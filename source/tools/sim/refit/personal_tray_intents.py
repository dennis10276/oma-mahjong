import math

import numpy as np
from scipy.optimize import minimize

from personal_clock_intents import components_of, forward_backward, switch_objective, transitions_of
from personal_full_choice_fit import probabilities


MODES = ['ordinary', 'knownMatch', 'recover']
CONTEXT = ['bias', 'tray1', 'tray2', 'tray3', 'knownMatch', 'knownClear', 'information', 'boundary', 'previousMatch', 'previousRecovery']
FEATURES = ['knownProgress', 'knownTrayClear', 'knownTrap', 'informationReachable', 'planningBoundary']
PARAMETERS = {'taps': 6, 'nodes': 256, 'progress': 4}


def checked_features(decision):
    matrix = np.asarray(decision['trayPlan'], dtype=float)
    if matrix.shape != (len(decision['F']), len(FEATURES)) or not np.all(np.isfinite(matrix)) or np.any((matrix < 0) | (matrix > 1)):
        raise ValueError('Invalid public tray intent features')
    return matrix


def masks_of(decision):
    matrix, features = checked_features(decision), np.asarray(decision['F'])
    safe = matrix[:, 2] == 0
    match = safe & ((features[:, 14] > 0) | (features[:, 64] > 0) | (features[:, 66] > 0))
    useful_inspection = (features[:, 19] == 0) | (features[:, 65] == 0) | (features[:, 67] > 0)
    recover = safe & useful_inspection & (matrix[:, 1] > 0) if np.any(matrix[:, 1] > 0) else safe & useful_inspection & (
        ((matrix[:, 3] > 0) & (features[:, 19] > 0) & (features[:, 65] == 0)) | ((matrix[:, 0] > 0) & (features[:, 67] > 0)))
    return np.asarray([np.ones(len(matrix), dtype=bool), match, recover])


def context_of(decision, previous=None):
    matrix, masks = checked_features(decision), masks_of(decision)
    previous = previous or {'match': 0, 'recover': 0}
    return np.asarray([1, *decision['kindContext'][1:4], float(np.any(masks[1])), float(np.any(matrix[:, 1])),
                       float(np.any(matrix[:, 3])), float(np.any(matrix[:, 4])), previous['match'], previous['recover']])


def observation_of(decision, selected):
    masks = masks_of(decision)
    return {'match': float(masks[1, selected]), 'recover': float(masks[2, selected])}


def predictive(decision, actor, model, prior, enabled=True):
    kind = np.asarray([actor['kindModel']['weights'][name] for name in ['flip', 'pair', 'single', 'fatal']])
    base = probabilities(decision, kind, np.asarray(actor['withinWeights']))
    components = components_of(base, masks_of(decision))
    active = enabled and model['trainingChoices'] > 0 and bool(np.any(checked_features(decision)))
    return components @ prior if active else base, components


def fit_tray_intents(games, actor, iterations=8, penalty=5):
    allowed, cutoff = set(actor['trainedAids']), actor['trainingCut']
    training = sorted([game for game in games if game['aid'] in allowed and game['availableAt'] < cutoff],
                      key=lambda game: game['availableAt'], reverse=True)
    if len(training) != actor['trainingGames'][actor['name']] or {game['aid'] for game in training} != allowed:
        raise ValueError('Tray intents changed frozen own membership')
    kind = np.asarray([actor['kindModel']['weights'][name] for name in ['flip', 'pair', 'single', 'fatal']])
    within = np.asarray(actor['withinWeights'])
    emissions, contexts, sequences, importance = [], [], [], []
    for age, game in enumerate(training):
        previous, first = None, len(emissions)
        weight = .5 ** (age / 20)
        for decision in game['decisions']:
            if decision['k'] < 0 or not np.any(checked_features(decision)):
                continue
            base = probabilities(decision, kind, within)
            emissions.append(components_of(base, masks_of(decision))[decision['k']])
            contexts.append(context_of(decision, previous))
            previous = observation_of(decision, decision['k'])
            importance.append(weight)
        if len(emissions) > first:
            sequences.append({'first': first, 'last': len(emissions), 'prior': 0 if game.get('initialNewLevel') else 1, 'weight': weight})
    reference = np.zeros((len(MODES), len(MODES), len(CONTEXT)))
    for mode in range(len(MODES)):
        reference[mode, mode, 0] = 1.5
    weights, priors, objectives = reference.copy(), np.full((2, len(MODES)), 1 / len(MODES)), []
    if emissions:
        log_emission = np.log(np.maximum(1e-300, emissions))
        contexts, importance = np.asarray(contexts), np.asarray(importance)
        for iteration in range(iterations + 1):
            transitions = transitions_of(contexts, weights)
            xi, prior_counts, likelihood = np.zeros_like(transitions), np.ones_like(priors), 0.0
            for sequence in sequences:
                section = slice(sequence['first'], sequence['last'])
                value, gamma, pairs = forward_backward(log_emission[section], transitions[section], priors[sequence['prior']])
                xi[section] = pairs
                prior_counts[sequence['prior']] += sequence['weight'] * gamma[0]
                likelihood += sequence['weight'] * value
            objectives.append(-likelihood + .5 * penalty * np.sum((weights - reference) ** 2) - np.log(priors).sum())
            if iteration == iterations:
                break
            priors = prior_counts / prior_counts.sum(axis=1, keepdims=True)
            for mode in range(len(MODES)):
                fit = minimize(switch_objective, weights[mode].ravel(),
                    args=(contexts, xi[:, mode], importance, reference[mode], penalty), jac=True, method='L-BFGS-B',
                    bounds=[(-4, 4)] * (len(MODES) * len(CONTEXT)), options={'maxiter': 200, 'ftol': 1e-11})
                if not fit.success or not np.all(np.isfinite(fit.x)):
                    raise RuntimeError('Personal tray intent fit failed: ' + fit.message)
                weights[mode] = fit.x.reshape(len(MODES), len(CONTEXT))
        if any(later > earlier + 1e-7 for earlier, later in zip(objectives, objectives[1:])):
            raise ValueError('Tray intent EM worsened its declared training objective')
    return {'type': 'personalPersistentTrayIntents-v1', 'modes': MODES, 'features': FEATURES, 'context': CONTEXT,
        'parameters': PARAMETERS, 'switchWeights': weights.tolist(), 'priors': priors.tolist(),
        'trainingCut': cutoff, 'availableThrough': max((game['availableAt'] for game in training), default=None),
        'trainingGames': len(training), 'trainingActiveGames': len(sequences), 'trainingChoices': len(emissions),
        'trainedAids': sorted(allowed), 'trainingObjectives': objectives,
        'settings': {'emIterations': iterations, 'switchPenalty': penalty, 'switchBound': 4, 'stickyPriorIntercept': 1.5,
                     'prefixHalfLife': 20, 'initialPriorPseudoCount': 1},
        'note': 'Optional own ordinary/match/recovery intents learned from earlier natural actions, not universal greedy finishing. '
                'Known bounded escapes are public. Without a known escape, inspection/preparation can preserve tray capacity. '
                'Unnecessary pickups remain supported by ordinary behavior. Active-clock actions are unchanged. '
                'Only causal filtering runs autonomously; no future state smoothing, hidden pictures or winning labels.'}


def score_tray_intents(games, actor, model):
    loss, hits, count = 0.0, 0.0, 0
    for game in games:
        posterior, previous, started = np.asarray(model['priors'][0 if game.get('initialNewLevel') else 1]), None, False
        for decision in game['decisions']:
            if decision['k'] < 0:
                continue
            active = model['trainingChoices'] > 0 and bool(np.any(checked_features(decision)))
            prior = posterior
            if active and started:
                prior = posterior @ transitions_of(context_of(decision, previous)[None, :], model['switchWeights'])[0]
            values, components = predictive(decision, actor, model, prior)
            selected = decision['k']
            loss -= math.log(max(1e-300, values[selected]))
            ties = np.isclose(values, values.max(), rtol=1e-8, atol=1e-12)
            hits += float(ties[selected]) / ties.sum()
            count += 1
            if active:
                posterior = prior * components[selected]
                posterior /= posterior.sum()
                previous = observation_of(decision, selected)
                started = True
    return {'decisions': count, 'jointLogLoss': loss / count if count else None, 'topActionAccuracy': hits / count if count else None}
