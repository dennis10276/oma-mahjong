import hashlib
import json
import os
import sys
import time
from pathlib import Path

import sklearn

from attempt_count_fit import FACTORIES, NAMES, best_prediction, best_prediction_with_tail, completed_before
from board_recall_eval import recalled_prediction
from personal_count_fit import features_of, predictive_distribution
from prospective import validate_inputs, score_ledger


ROOT = Path(__file__).resolve().parents[3]
ARCHIVE = ROOT / 'analysis/archive/personal-bots'
OUTPUT = ROOT / 'analysis/personal-bots'
LEDGER = OUTPUT / 'count-profile-prospective-forecasts.json'
MODEL = 'countProfileRecallForest-v1'


def schema_of(data):
    profiles = list(data['profiles'])
    columns = len(features_of(data['rows'], data['rows'][0], profiles, data['runs'])[1])
    return {'version': 'count-profile-v1', 'profiles': profiles, 'columns': columns}


def validate_coverage(forecasts, earlier=()):
    for name in NAMES:
        upcoming = {row['lv'] for row in [*forecasts, *earlier] if row['name'] == name and row['upcoming']}
        if len(upcoming) < 20:
            raise ValueError('Each person needs at least twenty predeclared upcoming targets')


def forecasts_of(data, inputs, coverage=()):
    profiles, cutoff = list(data['profiles']), inputs['inputsFrozenAt']
    before = completed_before(data['rows'], cutoff)
    if any(sum(row['name'] == name for row in before) < 6 for name in NAMES):
        raise ValueError('Every modeled person needs earlier completed training episodes')
    classifier = FACTORIES['forest']()
    classifier.fit([features_of(data['rows'], row, profiles, data['runs'])[1] for row in before], [row['wonOn'] for row in before])
    forecasts = []
    identities = set()
    for row in inputs['rows']:
        if row['start'] != cutoff or row['firstAttempt'] != 1 or any(key in row for key in ['wonOn', 'end', 'assisted']):
            raise ValueError('Future inputs must not contain target outcomes or post-opening metadata')
        if list(row['chains']) != profiles:
            raise ValueError('Future actor profiles differ from the training schema')
        identity = (row['name'], row['lv'], row['board'])
        if identity in identities:
            raise ValueError('Duplicate forecast identity')
        identities.add(identity)
        features = features_of(data['rows'], row, profiles, data['runs'])[1]
        probabilities = classifier.predict_proba([features])[0]
        distribution = {int(attempt): float(probability) for attempt, probability in zip(classifier.classes_, probabilities)}
        forest_prediction = best_prediction(distribution)
        predicted, own_matches = recalled_prediction(data['rows'], row, forest_prediction)
        mixture, tail, weights, availability, components = predictive_distribution(data['rows'], row, profiles, data['runs'])
        forecasts.append({key: row[key] for key in ['name', 'lv', 'version', 'board', 'priorCounter', 'upcoming']} |
                         {'predictedAttempt': predicted, 'predictedDisplayedAttempt': row['priorCounter'] + predicted,
                          'selectedModel': MODEL, 'forestDistribution': distribution, 'ownBoardMatches': own_matches,
                          'profileWeights': weights, 'profileTrainingAvailability': availability, 'mixtureBeyond128': tail,
                          'alternatives': {'alwaysFirst': 1, 'profileForest': forest_prediction,
                                           'personalMixture': best_prediction_with_tail(mixture, tail, 129),
                                           'baselineSmoothed': best_prediction_with_tail(*components['baseline'], 129)}})
    validate_coverage(forecasts, coverage)
    return forecasts, max(row['end'] for row in before)


def append_snapshot(ledger_path, snapshot):
    lock_path = ledger_path.with_suffix('.lock')
    lock = lock_path.open('x', encoding='utf-8')
    try:
        ledger = json.loads(ledger_path.read_text(encoding='utf-8')) if ledger_path.exists() else []
        if any(row.get('fingerprint') == snapshot['fingerprint'] and row.get('inputsFrozenAt') == snapshot['inputsFrozenAt'] for row in ledger):
            raise ValueError('These forecast inputs have already been frozen')
        updated = ledger + [snapshot]
        temporary = ledger_path.with_suffix('.tmp')
        with temporary.open('w', encoding='utf-8') as stream:
            json.dump(updated, stream, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, ledger_path)
    finally:
        lock.close()
        lock_path.unlink()


def freeze():
    data_file = ARCHIVE / 'count-profile-data.json'
    inputs_file = ARCHIVE / 'count-profile-prospective-input.json'
    data = json.loads(data_file.read_text(encoding='utf-8'))
    inputs = json.loads(inputs_file.read_text(encoding='utf-8'))
    schema = schema_of(data)
    validate_inputs(inputs, {'featureSchema': schema})
    if inputs['measurementFingerprint'] != data['fingerprint'] or inputs['runs'] != data['runs'] or inputs['attempts'] != data['attempts']:
        raise ValueError('Forecast and training measurement protocols differ')
    forecasts, training_through = forecasts_of(data, inputs)
    validate_inputs(inputs, {'featureSchema': schema})
    snapshot = {'frozenAt': int(time.time() * 1000), 'inputsFrozenAt': inputs['inputsFrozenAt'],
                'fingerprint': inputs['fingerprint'], 'measurementFingerprint': data['fingerprint'],
                'inputsSha256': hashlib.sha256(inputs_file.read_bytes()).hexdigest(),
                'model': MODEL, 'trainingCompletedThrough': training_through, 'sklearnVersion': sklearn.__version__,
                'featureSchema': schema, 'forecasts': forecasts,
                'note': 'Separate experimental cohort, selected using past exploratory development only. Primary model is fixed before future outcomes. '
                        'Each new replay starts at local try 1; tolerance uses local counts. Displayed predictions are diagnostic only. '
                        'Earlier prototype/context forecasts are never replaced. First twenty opened episodes per person remain the pass cohort, including missing forecasts and unfinished hard games. '
                        'Previously played fixed-board replay targets supplement at least twenty upcoming levels; this is not evidence of 80% success.'}
    append_snapshot(LEDGER, snapshot)
    print('Frozen', len(forecasts), 'experimental profile forecasts at', snapshot['frozenAt'])
    for name in NAMES:
        first = min((row for row in forecasts if row['name'] == name and row['upcoming']), key=lambda row: row['lv'])
        print(name, 'L' + str(first['lv']) + ': local try', first['predictedAttempt'])


def score():
    ledger = json.loads(LEDGER.read_text(encoding='utf-8'))
    episodes = json.loads((ARCHIVE / 'prospective-outcomes.json').read_text(encoding='utf-8'))
    report = score_ledger(ledger, episodes)
    report['model'] = MODEL
    report['note'] = 'Experimental profile cohort only; no earlier failed prediction can be replaced, and alternatives never determine the pass gate.'
    (OUTPUT / 'count-profile-prospective-results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    score() if len(sys.argv) > 1 and sys.argv[1] == 'score' else freeze()
