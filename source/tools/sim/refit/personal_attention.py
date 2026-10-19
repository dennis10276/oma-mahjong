import math

import numpy as np
from scipy.optimize import minimize
from scipy.special import logsumexp


FEATURES = ('repeatKnownInspection', 'repeatKnownInspection.clock')
TYPE = 'personalInspectionAttention-v1'
LOG_TYPE = 'personalInspectionAttentionLog-v2'


class AttentionState:
    def __init__(self, strength_limit=3.):
        if strength_limit is not None and (not math.isfinite(strength_limit) or strength_limit <= 0):
            raise ValueError('Attention strength limit must be positive or explicitly unbounded')
        self.strength_limit = strength_limit
        self.remaining = None
        self.inspected = {}

    def features(self, decision):
        same_progress = self.remaining == decision['kindContext'][9]
        values = []
        for feature in decision['F']:
            key = tuple(feature[index] for index in (21, 22, 26))
            count = self.inspected.get(key, 0) if same_progress else 0
            strength = math.log1p(count) if feature[19] > 0 and feature[65] > 0 and feature[64] == 0 and feature[66] == 0 else 0.
            if self.strength_limit is not None:
                strength = min(self.strength_limit, strength)
            values.append((strength, strength * decision['kindContext'][11]))
        return np.asarray(values, dtype=np.float64)

    def observe(self, decision, selected):
        remaining = decision['kindContext'][9]
        if self.remaining != remaining:
            self.inspected = {}
        self.remaining = remaining
        feature = decision['F'][selected]
        if feature[19] > 0:
            key = tuple(feature[index] for index in (21, 22, 26))
            self.inspected[key] = self.inspected.get(key, 0) + 1


def adjusted(values, features, weights):
    values = np.asarray(values, dtype=np.float64)
    if (values.ndim != 1 or len(values) != len(features) or len(values) == 0 or np.any(values < 0)
            or not np.all(np.isfinite(values)) or abs(float(values.sum()) - 1) > 1e-12):
        raise ValueError('Attention needs a valid own base distribution')
    offset = np.full(values.shape, -np.inf)
    positive = values > 0
    offset[positive] = np.log(values[positive])
    scores = offset + features @ np.asarray(weights)
    return np.exp(scores - logsumexp(scores))


def fit_attention(samples, strength_limit=3.):
    if strength_limit not in (None, 3.):
        raise ValueError('Use one explicitly versioned attention feature definition')
    def objective(weights):
        loss, gradient = 5 * float(weights @ weights), 10 * weights.copy()
        for values, features, selected, importance in samples:
            probabilities = adjusted(values, features, weights)
            if probabilities[selected] <= 0:
                raise ValueError('An actual recorded choice has no support in its frozen own actor')
            loss -= importance * math.log(probabilities[selected])
            gradient += importance * (probabilities @ features - features[selected])
        return loss, gradient
    result = minimize(objective, np.zeros(len(FEATURES)), jac=True, method='L-BFGS-B', bounds=[(-4, 4)] * len(FEATURES))
    if not result.success or not np.all(np.isfinite(result.x)):
        raise ValueError('Own inspection-attention fitting failed')
    return {'type': TYPE if strength_limit == 3 else LOG_TYPE, 'strengthLimit': strength_limit,
            'features': FEATURES, 'weights': result.x.tolist(), 'l2': 10, 'bound': 4,
            'trainingOpportunities': len(samples), 'regularizedLossBefore': objective(np.zeros(len(FEATURES)))[0],
            'regularizedLossAfter': float(result.fun)}
