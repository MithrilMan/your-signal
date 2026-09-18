"""Dependency-free diagnostic metrics. Labels must be independently validated for research claims."""
import math
from statistics import mean


def binary_metrics(pairs):
    pairs = list(pairs)
    for p, y in pairs:
        if isinstance(p, bool) or not isinstance(p, (int, float)) or not math.isfinite(p) or not 0 <= p <= 1 or y not in (0, 1):
            raise ValueError('Expected finite probability and binary label.')
    if not pairs:
        return {'n': 0}
    accuracy = lambda values: mean(int(p >= .5) == y for p, y in values) if values else None
    ece = 0
    bins = []
    for i in range(10):
        group = [(p, y) for p, y in pairs if min(9, int(p * 10)) == i]
        if group:
            mp, my = mean(p for p, _ in group), mean(y for _, y in group)
            ece += len(group) / len(pairs) * abs(mp - my)
            bins.append({'lower': i / 10, 'n': len(group), 'mean_probability': mp, 'positive_rate': my})
    curve = []
    for margin in (0, .2, .5, .8, .95):
        selected = [(p, y) for p, y in pairs if abs(2 * p - 1) + 1e-12 >= margin]
        curve.append({'minimum_margin': margin, 'coverage': len(selected) / len(pairs), 'accuracy': accuracy(selected)})
    clipped = [(min(1 - 1e-15, max(1e-15, p)), y) for p, y in pairs]
    return {
        'n': len(pairs), 'accuracy_at_0_5': accuracy(pairs),
        'brier': mean((p - y) ** 2 for p, y in pairs),
        'log_loss': -mean(y * math.log(p) + (1 - y) * math.log(1 - p) for p, y in clipped),
        'ece_10_bins': ece, 'reliability_bins': bins, 'selective_curve': curve,
    }


def percentile(values, q):
    a = sorted(values)
    if not a:
        return None
    t = (len(a) - 1) * q
    i = math.floor(t)
    return a[i] + (a[min(i + 1, len(a) - 1)] - a[i]) * (t - i)


def report(rows, keys):
    good = [r for r in rows if 'metrics' in r]
    # Use the first successful repetition for accuracy: repeated calls are not independent examples.
    unique = {}
    for row in good:
        unique.setdefault(row['id'], row)
    dimensions = {k: binary_metrics((r['metrics'][k], r['labels'][k]) for r in unique.values() if k in r['labels']) for k in keys}
    stability = {}
    for k in keys:
        ranges, agreements = [], []
        for identifier in unique:
            values = [r['metrics'][k] for r in good if r['id'] == identifier]
            if len(values) > 1:
                ranges.append(max(values) - min(values))
                positives = sum(p >= .5 for p in values)
                agreements.append(max(positives, len(values) - positives) / len(values))
        stability[k] = {'repeated_examples': len(ranges), 'mean_probability_range': mean(ranges) if ranges else None,
                        'mean_majority_label_agreement': mean(agreements) if agreements else None}
    times = [r['latency_ms'] for r in good]
    return {'successful_calls': len(good), 'failed_calls': len(rows) - len(good), 'unique_examples': len(unique),
            'input_tokens': sum(r['input_tokens'] for r in good),
            'latency_ms': {f'p{int(q * 100)}': percentile(times, q) for q in (.5, .95, .99)},
            'dimensions': dimensions, 'stability': stability,
            'limitations': 'No confidence intervals. Raw margins are not calibrated accuracy. Supplied examples and labels are synthetic smoke fixtures, not a benchmark.'}
