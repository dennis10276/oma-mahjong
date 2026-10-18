import math

import numpy as np
from scipy.optimize import minimize
from scipy.special import logsumexp

from personal_clock_strategy import CONTEXT, FEATURES, PARAMETERS, context_of, observation_of, strategy_features
from personal_full_choice_fit import probabilities


MODES = ['ordinary', 'dig', 'pairFirst']


def masks_of(decision):
    matrix = strategy_features(decision)
    good_exit = (matrix[:, 1] > 0) | (matrix[:, 2] > 0)
    dig = ((matrix[:, 7] > 0) | (matrix[:, 8] > 0)) & (matrix[:, 4] == 0)
    if np.any(good_exit):
        dig &= good_exit
    features = np.asarray(decision['F'])
    pair = (matrix[:, 6] > 0) & ((features[:, 14] > 0) | (features[:, 64] > 0) | (features[:, 66] > 0))
    return np.asarray([np.ones(len(matrix), dtype=bool), dig, pair])


def components_of(values, masks):
    values, masks = np.asarray(values), np.asarray(masks)
    if (values.ndim != 1 or not len(values) or masks.shape != (len(MODES), len(values))
            or not np.all(np.isfinite(values)) or np.any(values < 0) or abs(values.sum() - 1) > 1e-12):
        raise ValueError('Invalid personal clock intent emissions')
    result = []
    for mask in masks:
        mass = values * mask
        result.append(mass / mass.sum() if mass.sum() > 0 else values.copy())
    return np.asarray(result).T


def transitions_of(contexts, weights):
    logits = np.einsum('nd,mkd->nmk', contexts, weights)
    return np.exp(logits - logsumexp(logits, axis=2, keepdims=True))


def forward_backward(log_emission, transitions, prior):
    log_emission, transitions, prior = np.asarray(log_emission), np.asarray(transitions), np.asarray(prior)
    count, modes = log_emission.shape
    if not count or modes != len(MODES) or transitions.shape != (count, modes, modes) or prior.shape != (modes,):
        raise ValueError('Invalid persistent-intent sequence')
    log_transition = np.log(np.maximum(1e-300, transitions))
    forward, backward = np.zeros_like(log_emission), np.zeros_like(log_emission)
    forward[0] = np.log(np.maximum(1e-300, prior)) + log_emission[0]
    for index in range(1, count):
        forward[index] = log_emission[index] + logsumexp(forward[index - 1, :, None] + log_transition[index], axis=0)
    likelihood = logsumexp(forward[-1])
    for index in range(count - 2, -1, -1):
        backward[index] = logsumexp(log_transition[index + 1] + log_emission[index + 1, None, :] + backward[index + 1, None, :], axis=1)
    gamma = np.exp(forward + backward - likelihood)
    xi = np.zeros_like(transitions)
    for index in range(1, count):
        xi[index] = np.exp(forward[index - 1, :, None] + log_transition[index] + log_emission[index, None, :] + backward[index, None, :] - likelihood)
    return float(likelihood), gamma, xi


def switch_objective(flattened, contexts, counts, importance, prior, penalty):
    weights = flattened.reshape(len(MODES), len(CONTEXT))
    logits = contexts @ weights.T
    normalizer = logsumexp(logits, axis=1)
    probabilities = np.exp(logits - normalizer[:, None])
    total = counts.sum(axis=1)
    difference = weights - prior
    loss = np.sum(importance * (total * normalizer - np.sum(counts * logits, axis=1))) + .5 * penalty * np.sum(difference ** 2)
    gradient = (importance[:, None] * (total[:, None] * probabilities - counts)).T @ contexts + penalty * difference
    return float(loss), gradient.ravel()


def predictive(decision, actor, model, prior, enabled=True):
    kind = np.asarray([actor['kindModel']['weights'][name] for name in ['flip', 'pair', 'single', 'fatal']])
    base = probabilities(decision, kind, np.asarray(actor['withinWeights']))
    components = components_of(base, masks_of(decision))
    active = enabled and model['trainingClockChoices'] > 0 and bool(np.any(strategy_features(decision)))
    return components @ prior if active else base, components


def fit_intents(games, actor, iterations=8, penalty=5):
    allowed, cutoff = set(actor['trainedAids']), actor['trainingCut']
    training = sorted([game for game in games if game['aid'] in allowed and game['availableAt'] < cutoff],
                      key=lambda game: game['availableAt'], reverse=True)
    if len(training) != actor['trainingGames'][actor['name']] or {game['aid'] for game in training} != allowed:
        raise ValueError('Persistent clock intents changed frozen own membership')
    kind = np.asarray([actor['kindModel']['weights'][name] for name in ['flip', 'pair', 'single', 'fatal']])
    within = np.asarray(actor['withinWeights'])
    emissions, contexts, sequences, importance = [], [], [], []
    for age, game in enumerate(training):
        previous, first = None, len(emissions)
        weight = 0.5 ** (age / 20)
        for decision in game['decisions']:
            if decision['k'] < 0 or not np.any(strategy_features(decision)):
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
    weights = reference.copy()
    priors = np.full((2, len(MODES)), 1 / len(MODES))
    objectives = []
    if emissions:
        log_emission = np.log(np.maximum(1e-300, emissions))
        contexts, importance = np.asarray(contexts), np.asarray(importance)
        for iteration in range(iterations + 1):
            transitions = transitions_of(contexts, weights)
            xi = np.zeros_like(transitions)
            prior_counts = np.ones_like(priors)
            likelihood = 0.0
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
                    raise RuntimeError('Personal clock intent switch fit failed: ' + fit.message)
                weights[mode] = fit.x.reshape(len(MODES), len(CONTEXT))
        if any(later > earlier + 1e-7 for earlier, later in zip(objectives, objectives[1:])):
            raise ValueError('Clock intent EM worsened its declared training objective')
    return {'type': 'personalPersistentClockIntents-v1', 'modes': MODES, 'features': FEATURES, 'context': CONTEXT,
        'parameters': PARAMETERS, 'switchWeights': weights.tolist(), 'priors': priors.tolist(),
        'trainingCut': cutoff, 'availableThrough': max((game['availableAt'] for game in training), default=None),
        'trainingGames': len(training), 'trainingClockGames': len(sequences), 'trainingClockChoices': len(emissions),
        'trainedAids': sorted(allowed), 'trainingObjectives': objectives,
        'settings': {'emIterations': iterations, 'switchPenalty': penalty, 'switchBound': 4, 'stickyPriorIntercept': 1.5,
                     'prefixHalfLife': 20, 'initialPriorPseudoCount': 1},
        'note': 'Three optional persistent public intents: ordinary own policy, clock digging and pairing before a supported safe clock exit. '
                'Intent probabilities/switching are learned only from own earlier natural actions. Empty option masks fall back to own policy. '
                'No clock training evidence disables intent control; unknown pictures and search bounds are not labelled traps. '
                'Fitting may smooth earlier latent states, but runtime uses only causal forward filtering and actual prior bot actions.'}


def score_intents(games, actor, model):
    loss, hits, count = 0.0, 0.0, 0
    for game in games:
        posterior = np.asarray(model['priors'][0 if game.get('initialNewLevel') else 1])
        previous, started = None, False
        for decision in game['decisions']:
            if decision['k'] < 0:
                continue
            active = model['trainingClockChoices'] > 0 and bool(np.any(strategy_features(decision)))
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
