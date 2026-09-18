"""Run the shared Jev rubric on JSONL. Dry-run by default; --execute authorizes paid requests."""
import argparse
import json
import math
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.request
from metrics import report

ROOT = Path(__file__).resolve().parents[1]
RUBRIC = json.loads((ROOT / 'shared/rubric.json').read_text(encoding='utf-8'))
KEYS = tuple(RUBRIC['questions'])


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


OPENER = urllib.request.build_opener(NoRedirect())


def load(path):
    rows, ids = [], set()
    for line_no, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
        if not line.strip():
            continue
        row = json.loads(line)
        if not isinstance(row, dict) or not isinstance(row.get('id'), str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}', row['id']) or row['id'] in ids:
            raise ValueError(f'Invalid/duplicate id on line {line_no}')
        if not isinstance(row.get('text'), str) or not 3 <= len(row['text']) <= 6000 or not isinstance(row.get('interests'), str) or len(row['interests']) > 400:
            raise ValueError(f'Invalid text/interests on line {line_no}')
        labels = row.get('labels', {})
        if not isinstance(labels, dict) or any(k not in KEYS or type(y) is not int or y not in (0, 1) for k, y in labels.items()):
            raise ValueError(f'Invalid labels on line {line_no}')
        row['labels'] = labels
        rows.append(row)
        ids.add(row['id'])
    if not rows:
        raise ValueError('Empty dataset')
    return rows


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('dataset', type=Path)
    p.add_argument('--execute', action='store_true')
    p.add_argument('--repeat', type=int, default=1)
    p.add_argument('--model', default=RUBRIC['model'])
    p.add_argument('--output', type=Path, default=ROOT / 'eval/results.jsonl')
    p.add_argument('--input-usd-per-million', type=float, help='Optional verified price; no price assumption is baked into the tool.')
    args = p.parse_args()
    if not 1 <= args.repeat <= 20:
        p.error('--repeat must be 1–20')
    if args.input_usd_per_million is not None and (not math.isfinite(args.input_usd_per_million) or args.input_usd_per_million < 0):
        p.error('Invalid price')
    try:
        rows = load(args.dataset)
    except (ValueError, OSError) as exc:
        p.error(str(exc))
    print(f'{len(rows)} examples × {args.repeat} repetitions = {len(rows) * args.repeat} requests, model {args.model}.')
    if not args.execute:
        print('DRY RUN: dataset validated. No network calls. Add --execute to spend Jev credits.')
        return
    key = os.getenv('JEV_API_KEY', '')
    if not key:
        p.error('Set JEV_API_KEY in the environment; never place it in the dataset or command arguments.')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    records = []
    # Exclusive creation prevents accidentally destroying earlier measurements.
    with args.output.open('x', encoding='utf-8') as output:
        for repeat in range(args.repeat):
            for row in rows:
                post = {'text': row['text'], **{k: row.get(k) is True for k in ('has_link', 'has_media', 'truncated')}}
                payload = {'model': args.model, 'state': {'post': post, 'reader_interests': row['interests']},
                           'questions': {k: {**q, 'instructions': RUBRIC['preamble'] + q['instructions']} for k, q in RUBRIC['questions'].items()}}
                record = {'id': row['id'], 'repeat': repeat, 'labels': row['labels'], 'rubric_version': RUBRIC['version']}
                started = time.perf_counter()
                try:
                    request = urllib.request.Request('https://api.typesafe.ai/v1/systemone', data=json.dumps(payload).encode(),
                        headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}, method='POST')
                    # No retries: each record corresponds to exactly one attempted request.
                    with OPENER.open(request, timeout=30) as response:
                        body = json.load(response)
                    metrics = {}
                    for k in KEYS:
                        answer = body['answers'][k]
                        value = answer['noul']
                        if answer['type'] != 'noul' or type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 1:
                            raise ValueError('Invalid response schema')
                        metrics[k] = value
                    tokens = body['usage']['input_tokens']
                    if type(tokens) is not int or tokens < 0 or not isinstance(body['model'], str):
                        raise ValueError('Invalid usage/model')
                    record.update(metrics=metrics, model=body['model'], input_tokens=tokens)
                except urllib.error.HTTPError as exc:
                    record['error'] = 'HTTP_' + str(exc.code)
                except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError, TypeError):
                    record['error'] = 'NETWORK_OR_SCHEMA_ERROR'
                record['latency_ms'] = round((time.perf_counter() - started) * 1000, 2)
                records.append(record)
                output.write(json.dumps(record) + '\n')
                output.flush()
                print(f"{len(records)}/{len(rows) * args.repeat} {row['id']}: {record.get('error', 'ok')}")
    summary = report(records, KEYS)
    summary.update(model_requested=args.model, rubric_version=RUBRIC['version'])
    if args.input_usd_per_million is not None:
        summary['estimated_input_usd_successful_calls_only'] = summary['input_tokens'] / 1_000_000 * args.input_usd_per_million
    result_path = args.output.with_suffix('.report.json')
    result_path.write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
    print('Report:', result_path)
    if summary['failed_calls']:
        sys.exit(2)


if __name__ == '__main__':
    main()
