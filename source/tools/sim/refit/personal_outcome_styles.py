import math

import numpy as np
from scipy.optimize import minimize
from scipy.special import logsumexp

from personal_full_choice_fit import probabilities
from personal_known_plan import objective
from personal_plan import FEATURES as PLAN_FEATURES, plan_features
from personal_policy_fit import kind_of
from personal_value import value_label


KINDS = ['flip', 'pair', 'single', 'fatal']
FEATURES = PLAN_FEATURES + [kind + '.' + context for kind in KINDS for context in ['intercept', 'trayTwo', 'trayThree']]


def style_features(decision):
    context = np.asarray([1, decision['kindContext'][2], decision['kindContext'][3]])
    kinds = [KINDS.index(kind_of(feature)) for feature in decision['F']]
    interactions = np.zeros((len(kinds), len(KINDS), len(context)))
    interactions[np.arange(len(kinds)), kinds, :] = context
    matrix = np.concatenate([plan_features(decision), interactions.reshape(len(kinds), -1)], axis=1)
    if not np.all(np.isfinite(matrix)):
        raise ValueError('Invalid public outcome-style features')
    return matrix


def fit_styles(games, actor, penalty=20):
    allowed, cutoff = set(actor['trainedAids']), actor['trainingCut']
    training = sorted([game for game in games if game['aid'] in allowed and game['availableAt'] < cutoff],
                      key=lambda game: game['availableAt'], reverse=True)
    if (len(training) != actor['trainingGames'][actor['name']] or {game['aid'] for game in training} != allowed
            or any(source['availableAt'] >= game['t'] or source['aid'] not in allowed
                   for game in training for source in game.get('memorySources', []))):
        raise ValueError('Outcome-style fitting changed earlier own-person membership')
    if not math.isfinite(penalty) or penalty <= 0:
        raise ValueError('Outcome-style penalty must be positive')
    kind = np.asarray([actor['kindModel']['weights'][name] for name in KINDS])
    within = np.asarray(actor['withinWeights'])
    samples, weights, labels = [[], []], [], []
    counts = np.zeros((2, 2))
    for age, game in enumerate(training):
        label = value_label(game)
        if label is None:
            continue
        valid = [decision for decision in game['decisions'] if decision['k'] >= 0]
        if not valid:
            continue
        importance = 0.5 ** (age / 20)
        scope = 0 if game.get('initialNewLevel') else 1
        counts[scope, label] += importance
        labels.append({'aid': game['aid'], 'availableAt': game['availableAt'], 'label': label,
                       'initialNewLevel': bool(game.get('initialNewLevel')), 'choices': len(valid)})
        for decision in valid:
            features = style_features(decision)
            if not 0 <= decision['k'] < len(features):
                raise ValueError('Outcome-style observed choice is outside its alternatives')
            if len(features) > 1:
                samples[label].append((features, np.log(np.maximum(1e-300, probabilities(decision, kind, within))),
                                       decision['k'], 64 * importance / len(valid)))
    objectives = []
    for group in samples:
        parameter = np.zeros(len(FEATURES))
        before, after = None, None
        if group:
            sizes = np.asarray([len(features) for features, _, _, _ in group])
            starts = np.cumsum(np.r_[0, sizes[:-1]])
            matrix = np.concatenate([features for features, _, _, _ in group])
            log_base = np.concatenate([base for _, base, _, _ in group])
            selected = starts + np.asarray([selected for _, _, selected, _ in group])
            importance = np.asarray([importance for _, _, _, importance in group])
            arguments = (matrix, log_base, starts, sizes, selected, importance, penalty)
            before = objective(parameter, *arguments)[0]
            result = minimize(objective, parameter, args=arguments, jac=True, method='L-BFGS-B',
                              bounds=[(-4, 4)] * len(FEATURES), options={'maxiter': 200, 'ftol': 1e-11})
            if not result.success or not np.all(np.isfinite(result.x)):
                raise RuntimeError('Own outcome-style fit failed: ' + result.message)
            parameter, after = result.x, objective(result.x, *arguments)[0]
            if after > before + 1e-8:
                raise ValueError('Outcome-style regularized objective worsened')
        weights.append(parameter.tolist())
        objectives.append({'before': before, 'after': after})
    overall = (counts.sum(axis=0) + 1) / (counts.sum() + 2)
    priors = (counts + 2 * overall) / (counts.sum(axis=1)[:, None] + 2)
    return {'type': 'personalOutcomeStyles-v1', 'features': FEATURES, 'weights': weights, 'priors': priors.tolist(),
            'trainingCut': cutoff, 'availableThrough': max((game['availableAt'] for game in training), default=None),
            'trainedAids': sorted(allowed), 'trainingGames': len(training), 'labelledGames': labels,
            'censoredGames': len(training) - len(labels), 'effectiveLabels': counts.tolist(), 'objectives': objectives,
            'settings': {'weightPenalty': penalty, 'weightBound': 4, 'prefixHalfLife': 20, 'trajectoryMass': 64,
                         'overallPriorPseudoCounts': [1, 1], 'scopePriorMass': 2},
            'note': 'Own earlier natural failure/success trajectories anchor two behavioral experts. '
                'Automatic guaranteed-safe cleanup is success; incomplete/tool/shuffle boundaries remain censored. '
                'Each trajectory has normalized influence; initial-new and retry priors use only own earlier labels. '
                'The expert is a correlated behavioral style, NOT a guaranteed future outcome. '
                'No target outcome, future winning count or other person selects the simulated style.'}


def components(decision, actor, model, enabled=True):
    kind = np.asarray([actor['kindModel']['weights'][name] for name in KINDS])
    base = probabilities(decision, kind, np.asarray(actor['withinWeights']))
    scores = np.log(np.maximum(1e-300, base))[None, :] + np.asarray(model['weights']) @ style_features(decision).T
    return np.exp(scores - logsumexp(scores, axis=1)[:, None]) if enabled else np.tile(base, (2, 1))


def score_styles(game, actor, model, enabled=True):
    posterior = np.asarray(model['priors'][0 if game.get('initialNewLevel') else 1]).copy()
    loss, hits, count = 0.0, 0.0, 0
    for decision in game['decisions']:
        selected = decision['k']
        if selected < 0:
            continue
        emission = components(decision, actor, model, enabled)
        values = posterior @ emission
        ties = np.isclose(values, values.max(), rtol=1e-8, atol=1e-12)
        loss -= math.log(max(1e-300, values[selected]))
        hits += float(ties[selected]) / ties.sum()
        log_posterior = np.log(np.maximum(1e-300, posterior)) + np.log(np.maximum(1e-300, emission[:, selected]))
        posterior = np.exp(log_posterior - logsumexp(log_posterior))
        count += 1
    return {'decisions': count, 'jointLogLoss': loss / count if count else None,
            'topActionAccuracy': hits / count if count else None, 'posterior': posterior.tolist()}
