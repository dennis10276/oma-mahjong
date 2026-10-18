import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from scipy.optimize import minimize
from scipy.special import logsumexp

from personal_kind_fit import KINDS, encode, fit as fit_kind, samples as kind_samples
from personal_policy_fit import kind_of


ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'analysis/archive/personal-bots/policy-prefix-data.json'
OUTPUT = ROOT / 'analysis/personal-bots/personal-full-choice-policy.json'


def before(games, cutoff):
    return [game for game in games if game['availableAt'] < cutoff]


def within_samples(games):
    samples = []
    for age, game in enumerate(reversed(sorted(games, key=lambda item: item['availableAt']))):
        for decision in game['decisions']:
            selected = decision['k']
            if selected < 0:
                continue
            features = np.asarray(decision['F'], dtype=float)
            if selected >= len(features) or not np.all(np.isfinite(features)):
                raise ValueError('Invalid full-choice decision')
            kinds = [kind_of(feature) for feature in features]
            keep = np.asarray([kind == kinds[selected] for kind in kinds])
            if keep.sum() > 1:
                samples.append((features[keep], int(keep[:selected].sum()), 0.5 ** (age / 20)))
    return samples


def equal_person(groups, effective=500):
    result = []
    totals = [sum(sample[2] for sample in samples) for samples in groups]
    mass = min([effective] + [total for total in totals if total])
    for samples, total in zip(groups, totals):
        if total:
            result.extend((features, selected, weight * mass / total) for features, selected, weight in samples)
    return result


def fit_within(samples, prior, penalty=10):
    if not samples:
        return prior.copy()
    starts = np.cumsum([0] + [len(features) for features, _, _ in samples[:-1]])
    sizes = np.asarray([len(features) for features, _, _ in samples])
    features = np.concatenate([features for features, _, _ in samples])
    selected = starts + np.asarray([selected for _, selected, _ in samples])
    importance = np.asarray([weight for _, _, weight in samples])
    chosen = features[selected]

    def objective(weights):
        scores = features @ weights
        maximum = np.maximum.reduceat(scores, starts)
        exponent = np.exp(scores - np.repeat(maximum, sizes))
        normalizers = np.add.reduceat(exponent, starts)
        probabilities = exponent / np.repeat(normalizers, sizes)
        difference = weights - prior
        loss = importance @ (maximum + np.log(normalizers) - scores[selected]) + 0.5 * penalty * (difference @ difference)
        gradient = features.T @ (probabilities * np.repeat(importance, sizes)) - importance @ chosen + penalty * difference
        return loss, gradient

    result = minimize(objective, prior, jac=True, method='L-BFGS-B', options={'maxiter': 400, 'ftol': 1e-10})
    if not result.success or not np.all(np.isfinite(result.x)):
        raise RuntimeError('Full-choice preference fit failed: ' + result.message)
    return result.x


def fit_models(players, name, cutoff, base, dimensions):
    training = {person: before(games, cutoff) for person, games in players.items()}
    kind_groups = [kind_samples(games, {}, dimensions) for games in training.values()]
    mass = min([500] + [group[3].sum() for group in kind_groups if len(group[2])])
    normalized = []
    for contexts, offsets, labels, importance in kind_groups:
        if len(labels):
            normalized.append((contexts, offsets, labels, importance * mass / importance.sum()))
    family_data = tuple(np.concatenate([group[index] for group in normalized]) for index in range(4)) if normalized else kind_samples([], {}, dimensions)
    shared_kind = fit_kind(family_data, np.zeros((len(KINDS), dimensions)))
    personal_kind = fit_kind(kind_samples(training[name], {}, dimensions), shared_kind)
    shared_within = fit_within(equal_person([within_samples(games) for games in training.values()]), base)
    personal_within = fit_within(within_samples(training[name]), shared_within)
    return personal_kind, personal_within, {person: len(games) for person, games in training.items()}


def fit_person(games, cutoff, base, dimensions):
    training = before(games, cutoff)
    kind = fit_kind(kind_samples(training, {}, dimensions), np.zeros((len(KINDS), dimensions)))
    within = fit_within(within_samples(training), base)
    return kind, within, len(training)


def joint_features(decision):
    features = np.asarray(decision['F'], dtype=float)
    context = np.asarray(decision['kindContext'], dtype=float)
    if features.ndim != 2 or not np.all(np.isfinite(features)) or not np.all(np.isfinite(context)):
        raise ValueError('Invalid joint-choice decision')
    kinds = [KINDS.index(kind_of(feature)) for feature in features]
    interactions = np.zeros((len(features), len(KINDS), len(context)))
    interactions[np.arange(len(features)), kinds, :] = context
    return np.concatenate([features, interactions.reshape(len(features), -1)], axis=1)


def joint_samples(games):
    result = []
    for age, game in enumerate(reversed(sorted(games, key=lambda item: item['availableAt']))):
        for decision in game['decisions']:
            selected = decision['k']
            if selected < 0:
                continue
            features = joint_features(decision)
            if selected >= len(features):
                raise ValueError('Joint choice index outside alternatives')
            if len(features) > 1:
                result.append((features, selected, 0.5 ** (age / 20)))
    return result


def fit_person_joint(games, cutoff, base, dimensions):
    training = before(games, cutoff)
    prior = np.concatenate([base, np.zeros(len(KINDS) * dimensions)])
    fitted = fit_within(joint_samples(training), prior)
    return fitted[len(base):].reshape(len(KINDS), dimensions), fitted[:len(base)], len(training)


def joint_probabilities(decision, kind_weights, within_weights):
    weights = np.concatenate([within_weights, kind_weights.reshape(-1)])
    scores = joint_features(decision) @ weights
    return np.exp(scores - logsumexp(scores))


def probabilities(decision, kind_weights, within_weights):
    features = np.asarray(decision['F'], dtype=float)
    kinds = [kind_of(feature) for feature in features]
    available = [kind for kind in KINDS if kind in kinds]
    if not available:
        raise ValueError('No full-choice alternatives')
    context = np.asarray(decision['kindContext'], dtype=float)
    scores = np.asarray([context @ kind_weights[KINDS.index(kind)] + math.log(0.01 if kind == 'fatal' else 1) for kind in available])
    type_probabilities = np.exp(scores - logsumexp(scores))
    result = np.zeros(len(features))
    for kind, probability in zip(available, type_probabilities):
        indices = np.asarray([index for index, value in enumerate(kinds) if value == kind])
        values = features[indices] @ within_weights
        result[indices] = probability * np.exp(values - logsumexp(values))
    return result


def score(games, kind_weights, within_weights, joint=False):
    losses, correct, known_matches = [], [], []
    for game in games:
        for decision in game['decisions']:
            selected = decision['k']
            if selected < 0:
                continue
            values = (joint_probabilities if joint else probabilities)(decision, kind_weights, within_weights)
            ties = np.isclose(values, values.max(), rtol=1e-8, atol=1e-12)
            losses.append(-math.log(max(1e-300, values[selected])))
            correct.append(float(ties[selected]) / ties.sum())
            chosen = decision['F'][selected]
            if len(chosen) > 64 and (chosen[64] or (len(chosen) > 66 and chosen[66])):
                known_matches.append(losses[-1])
    return {'decisions': len(losses), 'jointLogLoss': float(np.mean(losses)) if losses else None,
            'topActionAccuracy': float(np.mean(correct)) if correct else None,
            'knownMatchChoices': len(known_matches), 'knownMatchLogLoss': float(np.mean(known_matches)) if known_matches else None}


def validate(data):
    digest = hashlib.sha256()
    for filename in data['fingerprintFiles']:
        digest.update(filename.encode())
        digest.update((ROOT / filename).read_bytes())
    if digest.hexdigest() != data['fingerprint']:
        raise ValueError('Natural-prefix measurements are stale; rebuild before fitting')


def prior_of(data):
    base = np.asarray(data['base'], dtype=float).copy()
    for index in [8, 10, 17, 18]:
        base[index] = -4
    base[9] = -1
    base[data['features'].index('visibleTrayMatch')] = 2
    base[data['features'].index('visiblePeekMatch')] = 2
    return base


def main():
    raw = DATA.read_bytes()
    data = json.loads(raw)
    validate(data)
    base = prior_of(data)
    dimensions = len(data['kindContextFeatures'])
    source_files = [Path(__file__), Path(__file__).with_name('personal_kind_fit.py'), Path(__file__).with_name('personal_policy_fit.py')]
    source_hashes = {source.name: hashlib.sha256(source.read_bytes()).hexdigest() for source in source_files}
    report = {'made': datetime.now(timezone.utc).isoformat(), 'dataSha256': hashlib.sha256(raw).hexdigest(),
              'fitSources': source_hashes,
              'dataFingerprint': data['fingerprint'], 'features': data['features'], 'kindContextFeatures': data['kindContextFeatures'],
              'scope': data['scope'], 'players': {},
              'note': 'Exploratory chronological physical-tap diagnostics, NOT winning-attempt accuracy. All own/family training prefixes must be available strictly before the cutoff. No deterministic tray-match, end-solver, clock-plan or multi-tap macro assumption is part of these fitted likelihoods. Whole-count evaluation with earlier-available fitted snapshots is required before forecast promotion.'}
    for name, recorded in data['players'].items():
        ordered = sorted(recorded, key=lambda game: game['t'])
        if not ordered:
            continue
        cut = ordered[min(len(ordered) - 1, math.floor(len(ordered) * 0.75))]['t']
        kind, within, counts = fit_models(data['players'], name, cut, base, dimensions)
        held = [game for game in ordered if game['t'] >= cut]
        report['players'][name] = {'trainingCut': cut, 'trainingGames': counts, 'testingGames': len(held),
                                  'base': score(held, np.zeros_like(kind), base), 'full': score(held, kind, within),
                                  'kindModel': encode(kind), 'withinWeights': within.tolist()}
        print(name, json.dumps({key: report['players'][name][key] for key in ['trainingGames', 'testingGames', 'base', 'full']}), flush=True)
    validate(data)
    if DATA.read_bytes() != raw:
        raise ValueError('Natural-prefix data changed during fitting')
    if source_hashes != {source.name: hashlib.sha256(source.read_bytes()).hexdigest() for source in source_files}:
        raise ValueError('Full-choice fit sources changed during fitting')
    OUTPUT.write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
