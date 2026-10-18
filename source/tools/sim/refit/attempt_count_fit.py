import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sklearn.ensemble import ExtraTreesClassifier, HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from attempt_hazard import contextual_distribution


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'analysis/archive/personal-bots/attempt-count-data.json'
OUTPUT = ROOT / 'analysis/personal-bots/attempt-count-evaluation.json'
NAMES = ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda']
SCORING_RULE = {'id': 'attempt-tolerance-and-8plus-v2',
                'toleranceByActualAttempt': {'1-3': 0, '4-5': 1, '6+': 2},
                'sharedSuccessBucketMinimum': 8, 'combination': 'within-tolerance-or-both-8plus'}
FACTORIES = {
    'forest': lambda: RandomForestClassifier(n_estimators=64, max_depth=5, min_samples_leaf=3, random_state=1610, n_jobs=1),
    'extraTrees': lambda: ExtraTreesClassifier(n_estimators=64, max_depth=6, min_samples_leaf=3, random_state=1610, n_jobs=1),
    'logistic': lambda: make_pipeline(StandardScaler(), LogisticRegression(C=0.3, max_iter=500)),
    'boosted': lambda: HistGradientBoostingClassifier(max_iter=60, max_depth=3, min_samples_leaf=8, l2_regularization=2, random_state=1610),
}
SURVIVAL_FACTORIES = {
    'survivalLogistic': lambda: make_pipeline(StandardScaler(), LogisticRegression(C=0.3, max_iter=500)),
    'survivalBoosted': lambda: HistGradientBoostingClassifier(max_iter=80, max_depth=3, min_samples_leaf=12, l2_regularization=3, random_state=1610),
    'survivalTrees': lambda: ExtraTreesClassifier(n_estimators=96, max_depth=7, min_samples_leaf=6, random_state=1610, n_jobs=1),
}


def attempt_tolerance(actual):
    return 2 if actual > 5 else 1 if actual > 3 else 0


def is_correct(predicted, actual):
    return (predicted >= 8 and actual >= 8) or abs(predicted - actual) <= attempt_tolerance(actual)


def best_prediction(probabilities):
    candidates = range(1, min(max(probabilities), 8) + 1)
    return max(candidates, key=lambda predicted: sum(probability for actual, probability in probabilities.items() if is_correct(predicted, actual)))


def best_prediction_with_tail(probabilities, tail, tail_starts_at):
    if (not math.isfinite(tail) or not 0 <= tail <= 1
            or any(not isinstance(actual, int) or actual < 1 or not math.isfinite(probability) or probability < 0
                   for actual, probability in probabilities.items())
            or abs(sum(probabilities.values()) + tail - 1) > 1e-9):
        raise ValueError('Invalid predictive attempt distribution or unresolved tail mass')
    if tail == 0:
        return best_prediction(probabilities)
    if not isinstance(tail_starts_at, int) or tail_starts_at < 10 or tail_starts_at <= max(probabilities, default=0):
        raise ValueError('A single8+ tail must be wholly beyond every lower prediction tolerance')
    return best_prediction({**probabilities, tail_starts_at: tail})


def accuracy(rows, method):
    correct = sum(is_correct(row['predictions'][method], row['wonOn']) for row in rows)
    count = len(rows)
    if not count:
        return {'n': 0, 'correct': 0, 'accuracy': None, 'wilson95': None}
    fraction = correct / count
    denominator = 1 + 1.96 ** 2 / count
    center = (fraction + 1.96 ** 2 / (2 * count)) / denominator
    radius = 1.96 * math.sqrt(fraction * (1 - fraction) / count + 1.96 ** 2 / (4 * count ** 2)) / denominator
    return {
        'n': count, 'correct': correct, 'accuracy': fraction,
        'exactAccuracy': sum(row['predictions'][method] == row['wonOn'] for row in rows) / count,
        'wilson95': [center - radius, center + radius],
        'meanAbsoluteError': sum(abs(row['predictions'][method] - row['wonOn']) for row in rows) / count,
    }


def own_mode(before, target):
    mine = sorted([row for row in before if row['name'] == target['name']], key=lambda row: row['end'])[-20:]
    counts = {1: 1.0}
    for age, row in enumerate(reversed(mine)):
        attempt = row['wonOn']
        counts[attempt] = counts.get(attempt, 0) + 0.5 ** (age / 20)
    return best_prediction(counts)


def completed_before(rows, opening):
    return [row for row in rows if row['end'] < opening and row['firstAttempt'] == 1 and row['wonOn'] is not None]


def attempt_features(row, attempt):
    conditional = row['chain']['cond']
    known = [value for value in conditional[:min(attempt, len(conditional))] if value is not None]
    raw = known[-1] if known else row['chain']['within'][0]
    extra = []
    for chain in [*row.get('extraChains', {}).values(), *row.get('retryChains', {}).values(), *row.get('memoryChains', {}).values()]:
        available = [value for value in chain['cond'][:min(attempt, len(chain['cond']))] if value is not None]
        extra.append(available[-1] if available else chain['within'][0])
    return row['features'] + extra + [attempt, math.log(attempt), raw, int(conditional[min(attempt, len(conditional)) - 1] is not None)]


def survival_predictions(before, target):
    training = np.asarray([attempt_features(row, attempt) for row in before for attempt in range(1, row['wonOn'] + 1)], dtype=float)
    labels = np.asarray([int(attempt == row['wonOn']) for row in before for attempt in range(1, row['wonOn'] + 1)], dtype=int)
    target_features = np.asarray([attempt_features(target, attempt) for attempt in range(1, 21)], dtype=float)
    result = {}
    for method, factory in SURVIVAL_FACTORIES.items():
        if len(np.unique(labels)) == 1:
            result[method] = 1
            continue
        classifier = factory()
        classifier.fit(training, labels)
        hazards = classifier.predict_proba(target_features)[:, list(classifier.classes_).index(1)]
        remaining = 1.0
        distribution = []
        for hazard in hazards:
            hazard = min(0.99, max(0.01, float(hazard)))
            distribution.append(remaining * hazard)
            remaining *= 1 - hazard
        result[method] = best_prediction_with_tail({index + 1: probability for index, probability in enumerate(distribution)}, remaining, len(distribution) + 1)
    return result


def main():
    dataset = json.loads(SOURCE.read_text(encoding='utf-8'))
    all_rows = sorted(dataset['rows'], key=lambda row: row['start'])
    complete = [row for row in all_rows if row['firstAttempt'] == 1 and row['wonOn'] is not None]
    person_cuts = {}
    for name in NAMES:
        personal = [row for row in complete if row['name'] == name]
        person_cuts[name] = personal[max(6, len(personal) - 20)]['start']
    cut = min(person_cuts.values())
    scored = []
    for target in complete:
        before = completed_before(complete, target['start'])
        if sum(row['name'] == target['name'] for row in before) < 6:
            continue
        predictions = {'alwaysFirst': 1, 'ownMode': own_mode(before, target),
                       'personalHazards': best_prediction_with_tail({index + 1: probability for index, probability in enumerate(target['distribution'])},
                           max(0, 1 - sum(target['distribution'])), len(target['distribution']) + 1)}
        contextual, contextual_tail = contextual_distribution(all_rows, target)
        predictions['contextualHazards'] = best_prediction_with_tail(contextual, contextual_tail, max(contextual) + 1)
        for mode, chain in target.get('extraChains', {}).items():
            previous = 0.0
            masses = {}
            for index, within in enumerate(chain['within']):
                masses[index + 1] = within - previous
                previous = within
            masses[len(chain['within']) + 1] = 1 - previous
            predictions['policy_' + mode] = best_prediction(masses)
        for mode, chain in target.get('retryChains', {}).items():
            previous = 0.0
            masses = {}
            for index, within in enumerate(chain['within']):
                masses[index + 1] = within - previous
                previous = within
            masses[len(chain['within']) + 1] = 1 - previous
            predictions['retry_' + mode] = best_prediction(masses)
        for mode, chain in target.get('memoryChains', {}).items():
            previous = 0.0
            masses = {}
            for index, within in enumerate(chain['within']):
                masses[index + 1] = within - previous
                previous = within
            masses[len(chain['within']) + 1] = 1 - previous
            predictions['memory_' + mode] = best_prediction(masses)
        training = np.asarray([row['features'] for row in before], dtype=float)
        labels = np.asarray([row['wonOn'] for row in before], dtype=int)
        ensemble = {}
        for method, factory in FACTORIES.items():
            if len(np.unique(labels)) == 1:
                predictions[method] = int(labels[0])
                continue
            classifier = factory()
            classifier.fit(training, labels)
            probabilities = classifier.predict_proba([target['features']])[0]
            predictions[method] = best_prediction({int(attempt): float(probability) for attempt, probability in zip(classifier.classes_, probabilities)})
            for attempt, probability in zip(classifier.classes_, probabilities):
                ensemble[int(attempt)] = ensemble.get(int(attempt), 0.0) + float(probability)
        predictions['ensemble'] = best_prediction(ensemble) if ensemble else int(labels[0])
        predictions.update(survival_predictions(before, target))
        earlier_scores = [row for row in scored if row['end'] < target['start'] and row['name'] == target['name']]
        candidates = list(predictions)
        selected = max(candidates, key=lambda method: sum(
            0.5 ** (age / 20) * is_correct(row['predictions'][method], row['wonOn'])
            for age, row in enumerate(reversed(earlier_scores))
        )) if earlier_scores else 'alwaysFirst'
        predictions['onlineSelection'] = predictions[selected]
        scored.append({key: target[key] for key in ['name', 'lv', 'version', 'board', 'start', 'end', 'wonOn', 'assisted', 'source']} |
                      {'predictions': predictions, 'onlineModel': selected, 'reference': target.get('reference'),
                       'contextualBeyond20': contextual_tail,
                       'learnedPolicyAvailable': target.get('learnedAvailable', False)})
        if len(scored) % 25 == 0:
            print(f'Exact-attempt test: {len(scored)} opening forecasts', flush=True)

    methods = list(scored[0]['predictions'])
    development = [row for row in scored if row['end'] < cut]
    held_out = [row for row in scored if row['start'] >= person_cuts[row['name']]]
    chosen = max(methods, key=lambda method: accuracy(development, method)['accuracy'])
    per_person = {}
    for name in NAMES:
        development_person = [row for row in scored if row['name'] == name and row['end'] < person_cuts[name]]
        selected = max(methods, key=lambda method: accuracy(development_person, method)['accuracy']) if development_person else chosen
        test_person = [row for row in held_out if row['name'] == name]
        per_person[name] = {'selectedBeforeTest': selected, 'heldOut': accuracy(test_person, selected),
                            'allMethodsHeldOut': {method: accuracy(test_person, method) for method in methods}}
    report = {
        'made': dataset['made'], 'evaluatedAt': datetime.now(timezone.utc).isoformat(),
        'evidence': 'historical-exploratory', 'scoringRule': SCORING_RULE,
        'goal': {'winningAttemptAccuracy': 0.8, 'minimumTestLevelsPerPerson': 20,
                 'toleranceByActualAttempt': SCORING_RULE['toleranceByActualAttempt'], 'sharedSuccessBucketMinimum': 8},
        'testStartsAt': cut, 'playerTestStartsAt': person_cuts, 'selectedBeforeTest': chosen,
        'coverage': {'measuredEpisodes': len(all_rows), 'completedFromFirstTry': len(complete),
                     'censored': sum(row['wonOn'] is None for row in all_rows),
                     'missingOpening': sum(row['firstAttempt'] != 1 for row in all_rows),
                     'assistedCompleted': sum(row['assisted'] for row in complete)},
        'development': {method: accuracy(development, method) for method in methods},
        'heldOut': {method: accuracy(held_out, method) for method in methods},
        'rolling': {method: accuracy(scored, method) for method in methods},
        'players': per_person,
        'difficultyBands': {
            band: {method: accuracy([row for row in held_out if row['reference'] is not None and lower <= row['reference']['strong'] < upper], method)
                   for method in methods}
            for band, lower, upper in [('hard', 0, 0.4), ('medium', 0.4, 0.8), ('easy', 0.8, 1.01)]
        },
        'learnedPolicyPeriod': {method: accuracy([row for row in held_out if row['learnedPolicyAvailable']], method) for method in methods},
        'historicalThresholdMet': all(person['heldOut']['n'] >= 20 and person['heldOut']['accuracy'] >= 0.8 for person in per_person.values()),
        'targetMet': False,
        'note': 'Each historical prediction uses only observations completed before the level starts. This is an offline chronological reconstruction, not a timestamped prospective forecast. Assisted wins remain in the labels. Models are chosen on earlier completed development levels. These data were previously inspected; prospective validation is still needed.',
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(report, indent=2), encoding='utf-8')
    (SOURCE.parent / 'attempt-count-scored.json').write_text(json.dumps(scored), encoding='utf-8')
    print(json.dumps({'selected': chosen, 'heldOut': report['heldOut'], 'players': per_person, 'targetMet': report['targetMet']}, indent=2))


if __name__ == '__main__':
    main()
