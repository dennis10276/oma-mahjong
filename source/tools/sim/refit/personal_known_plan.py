import math

import numpy as np
from scipy.optimize import minimize
from scipy.special import logsumexp

from personal_full_choice_fit import probabilities


FEATURES = ['knownProgress', 'knownTrayClear', 'knownTrap', 'informationReachable', 'planningBoundary']
PARAMETERS = {'taps': 6, 'nodes': 256, 'progress': 4}


def plan_features(decision):
    features = np.asarray(decision['knownPlan'], dtype=float)
    if features.shape != (len(decision['F']), len(FEATURES)) or not np.all(np.isfinite(features)) or np.any((features < 0) | (features > 1)):
        raise ValueError('Invalid known-only plan features')
    return features


def plan_probabilities(decision, kind, within, weights):
    weights = np.asarray(weights, dtype=float)
    if weights.shape != (len(FEATURES),) or not np.all(np.isfinite(weights)) or weights[-1] != 0:
        raise ValueError('Invalid personal known-plan weights')
    scores = np.log(np.maximum(1e-300, probabilities(decision, kind, within))) + plan_features(decision) @ weights
    return np.exp(scores - logsumexp(scores))


def objective(weights, matrix, log_base, starts, sizes, selected, importance, penalty):
    scores = log_base + matrix @ weights
    maximum = np.maximum.reduceat(scores, starts)
    exponent = np.exp(scores - np.repeat(maximum, sizes))
    normalizers = np.add.reduceat(exponent, starts)
    probability = exponent / np.repeat(normalizers, sizes)
    loss = importance @ (maximum + np.log(normalizers) - scores[selected]) + 0.5 * penalty * (weights @ weights)
    gradient = matrix.T @ (probability * np.repeat(importance, sizes)) - importance @ matrix[selected] + penalty * weights
    return loss, gradient


def fit_plan(games, actor, penalty=20):
    cutoff, allowed = actor['trainingCut'], set(actor['trainedAids'])
    training = sorted([game for game in games if game['aid'] in allowed and game['availableAt'] < cutoff],
                      key=lambda game: game['availableAt'], reverse=True)
    if len(training) != actor['trainingGames'][actor['name']] or set(game['aid'] for game in training) != allowed:
        raise ValueError('Known-plan fitting changed the frozen own-person actor membership')
    kind = np.asarray([actor['kindModel']['weights'][name] for name in ['flip', 'pair', 'single', 'fatal']])
    within = np.asarray(actor['withinWeights'])
    samples, choices = [], 0
    for age, game in enumerate(training):
        for decision in game['decisions']:
            selected = decision['k']
            if selected < 0:
                continue
            choices += 1
            features = plan_features(decision)
            if len(features) > 1 and np.any(np.ptp(features[:, :-1], axis=0) > 0):
                samples.append((features, np.log(np.maximum(1e-300, probabilities(decision, kind, within))),
                                selected, 0.5 ** (age / 20)))
    weights = np.zeros(len(FEATURES))
    before, after = None, None
    if samples:
        starts = np.cumsum([0] + [len(features) for features, _, _, _ in samples[:-1]])
        sizes = np.asarray([len(features) for features, _, _, _ in samples])
        selected = starts + np.asarray([selection for _, _, selection, _ in samples])
        importance = np.asarray([weight for _, _, _, weight in samples])
        matrix = np.concatenate([features for features, _, _, _ in samples])
        log_base = np.concatenate([base for _, base, _, _ in samples])
        arguments = (matrix, log_base, starts, sizes, selected, importance, penalty)
        before = objective(weights, *arguments)[0]
        result = minimize(objective, weights, args=arguments, jac=True, method='L-BFGS-B',
                          bounds=[(-4, 4)] * (len(FEATURES) - 1) + [(0, 0)], options={'maxiter': 200, 'ftol': 1e-11})
        if not result.success or not np.all(np.isfinite(result.x)):
            raise RuntimeError('Personal known-plan fitting failed: ' + result.message)
        weights = result.x
        after = objective(weights, *arguments)[0]
        if after > before + 1e-8:
            raise ValueError('Personal known-plan fit worsened its regularized training objective')
    return {'type': 'personalKnownTrayPlan-v1', 'features': FEATURES, 'weights': weights.tolist(), 'parameters': PARAMETERS,
            'trainingCut': cutoff, 'availableThrough': max((game['availableAt'] for game in training), default=None),
            'trainingGames': len(training), 'trainingChoices': choices, 'informativeTrainingChoices': len(samples),
            'trainedAids': sorted(allowed), 'settings': {'weightPenalty': penalty, 'weightBound': 4, 'prefixHalfLife': 20,
                'planningBoundaryWeight': 0}, 'trainingObjectiveBefore': before, 'trainingObjectiveAfter': after,
            'note': 'Own earlier observed choices only; no family prior, target trajectory, future winning try or fixed greedy preference. '
                    'The planning-boundary coefficient is fixed at zero, not learned as a playing preference. '
                    'The search offers known route evidence, not a hidden-picture oracle; active-clock features remain zero.'}


def score_plan(games, actor, model):
    kind = np.asarray([actor['kindModel']['weights'][name] for name in ['flip', 'pair', 'single', 'fatal']])
    within = np.asarray(actor['withinWeights'])
    loss, hits, decisions = 0.0, 0.0, 0
    for game in games:
        for decision in game['decisions']:
            selected = decision['k']
            if selected < 0:
                continue
            values = plan_probabilities(decision, kind, within, model['weights'])
            ties = np.isclose(values, values.max(), rtol=1e-8, atol=1e-12)
            loss -= math.log(max(1e-300, values[selected]))
            hits += float(ties[selected]) / ties.sum()
            decisions += 1
    return {'decisions': decisions, 'jointLogLoss': loss / decisions if decisions else None,
            'topActionAccuracy': hits / decisions if decisions else None}
