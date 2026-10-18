import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.optimize import minimize
from scipy.special import logsumexp

from personal_policy_fit import kind_of


ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'analysis/archive/personal-bots/policy-data.json'
OUTPUT = ROOT / 'analysis/personal-bots/personal-kind-policy.json'
KINDS = ['flip', 'pair', 'single', 'fatal']


def samples(games, tables, dimensions):
    contexts, offsets, labels, importance = [], [], [], []
    for age, game in enumerate(reversed(sorted(games, key=lambda row: row['availableAt']))):
        for decision in game['decisions']:
            selected = decision['k']
            if selected < 0:
                continue
            kinds = [kind_of(feature) for feature in decision['F']]
            available = np.asarray([kind in kinds for kind in KINDS])
            if available.sum() < 2:
                continue
            context = decision['kindContext']
            if len(context) != dimensions or not np.all(np.isfinite(context)):
                raise ValueError('Invalid visible kind context')
            key = 't' + str(min(3, decision['tray'])) + ('p' if 'pair' in kinds else 'n') + ('' if 'flip' in kinds else '-')
            rates = tables.get(key, {})
            prior = np.asarray([rates.get(kind, 0.0) for kind in KINDS], dtype=float)
            if prior[available].sum() <= 0:
                prior = np.asarray([0.01 if kind == 'fatal' else 1 for kind in KINDS])
            offsets.append(np.where(available, np.log(np.maximum(1e-6, prior)), -np.inf))
            contexts.append(context)
            labels.append(KINDS.index(kinds[selected]))
            importance.append(0.5 ** (age / 20))
    return (np.asarray(contexts, dtype=float).reshape(-1, dimensions),
            np.asarray(offsets, dtype=float).reshape(-1, len(KINDS)),
            np.asarray(labels, dtype=int), np.asarray(importance, dtype=float))


def combine(groups):
    return tuple(np.concatenate([group[index] for group in groups]) for index in range(4))


def fit(data, prior, penalty=10):
    contexts, offsets, labels, importance = data
    if not len(labels):
        return prior.copy()
    positions = np.arange(len(labels))

    def objective(parameters):
        weights = parameters.reshape(prior.shape)
        scores = offsets + contexts @ weights.T
        normalizer = logsumexp(scores, axis=1)
        residual = np.exp(scores - normalizer[:, None])
        residual[positions, labels] -= 1
        difference = weights - prior
        loss = np.sum(importance * (normalizer - scores[positions, labels])) + 0.5 * penalty * np.sum(difference ** 2)
        gradient = (residual * importance[:, None]).T @ contexts + penalty * difference
        return loss, gradient.ravel()

    result = minimize(objective, prior.ravel(), jac=True, method='L-BFGS-B', options={'maxiter': 300, 'ftol': 1e-10})
    if not result.success:
        raise RuntimeError('Contextual kind fit failed: ' + result.message)
    return result.x.reshape(prior.shape)


def score(data, weights):
    contexts, offsets, labels, importance = data
    if not len(labels):
        return {'decisions': 0, 'logLoss': None, 'topKindAccuracy': None}
    scores = offsets + contexts @ weights.T
    normalizer = logsumexp(scores, axis=1)
    maximum = scores.max(axis=1)
    ties = np.isclose(scores, maximum[:, None])
    return {'decisions': len(labels), 'logLoss': float(np.mean(normalizer - scores[np.arange(len(labels)), labels])),
            'topKindAccuracy': float(np.mean(ties[np.arange(len(labels)), labels] / ties.sum(axis=1)))}


def encode(weights):
    return {'weights': {kind: weights[index].tolist() for index, kind in enumerate(KINDS)}}


def main():
    data = json.loads(DATA.read_text(encoding='utf-8'))
    dimensions = len(data['kindContextFeatures'])
    base = np.zeros((len(KINDS), dimensions))
    report = {'features': data['kindContextFeatures'], 'dataSha256': hashlib.sha256(DATA.read_bytes()).hexdigest(), 'players': {},
              'note': 'Visible-context move-type diagnostic, not winning-attempt accuracy. Each fitted model is available only after its training cutoff.'}
    for name, games in data['players'].items():
        baseline = data['kindBaselines'][name]
        cut, tables = baseline['cut'], baseline['tables']
        training = [game for game in games if game['availableAt'] < cut]
        testing = [game for game in games if game['t'] >= cut]
        family = combine([samples([game for game in recorded if game['availableAt'] < cut], tables[person], dimensions)
                          for person, recorded in data['players'].items()])
        shared = fit(family, base)
        weights = fit(samples(training, tables[name], dimensions), shared)
        held = samples(testing, tables[name], dimensions)
        report['players'][name] = {'trainingCut': cut, 'trainingGames': len(training), 'testingGames': len(testing),
                                   'base': score(held, base), 'context': score(held, weights), 'model': encode(weights)}
        print(name, json.dumps({key: report['players'][name][key] for key in ['base', 'context']}), flush=True)
    OUTPUT.write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
