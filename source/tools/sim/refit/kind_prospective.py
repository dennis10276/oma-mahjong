import json
import sys
import time
from pathlib import Path

from attempt_count_fit import FACTORIES, best_prediction, best_prediction_with_tail, completed_before
from kind_count_fit import distribution_of
from prospective import validate_inputs, score_ledger


ROOT = Path(__file__).resolve().parents[3]
ARCHIVE = ROOT / 'analysis/archive/personal-bots'
OUTPUT = ROOT / 'analysis/personal-bots'
LEDGER = OUTPUT / 'kind-prospective-forecasts.json'


def freeze():
    inputs = json.loads((ARCHIVE / 'kind-prospective-input.json').read_text(encoding='utf-8'))
    data = json.loads((ARCHIVE / 'kind-count-data.json').read_text(encoding='utf-8'))
    validate_inputs(inputs, {'featureSchema': {'version': 'kind-count-v1', 'columns': len(data['rows'][0]['features'])}})
    previous = completed_before(data['rows'], inputs['inputsFrozenAt'])
    classifier = FACTORIES['forest']()
    classifier.fit([row['features'] for row in previous], [row['wonOn'] for row in previous])
    forecasts = []
    for row in inputs['rows']:
        probabilities = classifier.predict_proba([row['features']])[0]
        distribution = {int(attempt): float(probability) for attempt, probability in zip(classifier.classes_, probabilities)}
        predicted = best_prediction(distribution)
        forecasts.append({key: row[key] for key in ['name', 'lv', 'version', 'board', 'priorCounter']} |
                         {'predictedAttempt': predicted, 'predictedDisplayedAttempt': row['priorCounter'] + predicted,
                          'selectedModel': 'honestContextForest-v1', 'distribution': distribution,
                          'alternatives': {'alwaysFirst': 1,
                              **{mode + 'Raw': best_prediction_with_tail(distribution_of(row[mode + 'Chain']),
                                  max(0, 1 - row[mode + 'Chain']['within'][-1]), len(row[mode + 'Chain']['within']) + 1)
                                 for mode in ['context', 'control']}}})
    snapshot = {'frozenAt': int(time.time() * 1000), 'inputsFrozenAt': inputs['inputsFrozenAt'],
                'fingerprint': inputs['fingerprint'], 'model': 'honestContextForest-v1',
                'note': 'Separate predeclared repaired-bot cohort. All primary forecasts use the same context-feature forest. Each new replay starts at attempt 1; predictions and tolerance bands use replay-local counts, as requested by the user. Frozen displayed predictions are diagnostic only.',
                'forecasts': forecasts}
    ledger = json.loads(LEDGER.read_text(encoding='utf-8')) if LEDGER.exists() else []
    ledger.append(snapshot)
    LEDGER.write_text(json.dumps(ledger, indent=2), encoding='utf-8')
    print('Frozen', len(forecasts), 'repaired-bot forecasts at', snapshot['frozenAt'])


def score():
    ledger = json.loads(LEDGER.read_text(encoding='utf-8'))
    episodes = json.loads((ARCHIVE / 'prospective-outcomes.json').read_text(encoding='utf-8'))
    report = score_ledger(ledger, episodes)
    report['model'] = 'honestContextForest-v1'
    report['note'] = 'This repaired-bot cohort is separate from the earlier prototype; its forecasts cannot replace earlier failed predictions retrospectively.'
    (OUTPUT / 'kind-prospective-results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    score() if len(sys.argv) > 1 and sys.argv[1] == 'score' else freeze()
