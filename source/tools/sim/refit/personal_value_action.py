import hashlib
import json
import math
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from scipy.optimize import minimize
from scipy.special import logsumexp

from attempt_count_fit import NAMES
from personal_full_choice_fit import probabilities, validate
from personal_kind_fit import KINDS
from personal_value import immediate_features, value_logits
from personal_value_fit import ARCHIVE, DATA, PINNED, ROOT, SCOPES, digest
from physical_policy_bank import scope_players


WORKER_DATA = None
WORKER_BANK = None
WORKER_CRITICS = None
WORKER_REQUESTS = None


def tilted_probabilities(decision, strength):
    scores = np.asarray(decision['logBase']) + strength * np.asarray(decision['valueLogits'])
    return np.exp(scores - logsumexp(scores))


def fit_alignment(games, cutoff, allowed):
    training = sorted([game for game in games if game['availableAt'] < cutoff and game['aid'] in allowed
                       and all(source['availableAt'] < cutoff and source['aid'] in allowed
                               for source in game.get('memorySources', []))], key=lambda game: game['availableAt'], reverse=True)
    samples = []
    for age, game in enumerate(training):
        if game['decisions']:
            weight = 64 * 0.5 ** (age / 20) / len(game['decisions'])
            samples.extend((decision, weight) for decision in game['decisions'])

    def objective(parameter):
        strength = float(parameter[0])
        loss, gradient = 5 * strength ** 2, 10 * strength
        for decision, weight in samples:
            values = np.asarray(decision['valueLogits'])
            scores = np.asarray(decision['logBase']) + strength * values
            normalizer = logsumexp(scores)
            probability = np.exp(scores - normalizer)
            loss += weight * (normalizer - scores[decision['k']])
            gradient += weight * (probability @ values - values[decision['k']])
        return loss, np.asarray([gradient])

    result = minimize(objective, np.zeros(1), jac=True, method='L-BFGS-B', bounds=[(-4, 4)])
    if not result.success or not np.all(np.isfinite(result.x)):
        raise RuntimeError('Personal value preference failed: ' + result.message)
    return {'strength': float(result.x[0]), 'trainingCut': cutoff, 'trainingGames': len(training),
            'trainingChoices': len(samples), 'availableThrough': max((game['availableAt'] for game in training), default=None),
            'trainedAids': sorted({aid for game in training for aid in [game['aid'], *[source['aid'] for source in game.get('memorySources', [])]]}),
            'crossfitCritics': {game['aid']: game['critic'] for game in training},
            'note': 'Own earlier choices against critics frozen before each older campaign. Zero prior, independent signed preference, bounded strength, prefix-normalized temporal weights. Not a mandated greedy strategy or a winning-try score.'}


def action_metrics(game, strength):
    losses, hits = [], []
    for decision in game['decisions']:
        probability = tilted_probabilities(decision, strength)
        losses.append(-math.log(max(1e-300, probability[decision['k']])))
        ties = np.isclose(probability, probability.max(), rtol=1e-8, atol=1e-12)
        hits.append(float(ties[decision['k']]) / ties.sum())
    return {'decisions': len(losses), 'jointLogLoss': float(np.mean(losses)) if losses else None,
            'topActionAccuracy': float(np.mean(hits)) if hits else None}


def initialize():
    global WORKER_DATA, WORKER_BANK, WORKER_CRITICS, WORKER_REQUESTS
    WORKER_DATA = json.loads(DATA.read_bytes())
    WORKER_BANK = json.loads((PINNED / 'analysis/archive/personal-bots/physical-memory-policy-bank.json').read_bytes())
    WORKER_CRITICS = {model['id']: model['value'] for model in json.loads((ARCHIVE / 'personal-value-models.json').read_bytes())['models']}
    WORKER_REQUESTS = json.loads((PINNED / 'analysis/archive/personal-bots/physical-count-requests.json').read_bytes())['requests']


def fit_person(task):
    name, scope = task
    models = {model['id']: model for model in WORKER_BANK['models']}
    selections = {(row['name'], row['start']): row['models'] for row in WORKER_BANK['selections']}
    campaigns = {aid: request for request in WORKER_REQUESTS if request['name'] == name for aid in request['excludedAids']}
    observed = scope_players(WORKER_DATA, scope)[name]
    prepared, coverage = [], []
    for game in observed:
        campaign = campaigns.get(game['aid'])
        if campaign is None:
            coverage.append({'aid': game['aid'], 'status': 'no-campaign-model'})
            continue
        identity = selections[name, campaign['start']][scope]
        actor, critic = models[identity], WORKER_CRITICS[identity]
        if actor['trainingCut'] > campaign['start'] or critic['trainingCut'] > campaign['start']:
            raise ValueError('Action value model is unavailable before campaign')
        if set(actor['trainedAids']) & set(campaign['excludedAids']) or set(critic['trainedAids']) & set(campaign['excludedAids']):
            raise ValueError('Action value trained on the scored campaign')
        if any(source['availableAt'] >= game['t'] for source in game.get('memorySources', [])):
            raise ValueError('Action value memory source arrived after the retry')
        kind = np.asarray([actor['kindModel']['weights'][kind] for kind in KINDS])
        within = np.asarray(actor['withinWeights'])
        decisions = []
        for decision in game['decisions']:
            base = probabilities(decision, kind, within)
            values = np.clip(value_logits(critic['predictor'], immediate_features(decision)), -6, 6)
            values -= float(base @ values)
            decisions.append({'logBase': np.log(np.maximum(base, 1e-300)).tolist(),
                              'valueLogits': values.tolist(), 'k': decision['k']})
        prepared.append({key: game[key] for key in ['aid', 't', 'availableAt', 'initialNewLevel', 'lv']} |
                        {'memorySources': game.get('memorySources', []), 'critic': identity, 'decisions': decisions})
        coverage.append({'aid': game['aid'], 'status': 'crossfit-before-campaign', 'opening': campaign['start'], 'critic': identity})
    alignments = {}
    for actor in WORKER_BANK['models']:
        if actor['name'] == name and actor['scope'] == scope:
            fitted = fit_alignment(prepared, actor['trainingCut'], set(actor['trainedAids']))
            if not set(fitted['trainedAids']).issubset(actor['trainedAids']):
                raise ValueError('Value preference introduced an unauthorized observation')
            alignments[actor['id']] = {'id': actor['id'], 'name': name, 'scope': scope, 'valueAlignment': fitted}
    held = sorted([game for game in observed if game.get('initialNewLevel')], key=lambda game: game['t'])[-20:]
    prepared_map = {game['aid']: game for game in prepared}
    rows = []
    for game in held:
        if game['aid'] not in prepared_map:
            rows.append({'aid': game['aid'], 'level': game['lv'], 'status': 'no-campaign-model'})
            continue
        target = prepared_map[game['aid']]
        fitted = alignments[target['critic']]['valueAlignment']
        if game['aid'] in fitted['trainedAids'] or fitted['trainingCut'] > campaigns[game['aid']]['start']:
            raise ValueError('Value alignment learned from the target')
        rows.append({'aid': game['aid'], 'level': game['lv'], 'critic': target['critic'], 'strength': fitted['strength'],
                     'opening': campaigns[game['aid']]['start'], 'scores': {
                         'control': action_metrics(target, 0), 'personalValue': action_metrics(target, fitted['strength']),
                         'fixedPositiveValue': action_metrics(target, 1)}})
    return {'name': name, 'scope': scope, 'candidatePrefixes': len(held), 'rows': rows,
            'coverage': coverage, 'models': list(alignments.values())}


def main():
    sources = [Path(__file__), *[Path(__file__).with_name(name) for name in [
        'personal_value.py', 'personal_value_fit.py', 'personal_full_choice_fit.py', 'personal_kind_fit.py',
        'personal_policy_fit.py', 'physical_policy_bank.py']]]
    source_hashes = {source.name: digest(source) for source in sources}
    paths = [DATA, ARCHIVE / 'personal-value-models.json',
             PINNED / 'analysis/archive/personal-bots/physical-memory-policy-bank.json',
             PINNED / 'analysis/archive/personal-bots/physical-count-requests.json']
    hashes = {path.relative_to(ROOT).as_posix(): digest(path) for path in paths}
    value_report = json.loads((ROOT / 'analysis/personal-bots/personal-value-count-evaluation.json').read_bytes())
    if digest(DATA) != value_report['inputHashes'][DATA.name] or digest(paths[1]) != value_report['modelsSha256']:
        raise ValueError('Action critics do not match the measured value experiment')
    if digest(paths[2]) != value_report['pinnedControlHashes']['bank'] or digest(paths[3]) != value_report['pinnedControlHashes']['requests']:
        raise ValueError('Action personal controls changed')
    data = json.loads(DATA.read_bytes())
    validate(data)
    del data
    results = []
    with ProcessPoolExecutor(max_workers=2, initializer=initialize) as pool:
        futures = [pool.submit(fit_person, (name, scope)) for name in NAMES for scope in SCOPES]
        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            print('Measured own cross-fitted value preference', result['name'], result['scope'], flush=True)
    if hashes != {path.relative_to(ROOT).as_posix(): digest(path) for path in paths} or source_hashes != {source.name: digest(source) for source in sources}:
        raise ValueError('Action value inputs changed during fitting')
    validate(json.loads(DATA.read_bytes()))
    players, models = {}, []
    for result in results:
        models.extend(result.pop('models'))
        summary = {}
        for method in ['control', 'personalValue', 'fixedPositiveValue']:
            metrics = [row['scores'][method] for row in result['rows'] if 'scores' in row]
            count = sum(metric['decisions'] for metric in metrics)
            summary[method] = {'prefixes': len(metrics), 'decisions': count,
                               **{field: sum(metric[field] * metric['decisions'] for metric in metrics if metric['decisions']) / count if count else None
                                  for field in ['jointLogLoss', 'topActionAccuracy']}}
        players.setdefault(result['name'], {})[result['scope']] = {**result, 'methods': summary}
    model_file = ARCHIVE / 'personal-value-alignment-models.json'
    model_file.write_text(json.dumps({'inputHashes': hashes, 'fitSourceHashes': source_hashes,
                                     'models': sorted(models, key=lambda model: model['id'])}), encoding='utf-8')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory-personal-value-alignment',
              'targetMet': False, 'personalOnly': True, 'inputHashes': hashes, 'fitSourceHashes': source_hashes,
              'modelsSha256': digest(model_file), 'players': players,
              'note': 'Only earlier own choices fit value preference. Every older training choice uses a critic/actor frozen before its own campaign, '
                      'excluding that campaign outcome and all target dependencies. Signed regularized strengths can favor, ignore or oppose value; '
                      'there is no shared greedy preference. Held natural-action likelihood is not winning-try accuracy. '
                      'No autonomous policy, numeric forecast or genuine prospective cohort is changed.'}
    (ROOT / 'analysis/personal-bots/personal-value-action-evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: {scope: result['methods'] for scope, result in scopes.items()}
                      for name, scopes in players.items()}, indent=2), flush=True)


if __name__ == '__main__':
    main()
