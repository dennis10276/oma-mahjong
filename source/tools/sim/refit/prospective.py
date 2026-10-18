import json
import sys
import time
import hashlib
from pathlib import Path

import numpy as np

from attempt_count_fit import FACTORIES, SCORING_RULE, accuracy, best_prediction, best_prediction_with_tail, completed_before, own_mode, survival_predictions, is_correct
from attempt_hazard import contextual_distribution


ROOT = Path(__file__).resolve().parents[3]
ARCHIVE = ROOT / 'analysis/archive/personal-bots'
OUTPUT = ROOT / 'analysis/personal-bots'
LEDGER = OUTPUT / 'prospective-forecasts.json'


def candidate_predictions(before, target, observations=None):
    result = {'alwaysFirst': 1, 'ownMode': own_mode(before, target),
              'personalHazards': best_prediction_with_tail({index + 1: value for index, value in enumerate(target['distribution'])},
                  max(0, 1 - sum(target['distribution'])), len(target['distribution']) + 1)}
    distribution, beyond_twenty = contextual_distribution(observations if observations is not None else before, target)
    result['contextualHazards'] = best_prediction_with_tail(distribution, beyond_twenty, max(distribution) + 1)
    for mode, chain in target['extraChains'].items():
        previous = 0.0
        masses = {}
        for index, within in enumerate(chain['within']):
            masses[index + 1] = within - previous
            previous = within
        masses[len(chain['within']) + 1] = 1 - previous
        result['policy_' + mode] = best_prediction(masses)
    for mode, chain in target.get('retryChains', {}).items():
        previous = 0.0
        masses = {}
        for index, within in enumerate(chain['within']):
            masses[index + 1] = within - previous
            previous = within
        masses[len(chain['within']) + 1] = 1 - previous
        result['retry_' + mode] = best_prediction(masses)
    for mode, chain in target.get('memoryChains', {}).items():
        previous = 0.0
        masses = {}
        for index, within in enumerate(chain['within']):
            masses[index + 1] = within - previous
            previous = within
        masses[len(chain['within']) + 1] = 1 - previous
        result['memory_' + mode] = best_prediction(masses)
    training = np.asarray([row['features'] for row in before], dtype=float)
    labels = np.asarray([row['wonOn'] for row in before], dtype=int)
    ensemble = {}
    for method, factory in FACTORIES.items():
        if len(np.unique(labels)) == 1:
            result[method] = int(labels[0])
            ensemble[int(labels[0])] = ensemble.get(int(labels[0]), 0) + 1
            continue
        classifier = factory()
        classifier.fit(training, labels)
        probabilities = classifier.predict_proba([target['features']])[0]
        masses = {int(attempt): float(probability) for attempt, probability in zip(classifier.classes_, probabilities)}
        result[method] = best_prediction(masses)
        for attempt, probability in masses.items():
            ensemble[attempt] = ensemble.get(attempt, 0) + probability
    result['ensemble'] = best_prediction(ensemble)
    result.update(survival_predictions(before, target))
    return result


def freeze():
    inputs = json.loads((ARCHIVE / 'prospective-input.json').read_text(encoding='utf-8'))
    data = json.loads((ARCHIVE / 'attempt-count-data.json').read_text(encoding='utf-8'))
    evaluation = json.loads((OUTPUT / 'attempt-count-evaluation.json').read_text(encoding='utf-8'))
    validate_inputs(inputs, data)
    before = completed_before(data['rows'], inputs['inputsFrozenAt'])
    forecasts = []
    for row in inputs['rows']:
        predictions = candidate_predictions(before, row, data['rows'])
        scores = evaluation['players'][row['name']]['allMethodsHeldOut']
        eligible = {method: score for method, score in scores.items() if method in predictions}
        selected = max(eligible, key=lambda method: eligible[method]['accuracy'])
        forecasts.append({'name': row['name'], 'lv': row['lv'], 'version': row['version'], 'board': row['board'],
                          'predictedAttempt': predictions[selected], 'selectedModel': selected, 'alternatives': predictions})
    frozen_at = int(time.time() * 1000)
    ledger = json.loads(LEDGER.read_text(encoding='utf-8')) if LEDGER.exists() else []
    ledger.append({'frozenAt': frozen_at, 'inputsFrozenAt': inputs['inputsFrozenAt'], 'fingerprint': inputs['fingerprint'],
                   'note': 'Each confirmed new replay starts at attempt 1, as requested by the user. Predictions and tolerance bands use replay-local counts; retained app counters are diagnostic only.',
                   'forecasts': forecasts})
    LEDGER.write_text(json.dumps(ledger, indent=2), encoding='utf-8')
    for forecast in forecasts:
        print(f"Frozen {forecast['name']} L{forecast['lv']}: try {forecast['predictedAttempt']} ({forecast['selectedModel']})")


def validate_inputs(inputs, data):
    if inputs.get('featureSchema') != data.get('featureSchema') or not inputs.get('featureSchema'):
        raise ValueError('Forecast and training feature schemas differ; rebuild prospective inputs')
    digest = hashlib.sha256()
    for relative in inputs.get('fingerprintFiles', []):
        target = (ROOT / relative).resolve()
        if not target.is_relative_to(ROOT):
            raise ValueError('Fingerprint path escapes the source directory')
        digest.update(target.read_bytes())
    if not inputs.get('fingerprintFiles') or digest.hexdigest() != inputs['fingerprint']:
        raise ValueError('Forecast inputs are stale; rebuild before freezing')


def eligible_forecast(ledger, episode, after=None):
    candidates = []
    for snapshot in ledger:
        if snapshot['frozenAt'] >= episode['start'] or (after is not None and snapshot['frozenAt'] <= after):
            continue
        for forecast in snapshot['forecasts']:
            if all(forecast[key] == episode[key] for key in ['name', 'lv', 'board']):
                candidates.append((snapshot['frozenAt'], forecast))
    return min(candidates, key=lambda item: item[0]) if candidates else None


def score_ledger(ledger, episodes):
    scored = []
    matches = {}
    last_matches = {}
    for episode in sorted(episodes, key=lambda row: row['start']):
        if episode['firstAttempt'] != 1 or not episode.get('openingRecorded', False):
            continue
        key = (episode['name'], episode['lv'], episode['board'])
        matched = eligible_forecast(ledger, episode, last_matches.get(key))
        if matched:
            frozen_at, forecast = matched
            last_matches[key] = episode['end']
            matches[(episode['name'], episode['start'])] = matched
            if episode['wonOn'] is None:
                continue
            scored.append({**episode, 'frozenAt': frozen_at, 'predictedAttempt': forecast['predictedAttempt'],
                           'correct': is_correct(forecast['predictedAttempt'], episode['wonOn'])})
    players = {}
    cohort = {}
    anchor = min(snapshot['frozenAt'] for snapshot in ledger) if ledger else None
    for name in ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda']:
        rows = [row for row in scored if row['name'] == name]
        players[name] = accuracy([{'wonOn': row['wonOn'], 'predictions': {'primary': row['predictedAttempt']}} for row in rows], 'primary')
        opened = sorted([row for row in episodes if row['name'] == name and anchor is not None and row['start'] > anchor], key=lambda row: row['start'])[:20]
        completed = [row for row in opened if row['wonOn'] is not None]
        eligible = [row for row in opened if (name, row['start']) in matches]
        correct = sum(row['wonOn'] is not None and (name, row['start']) in matches
                      and is_correct(matches[(name, row['start'])][1]['predictedAttempt'], row['wonOn']) for row in opened)
        cohort[name] = {'opened': len(opened), 'completed': len(completed), 'eligibleFrozenForecasts': len(eligible),
                        'correct': correct, 'accuracy': correct / 20 if len(completed) == 20 else None,
                        'pending': len(opened) - len(completed), 'missingForecastsOrOpening': len(opened) - len(eligible)}
    report = {'evidence': 'prospective-frozen', 'attemptMetric': 'episode-relative', 'scoringRule': SCORING_RULE,
              'players': players, 'scored': scored,
              'cohortStartsAfter': anchor, 'cohortRule': 'First 20 opened episodes per person after the first freeze, including unfinished or unforecasted episodes.',
              'cohort': cohort, 'targetMet': all(value['opened'] == 20 and value['completed'] == 20
                                               and value['eligibleFrozenForecasts'] == 20 and value['accuracy'] >= 0.8 for value in cohort.values())}
    return report


def score():
    ledger = json.loads(LEDGER.read_text(encoding='utf-8'))
    episodes = json.loads((ARCHIVE / 'prospective-outcomes.json').read_text(encoding='utf-8'))
    report = score_ledger(ledger, episodes)
    (OUTPUT / 'prospective-results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'score':
        score()
    else:
        freeze()
