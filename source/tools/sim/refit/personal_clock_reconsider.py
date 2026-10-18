import math

import numpy as np

from personal_clock_strategy import context_of, observation_of, predictive, strategy_features, transition_probabilities


def masks_of(decision):
    matrix = strategy_features(decision)
    recipients = np.asarray([(feature[14] > 0 or feature[64] > 0 or feature[66] > 0) and (parts[1] > 0 or parts[2] > 0)
                             for feature, parts in zip(decision['F'], matrix)])
    donors = np.asarray([(parts[0] > 0 and parts[1] == 0 and parts[2] == 0 and parts[3] == 0.25)
                        or (decision['kindContext'][3] > 0 and parts[4] > 0) for parts in matrix])
    return donors & ~recipients, recipients


def transfer(values, donors, recipients, rate):
    values = np.asarray(values)
    donors, recipients = np.asarray(donors, dtype=bool), np.asarray(recipients, dtype=bool)
    if (values.shape != donors.shape or values.shape != recipients.shape or np.any(donors & recipients)
            or not np.all(np.isfinite(values)) or np.any(values < 0)
            or not np.isclose(values.sum(), 1, rtol=1e-12, atol=1e-12) or not np.isfinite(rate) or not 0 <= rate <= 1):
        raise ValueError('Invalid personal clock reconsideration transfer')
    donor_mass, recipient_mass = values[donors].sum(), values[recipients].sum()
    if donor_mass == 0 or recipient_mass == 0 or rate == 0:
        return values.copy()
    result = values.copy()
    result[donors] *= 1 - rate
    result[recipients] *= 1 + rate * donor_mass / recipient_mass
    return result


def fit_rate(observations, baseline_pseudo_count=1):
    if not np.isfinite(baseline_pseudo_count) or baseline_pseudo_count <= 0:
        raise ValueError('Invalid reconsideration baseline pseudo-count')
    donor_count = baseline_pseudo_count
    recipients = []
    for selected_donor, selected_recipient, ratio, importance in observations:
        if (selected_donor and selected_recipient or not np.isfinite(ratio) or ratio <= 0
                or not np.isfinite(importance) or importance < 0):
            raise ValueError('Invalid causal reconsideration observation')
        if selected_donor:
            donor_count += importance
        if selected_recipient:
            recipients.append((ratio, importance))
    def derivative(rate):
        return donor_count / (1 - rate) - sum(importance * ratio / (1 + rate * ratio) for ratio, importance in recipients)
    if derivative(0) >= 0:
        return 0.0
    lower, upper = 0.0, 1 - 1e-12
    for _ in range(60):
        middle = (lower + upper) / 2
        if derivative(middle) < 0:
            lower = middle
        else:
            upper = middle
    return (lower + upper) / 2


def proposal_sequence(game, actor, base_strategy, clock_only=False):
    scope = 0 if game.get('initialNewLevel') else 1
    posterior = np.asarray(base_strategy['priors'][scope])
    previous, started = None, False
    for decision in game['decisions']:
        active = bool(np.any(strategy_features(decision)))
        if decision['k'] < 0:
            if active:
                raise ValueError('Cannot bridge an unrepresented observed clock action')
            continue
        if clock_only and not active:
            continue
        prior = posterior
        if active and started:
            prior = posterior @ transition_probabilities(context_of(decision, previous)[None, :], base_strategy['switchWeights'])[0]
        values, emission = predictive(decision, actor, base_strategy, prior)
        yield decision, values
        if active:
            posterior = prior * emission[decision['k']]
            posterior /= posterior.sum()
            previous, started = observation_of(decision, decision['k']), True


def fit_reconsideration(games, actor, base_strategy):
    cutoff, allowed = actor['trainingCut'], set(actor['trainedAids'])
    training = sorted([game for game in games if game['aid'] in allowed and game['availableAt'] < cutoff],
                      key=lambda game: game['availableAt'], reverse=True)
    if (len(training) != actor['trainingGames'][actor['name']] or {game['aid'] for game in training} != allowed
            or set(base_strategy['trainedAids']) != allowed or base_strategy['trainingCut'] != cutoff
            or base_strategy['availableThrough'] != max((game['availableAt'] for game in training), default=None)):
        raise ValueError('Selective reconsideration changed frozen own-person membership or proposal availability')
    observations, contexts = [[], []], [0, 0]
    for age, game in enumerate(training):
        scope = 0 if game.get('initialNewLevel') else 1
        for decision, values in proposal_sequence(game, actor, base_strategy, clock_only=True):
            donors, recipients = masks_of(decision)
            donor_mass, recipient_mass = values[donors].sum(), values[recipients].sum()
            if donor_mass <= 0 or recipient_mass <= 0:
                continue
            ratio = donor_mass / recipient_mass
            if not np.isfinite(ratio):
                raise ValueError('Selective reconsideration proposal ratio is unresolved')
            contexts[scope] += 1
            observations[scope].append((bool(donors[decision['k']]), bool(recipients[decision['k']]), ratio, 0.5 ** (age / 20)))
    rates = [fit_rate(rows) for rows in observations]
    return {'type': 'personalClockReconsideration-v1', 'baseStrategy': base_strategy, 'rates': rates,
            'trainingCut': cutoff, 'availableThrough': max((game['availableAt'] for game in training), default=None),
            'trainedAids': sorted(allowed), 'trainingGames': len(training), 'trainingContexts': contexts,
            'effectiveDonorChoices': [sum(row[3] for row in rows if row[0]) for rows in observations],
            'effectiveRecipientChoices': [sum(row[3] for row in rows if row[1]) for rows in observations],
            'settings': {'prefixHalfLife': 20, 'initialNewSeparate': True, 'baselinePseudoCount': 1},
            'note': 'Own earlier actions fit a selective proposal-reconsideration rate, separately for initial-new/retry contexts. '
                'Only known bad clock exits or known crowded traps donate probability to immediate known pairs '
                'with found acceptable within-budget exits. Other safe choices are unchanged and supply no switching evidence. '
                'One no-change pseudo-vote shrinks sparse data; no data gives rate0. The old causal filter is auxiliary, '
                'not a newly inferred latent generative strategy. No winning labels, family rates or target actions enter fitting.'}


def score_reconsideration(games, actor, model, enabled=True):
    loss, hits, count = 0.0, 0.0, 0
    for game in games:
        rate = model['rates'][0 if game.get('initialNewLevel') else 1] if enabled else 0
        for decision, baseline in proposal_sequence(game, actor, model['baseStrategy']):
            donors, recipients = masks_of(decision)
            values = transfer(baseline, donors, recipients, rate)
            selected = decision['k']
            ties = np.isclose(values, values.max(), rtol=1e-8, atol=1e-12)
            loss -= math.log(max(1e-300, values[selected]))
            hits += float(ties[selected]) / ties.sum()
            count += 1
    return {'decisions': count, 'jointLogLoss': loss / count if count else None, 'topActionAccuracy': hits / count if count else None}
