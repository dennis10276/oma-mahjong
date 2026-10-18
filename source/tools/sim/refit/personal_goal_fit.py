import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.optimize import minimize
from scipy.special import logsumexp

from personal_policy_fit import kind_of


ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'analysis/archive/personal-bots/policy-data.json'
OUTPUT = ROOT / 'analysis/personal-bots/personal-goal-policy.json'


def samples(games, base):
    result = []
    for age, game in enumerate(reversed(sorted(games, key=lambda row: row['availableAt']))):
        for decision in game['decisions']:
            selected = decision['k']
            if selected < 0:
                continue
            kinds = [kind_of(feature) for feature in decision['F']]
            if kinds[selected] == 'fatal':
                continue
            keep = [index for index, kind in enumerate(kinds) if kind == kinds[selected]]
            if len(keep) < 2:
                continue
            features = np.asarray([decision['goals'][index] for index in keep], dtype=float)
            offsets = np.asarray([decision['F'][index] for index in keep], dtype=float) @ base
            if not np.all(np.isfinite(features)) or not np.all(np.isfinite(offsets)):
                raise ValueError('Invalid goal-choice features')
            result.append((features, offsets, keep.index(selected), 0.5 ** (age / 20)))
    return result


def fit(data, prior, penalty=10):
    if not data:
        return prior.copy()

    def objective(weights):
        difference = weights - prior
        loss = 0.5 * penalty * np.dot(difference, difference)
        gradient = penalty * difference
        for features, offsets, selected, importance in data:
            scores = offsets + features @ weights
            normalizer = logsumexp(scores)
            probabilities = np.exp(scores - normalizer)
            loss += importance * (normalizer - scores[selected])
            gradient += importance * (probabilities @ features - features[selected])
        return loss, gradient

    result = minimize(objective, prior, jac=True, method='L-BFGS-B', bounds=[(-15, 15)] * len(prior),
                      options={'maxiter': 250, 'ftol': 1e-10})
    if not result.success:
        raise RuntimeError('Visible goal fit failed: ' + result.message)
    return result.x


def score(data, weights):
    if not data:
        return {'decisions': 0, 'logLoss': None, 'topChoiceAccuracy': None}
    loss, correct = 0.0, 0.0
    for features, offsets, selected, importance in data:
        scores = offsets + features @ weights
        loss += logsumexp(scores) - scores[selected]
        ties = np.isclose(scores, scores.max())
        correct += float(ties[selected]) / ties.sum()
    return {'decisions': len(data), 'logLoss': float(loss / len(data)), 'topChoiceAccuracy': float(correct / len(data))}


def main():
    data = json.loads(DATA.read_text(encoding='utf-8'))
    base = np.asarray(data['base'], dtype=float)
    prior = np.zeros(len(data['goalFeatures']))
    report = {'features': data['goalFeatures'], 'dataSha256': hashlib.sha256(DATA.read_bytes()).hexdigest(), 'players': {},
              'note': 'Conditional tile-choice diagnostic for visible keys/clocks; move type and base planning weights are not refitted. This is not winning-attempt accuracy.'}
    for name, games in data['players'].items():
        cut = data['kindBaselines'][name]['cut']
        training = [game for game in games if game['availableAt'] < cut]
        testing = [game for game in games if game['t'] >= cut]
        family = [game for recorded in data['players'].values() for game in recorded if game['availableAt'] < cut]
        shared = fit(samples(family, base), prior)
        weights = fit(samples(training, base), shared)
        held = samples(testing, base)
        report['players'][name] = {'trainingCut': cut, 'trainingGames': len(training), 'testingGames': len(testing),
                                   'trainingAvailableUntil': max((game['availableAt'] for game in training), default=None),
                                   'familyAvailableUntil': max((game['availableAt'] for game in family), default=None),
                                   'weights': weights.tolist(), 'base': score(held, prior), 'goal': score(held, weights)}
        print(name, json.dumps({key: report['players'][name][key] for key in ['base', 'goal']}), flush=True)
    OUTPUT.write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
