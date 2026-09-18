# Jev evaluation harness

A dependency-free Python runner based on the same rubric as the app. It is a tool for starting reproducible measurements, not a validated benchmark or a multi-provider comparison.

## Getting started

```bash
python eval/run.py eval/examples.jsonl
# Dry run: validates the format and reports how many requests it would make.

# Set JEV_API_KEY in the environment, then explicitly authorize spending:
python eval/run.py eval/examples.jsonl --execute --repeat 3 --output eval/run-001.jsonl
```

`--execute` is required. The runner makes one request per example/repetition, with all five criteria in the same request and no automatic retries. Output never overwrites existing files. Use `--model` for a specific version. `--input-usd-per-million` accepts a price you have verified; no potentially stale rate is hard-coded.

If some requests fail, results remain on disk and the exit code is 2. Errors record only the category/status, not responses containing data or credentials. The runner rejects redirects. Text is sent to the TypeSafe endpoint; use only data you are authorized to transfer.

## JSONL dataset format

```json
{"id":"example-001","text":"Post text","interests":"Software engineering","labels":{"relevance":1,"substance":0,"actionable":0,"promotion":0,"bait":0}}
```

IDs must be unique; text must contain 3–6,000 characters; interests are limited to 400 characters. `has_link`, `has_media`, and `truncated` are optional booleans. Labels are 0/1 integers; labeling only some criteria is allowed. Do not put the key in the dataset.

The included fixtures are ten invented examples with illustrative labels. They are not an independent collection of human judgments. Some decisions are subjective and prompts may influence them: do not use these fixture outputs as promotional evidence of accuracy.

## Output and metrics

JSONL: ID, repetition, rubric, labels, five probabilities, actual model, tokens, latency or error. The text is not copied. The aggregate report includes accuracy at a 0.5 threshold, Brier score, log loss, ten-bin ECE, reliability bins, an accuracy/coverage curve over margin thresholds, p50/p95/p99, and stability across repetitions.

Accuracy uses the first successful repetition for each example, avoiding counting repeated requests as independent samples. Stability shows the mean probability range and agreement with the majority class across repetitions. ECE and quantiles over a small number of examples are extremely unstable; no uncertainty interval is included. The optional cost estimate covers only tokens from successful responses, not any failed attempts charged by the provider.

For serious calibration: use a corpus separate from prompt development; document permission to use it; employ independent annotators; document the rubric and disagreements; stratify by language, length, and ambiguity; split without leakage; test paraphrases/injection; calculate bootstrap intervals grouped by post; and keep the holdout untouched. Also measure filter false negatives and the frequency of “Show anyway” actions only with participant approval.

The report can be reused offline: `metrics.report(records, keys)` does not depend on Jev. Adding other providers requires an adapter that produces the same format and documentation of the differences; this is not implemented in this version.
