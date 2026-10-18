import math

import numpy as np
from scipy.optimize import minimize
from scipy.special import logsumexp

from personal_full_choice_fit import probabilities
from personal_value import immediate_features


FEATURES = ['sideX', 'sideY', 'height', 'pair', 'trayMatch', 'peekMatch', 'inspection', 'reopen',
            'pairPreparation', 'keyProgress', 'clockProgress', 'urgentClockProgress', 'mateDepth',
            'trayThree', 'freeOptions', 'expectedReveal']


def plan_features(decision):
    actual = immediate_features(decision)
    result = np.column_stack([actual[:, 21] - 0.5, actual[:, 22] - 0.5, actual[:, 26], actual[:, 14],
        actual[:, 64], actual[:, 66], actual[:, 19], actual[:, 65], actual[:, 67],
        actual[:, 69], actual[:, 72], actual[:, 73], np.clip(actual[:, 3], 0, 20) / 20,
        actual[:, 2], np.log1p(np.maximum(0, actual[:, 6])) / 5, np.clip(actual[:, 13], 0, 4) / 4])
    if not np.all(np.isfinite(result)):
        raise ValueError('Nonfinite personal plan features')
    return result


def failure_reason(game):
    if not game.get('complete') or game.get('stopReason') != 'end':
        return None
    if game.get('ending') == 'restart':
        return 'restart'
    if game.get('ending') == 'stuck':
        return game.get('reconstructed', {}).get('why') if game.get('reconstructed', {}).get('why') in ['clock', 'tray'] else 'other'
    return None


def eligible(games, cutoff, allowed):
    return sorted([game for game in games if game['availableAt'] < cutoff and game['aid'] in allowed
                   and all(source['aid'] in allowed and source['availableAt'] < cutoff and source['availableAt'] < game['t']
                           for source in game.get('memorySources', []))], key=lambda game: game['availableAt'], reverse=True)


def retry_links(games):
    campaigns = {}
    for game in games:
        if game.get('campaignStart') is not None and game.get('campaignBoard') and not game.get('campaignBoardChanged', False):
            campaigns.setdefault((game['campaignStart'], game['campaignBoard']), []).append(game)
    links = []
    for members in campaigns.values():
        ordered = sorted(members, key=lambda game: game['t'])
        for previous, current in zip(ordered, ordered[1:]):
            reason = failure_reason(previous)
            if reason and previous['availableAt'] < current['t'] and current['at'] == previous['at'] + 1:
                links.append((previous['aid'], current['aid'], reason))
    return links


def transitions_of(games, posteriors, prior):
    counts = {reason: np.zeros((2, 2)) for reason in ['any', 'clock', 'tray', 'restart', 'other']}
    ages = {game['aid']: age for age, game in enumerate(sorted(games, key=lambda game: game['availableAt'], reverse=True))}
    links = retry_links(games)
    for previous, current, reason in links:
        weight = 0.5 ** (ages[current] / 20)
        mass = weight * np.outer(posteriors[previous], posteriors[current])
        counts['any'] += mass
        counts[reason] += mass
    aggregate = counts['any'] + 2 * np.tile(prior, (2, 1))
    aggregate /= aggregate.sum(axis=1, keepdims=True)
    result = {'any': aggregate.tolist()}
    for reason in ['clock', 'tray', 'restart', 'other']:
        matrix = counts[reason] + 2 * aggregate
        result[reason] = (matrix / matrix.sum(axis=1, keepdims=True)).tolist()
    return result, [{'previous': previous, 'current': current, 'reason': reason} for previous, current, reason in links]


def fit_plan(games, kind, within, cutoff, allowed, iterations=8):
    training = eligible(games, cutoff, allowed)
    matrices, base, sizes, selections, game_indices = [], [], [], [], []
    for game_index, game in enumerate(training):
        for decision in game['decisions']:
            if decision['k'] < 0 or len(decision['F']) < 2:
                continue
            if decision['k'] >= len(decision['F']):
                raise ValueError('Personal plan choice differs from observation')
            matrices.append(plan_features(decision))
            base.extend(np.log(np.maximum(probabilities(decision, kind, within), 1e-300)))
            sizes.append(len(decision['F']))
            selections.append(decision['k'])
            game_indices.append(game_index)
    prior = np.full(2, 0.5)
    weights = np.zeros((2, len(FEATURES)))
    posteriors = {game['aid']: prior.copy() for game in training}
    objectives = []
    if len(training) >= 6 and len(selections) >= 64:
        matrix = np.concatenate(matrices)
        widths = np.asarray(sizes)
        starts = np.cumsum(np.r_[0, widths[:-1]])
        selected = starts + np.asarray(selections)
        selected_features = matrix[selected]
        log_base = np.asarray(base)
        membership = np.asarray(game_indices)
        importance = 0.5 ** (np.arange(len(training)) / 20)
        weights[0, 0], weights[0, 9], weights[0, 10] = 0.3, 0.2, -0.2
        weights[1] = -weights[0]

        def component_logs(parameter):
            scores = log_base + matrix @ parameter
            maximum = np.maximum.reduceat(scores, starts)
            exponent = np.exp(scores - np.repeat(maximum, widths))
            normalizer = maximum + np.log(np.add.reduceat(exponent, starts))
            chosen = scores[selected] - normalizer
            return np.bincount(membership, weights=chosen, minlength=len(training))

        def objective_of(parameters, mixture):
            likelihood = np.column_stack([component_logs(parameter) for parameter in parameters])
            total = logsumexp(likelihood + np.log(mixture), axis=1)
            objective = -importance @ total + 10 * np.sum(parameters ** 2) - np.log(mixture).sum()
            posterior = np.exp(likelihood + np.log(mixture) - total[:, None])
            return float(objective), posterior

        current_objective, responsibility = objective_of(weights, prior)
        objectives.append(current_objective)
        for iteration in range(iterations):
            for component in range(2):
                decision_weight = importance[membership] * responsibility[membership, component]
                row_weight = np.repeat(decision_weight, widths)

                def objective(parameter):
                    scores = log_base + matrix @ parameter
                    maximum = np.maximum.reduceat(scores, starts)
                    exponent = np.exp(scores - np.repeat(maximum, widths))
                    total = np.add.reduceat(exponent, starts)
                    probability = exponent / np.repeat(total, widths)
                    loss = decision_weight @ (maximum + np.log(total) - scores[selected]) + 10 * (parameter @ parameter)
                    gradient = matrix.T @ (probability * row_weight) - decision_weight @ selected_features + 20 * parameter
                    return loss, gradient

                fitted = minimize(objective, weights[component], jac=True, method='L-BFGS-B', bounds=[(-4, 4)] * len(FEATURES),
                                  options={'maxiter': 80, 'ftol': 1e-9})
                if not fitted.success or not np.all(np.isfinite(fitted.x)):
                    raise RuntimeError('Personal episode preference failed: ' + fitted.message)
                weights[component] = fitted.x
            prior = 1 + importance @ responsibility
            prior /= prior.sum()
            next_objective, responsibility = objective_of(weights, prior)
            if next_objective > current_objective + 1e-5 * (1 + abs(current_objective)):
                raise RuntimeError('Personal episode mixture objective regressed')
            objectives.append(next_objective)
            current_objective = next_objective
        posteriors = {game['aid']: responsibility[index] for index, game in enumerate(training)}
    initial = 2 * prior
    for age, game in enumerate(training):
        if game.get('initialNewLevel', False):
            initial += 0.5 ** (age / 20) * posteriors[game['aid']]
    initial /= initial.sum()
    transitions, links = transitions_of(training, posteriors, prior)
    return {'type': 'personalEpisodeStyles-v1', 'features': FEATURES, 'weights': weights.tolist(), 'prior': prior.tolist(),
            'initialPrior': initial.tolist(), 'transitions': transitions, 'transitionLinks': links,
            'trainingCut': cutoff, 'trainingGames': len(training), 'trainingChoices': len(selections),
            'availableThrough': max((game['availableAt'] for game in training), default=None),
            'trainedAids': sorted({aid for game in training for aid in [game['aid'], *[source['aid'] for source in game.get('memorySources', [])]]}),
            'settings': {'components': 2, 'iterations': iterations, 'weightPenalty': 20, 'weightBound': 4, 'priorPseudoCount': 1},
            'trainingObjectives': objectives,
            'note': 'Own earlier choices fit two whole-attempt preference components, not prescribed greedy styles or psychological labels. '
                    'Twenty-prefix decay, bounded regularized residuals and symmetric priors. New-level initial priors use earlier initial-new prefixes; '
                    'retry transitions use only adjacent same-board campaigns with earlier available observed natural failures. '
                    'Missing, helped, resumed/gapped or unavailable failures cannot create transitions. No target winning-count label enters fitting.'}


def component_probabilities(decision, kind, within, model):
    if model['type'] != 'personalEpisodeStyles-v1' or model['features'] != FEATURES:
        raise ValueError('Personal plan schema differs')
    weights = np.asarray(model['weights'])
    if weights.shape != (2, len(FEATURES)) or not np.all(np.isfinite(weights)):
        raise ValueError('Invalid personal plan weights')
    base = probabilities(decision, kind, within)
    scores = np.log(np.maximum(base, 1e-300))[None, :] + weights @ plan_features(decision).T
    return np.exp(scores - logsumexp(scores, axis=1, keepdims=True))


def score_plan(game, kind, within, model, initial=None):
    prior = np.asarray(initial if initial is not None else model['initialPrior'] if game.get('initialNewLevel', False) else model['prior'], dtype=float)
    if prior.shape != (2,) or not np.all(np.isfinite(prior)) or np.any(prior <= 0) or not np.isclose(prior.sum(), 1):
        raise ValueError('Invalid personal episode prior')
    posterior = prior.copy()
    loss, step_loss, hits, step_hits, decisions = 0.0, 0.0, 0.0, 0.0, 0
    for decision in game['decisions']:
        if decision['k'] < 0:
            continue
        components = component_probabilities(decision, kind, within, model)
        predictive, independent = posterior @ components, prior @ components
        chosen = decision['k']
        loss -= math.log(max(1e-300, predictive[chosen]))
        step_loss -= math.log(max(1e-300, independent[chosen]))
        for probability, destination in [(predictive, 'episode'), (independent, 'step')]:
            ties = np.isclose(probability, probability.max(), rtol=1e-8, atol=1e-12)
            value = float(ties[chosen]) / ties.sum()
            if destination == 'episode':
                hits += value
            else:
                step_hits += value
        log_posterior = np.log(np.maximum(posterior, 1e-300)) + np.log(np.maximum(components[:, chosen], 1e-300))
        posterior = np.exp(log_posterior - logsumexp(log_posterior))
        decisions += 1
    return {'decisions': decisions, 'jointLogLoss': loss / decisions if decisions else None,
            'topActionAccuracy': hits / decisions if decisions else None,
            'stepLogLoss': step_loss / decisions if decisions else None, 'stepTopActionAccuracy': step_hits / decisions if decisions else None,
            'posterior': posterior.tolist()}
