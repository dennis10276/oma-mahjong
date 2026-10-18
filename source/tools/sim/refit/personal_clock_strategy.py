import math

import numpy as np
from scipy.optimize import minimize
from scipy.special import expit, logsumexp

from personal_full_choice_fit import probabilities
from personal_known_plan import objective


FEATURES = ['clockRoute', 'clockExitTwo', 'clockExitThreeMatch', 'foundExitRoom', 'knownClockTrap',
            'clockInformation', 'pairBeforeClock', 'clockDigRemoval', 'clockDigInspection', 'urgentClockDig', 'pressuredClockDig', 'clockBoundary']
CONTEXT = ['intercept', 'trayTwo', 'trayThree', 'exitTwoFound', 'exitThreeMatchFound', 'information',
           'urgency', 'previousDig', 'previousPair', 'routeLost']
PARAMETERS = {'taps': 12, 'nodes': 256}


def strategy_features(decision):
    matrix = np.asarray(decision['knownPlan'], dtype=float)
    if (matrix.shape != (len(decision['F']), len(FEATURES)) or not np.all(np.isfinite(matrix))
            or np.any((matrix < 0) | (matrix > 1))):
        raise ValueError('Invalid public clock-strategy features')
    return matrix


def context_of(decision, previous=None):
    matrix = strategy_features(decision)
    previous = previous or {'dig': 0, 'pair': 0, 'route': 0}
    route = float(np.any(matrix[:, 0]))
    return np.asarray([1, decision['kindContext'][2], decision['kindContext'][3], float(np.any(matrix[:, 1])),
                       float(np.any(matrix[:, 2])), float(np.any(matrix[:, 5])), float(matrix[:, 9].max()),
                       previous['dig'], previous['pair'], float(previous['route'] > route)])


def observation_of(decision, selected):
    feature = strategy_features(decision)[selected]
    immediate = decision.get('immediate')
    pair = immediate[selected][14] if immediate is not None else decision['F'][selected][14]
    return {'dig': float(feature[7] > 0 or feature[8] > 0), 'pair': float(pair),
            'route': float(np.any(strategy_features(decision)[:, 0]))}


def transition_probabilities(contexts, weights):
    to_one = expit(np.asarray(contexts) @ np.asarray(weights).T)
    return np.stack([1 - to_one, to_one], axis=-1)


def forward_backward(log_emission, transitions, prior):
    log_emission = np.asarray(log_emission)
    transitions = np.asarray(transitions)
    count = len(log_emission)
    if log_emission.shape != (count, 2) or transitions.shape != (count, 2, 2) or not count:
        raise ValueError('Invalid clock-strategy sequence')
    log_transition = np.log(np.maximum(1e-300, transitions))
    forward = np.zeros_like(log_emission)
    forward[0] = np.log(prior) + log_emission[0]
    for index in range(1, count):
        forward[index] = log_emission[index] + logsumexp(forward[index - 1, :, None] + log_transition[index], axis=0)
    likelihood = logsumexp(forward[-1])
    backward = np.zeros_like(log_emission)
    for index in range(count - 2, -1, -1):
        backward[index] = logsumexp(log_transition[index + 1] + log_emission[index + 1, None, :] + backward[index + 1, None, :], axis=1)
    gamma = np.exp(forward + backward - likelihood)
    xi = np.zeros((count, 2, 2))
    for index in range(1, count):
        xi[index] = np.exp(forward[index - 1, :, None] + log_transition[index]
                           + log_emission[index, None, :] + backward[index, None, :] - likelihood)
    return float(likelihood), gamma, xi


def switch_objective(weights, contexts, to_one, total, importance, penalty):
    logits = contexts @ weights
    loss = importance @ (total * np.logaddexp(0, logits) - to_one * logits) + 0.5 * penalty * (weights @ weights)
    gradient = contexts.T @ (importance * (total * expit(logits) - to_one)) + penalty * weights
    return loss, gradient


def predictive(decision, actor, model, prior, scale=1):
    kind = np.asarray([actor['kindModel']['weights'][name] for name in ['flip', 'pair', 'single', 'fatal']])
    base = probabilities(decision, kind, np.asarray(actor['withinWeights']))
    matrix = strategy_features(decision)
    scores = np.log(np.maximum(1e-300, base))[:, None] + matrix @ (np.asarray(model['weights']) * scale).T
    emission = np.exp(scores - logsumexp(scores, axis=0))
    return emission @ prior, emission


def fit_strategy(games, actor, penalty=20, iterations=8):
    cutoff, allowed = actor['trainingCut'], set(actor['trainedAids'])
    training = sorted([game for game in games if game['aid'] in allowed and game['availableAt'] < cutoff],
                      key=lambda game: game['availableAt'], reverse=True)
    if len(training) != actor['trainingGames'][actor['name']] or {game['aid'] for game in training} != allowed:
        raise ValueError('Adaptive clock fitting changed frozen own-person membership')
    kind = np.asarray([actor['kindModel']['weights'][name] for name in ['flip', 'pair', 'single', 'fatal']])
    within = np.asarray(actor['withinWeights'])
    matrices, bases, selections, sequences, all_contexts, importance = [], [], [], [], [], []
    for age, game in enumerate(training):
        contexts, previous, first = [], None, len(matrices)
        for decision in game['decisions']:
            matrix = strategy_features(decision)
            if decision['k'] < 0 or not np.any(matrix):
                continue
            contexts.append(context_of(decision, previous))
            previous = observation_of(decision, decision['k'])
            matrices.append(matrix)
            bases.append(np.log(np.maximum(1e-300, probabilities(decision, kind, within))))
            selections.append(decision['k'])
            importance.append(0.5 ** (age / 20))
        if contexts:
            sequences.append({'first': first, 'last': len(matrices), 'prior': 0 if game.get('initialNewLevel') else 1,
                              'importance': 0.5 ** (age / 20)})
            all_contexts.extend(contexts)
    weights = np.zeros((2, len(FEATURES)))
    switch_weights = np.zeros((2, len(CONTEXT)))
    priors = np.full((2, 2), 0.5)
    objectives = []
    if matrices:
        random = np.random.default_rng(20261018)
        weights = random.normal(0, 0.05, weights.shape)
        weights[:, -1] = 0
        switch_weights[:, 0] = [-0.2, 0.2]
        sizes = np.asarray([len(matrix) for matrix in matrices])
        starts = np.cumsum([0] + sizes[:-1].tolist())
        selected = starts + np.asarray(selections)
        matrix, log_base = np.concatenate(matrices), np.concatenate(bases)
        contexts, importance = np.asarray(all_contexts), np.asarray(importance)
        for _ in range(iterations):
            scores = log_base[:, None] + matrix @ weights.T
            maximum = np.maximum.reduceat(scores, starts, axis=0)
            mass = np.exp(scores - np.repeat(maximum, sizes, axis=0))
            normalizer = maximum + np.log(np.add.reduceat(mass, starts, axis=0))
            log_emission = scores[selected] - normalizer
            transitions = transition_probabilities(contexts, switch_weights)
            gamma, xi = np.zeros_like(log_emission), np.zeros_like(transitions)
            prior_counts = np.ones((2, 2))
            likelihood = 0.0
            for sequence in sequences:
                section = slice(sequence['first'], sequence['last'])
                value, posterior, pairs = forward_backward(log_emission[section], transitions[section], priors[sequence['prior']])
                gamma[section], xi[section] = posterior, pairs
                prior_counts[sequence['prior']] += posterior[0] * sequence['importance']
                likelihood += value * sequence['importance']
            objectives.append(-likelihood + 0.5 * penalty * (np.sum(weights ** 2) + np.sum(switch_weights ** 2)) - np.log(priors).sum())
            priors = prior_counts / prior_counts.sum(axis=1, keepdims=True)
            for mode in range(2):
                arguments = (matrix, log_base, starts, sizes, selected, importance * gamma[:, mode], penalty)
                fitted = minimize(objective, weights[mode], args=arguments, jac=True, method='L-BFGS-B',
                                  bounds=[(-4, 4)] * (len(FEATURES) - 1) + [(0, 0)], options={'maxiter': 200, 'ftol': 1e-11})
                if not fitted.success or not np.all(np.isfinite(fitted.x)):
                    raise RuntimeError('Clock strategy emission fit failed: ' + fitted.message)
                weights[mode] = fitted.x
                switch_fit = minimize(switch_objective, switch_weights[mode],
                    args=(contexts, xi[:, mode, 1], xi[:, mode].sum(axis=1), importance, penalty), jac=True,
                    method='L-BFGS-B', bounds=[(-4, 4)] * len(CONTEXT), options={'maxiter': 200, 'ftol': 1e-11})
                if not switch_fit.success or not np.all(np.isfinite(switch_fit.x)):
                    raise RuntimeError('Clock strategy switch fit failed: ' + switch_fit.message)
                switch_weights[mode] = switch_fit.x
        if any(later > earlier + 1e-7 for earlier, later in zip(objectives, objectives[1:])):
            raise ValueError('Adaptive clock EM worsened its declared penalized training objective')
    return {'type': 'personalAdaptiveClock-v1', 'features': FEATURES, 'context': CONTEXT, 'parameters': PARAMETERS,
            'weights': weights.tolist(), 'switchWeights': switch_weights.tolist(), 'priors': priors.tolist(),
            'trainingCut': cutoff, 'availableThrough': max((game['availableAt'] for game in training), default=None),
            'trainingGames': len(training), 'trainingClockGames': len(sequences), 'trainingClockChoices': len(matrices),
            'trainedAids': sorted(allowed), 'trainingObjectives': objectives,
            'settings': {'weightPenalty': penalty, 'weightBound': 4, 'emIterations': iterations, 'prefixHalfLife': 20,
                         'boundaryWeight': 0, 'priorPseudoCount': 1, 'seed': 20261018},
            'note': 'Two exchangeable personal strategies and context-dependent switching fitted to earlier own choices only. '
                'Digging, pairing and exit room are public observations, not compulsory rules. Future training actions may smooth '
                'latent states only during fitting; evaluation/runtime use forward filtering from past actions only. '
                'Initial-new and other-attempt priors are fitted separately. No winning labels or family policy enter fitting. '
                'Generic physicalPlan must be disabled; no-clock actions retain the frozen ownAll baseline.'}


def score_strategy(games, actor, model, scale=1):
    loss, hits, count = 0.0, 0.0, 0
    for game in games:
        posterior = np.asarray(model['priors'][0 if game.get('initialNewLevel') else 1])
        previous, started = None, False
        for decision in game['decisions']:
            if decision['k'] < 0:
                continue
            active = bool(np.any(strategy_features(decision)))
            prior = posterior
            if active and started:
                prior = posterior @ transition_probabilities(context_of(decision, previous)[None, :], model['switchWeights'])[0]
            values, emission = predictive(decision, actor, model, prior, scale)
            selected = decision['k']
            ties = np.isclose(values, values.max(), rtol=1e-8, atol=1e-12)
            loss -= math.log(max(1e-300, values[selected]))
            hits += float(ties[selected]) / ties.sum()
            count += 1
            if active:
                posterior = prior * emission[selected]
                posterior /= posterior.sum()
                previous = observation_of(decision, selected)
                started = True
    return {'decisions': count, 'jointLogLoss': loss / count if count else None, 'topActionAccuracy': hits / count if count else None}
