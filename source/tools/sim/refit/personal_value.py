import math

import numpy as np
from scipy.special import expit
from sklearn.ensemble import HistGradientBoostingClassifier


def value_label(game):
    if game.get('stopReason') == 'auto':
        return 1
    if not game.get('complete') or game.get('stopReason') != 'end':
        return None
    if game.get('ending') == 'win':
        return 1
    if game.get('ending') in ['stuck', 'restart']:
        return 0
    return None


def immediate_features(decision, core_count=21, policy_count=68):
    original = np.asarray(decision['F'], dtype=float)
    immediate = np.asarray(decision['immediate'], dtype=float)
    context = np.asarray(decision['kindContext'], dtype=float)
    if original.ndim != 2 or immediate.ndim != 2 or len(original) != len(immediate):
        raise ValueError('Invalid immediate value choices')
    goals = original.shape[1] - policy_count
    if immediate.shape[1] != core_count + goals:
        raise ValueError('Immediate value schema differs')
    result = np.concatenate([immediate[:, :core_count], original[:, core_count:policy_count],
                             immediate[:, core_count:], np.tile(context, (len(original), 1))], axis=1)
    if not np.all(np.isfinite(result)):
        raise ValueError('Nonfinite immediate value input')
    return result


def export_hist(model, dimensions):
    if list(model.classes_) != [0, 1]:
        raise ValueError('Value export requires binary natural completion labels')
    trees = []
    for predictors in model._predictors:
        if len(predictors) != 1:
            raise ValueError('Unexpected value tree count')
        nodes = []
        for node in predictors[0].nodes:
            if node['is_categorical']:
                raise ValueError('Categorical value trees are unsupported')
            leaf = bool(node['is_leaf'])
            nodes.append([-1 if leaf else int(node['feature_idx']), 0.0 if leaf else float(node['num_threshold']),
                          int(node['left']), int(node['right']), float(node['value']) if leaf else 0.0])
        trees.append(nodes)
    return {'type': 'histogramValue-v1', 'dimensions': dimensions,
            'baseline': float(np.ravel(model._baseline_prediction)[0]), 'trees': trees}


def value_logits(model, features):
    features = np.asarray(features, dtype=float)
    if features.ndim != 2 or features.shape[1] != model['dimensions'] or not np.all(np.isfinite(features)):
        raise ValueError('Value predictor schema differs')
    if model['type'] == 'constantValue-v1':
        return np.full(len(features), math.log(model['probability'] / (1 - model['probability'])))
    if model['type'] != 'histogramValue-v1':
        raise ValueError('Unknown personal value model')
    result = np.full(len(features), model['baseline'])
    for nodes in model['trees']:
        for position, row in enumerate(features):
            index = 0
            while nodes[index][0] >= 0:
                feature, threshold, left, right, value = nodes[index]
                index = left if row[feature] <= threshold else right
            result[position] += nodes[index][4]
    return result


def fit_value(games, cutoff, features, excluded=(), core_count=21, policy_count=68):
    excluded = set(excluded)
    training = sorted([game for game in games if game['availableAt'] < cutoff and game['aid'] not in excluded
                       and all(source['availableAt'] < cutoff and source['aid'] not in excluded
                               for source in game.get('memorySources', []))], key=lambda game: game['availableAt'], reverse=True)
    selected, labels, importance, labelled = [], [], [], []
    wins, mass = 0.0, 0.0
    for age, game in enumerate(training):
        label = value_label(game)
        if label is None:
            continue
        if any(source['availableAt'] >= game['t'] for source in game.get('memorySources', [])):
            raise ValueError('Value training memory was not available before the retry')
        rows = []
        for decision in game['decisions']:
            matrix = immediate_features(decision, core_count, policy_count)
            if matrix.shape[1] != len(features) or not 0 <= decision['k'] < len(matrix):
                raise ValueError('Value training choice differs from observation')
            rows.append(matrix[decision['k']])
        if not rows:
            continue
        weight = 0.5 ** (age / 20)
        selected.extend(rows)
        labels.extend([label] * len(rows))
        importance.extend([64 * weight / len(rows)] * len(rows))
        wins += weight * label
        mass += weight
        labelled.append(game)
    if len(labelled) < 4 or len(set(labels)) < 2 or len(labels) < 64:
        predictor = {'type': 'constantValue-v1', 'dimensions': len(features), 'probability': (1 + wins) / (2 + mass)}
    else:
        model = HistGradientBoostingClassifier(max_iter=40, max_depth=3, max_leaf_nodes=8,
            min_samples_leaf=24, l2_regularization=2, learning_rate=0.1, early_stopping=False, random_state=1610)
        model.fit(np.asarray(selected), np.asarray(labels), sample_weight=np.asarray(importance))
        predictor = export_hist(model, len(features))
    sources = sorted({aid for game in labelled for aid in [game['aid'], *[source['aid'] for source in game.get('memorySources', [])]]})
    return {'features': features, 'predictor': predictor, 'trainingCut': cutoff,
            'availableThrough': max((game['availableAt'] for game in labelled), default=None),
            'trainedAids': sources, 'trainingGames': len(labelled), 'censoredGames': len(training) - len(labelled),
            'trainingChoices': len(labels), 'labelCounts': {str(label): sum(value_label(game) == label for game in labelled) for label in [0, 1]},
            'note': 'Own earlier natural trajectory outcomes. Automatic guaranteed-safe cleanup is a success state; tool, missing and unfinished boundaries are censored. Prefix-normalized temporal weights prevent long trajectories from dominating. Observational value is not proof of counterfactual success or winning-try accuracy.'}


def opening_value(opening, kind, within, model, probabilities):
    values = expit(value_logits(model['predictor'], immediate_features(opening)))
    policy = probabilities(opening, kind, within)
    return [float(policy @ values), float(values.max()), float(values.min()), float(values.std()),
            float(values[int(np.argmax(policy))])]
