import json
import math
from pathlib import Path

import numpy as np
from scipy.optimize import minimize
from scipy.special import logsumexp


ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'analysis/archive/personal-bots/policy-data.json'
OUTPUT = ROOT / 'analysis/personal-bots/personal-policy.json'


def kind_of(feature):
    return 'flip' if feature[19] else 'fatal' if feature[18] else 'pair' if feature[14] else 'single'


def decisions(games):
    result = []
    for age, game in enumerate(reversed(sorted(games, key=lambda item: item['t']))):
        weight = 0.5 ** (age / 20)
        for decision in game['decisions']:
            selected = decision['k']
            if selected < 0:
                continue
            features = np.clip(np.asarray(decision['F'], dtype=float), -50, 50)
            kinds = [kind_of(feature) for feature in features]
            keep = np.asarray([kind == kinds[selected] for kind in kinds])
            if keep.sum() < 2:
                continue
            position = int(keep[:selected].sum())
            result.append((features[keep], position, weight))
    return result


def fit(samples, prior, position_only):
    bounds = [(None, None)] * len(prior)
    for index in [0, 1, 2, 3, 4, 5, 9, 11, 12]:
        bounds[index] = (None, 0)
    for index in [7, 13]:
        bounds[index] = (0, None)
    for index, value in {8: -20, 10: -20, 17: -50, 18: -50, 14: 0, 19: 0, 20: 0}.items():
        bounds[index] = (value, value)
    if position_only:
        for index in range(21):
            bounds[index] = (prior[index], prior[index])
    initial = prior.copy()
    for index, (lower, upper) in enumerate(bounds):
        if lower is not None:
            initial[index] = max(initial[index], lower)
        if upper is not None:
            initial[index] = min(initial[index], upper)

    def objective(weights):
        difference = weights - initial
        value = 5 * np.dot(difference, difference)
        gradient = 10 * difference
        for features, selected, importance in samples:
            scores = features @ weights
            normalizer = logsumexp(scores)
            probabilities = np.exp(scores - normalizer)
            value += importance * (normalizer - scores[selected])
            gradient += importance * (probabilities @ features - features[selected])
        return value, gradient

    result = minimize(objective, initial, jac=True, method='L-BFGS-B', bounds=bounds, options={'maxiter': 250})
    if not np.all(np.isfinite(result.x)):
        raise ValueError('Non-finite personal policy weights')
    return result.x


def score(samples, weights):
    likelihood = 0.0
    correct = 0.0
    uniform = 0.0
    for features, selected, importance in samples:
        scores = features @ weights
        likelihood += logsumexp(scores) - scores[selected]
        maximum = scores.max()
        ties = np.isclose(scores, maximum)
        correct += float(ties[selected]) / ties.sum()
        uniform += math.log(len(features))
    return {'decisions': len(samples), 'logLoss': likelihood / len(samples) if samples else None,
            'topChoiceAccuracy': correct / len(samples) if samples else None,
            'uniformLogLoss': uniform / len(samples) if samples else None}


def main():
    data = json.loads(DATA.read_text(encoding='utf-8'))
    base = np.asarray(data['base'], dtype=float)
    report = {'features': data['features'], 'players': {}, 'note': 'Action-choice evaluation only; this does not establish winning-attempt accuracy.'}
    for name, games in data['players'].items():
        games = sorted(games, key=lambda item: item['t'])
        cut = games[max(1, math.floor(len(games) * 0.75))]['t']
        training = [game for game in games if game['availableAt'] < cut]
        testing = [game for game in games if game['t'] >= cut]
        family = [game for other in data['players'].values() for game in other if game['availableAt'] < cut]
        samples = decisions(training)
        test_samples = decisions(testing)
        modes = {}
        for mode, position_only in [('position', True), ('full', False)]:
            family_weights = fit(decisions(family), base, position_only)
            weights = fit(samples, family_weights, position_only)
            modes[mode] = {'weights': weights.tolist(), 'test': score(test_samples, weights)}
        report['players'][name] = {'trainingCut': cut, 'trainingGames': len(training), 'testingGames': len(testing),
                                   'base': score(test_samples, base), 'models': modes}
        print(name, json.dumps({mode: item['test'] for mode, item in modes.items()}), flush=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
