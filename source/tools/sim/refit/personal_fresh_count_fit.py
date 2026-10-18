import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from attempt_count_fit import FACTORIES, NAMES, SCORING_RULE, accuracy, best_prediction, best_prediction_with_tail, is_correct, own_mode
from personal_causal_factor_head import predict_causal_3bucket
from personal_count_fit import distribution_of, hazards_of, predictive_distribution


ROOT = Path(__file__).resolve().parents[3]
PROFILES = ('ownOutcomeBase0', 'ownOutcomeStyles0')
METHODS = ('alwaysFirst', 'ownRecentMode', 'ownBaseSmoothed', 'ownStylesSmoothed',
           'ownMixtureSmoothed', 'ownBoardForest', 'ownBotForest', 'ownCausalFactor3Bucket')
PROTOCOL = 'fresh-own-first-clear-prequential-v1'


def eligible(row):
    return (row.get('firstAttempt') == 1 and row.get('firstClear') is True
            and not row.get('boardChangedWithinCampaign', False))


def target_eligible(row):
    return row.get('firstAttempt') == 1 and row.get('firstClear') is True


def past_of(rows, target):
    return sorted([row for row in rows if eligible(row) and row['name'] == target['name']
                   and row.get('wonOn') is not None and row['end'] < target['start']
                   and not row.get('assisted', False)], key=lambda row: row['end'])


def features_of(rows, target, runs):
    mine = past_of(rows, target)[-20:]
    count = len(mine)
    rates = [(1 + sum(row['wonOn'] <= bound for row in mine)) / (2 + count) for bound in (1, 2, 4, 8)]
    history = [count, *rates, sum(min(8, row['wonOn']) for row in mine) / count if count else 2]
    board = [target['lv'], *target['physical'], target['reference']['strong'], target['reference']['average'], *history]
    extra = []
    for profile in PROFILES:
        hazards = hazards_of(target['chains'][profile], runs)
        distribution, tail = distribution_of(hazards)
        extra += hazards[:4] + [sum(distribution[attempt] for attempt in range(1, bound + 1)) for bound in (2, 4, 8)]
        extra.append(sum(min(attempt, 8) * probability for attempt, probability in distribution.items()) + 8 * tail)
    if not np.all(np.isfinite(board + extra)):
        raise ValueError('Nonfinite personal count features')
    return board, board + extra


def select_method(scored, target):
    earlier = sorted([row for row in scored if row['name'] == target['name']
                      and row['end'] < target['start'] and not row.get('assisted', False)
                      and not row.get('boardChangedWithinCampaign', False)], key=lambda row: row['end'])[-20:]
    scores = {}
    for method in METHODS:
        success, total = 1.0, 2.0
        for age, row in enumerate(reversed(earlier)):
            weight = 0.5 ** (age / 10)
            success += weight * is_correct(row['predictions'][method], row['wonOn'])
            total += weight
        scores[method] = success / total
    return max(METHODS, key=scores.get), {'selectionEpisodes': len(earlier),
        'selectionAvailableThrough': max((row['end'] for row in earlier), default=None), 'selectionScores': scores}


def predict(rows, target, runs, prepared_features, forest_cache):
    before = past_of(rows, target)
    predictions = {'alwaysFirst': 1, 'ownRecentMode': own_mode(before, target)}
    likelihood_rows = [row for row in rows if eligible(row) and row['name'] == target['name']]
    mixture, tail, weights, availability, components = predictive_distribution(likelihood_rows, target, PROFILES, runs, own_only=True)
    predictions['ownBaseSmoothed'] = best_prediction_with_tail(*components[PROFILES[0]], 129)
    predictions['ownStylesSmoothed'] = best_prediction_with_tail(*components[PROFILES[1]], 129)
    predictions['ownMixtureSmoothed'] = best_prediction_with_tail(mixture, tail, 129)
    roster = tuple((row['name'], row['start']) for row in before)
    for index, method in enumerate(('ownBoardForest', 'ownBotForest')):
        if len(before) < 6:
            predictions[method] = predictions['ownRecentMode']
            continue
        cache_key = (roster, index)
        if cache_key not in forest_cache:
            model = FACTORIES['forest']()
            sample_weights = [0.5 ** ((len(before) - 1 - position) / 20) for position in range(len(before))]
            model.fit([prepared_features[row['name'], row['start']][index] for row in before],
                      [row['wonOn'] for row in before], sample_weight=sample_weights)
            forest_cache[cache_key] = model
        model = forest_cache[cache_key]
        probabilities = model.predict_proba([prepared_features[target['name'], target['start']][index]])[0]
        predictions[method] = best_prediction({int(attempt): float(probability)
            for attempt, probability in zip(model.classes_, probabilities)})
    predictions['ownCausalFactor3Bucket'] = predict_causal_3bucket(before, target)
    return predictions, {'trainingEpisodes': len(before), 'trainingAvailableThrough': max((row['end'] for row in before), default=None),
        'profileWeights': weights, 'profileAvailability': availability, 'beyond128': tail}


def evaluate(data):
    if data['runs'] != 32 or data['attempts'] != 32 or data['computationCaps'] != 0 or not data['validUncensoredSimulation']:
        raise ValueError('Only complete uncensored32x32 counts may be scored')
    if tuple(data['profiles']) != PROFILES:
        raise ValueError('Fresh own count head requires the two explicitly declared personal profiles')
    rows, future = data['rows'], data['future']
    if len({(row['name'], row['start']) for row in rows}) != len(rows):
        raise ValueError('Duplicate historical campaign key')
    targets = [row for row in rows if target_eligible(row)] + future
    future_keys = [(row['name'], row['lv']) for row in future]
    if len(set(future_keys)) != len(future_keys):
        raise ValueError('Duplicate future level')
    if any(key in row for row in future for key in ('wonOn', 'end', 'observedAttempts', 'assisted')):
        raise ValueError('Future prediction input must not contain human target outcomes')
    features = {(row['name'], row['start']): features_of(rows, row, data['runs']) for row in targets if row.get('kind') != 'future'}
    scored, forecasts, cache = [], [], {}
    for target in sorted(targets, key=lambda row: (row['start'], row['name'], row['lv'])):
        target_key = (target['name'], target['start'])
        features[target_key] = features_of(rows, target, data['runs'])
        predictions, availability = predict(rows, target, data['runs'], features, cache)
        selected, selection = select_method(scored, target)
        predictions['selectedPrequential'] = predictions[selected]
        output = {key: target[key] for key in ('name', 'lv', 'start', 'board')}
        output.update({'predictions': predictions, 'selectedMethod': selected, **availability, **selection})
        if target.get('kind') == 'future':
            forecasts.append({**output, 'modelId': target['modelId'], 'version': target['version'],
                              'firstAttempt': 1, 'firstClear': True, 'numericForecastFrozen': False})
        elif target.get('wonOn') is not None and len(past_of(rows, target)) >= 6:
            scored.append({**output, 'end': target['end'], 'wonOn': target['wonOn'], 'assisted': target.get('assisted', False),
                           'boardChangedWithinCampaign': target.get('boardChangedWithinCampaign', False)})
    held_ids, recent_ids = set(data['comparisonEpisodes']), set(data['additionalRecentIds'])
    held = [row for row in scored if row['name'] + '|' + str(row['start']) in held_ids]
    recent = [row for row in scored if row['name'] + '|' + str(row['start']) in recent_ids]
    methods = (*METHODS, 'selectedPrequential')
    results = lambda cohort: {name: {method: accuracy([row for row in cohort if row['name'] == name], method)
                                   for method in methods} for name in NAMES}
    return {'evidence': 'historical-exploratory-and-unfrozen-future-candidates', 'targetMet': False,
        'protocol': PROTOCOL, 'scoringRule': SCORING_RULE, 'personalOnly': True,
        'coverage': {'historicalRows': len(rows), 'heldRetained': len(held_ids), 'heldScored': len(held),
                     'heldBoardChanged': sum(row['boardChangedWithinCampaign'] for row in held), 'recentScored': len(recent),
                     'recentPending': sum(eligible(row) and row.get('wonOn') is None and row['name'] + '|' + str(row['start']) in recent_ids for row in rows),
                     'futureCandidates': len(forecasts)},
        'heldPlayers': results(held), 'recentPlayers': results(recent), 'scored': scored, 'future': forecasts,
        'note': 'Every head, forest and likelihood uses only that person’s earlier unassisted unchanged-board first-clear outcomes. '
                'The fixed held cohort retains changed-board targets as diagnostic predictions rather than silently dropping misses. '
                'Pending failures enter profile likelihood, never invented wins; replays do not score or train count heads. '
                'Forests use64 trees/depth5/leaf3 and20-episode recency half-life. Selector uses last20 earlier own prequential outcomes '
                'with10-episode half-life, Beta(1,1) prior, stable method-order ties. Historical client-time fits are exploratory, '
                'not proof of server receipt or pre-opening forecasts. Future candidates require a new live opening check and immutable numeric freeze. '
                'No old numeric forecast or miss is changed; no80% success is established.'}


def main(data_file, output_file):
    data_bytes = data_file.read_bytes()
    report = evaluate(json.loads(data_bytes))
    report.update({'made': datetime.now(timezone.utc).isoformat(), 'dataSha256': hashlib.sha256(data_bytes).hexdigest(),
                   'measurementFingerprint': json.loads(data_bytes)['fingerprint'],
                   'scoringSourceHashes': {name: hashlib.sha256((Path(__file__).parent / name).read_bytes()).hexdigest()
                       for name in ('personal_fresh_count_fit.py', 'personal_causal_factor_head.py', 'personal_count_fit.py', 'attempt_count_fit.py', 'attempt_hazard.py', 'board_recall_eval.py')}})
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({key: value for key, value in report.items() if key not in ('scored', 'future')}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=Path, default=ROOT / 'analysis/archive/personal-bots/physical-fresh-count-data.json')
    parser.add_argument('--output', type=Path, default=ROOT / 'analysis/personal-bots/personal-fresh-count-evaluation.json')
    args = parser.parse_args()
    main(args.data, args.output)
