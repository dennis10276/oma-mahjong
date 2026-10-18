import numpy as np
from scipy.optimize import minimize
from scipy.special import expit

from personal_joint_sequence import JointState


CONTEXT = ['bias', 'newTrayCue', 'knownInspection', 'tray1', 'tray2', 'tray3', 'clock', 'urgency',
           'newTrayClock', 'otherTrayMatch', 'keyProgress', 'clockProgress', 'optionShare']


def tray_count(decision):
    return decision['kindContext'][1] + 2 * decision['kindContext'][2] + 3 * decision['kindContext'][3]


def picture_of(feature):
    present = [index for index, value in enumerate(feature[27:64]) if value > 0]
    return present[0] if len(present) == 1 and present[0] < 36 else None


def descriptor_of(decision, selected):
    feature = decision['F'][selected]
    if len(feature) != 76 or not np.all(np.isfinite(feature)):
        raise ValueError('Invalid actual handoff action')
    return {'position': [feature[index] for index in (21, 22, 26)], 'picture': picture_of(feature),
            'inspect': feature[19] > 0, 'knownReopen': feature[65] > 0, 'pairPreparation': feature[67] > 0,
            'tray': tray_count(decision)}


def cue_of(decision, previous):
    if previous is None:
        return None
    indices, cue_type = [], None
    if previous['inspect']:
        current = [feature for feature in decision['F'] if feature[19] == 0
                   and [feature[index] for index in (21, 22, 26)] == previous['position']]
        if len(current) != 1:
            return None
        indices = [index for index, feature in enumerate(decision['F']) if feature[66] > 0]
        cue_type = 'peekPair'
    elif tray_count(decision) > previous['tray'] and previous['picture'] is not None:
        indices = [index for index, feature in enumerate(decision['F']) if feature[64] > 0 and picture_of(feature) == previous['picture']]
        cue_type = 'newTrayMate'
    return {'type': cue_type, 'indices': indices, 'previous': previous} if indices else None


def context_of(decision, cue):
    clock, new_tray = decision['kindContext'][11] > 0, cue['type'] == 'newTrayMate'
    recipients = set(cue['indices'])
    bounded_maximum = lambda part: min(1, max(0, *(decision['F'][index][part] for index in cue['indices'])))
    return np.asarray([1, float(new_tray), float(cue['previous']['inspect'] and cue['previous']['knownReopen']),
        *decision['kindContext'][1:4], float(clock), 1 - decision['kindContext'][12] if clock else 0,
        float(new_tray and clock), float(any(feature[64] > 0 and index not in recipients for index, feature in enumerate(decision['F']))),
        bounded_maximum(68), max(bounded_maximum(71), bounded_maximum(72)), len(cue['indices']) / len(decision['F'])])


def shift_group(values, indices, delta):
    values = np.asarray(values, dtype=float)
    if (values.ndim != 1 or not len(values) or not np.all(np.isfinite(values)) or np.any(values < 0)
            or abs(values.sum() - 1) > 1e-12 or not np.isfinite(delta) or len(set(indices)) != len(indices)
            or any(not isinstance(index, int) or not 0 <= index < len(values) for index in indices)):
        raise ValueError('Invalid handoff odds transfer')
    if not indices or delta == 0:
        return values.copy()
    mass = values[indices].sum()
    if mass <= 0 or mass >= 1:
        return values.copy()
    clipped = np.clip(mass, 1e-12, 1 - 1e-12)
    following = expit(np.log(clipped) - np.log1p(-clipped) + delta)
    result = values * ((1 - following) / (1 - mass))
    result[indices] = values[indices] * following / mass
    return result


def samples_of(games, actor, base_model, references=None):
    allowed, cutoff = set(actor['trainedAids']), actor['trainingCut']
    training = sorted([game for game in games if game['aid'] in allowed and game['availableAt'] < cutoff],
                      key=lambda game: game['availableAt'], reverse=True)
    if len(training) != actor['trainingGames'][actor['name']] or {game['aid'] for game in training} != allowed:
        raise ValueError('Handoff fitting changed frozen own membership')
    samples = []
    for age, game in enumerate(training):
        reference = references.get((actor['id'], game['aid'], game['availableAt'])) if references is not None else None
        state = None if reference is not None else JointState(actor, base_model, bool(game.get('initialNewLevel')))
        previous = None
        for index, decision in enumerate(game['decisions']):
            if decision['k'] < 0:
                previous = None
                continue
            evaluated = state.evaluate(decision) if state is not None else None
            baseline = evaluated['values'] if evaluated is not None else np.asarray(reference[index]['probabilities'])
            if baseline.shape != (len(decision['F']),) or not np.all(np.isfinite(baseline)) or np.any(baseline < 0) or abs(baseline.sum() - 1) > 1e-12:
                raise ValueError('Invalid causal handoff baseline reference')
            cue = cue_of(decision, previous)
            if cue:
                probability = float(baseline[cue['indices']].sum())
                if 1e-12 < probability < 1 - 1e-12:
                    samples.append({'context': context_of(decision, cue), 'offset': np.log(probability) - np.log1p(-probability),
                        'label': float(decision['k'] in cue['indices']), 'weight': .5 ** (age / 20),
                        'clock': decision['kindContext'][11] > 0, 'type': cue['type'], 'aid': game['aid'], 'index': index})
            if state is not None:
                state.observe(decision, decision['k'], evaluated)
            previous = descriptor_of(decision, decision['k'])
    return training, samples


def objective(weights, contexts, offsets, labels, importance, penalty=10):
    logits = offsets + contexts @ weights
    loss = importance @ (np.logaddexp(0, logits) - labels * logits) + .5 * penalty * (weights @ weights)
    gradient = contexts.T @ (importance * (expit(logits) - labels)) + penalty * weights
    return float(loss), gradient


def fit_handoff(games, actor, base_model, penalty=10, references=None):
    training, samples = samples_of(games, actor, base_model, references)
    weights = np.zeros(len(CONTEXT))
    if samples:
        arguments = tuple(np.asarray([sample[key] for sample in samples]) for key in ('context', 'offset', 'label', 'weight'))
        fit = minimize(objective, weights, args=(*arguments, penalty), jac=True, method='L-BFGS-B',
                       bounds=[(-4, 4)] * len(CONTEXT), options={'maxiter': 200, 'ftol': 1e-11})
        if not fit.success or not np.all(np.isfinite(fit.x)):
            raise RuntimeError('Own conditional handoff fit failed: ' + fit.message)
        weights = fit.x
    return {'type': 'personalConditionalHandoff-v1', 'actorId': actor['id'], 'name': actor['name'], 'features': CONTEXT,
        'weights': weights.tolist(), 'trainingSamples': len(samples), 'trainingClockSamples': sum(sample['clock'] for sample in samples),
        'trainingByCue': {cue_type: sum(sample['type'] == cue_type for sample in samples) for cue_type in ('newTrayMate', 'peekPair')},
        'trainingGames': len(training), 'trainingCut': actor['trainingCut'],
        'availableThrough': max((game['availableAt'] for game in training), default=None), 'trainedAids': sorted(actor['trainedAids']),
        'settings': {'penalty': penalty, 'weightBound': 4, 'prefixHalfLife': 20, 'offsetClip': 1e-12},
        'note': 'Own earlier action follow-through, not winning labels or universal greedy matching. '
                'Fresh tray targets differ from peek pairs. Unknown/removed targets never create an opportunity. '
                'No clock samples leaves clock adjustment disabled. Base latent states observe the actual final choice; zero offsets preserve controls.'}


def adjusted(decision, previous, baseline, model, enabled=True):
    cue = cue_of(decision, previous)
    if (not enabled or not cue or model['trainingSamples'] == 0
            or decision['kindContext'][11] > 0 and model['trainingClockSamples'] == 0):
        return np.asarray(baseline).copy(), cue
    delta = float(context_of(decision, cue) @ model['weights'])
    return shift_group(baseline, cue['indices'], delta), cue


class HandoffState:
    def __init__(self, actor, base_model, model, initial_new=True, enabled=True):
        if (model['type'] != 'personalConditionalHandoff-v1' or model['actorId'] != actor['id'] or model['name'] != actor['name']
                or model['features'] != CONTEXT or len(model['weights']) != len(CONTEXT)
                or not np.all(np.isfinite(model['weights'])) or np.any(np.abs(model['weights']) > 4)
                or not 0 <= model['trainingClockSamples'] <= model['trainingSamples']):
            raise ValueError('Invalid independently fitted handoff model')
        self.base = JointState(actor, base_model, initial_new)
        self.model = {**model, 'weights': list(model['weights'])}
        self.enabled = enabled
        self.previous = None

    def evaluate(self, decision):
        evaluated = self.base.evaluate(decision)
        values, cue = adjusted(decision, self.previous, evaluated['values'], self.model, self.enabled)
        return {'values': values, 'cue': cue, 'base': evaluated}

    def observe(self, decision, selected, evaluated=None):
        evaluated = evaluated or self.evaluate(decision)
        self.base.observe(decision, selected, evaluated['base'])
        self.previous = descriptor_of(decision, selected)

    def posterior(self):
        return {phase: values.copy() for phase, values in self.base.posterior.items()}
