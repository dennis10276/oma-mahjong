import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from attempt_count_fit import NAMES, FACTORIES, accuracy, best_prediction, best_prediction_with_tail, completed_before, own_mode
from attempt_hazard import contextual_distribution


ROOT = Path(__file__).resolve().parents[3]
ARCHIVE = ROOT / 'analysis/archive/personal-bots'
OUTPUT = ROOT / 'analysis/personal-bots/kind-count-evaluation.json'


def distribution_of(chain):
    previous = 0.0
    result = {}
    for attempt, within in enumerate(chain['within'], 1):
        result[attempt] = within - previous
        previous = within
    return result


def main():
    experiment = 'match' if '--match' in sys.argv else 'clock' if '--clock' in sys.argv else 'inspection' if '--inspection' in sys.argv else 'goal' if '--goal' in sys.argv else 'kind'
    dataset = json.loads((ARCHIVE / (experiment + '-count-data.json')).read_text(encoding='utf-8'))
    rows = dataset['rows']
    variants = {mode: [{**row, 'chain': row[mode + 'Chain']} for row in rows] for mode in ['control', 'context']}
    targets = [row for row in rows if row['firstAttempt'] == 1 and row['wonOn'] is not None]
    comparisons = set(dataset['comparisonEpisodes'])
    scored = []
    for target in targets:
        before = completed_before(rows, target['start'])
        if sum(row['name'] == target['name'] for row in before) < 6:
            continue
        predictions = {'alwaysFirst': 1, 'ownMode': own_mode(before, target)}
        if experiment == 'goal':
            if not target.get('beforeFixChain'):
                raise ValueError('A fixed before-clock-fix comparison is missing')
            distribution = distribution_of(target['beforeFixChain'])
            predictions['beforeClockFixRaw'] = best_prediction_with_tail(distribution, max(0, 1 - sum(distribution.values())), max(distribution) + 1)
        tails = {}
        for mode in ['control', 'context']:
            distribution = distribution_of(target[mode + 'Chain'])
            predictions[mode + 'Raw'] = best_prediction_with_tail(distribution, max(0, 1 - sum(distribution.values())), max(distribution) + 1)
            calibrated, tails[mode] = contextual_distribution(variants[mode], {**target, 'chain': target[mode + 'Chain']})
            predictions[mode + 'Calibrated'] = best_prediction_with_tail(calibrated, tails[mode], max(calibrated) + 1)
            classifier = FACTORIES['forest']()
            training = [row['features'][:-4] if mode == 'control' else row['features'] for row in before]
            classifier.fit(training, [row['wonOn'] for row in before])
            features = target['features'][:-4] if mode == 'control' else target['features']
            probabilities = classifier.predict_proba([features])[0]
            predictions[mode + 'Forest'] = best_prediction({int(attempt): float(probability) for attempt, probability in zip(classifier.classes_, probabilities)})
        scored.append({key: target[key] for key in ['name', 'lv', 'start', 'end', 'wonOn', 'board', 'modelAvailable']} |
                      {'predictions': predictions, 'beyond20': tails})
    methods = list(scored[0]['predictions'])
    held = [row for row in scored if row['name'] + '|' + str(row['start']) in comparisons]
    players = {}
    for name in NAMES:
        testing = [row for row in held if row['name'] == name]
        cutoff = min(row['start'] for row in testing)
        development = [row for row in scored if row['name'] == name and row['end'] < cutoff]
        chosen = max(methods, key=lambda method: accuracy(development, method)['accuracy']) if development else 'alwaysFirst'
        players[name] = {'selectedBeforeTest': chosen, 'selectedScore': accuracy(testing, chosen),
                         'methods': {method: accuracy(testing, method) for method in methods}}
    report = {'evaluatedAt': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory',
              'experiment': experiment, 'controlLabel': 'clock-corrected context actor' if experiment != 'kind' else 'coarse habit actor',
              'candidateLabel': 'personal fatal error despite known tray match' if experiment == 'match' else 'personal clock-planning onset' if experiment == 'clock' else 'personal novel inspection before visible match' if experiment == 'inspection' else 'visible clock/key goal residual' if experiment == 'goal' else 'visible-context move types',
              'measurementFingerprint': dataset['fingerprint'], 'simulationRuns': dataset['runs'],
              'comparison': 'Same 80 episodes as the previous count report; later L53 completion is not added to this test window.',
              'coverage': {'episodes': len(rows), 'heldOutEpisodes': len(held), 'contextActiveInHeldOut': sum(row['modelAvailable'] for row in held)},
              'heldOut': {method: accuracy(held, method) for method in methods}, 'players': players,
              'contextAvailablePeriod': {method: accuracy([row for row in held if row['modelAvailable']], method) for method in methods},
              'targetMet': False, 'note': ('Clock-corrected context choices and learned visible key/clock preferences are compared with a pinned pre-fix baseline. '
                                          if experiment == 'goal' else 'Personal inspection rates use strictly earlier available replay chunks and a leave-person-out family prior. '
                                          if experiment == 'inspection' else 'Clock-planning onset uses clock-loss mechanisms in strictly earlier available recordings, not target outcomes. '
                                          if experiment == 'clock' else 'Visible-match error rates use earlier human physical choices, excluding automatic actions and unknown matching pictures. '
                                          if experiment == 'match' else 'A repaired unseen-tile policy and visible-context move types are compared. ')
                                         + 'Historical accuracy cannot establish the frozen prospective goal.'}
    (OUTPUT.parent / (experiment + '-count-evaluation.json')).write_text(json.dumps(report, indent=2), encoding='utf-8')
    (ARCHIVE / (experiment + '-count-scored.json')).write_text(json.dumps(scored), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
