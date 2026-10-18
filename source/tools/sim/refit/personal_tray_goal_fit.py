import math

import numpy as np
from scipy.optimize import minimize
from scipy.special import expit

from personal_full_choice_fit import probabilities, joint_probabilities


FEATURES = ['bias', 'tray2', 'tray3', 'age1', 'age2plus', 'depth', 'freeTarget', 'optionShare']


def base_mass(game, sample, kind, within, joint=False):
    decision = game['decisions'][sample['decision']]
    values = (joint_probabilities if joint else probabilities)(decision, kind, within)
    allowed = np.asarray(sample['allowed'], dtype=bool)
    if len(allowed) != len(values) or not allowed.any() or allowed.all() or sample['selected'] != decision['k']:
        raise ValueError('Invalid observed target-goal choice set')
    if bool(allowed[decision['k']]) != sample['followed']:
        raise ValueError('Target-goal continuation label differs from actual choice')
    return float(np.clip(values[allowed].sum(), 1e-9, 1 - 1e-9))


def fit_offset(features, offsets, labels, importance, penalty=10):
    dimensions = features.shape[1]
    initial = np.zeros(dimensions)
    if not len(labels):
        return initial

    def objective(weights):
        scores = offsets + features @ weights
        loss = np.sum(importance * (np.logaddexp(0, scores) - labels * scores)) + 0.5 * penalty * (weights @ weights)
        gradient = features.T @ (importance * (expit(scores) - labels)) + penalty * weights
        return loss, gradient

    result = minimize(objective, initial, jac=True, method='L-BFGS-B', options={'maxiter': 300, 'ftol': 1e-10})
    if not result.success or not np.all(np.isfinite(result.x)):
        raise RuntimeError('Personal target-goal fit failed: ' + result.message)
    return result.x


def fit_tray_goal(games, kind, within, cutoff, joint=False):
    contexts, offsets, labels, importance = [], [], [], []
    training = sorted([game for game in games if game['availableAt'] < cutoff], key=lambda game: game['availableAt'], reverse=True)
    for age, game in enumerate(training):
        if any(source['availableAt'] >= cutoff for source in game.get('memorySources', [])):
            raise ValueError('Target-goal fit uses an unavailable memory source')
        for sample in game.get('trayGoalSamples', []):
            mass = base_mass(game, sample, kind, within, joint)
            if len(sample['context']) != len(FEATURES) or not np.all(np.isfinite(sample['context'])):
                raise ValueError('Invalid target-goal context')
            contexts.append(sample['context'])
            offsets.append(math.log(mass / (1 - mass)))
            labels.append(float(sample['followed']))
            importance.append(0.5 ** (age / 20))
    features = np.asarray(contexts, dtype=float).reshape(-1, len(FEATURES))
    offsets, labels, importance = (np.asarray(values, dtype=float) for values in [offsets, labels, importance])
    weights = fit_offset(features, offsets, labels, importance)
    return {'features': FEATURES, 'weights': weights.tolist(), 'trainingSamples': len(labels),
            'effectiveSamples': float(importance.sum()), 'depthLimit': 8,
            'note': 'Own earlier natural progress-target choices only. A regularized personal residual corrects the frozen actor continuation probability by goal age, tray and visible state. Zero prior means no policy change; forced-only choices and unavailable future observations do not fit commitment. This is not winning-try accuracy.'}


def goal_metrics(game, kind, within, model, joint=False):
    if model['features'] != FEATURES:
        raise ValueError('Target-goal context schema differs')
    base_loss, fitted_loss = 0.0, 0.0
    weights = np.asarray(model['weights'])
    samples = game.get('trayGoalSamples', [])
    for sample in samples:
        mass = base_mass(game, sample, kind, within, joint)
        probability = float(np.clip(expit(math.log(mass / (1 - mass)) + np.asarray(sample['context']) @ weights), 1e-9, 1 - 1e-9))
        base_loss -= math.log(mass if sample['followed'] else 1 - mass)
        fitted_loss -= math.log(probability if sample['followed'] else 1 - probability)
    return {'opportunities': len(samples), 'baseLoss': base_loss, 'fittedLoss': fitted_loss}
