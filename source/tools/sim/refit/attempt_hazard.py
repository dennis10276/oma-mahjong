import math

import numpy as np
from scipy.optimize import minimize
from scipy.special import expit


NAMES = ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda']


def logit(probability):
    probability = min(0.98, max(0.02, probability))
    return math.log(probability / (1 - probability))


def conditional(chain, attempt):
    available = [value for value in chain['cond'][:attempt] if value is not None]
    return available[-1] if available else chain['within'][0]


def hazard_features(row, attempt):
    personal = np.asarray([int(name == row['name']) for name in NAMES], dtype=float)
    physical = row['physical']
    difficulty = logit(row['reference']['strong']) / 3
    retry = math.log(attempt)
    clock = physical[6]
    keys = math.log1p(physical[9])
    shared = [1, difficulty, physical[5], clock, keys, physical[1], math.log1p(physical[0]) / 5, retry]
    features = np.concatenate([shared, personal, personal * difficulty, personal * retry, [clock * retry, keys * retry]])
    baseline = row.get('extraChains', {}).get('strong', row['chain'])
    return features, logit(conditional(baseline, attempt))


def observed_before(rows, opening):
    return [row for row in rows if row['end'] < opening and row['firstAttempt'] == 1
            and (row['wonOn'] is not None or row.get('observedAttempts', 0) > 0)]


def hazard_training(rows, opening):
    previous = sorted(observed_before(rows, opening), key=lambda row: row['end'])
    ages = {}
    observations = []
    for row in reversed(previous):
        age = ages.get(row['name'], 0)
        ages[row['name']] = age + 1
        attempts = row['wonOn'] if row['wonOn'] is not None else row['observedAttempts']
        for attempt in range(1, attempts + 1):
            features, offset = hazard_features(row, attempt)
            observations.append((features, offset, int(attempt == row['wonOn']), 0.5 ** (age / 20)))
    return observations


def contextual_distribution(rows, target, limit=20):
    observations = hazard_training(rows, target['start'])
    features = np.asarray([hazard_features(target, attempt)[0] for attempt in range(1, limit + 1)])
    offsets = np.asarray([hazard_features(target, attempt)[1] for attempt in range(1, limit + 1)])
    weights = np.zeros(features.shape[1])
    if observations:
        training = np.asarray([row[0] for row in observations])
        baseline = np.asarray([row[1] for row in observations])
        labels = np.asarray([row[2] for row in observations])
        sample_weights = np.asarray([row[3] for row in observations])
        penalty = np.asarray([2] * 8 + [4] * 4 + [8] * 8 + [8] * 2, dtype=float)

        def objective(parameters):
            logits = baseline + training @ parameters
            loss = np.sum(sample_weights * (np.logaddexp(0, logits) - labels * logits))
            loss += 0.5 * np.sum(penalty * parameters ** 2)
            gradient = training.T @ (sample_weights * (expit(logits) - labels)) + penalty * parameters
            return loss, gradient

        optimized = minimize(objective, weights, jac=True, method='L-BFGS-B', options={'maxiter': 200, 'ftol': 1e-10})
        if not optimized.success:
            raise RuntimeError('Contextual hazard fit failed: ' + optimized.message)
        weights = optimized.x
    hazards = expit(offsets + features @ weights)
    remaining = 1.0
    distribution = {}
    for attempt, hazard in enumerate(hazards, 1):
        distribution[attempt] = float(remaining * hazard)
        remaining *= 1 - hazard
    return distribution, float(remaining)
