import importlib.util
from pathlib import Path
import pytest
spec=importlib.util.spec_from_file_location('oya_metrics',Path(__file__).resolve().parents[1]/'metrics.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def test_perfect():
    r=m.binary_metrics([(0,0),(1,1)])
    assert r['brier']==0 and r['ece_10_bins']==0 and r['accuracy_at_0_5']==1

def test_uncertain():
    r=m.binary_metrics([(.5,0),(.5,1)])
    assert r['brier']==.25 and r['accuracy_at_0_5']==.5
    assert r['selective_curve'][-1]['coverage']==0 and r['selective_curve'][-1]['accuracy'] is None

def test_invalid():
    with pytest.raises(ValueError):m.binary_metrics([(float('nan'),1)])
    with pytest.raises(ValueError):m.binary_metrics([(True,1)])

def test_empty():
    assert m.binary_metrics([])=={'n':0}

def test_percentile():
    assert m.percentile([1,2,3],.5)==2
    assert m.percentile([],.99) is None

def test_repetitions_not_independent_examples():
    rows=[{'id':'a','metrics':{'x':p},'labels':{'x':1},'latency_ms':10,'input_tokens':100} for p in [.9,.2,.8]]
    r=m.report(rows,['x'])
    assert r['dimensions']['x']['n']==1 and r['dimensions']['x']['accuracy_at_0_5']==1
    assert r['stability']['x']['mean_majority_label_agreement']==pytest.approx(2/3)
