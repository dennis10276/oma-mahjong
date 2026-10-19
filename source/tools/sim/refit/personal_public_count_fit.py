import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestClassifier

from attempt_count_fit import NAMES, SCORING_RULE, accuracy, best_prediction, is_correct
from personal_value_fit import ARCHIVE, ROOT, digest


PROTOCOL = 'own-public-regime-count-v1'
FEATURES = ('n', 'blockedFreeCount', 'takeableWithVisMateFrac', 'takeableWithTakeableMate',
            'meanMateDepth', 'clockSlackRatio', 'hasClock', 'clockBudget', 'mateSamples')
METHODS = ('ownRecent', 'ownPublicForest', 'ownRegimeForest')


def metric_label(actual):
    if not isinstance(actual, int) or isinstance(actual, bool) or actual < 1:
        raise ValueError('First-clear counts must be positive integers')
    return min(actual, 10)


def vector_of(row):
    features = row['features']
    values = np.array([features[name] for name in FEATURES], dtype=np.float64)
    if not np.all(np.isfinite(values)) or features['hasClock'] not in (0, 1):
        raise ValueError('Invalid measured public-opening geometry')
    return values


def own_before(rows, target):
    return sorted([row for row in rows if row['name'] == target['name'] and row['end'] < target['start']
                   and row.get('wonOn') is not None and row.get('firstAttempt') == 1 and row.get('firstClear') is True
                   and row.get('boardChangedWithinCampaign') is False and not row.get('assisted', False)],
                  key=lambda row: (row['end'], row['start']))


def regime_features(rows, target):
    before = own_before(rows, target)
    recent = before[-25:]
    same_clock = [row for row in before if row['features']['hasClock'] == target['features']['hasClock']][-25:]
    reference = same_clock if len(same_clock) >= 3 else recent
    raw = vector_of(target)
    if reference:
        matrix = np.array([vector_of(row) for row in reference])
        normalized = np.clip((raw - matrix.mean(axis=0)) / np.maximum(matrix.std(axis=0), 1e-6), -2.5, 2.5)
    else:
        normalized = np.zeros(len(FEATURES))
    count = len(recent)
    history = [count, *[(1 + sum(row['wonOn'] <= bound for row in recent)) / (2 + count) for bound in (1, 2, 3, 5, 7)]]
    return np.concatenate((raw, normalized, history)), {
        'ownHistory': len(before), 'sameClockHistory': len(same_clock), 'normalizationHistory': len(reference),
        'normalizationRegime': 'same-clock' if len(same_clock) >= 3 else 'recent-own',
        'availableThrough': max((row['end'] for row in before), default=None),
    }


def prior_distribution(before):
    mass = {label: .25 for label in range(1, 11)}
    for age, row in enumerate(reversed(before[-25:])):
        mass[metric_label(row['wonOn'])] += .5 ** (age / 20)
    total = sum(mass.values())
    return {label: value / total for label, value in mass.items()}


def predict(rows, target, prepared=None):
    before = own_before(rows, target)
    if len({row['lv'] for row in before}) != len(before):
        raise ValueError('Own first-clear training history cannot contain duplicate replay levels')
    prior = prior_distribution(before)
    distributions = {'ownRecent': prior}
    features, availability = regime_features(rows, target)
    prepared = prepared if prepared is not None else {
        (row['name'], row['start']): regime_features(rows, row)[0] for row in before}
    weights = [.5 ** ((len(before) - index - 1) / 20) for index in range(len(before))]
    for method, columns in (('ownPublicForest', len(FEATURES)), ('ownRegimeForest', len(features))):
        if len(before) < 6:
            distributions[method] = dict(prior)
            continue
        model = RandomForestClassifier(n_estimators=64, max_depth=5, min_samples_leaf=3,
                                       max_features=1.0, random_state=20261019, n_jobs=1)
        model.fit([prepared[row['name'], row['start']][:columns] for row in before],
                  [metric_label(row['wonOn']) for row in before], sample_weight=weights)
        learned = dict(zip(map(int, model.classes_), model.predict_proba([features[:columns]])[0]))
        distributions[method] = {label: .95 * learned.get(label, 0) + .05 * prior[label] for label in prior}
    predictions = {method: best_prediction(distribution) for method, distribution in distributions.items()}
    return predictions, distributions, availability


def select_method(scored, target):
    prior = sorted([row for row in scored if row['name'] == target['name'] and row['end'] < target['start']
                    and not row.get('assisted', False) and row.get('boardChangedWithinCampaign') is False],
                   key=lambda row: row['end'])[-20:]
    losses = {}
    for method in METHODS:
        total, denominator = 0., 0.
        for age, row in enumerate(reversed(prior)):
            weight = .5 ** (age / 20)
            distribution = row['distributions'][method]
            label = metric_label(row['wonOn'])
            probability = distribution.get(label, distribution.get(str(label)))
            if probability is None or not math.isfinite(probability) or probability <= 0:
                raise ValueError('Own chronological method selection requires a proper count distribution')
            total -= weight * math.log(max(1e-12, probability))
            denominator += weight
        losses[method] = total / denominator if denominator else 0.
    selected = min(METHODS, key=lambda method: (losses[method], METHODS.index(method)))
    return selected, {'selectionEpisodes': len(prior), 'properCountLogLoss': losses,
                      'selectionAvailableThrough': max((row['end'] for row in prior), default=None)}


def fit_development(data):
    if data.get('evidence') != 'exact-public-opening-own-count-training-data':
        raise ValueError('Public count heads need exact measured own-history data')
    rows = data['rows']
    targets = [row for row in rows if row.get('firstClear') is True and row.get('firstAttempt') == 1
               and row.get('wonOn') is not None]
    prepared = {(row['name'], row['start']): regime_features(rows, row)[0] for row in rows}
    scored = []
    for target in sorted(targets, key=lambda row: (row['start'], row['name'])):
        predictions, distributions, availability = predict(rows, target, prepared)
        selected, selection = select_method(scored, target)
        predictions.update(selectedOwnPrequential=predictions[selected], alwaysFirst=1)
        scored.append({**target, 'predictions': predictions, 'distributions': distributions,
                       'selectedMethod': selected, **availability, **selection})
    return scored


def main():
    filename = ARCHIVE / 'personal-public-count-data.json'
    data = json.loads(filename.read_bytes())
    for relative, expected in data['sourceHashes'].items():
        if digest(ROOT / relative) != expected:
            raise ValueError('Public-opening count source changed: ' + relative)
    started = datetime.now(timezone.utc).isoformat()
    scored = fit_development(data)
    report = {'made': datetime.now(timezone.utc).isoformat(), 'fitStarted': started, 'protocol': PROTOCOL,
              'evidence': 'retrospective-own-public-geometry-development-only', 'targetMet': False,
              'scoringRule': SCORING_RULE, 'features': FEATURES, 'dataFile': str(filename), 'dataSha256': digest(filename),
              'sourceHashes': {name: digest(Path(__file__).parent / name) for name in (
                  Path(__file__).name, 'attempt_count_fit.py', 'personal_value_fit.py')},
              'missingBoards': data['missing'], 'scored': scored, 'players': {},
              'coverage': {name: {
                  'fixedHeldTargets': sum(key.startswith(name + '|') for key in data['comparisonEpisodes']),
                  'measuredHeldTargets': sum(row['name'] == name and name + '|' + str(row['start']) in data['comparisonEpisodes'] for row in scored),
                  'missingHeldBoards': sum(row['name'] == name and name + '|' + str(row['start']) in data['comparisonEpisodes'] for row in data['missing']),
              } for name in NAMES},
              'note': 'Own-person fitting and strictly earlier own clock/nonclock normalization only. No pooled actor or generic '
                      'reference scores. All reused historical cohorts are development diagnostics, not a fresh held/prospective pass. '
                      'Count classes1..9/10+ preserve the user scoring exactly for predictions1..8;8+ is NOT collapsed onto actual8 '
                      'and incorrectly credited to forecasts6/7. Assisted/board-changing targets are scored and flagged but do not train '
                      'normal own habits. Insufficient history uses an explicit prior rather than dropping the target. '
                      'New source-bound pre-opening numeric forecasts and later real outcomes remain necessary.'}
    for name in NAMES:
        own = [row for row in scored if row['name'] == name]
        held = [row for row in own if name + '|' + str(row['start']) in data['comparisonEpisodes']]
        recent = [row for row in own if name + '|' + str(row['start']) in data['additionalRecentIds']]
        report['players'][name] = {scope: {method: accuracy(part, method) for method in (*METHODS, 'selectedOwnPrequential', 'alwaysFirst')}
                                   for scope, part in (('allDevelopment', own), ('reusedHeldDevelopment', held), ('recentDevelopment', recent))}
    output = ROOT / 'analysis/personal-bots/personal-public-count-evaluation.json'
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'made': report['made'], 'targetMet': False, 'missingBoards': len(data['missing']),
        'scores': {name: {scope: {method: [value['correct'], value['n']] for method, value in methods.items()}
                          for scope, methods in report['players'][name].items()} for name in NAMES}}, indent=2))


if __name__ == '__main__':
    main()
