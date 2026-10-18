import math

import numpy as np
from sklearn.tree import DecisionTreeRegressor

from personal_full_choice_fit import probabilities
from personal_value import immediate_features


def export_tree(tree, shrinkage):
    nodes = []
    for index in range(tree.tree_.node_count):
        leaf = tree.tree_.children_left[index] < 0
        nodes.append([-1 if leaf else int(tree.tree_.feature[index]),
                      0.0 if leaf else float(tree.tree_.threshold[index]),
                      int(tree.tree_.children_left[index]), int(tree.tree_.children_right[index]),
                      float(tree.tree_.value[index, 0, 0] * shrinkage) if leaf else 0.0])
    return nodes


def tree_scores(model, features, stages=None):
    features = np.asarray(features, dtype=np.float32)
    if model['type'] != 'personalChoiceTrees-v1' or model.get('inputPrecision') != 'float32' or features.ndim != 2 or features.shape[1] != model['dimensions']:
        raise ValueError('Personal choice tree schema differs')
    if not np.all(np.isfinite(features)):
        raise ValueError('Nonfinite personal choice features')
    if stages is not None and (type(stages) is not int or not 0 <= stages <= len(model['trees'])):
        raise ValueError('Invalid personal choice stage count')
    result = np.zeros(len(features))
    for nodes in model['trees'][:stages]:
        for position, row in enumerate(features):
            index = 0
            while nodes[index][0] >= 0:
                feature, threshold, left, right, value = nodes[index]
                index = left if float(row[feature]) <= threshold else right
            result[position] += nodes[index][4]
    return result


def context_probabilities(decision, kind, within, model, stages=None):
    base = probabilities(decision, kind, within)
    residual = tree_scores(model, immediate_features(decision), stages)
    scores = np.log(np.maximum(base, 1e-300)) + residual
    exponent = np.exp(scores - scores.max())
    return exponent / exponent.sum()


def fit_context(games, kind, within, cutoff, allowed, features, stages=24):
    training = sorted([game for game in games if game['availableAt'] < cutoff and game['aid'] in allowed
                       and all(source['aid'] in allowed and source['availableAt'] < cutoff
                               and source['availableAt'] < game['t'] for source in game.get('memorySources', []))],
                      key=lambda game: game['availableAt'], reverse=True)
    matrices, base, selected, importance, widths = [], [], [], [], []
    for age, game in enumerate(training):
        choices = [decision for decision in game['decisions'] if decision['k'] >= 0 and len(decision['F']) > 1]
        weight = 64 * 0.5 ** (age / 20) / max(1, len(choices))
        for decision in choices:
            matrix = immediate_features(decision)
            if matrix.shape[1] != len(features) or decision['k'] >= len(matrix):
                raise ValueError('Context choice differs from observation')
            matrices.append(matrix)
            base.extend(np.log(np.maximum(probabilities(decision, kind, within), 1e-300)))
            selected.append(decision['k'])
            importance.append(weight)
            widths.append(len(matrix))
    model = {'type': 'personalChoiceTrees-v1', 'inputPrecision': 'float32', 'dimensions': len(features), 'trees': [],
             'features': features, 'trainingCut': cutoff, 'trainingGames': len(training),
             'trainingChoices': len(selected), 'availableThrough': max((game['availableAt'] for game in training), default=None),
             'trainedAids': sorted({aid for game in training for aid in [game['aid'], *[source['aid'] for source in game.get('memorySources', [])]]}),
             'settings': {'stages': stages, 'shrinkage': 0.2, 'maxDepth': 3, 'minLeaf': 48, 'leafPenalty': 4, 'leafClamp': 2},
             'note': 'Own earlier natural choices only; no winning-count labels, other people or prescribed finishing preference. Context trees correct the pinned personal actor using actual-tap consequences and frozen knowledge. Prefix-balanced twenty-game decay and zero initial residual. Action likelihood is not winning-try accuracy.'}
    if len(selected) < 32:
        return model
    matrix = np.concatenate(matrices)
    sizes = np.asarray(widths)
    starts = np.cumsum(np.r_[0, sizes[:-1]])
    chosen = starts + np.asarray(selected)
    row_weight = np.repeat(importance, sizes)
    scores = np.asarray(base)
    labels = np.zeros(len(scores))
    labels[chosen] = 1
    for stage in range(stages):
        maximum = np.maximum.reduceat(scores, starts)
        exponent = np.exp(scores - np.repeat(maximum, sizes))
        probability = exponent / np.repeat(np.add.reduceat(exponent, starts), sizes)
        gradient = (labels - probability) * row_weight
        hessian = np.maximum(probability * (1 - probability), 0.02) * row_weight
        tree = DecisionTreeRegressor(max_depth=3, min_samples_leaf=48, random_state=20261018 + stage)
        tree.fit(matrix, gradient / hessian, sample_weight=hessian)
        leaves = tree.apply(matrix)
        for leaf in np.unique(leaves):
            members = leaves == leaf
            tree.tree_.value[leaf, 0, 0] = np.clip(gradient[members].sum() / (hessian[members].sum() + 4), -2, 2)
        scores += 0.2 * tree.predict(matrix)
        model['trees'].append(export_tree(tree, 0.2))
    return model


def score_context(games, kind, within, model, stages=None):
    losses, hits = [], []
    for game in games:
        for decision in game['decisions']:
            if decision['k'] < 0:
                continue
            probability = context_probabilities(decision, kind, within, model, stages)
            losses.append(-math.log(max(1e-300, probability[decision['k']])))
            ties = np.isclose(probability, probability.max(), rtol=1e-8, atol=1e-12)
            hits.append(float(ties[decision['k']]) / ties.sum())
    return {'decisions': len(losses), 'jointLogLoss': float(np.mean(losses)) if losses else None,
            'topActionAccuracy': float(np.mean(hits)) if hits else None}
