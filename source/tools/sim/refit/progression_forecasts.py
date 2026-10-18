import hashlib
import json
import sys
import time
from pathlib import Path

from count_profile_prospective import MODEL, append_snapshot, forecasts_of, schema_of
from progression_score import same_model_ledger, score_progression
from prospective import validate_inputs


ROOT = Path(__file__).resolve().parents[3]
ARCHIVE = ROOT / 'analysis/archive/personal-bots'
OUTPUT = ROOT / 'analysis/personal-bots'
LEDGER = OUTPUT / 'progression-prospective-forecasts.json'


def freeze():
    inputs_file = ARCHIVE / 'progression-profile-input.json'
    raw = inputs_file.read_bytes()
    inputs = json.loads(raw)
    data = json.loads((ROOT / inputs['historicalDataFile']).read_text(encoding='utf-8'))
    validate_inputs(inputs, {'featureSchema': schema_of(data)})
    if inputs['scope'] != 'first-clear-progression-v1' or inputs['measurementFingerprint'] != data['fingerprint']:
        raise ValueError('Progression forecast protocol differs from its pinned measurement')
    earlier = json.loads(LEDGER.read_text(encoding='utf-8')) if LEDGER.exists() else []
    coverage = [{**row, 'upcoming': True} for snapshot in earlier if snapshot.get('model') == MODEL
                for row in snapshot['forecasts'] if row['name'] in inputs['targets']
                and row['lv'] in inputs['targets'][row['name']]['levels'] and row['version'] == inputs['targets'][row['name']]['version']]
    forecasts, training_through = forecasts_of(data, inputs, coverage)
    validate_inputs(inputs, {'featureSchema': schema_of(data)})
    if inputs_file.read_bytes() != raw:
        raise ValueError('Progression inputs changed during freezing')
    snapshot = {'frozenAt': int(time.time() * 1000), 'inputsFrozenAt': inputs['inputsFrozenAt'],
                'scope': inputs['scope'], 'model': MODEL, 'progressionStartLevels': inputs['progressionStartLevels'],
                'fingerprint': inputs['fingerprint'], 'inputsSha256': hashlib.sha256(raw).hexdigest(),
                'trainingCompletedThrough': training_through, 'featureSchema': inputs['featureSchema'], 'forecasts': forecasts,
                'note': 'User clarified that new/recent first-clear progression, not replay performance, must meet 80%. This extends the same model version and preserves earlier numeric ledgers and their eligible new-level misses; it does not reset its cohort clock. The predictor uses its pinned measured engine, not the unvalidated newer physical-tap research actor. Already-opened campaigns are useful diagnostic predictions only, not clean pre-start evidence. Replays never contribute to the primary pass gate.'}
    append_snapshot(LEDGER, snapshot)
    for name, first in inputs['progressionStartLevels'].items():
        rows = sorted([row for row in forecasts if row['name'] == name], key=lambda row: row['lv'])[:3]
        if rows:
            print(name, [(row['lv'], row['predictedAttempt']) for row in rows])
    print('Frozen', len(forecasts), 'new-progression forecasts at', snapshot['frozenAt'])


def score():
    ledger = json.loads(LEDGER.read_text(encoding='utf-8'))
    earlier = json.loads((OUTPUT / 'count-profile-prospective-forecasts.json').read_text(encoding='utf-8'))
    episodes = json.loads((ARCHIVE / 'prospective-outcomes.json').read_text(encoding='utf-8'))
    combined = same_model_ledger(ledger, earlier)
    report = score_progression(combined, episodes, ledger[0]['progressionStartLevels'])
    report['model'] = ledger[0]['model']
    report['note'] = 'Earlier same-model new-progression forecasts and misses remain in the primary cohort. Adding progression coverage or clarifying replay exclusions never resets the earliest same-model freeze.'
    (OUTPUT / 'progression-prospective-results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'scope': report['scope'], 'cohort': report['cohort'], 'targetMet': report['targetMet']}, indent=2))


if __name__ == '__main__':
    score() if len(sys.argv) > 1 and sys.argv[1] == 'score' else freeze()
