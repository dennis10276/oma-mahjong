import hashlib
import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from attempt_count_fit import NAMES, FACTORIES, SCORING_RULE, accuracy, best_prediction, best_prediction_with_tail, completed_before, own_mode
from attempt_hazard import contextual_distribution
from board_recall_eval import recalled_prediction


ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'analysis/archive/personal-bots/count-profile-data.json'
OUTPUT = ROOT / 'analysis/personal-bots/count-profile-evaluation.json'


def hazards_of(chain, runs, limit=128):
    hazards = []
    previous = 0.0
    last = 0.5
    for within in chain['within']:
        reach = round(runs * (1 - previous))
        wins = round(runs * (within - previous))
        if not 0 <= wins <= reach or within < previous or within > 1:
            raise ValueError('Invalid first-clear simulation counts')
        if reach:
            last = (wins + 0.5) / (reach + 1)
        hazards.append(last)
        previous = within
    if not hazards:
        raise ValueError('Missing first-clear simulation chain')
    return (hazards + [hazards[-1]] * max(0, limit - len(hazards)))[:limit]


def distribution_of(hazards):
    remaining, distribution = 1.0, {}
    for attempt, hazard in enumerate(hazards, 1):
        if not 0 < hazard < 1:
            raise ValueError('Smoothed hazard must be between zero and one')
        distribution[attempt] = remaining * hazard
        remaining *= 1 - hazard
    return distribution, remaining


def outcome_loss(row, profile, runs):
    attempts = row['wonOn'] if row['wonOn'] is not None else row.get('observedAttempts', 0)
    if attempts < 1:
        raise ValueError('An observed outcome or censored failure is required')
    hazards = hazards_of(row['chains'][profile], runs, max(128, attempts))
    failures = attempts - 1 if row['wonOn'] is not None else attempts
    loss = -sum(math.log1p(-hazard) for hazard in hazards[:failures])
    return loss - math.log(hazards[attempts - 1]) if row['wonOn'] is not None else loss


def profile_weights(rows, target, profiles, runs, own_only=False):
    eligible = [row for row in rows if row['end'] < target['start'] and row['firstAttempt'] == 1
                and not row.get('assisted', False) and not row.get('boardChangedWithinCampaign', False)
                and (not target.get('firstClear', False) or row.get('firstClear', True))
                and (row['wonOn'] is not None or row.get('observedAttempts', 0) > 0)]
    totals = {}
    for name in NAMES:
        past = sorted([row for row in eligible if row['name'] == name], key=lambda row: row['end'], reverse=True)
        losses = np.zeros(len(profiles))
        count = 0.0
        for age, row in enumerate(past):
            weight = 0.5 ** (age / 20)
            losses += weight * np.asarray([outcome_loss(row, profile, runs) for profile in profiles])
            count += weight
        totals[name] = {'losses': losses, 'weight': count, 'episodes': len(past),
                        'availableThrough': max((row['end'] for row in past), default=None)}
    own = totals[target['name']]
    family = [value for name, value in totals.items() if not own_only and name != target['name'] and value['weight'] > 0]
    loss = own['losses'].copy()
    if family:
        loss += 2 * np.mean([value['losses'] / value['weight'] for value in family], axis=0)
    prior = np.asarray([2.0 if profile == 'baseline' and not own_only else 1.0 for profile in profiles])
    logits = np.log(prior) - loss
    weights = np.exp(logits - logits.max())
    weights /= weights.sum()
    return dict(zip(profiles, weights.tolist())), {'ownEpisodes': own['episodes'],
            'ownAvailableThrough': own['availableThrough'], 'familyAvailableThrough': max((value['availableThrough'] for value in family), default=None)}


def predictive_distribution(rows, target, profiles, runs, own_only=False):
    weights, availability = profile_weights(rows, target, profiles, runs, own_only)
    distributions = {profile: distribution_of(hazards_of(target['chains'][profile], runs)) for profile in profiles}
    mixture = {attempt: sum(weights[profile] * distributions[profile][0][attempt] for profile in profiles) for attempt in range(1, 129)}
    tail = sum(weights[profile] * distributions[profile][1] for profile in profiles)
    return mixture, tail, weights, availability, distributions


def conditional_of(distribution, attempt, tail):
    reach = tail + sum(probability for count, probability in distribution.items() if count >= attempt)
    return distribution[attempt] / max(1e-300, reach)


def histories(rows, target, own_only=False):
    before = sorted(completed_before(rows, target['start']), key=lambda row: row['end'])
    if own_only:
        before = [row for row in before if row['name'] == target['name']]
    if target.get('firstClear', False):
        before = [row for row in before if row.get('firstClear', True)]
    mine = [row for row in before if row['name'] == target['name']][-20:]
    family = [row for row in before if row['board'] == target['board']]
    rate = lambda data, predicate: (1 + sum(predicate(row) for row in data)) / (2 + len(data))
    average = lambda data: sum(row['wonOn'] for row in data) / len(data) if data else 2
    return [len(mine), rate(mine, lambda row: row['wonOn'] == 1), rate(mine, lambda row: row['wonOn'] <= 2),
            average(mine), rate(mine, lambda row: bool(row.get('assisted'))), len(family), average(family), rate(family, lambda row: row['wonOn'] == 1)]


def features_of(rows, target, profiles, runs, own_only=False):
    distributions = {profile: distribution_of(hazards_of(target['chains'][profile], runs)) for profile in profiles}
    reference_profile = 'ownAll' if own_only and 'ownAll' in profiles else 'baseline'
    base = [int(name == target['name']) for name in NAMES] + [target['lv']] + target['physical']
    if 'firstClear' in target:
        base.append(int(target['firstClear']))
    base += [conditional_of(distributions[reference_profile][0], attempt, distributions[reference_profile][1]) for attempt in range(1, 5)]
    base += histories(rows, target, own_only) + [target['reference']['strong'], target['reference']['average']]
    extra = [value for profile in profiles if profile != reference_profile for value in
             [conditional_of(distributions[profile][0], 1, distributions[profile][1]), conditional_of(distributions[profile][0], 2, distributions[profile][1]),
              sum(distributions[profile][0][attempt] for attempt in range(1, 5))]]
    if not np.all(np.isfinite(base + extra)):
        raise ValueError('Nonfinite count-profile features')
    return base, base + extra


def main(data_file=DATA, output_file=OUTPUT, scored_file=None, own_only=False):
    data = json.loads(data_file.read_text(encoding='utf-8'))
    rows, runs = data['rows'], data['runs']
    profiles = list(data['profiles'])
    if own_only:
        profiles = [profile for profile in profiles if data['profiles'][profile].get('scope', '').startswith('own')]
        if 'ownAll' not in profiles:
            raise ValueError('Own-only count fitting needs an independently fitted ownAll reference')
    reference_profile = 'ownAll' if own_only else 'baseline'
    comparisons = set(data['comparisonEpisodes'])
    features = {(row['name'], row['start']): features_of(rows, row, profiles, runs, own_only) for row in rows}
    prepared, predictions_by_key = [], {}
    for target in sorted(rows, key=lambda row: row['start']):
        distribution, tail, weights, availability, components = predictive_distribution(rows, target, profiles, runs, own_only)
        conditional = [conditional_of(distribution, attempt, tail) for attempt in range(1, 129)]
        within, survival = [], 1.0
        for probability in conditional:
            survival *= 1 - probability
            within.append(1 - survival)
        prepared.append({**target, 'chain': {'cond': conditional, 'within': within}})
        predictions_by_key[target['name'], target['start']] = (distribution, tail, weights, availability, components)
    scored = []
    for target in prepared:
        if target['firstAttempt'] != 1 or target['wonOn'] is None:
            continue
        before = completed_before(rows, target['start'])
        if own_only:
            before = [row for row in before if row['name'] == target['name']
                      and (not target.get('firstClear', False) or row.get('firstClear', True))]
        if sum(row['name'] == target['name'] for row in before) < 6:
            continue
        distribution, tail, weights, availability, components = predictions_by_key[target['name'], target['start']]
        selected = max(profiles, key=weights.get)
        predictions = {'alwaysFirst': 1, 'ownMode': own_mode(before, target),
                       ('ownActorSmoothed' if own_only else 'baselineSmoothed'): best_prediction_with_tail(*components[reference_profile], 129),
                       'personalMixture': best_prediction_with_tail(distribution, tail, 129),
                       'personalBest': best_prediction_with_tail(*components[selected], 129)}
        personal_prepared = [row for row in prepared if row['name'] == target['name']] if own_only else prepared
        calibrated, calibrated_tail = contextual_distribution(personal_prepared, target, limit=128)
        predictions['mixtureCalibrated'] = best_prediction_with_tail(calibrated, calibrated_tail, 129)
        for index, method in enumerate(['controlForest', 'profileForest']):
            model = FACTORIES['forest']()
            model.fit([features[row['name'], row['start']][index] for row in before], [row['wonOn'] for row in before])
            probabilities = model.predict_proba([features[target['name'], target['start']][index]])[0]
            predictions[method] = best_prediction({int(attempt): float(probability) for attempt, probability in zip(model.classes_, probabilities)})
        personal_rows = [row for row in rows if row['name'] == target['name']] if own_only else rows
        predictions['recallProfileForest'], _ = recalled_prediction(personal_rows, target, predictions['profileForest'])
        scored.append({key: target[key] for key in ['name', 'lv', 'start', 'end', 'wonOn', 'board', 'assisted', 'openingRecorded', 'source']} |
                      {'predictions': predictions, 'profileWeights': weights, 'selectedProfile': selected, 'trainingAvailability': availability,
                       'beyond128': tail, 'calibratedBeyond128': calibrated_tail})
    held = [row for row in scored if row['name'] + '|' + str(row['start']) in comparisons]
    methods = list(scored[0]['predictions'])
    players = {}
    for name in NAMES:
        testing = [row for row in held if row['name'] == name]
        cutoff = min(row['start'] for row in testing)
        development = [row for row in scored if row['name'] == name and row['end'] < cutoff]
        chosen = max(methods, key=lambda method: accuracy(development, method)['accuracy']) if development else 'alwaysFirst'
        players[name] = {'methods': {method: accuracy(testing, method) for method in methods},
                         'selectedBeforeTest': chosen, 'selectedScore': accuracy(testing, chosen),
                         'selectedProfiles': {profile: sum(row['selectedProfile'] == profile for row in testing) for profile in profiles}}
    report = {'evaluatedAt': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory', 'targetMet': False,
              'scoringRule': SCORING_RULE,
              'comparisonScope': data.get('scope', 'historical-mixed-episodes'),
              'measurementFingerprint': data['fingerprint'], 'dataSha256': hashlib.sha256(data_file.read_bytes()).hexdigest(),
              'personalOnly': own_only,
              'strategyCandidates': profiles,
              'simulationRuns': runs, 'simulatedAttempts': data['attempts'], 'profiles': data['profiles'],
              'coverage': {'episodes': len(rows), 'heldOutEpisodes': len(held), 'heldOutAssisted': sum(row['assisted'] for row in held),
                           'heldWithRecordedOpening': sum(row['openingRecorded'] for row in held),
                           'heldBoardSources': {source: sum(row['source'] == source for row in held) for source in sorted(set(row['source'] for row in held))}},
              'heldOut': {method: accuracy(held, method) for method in methods}, 'players': players,
              'note': 'Personal profile weights optimize earlier first-clear likelihood including censored failures, not target outcomes or hit tolerance. '
                      'Unassisted past episodes train natural-actor profiles; all completed held episodes including assisted wins remain scored. ' +
                      ('Own-only mode fits strategy likelihood, count forests, calibration and recall independently per person with equal strategy priors. '
                       if own_only else 'Own likelihood has twenty-episode decay; family prior has two equal-person pseudo-episodes and baseline prior weight two. ') +
                      'Jeffreys smoothing uses measured simulation win/reach counts; unobserved hazards and the analytic tail reuse the last sampled hazard. '
                      'Thirty-two simulated attempts are extended analytically to 128, with remaining probability reported, never invented observed wins. '
                      'Availability is enforced against exported opening timestamps; historical inferred starts are not proof of a pre-start forecast. '
                      'Repeatedly inspected historical games do not establish the frozen prospective goal.'}
    output_file.write_text(json.dumps(report, indent=2), encoding='utf-8')
    (scored_file or ROOT / 'analysis/archive/personal-bots/count-profile-scored.json').write_text(json.dumps(scored), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=Path, default=DATA)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    parser.add_argument('--scored', type=Path)
    parser.add_argument('--own-only', action='store_true')
    args = parser.parse_args()
    main(args.data, args.output, args.scored, args.own_only)
