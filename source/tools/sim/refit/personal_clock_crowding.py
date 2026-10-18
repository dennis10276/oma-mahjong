import math

import numpy as np

from personal_clock_strategy import context_of, observation_of, predictive, strategy_features, transition_probabilities


def cue_mask(decision):
    matrix = strategy_features(decision)
    forecast_crowded = any(parts[0] > 0 and parts[1] == 0 and parts[2] == 0 and parts[3] == 0.25 for parts in matrix)
    return np.asarray([bool((decision['kindContext'][3] or forecast_crowded) and (feature[14] > 0 or feature[64] > 0 or feature[66] > 0)
                            and (parts[1] > 0 or parts[2] > 0))
                       for feature, parts in zip(decision['F'], matrix)])


def adjust(values, mask, counts, strength=1):
    values, mask = np.asarray(values), np.asarray(mask, dtype=bool)
    if (values.shape != mask.shape or not np.all(np.isfinite(values)) or np.any(values < 0)
            or not np.isclose(values.sum(), 1, rtol=1e-12, atol=1e-12) or len(counts) != 2
            or any(not np.isfinite(value) or value < 0 for value in counts) or strength <= 0):
        raise ValueError('Invalid personal clock crowding correction')
    mass = values[mask].sum()
    if not np.any(mask) or np.all(mask) or not 0 < mass < 1 or not sum(counts):
        return values.copy()
    probability = (strength * mass + counts[0]) / (strength + sum(counts))
    result = values.copy()
    result[mask] *= probability / mass
    result[~mask] *= (1 - probability) / (1 - mass)
    return result


def fit_cue(games, actor, base_strategy, strength=1):
    if strength != 1:
        raise ValueError('Clock crowding uses one declared baseline pseudo-observation')
    cutoff, allowed = actor['trainingCut'], set(actor['trainedAids'])
    training = sorted([game for game in games if game['aid'] in allowed and game['availableAt'] < cutoff],
                      key=lambda game: game['availableAt'], reverse=True)
    if (len(training) != actor['trainingGames'][actor['name']] or {game['aid'] for game in training} != allowed
            or set(base_strategy['trainedAids']) != allowed or base_strategy['trainingCut'] != cutoff
            or base_strategy['availableThrough'] != max((game['availableAt'] for game in training), default=None)):
        raise ValueError('Clock crowding fit changed frozen own-person membership or base availability')
    counts = np.zeros((2, 2))
    choices = [0, 0]
    for age, game in enumerate(training):
        scope = 0 if game.get('initialNewLevel') else 1
        for decision in game['decisions']:
            if decision['k'] < 0:
                continue
            mask = cue_mask(decision)
            if not np.any(mask) or np.all(mask):
                continue
            counts[scope, 0 if mask[decision['k']] else 1] += 0.5 ** (age / 20)
            choices[scope] += 1
    return {'type': 'personalClockCrowdingCue-v1', 'baseStrategy': base_strategy, 'counts': counts.tolist(),
            'priorStrength': strength, 'trainingCut': cutoff,
            'availableThrough': max((game['availableAt'] for game in training), default=None),
            'trainedAids': sorted(allowed), 'trainingGames': len(training), 'trainingCueChoices': choices,
            'settings': {'prefixHalfLife': 20, 'initialNewSeparate': True},
            'note': 'Public tray3 OR a found clock route ending with three occupied slots and no known ready match, '
                'plus a known immediate pair with a found within-budget clock exit of at-most-two occupied slots '
                'or three with a ready known mate. Own earlier choices fit initial-new/retry cue rates independently. '
                'One current-baseline pseudo-observation shrinks sparse evidence; no data leaves the baseline unchanged. '
                'The old causal strategy filter remains an auxiliary predictor; this output correction does not claim '
                'a newly identified latent generative strategy or universal greedy preference. No winning labels enter fitting.'}


def score_cue(games, actor, model, enabled=True):
    base = model['baseStrategy']
    loss, hits, count = 0.0, 0.0, 0
    for game in games:
        scope = 0 if game.get('initialNewLevel') else 1
        posterior = np.asarray(base['priors'][scope])
        previous, started = None, False
        for decision in game['decisions']:
            if decision['k'] < 0:
                continue
            active = bool(np.any(strategy_features(decision)))
            prior = posterior
            if active and started:
                prior = posterior @ transition_probabilities(context_of(decision, previous)[None, :], base['switchWeights'])[0]
            baseline, emission = predictive(decision, actor, base, prior)
            values = adjust(baseline, cue_mask(decision), model['counts'][scope], model['priorStrength']) if enabled else baseline
            selected = decision['k']
            ties = np.isclose(values, values.max(), rtol=1e-8, atol=1e-12)
            loss -= math.log(max(1e-300, values[selected]))
            hits += float(ties[selected]) / ties.sum()
            count += 1
            if active:
                posterior = prior * emission[selected]
                posterior /= posterior.sum()
                previous, started = observation_of(decision, selected), True
    return {'decisions': count, 'jointLogLoss': loss / count if count else None, 'topActionAccuracy': hits / count if count else None}
