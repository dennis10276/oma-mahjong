import gc
import json
import math
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from personal_context import fit_context, score_context
from personal_full_choice_fit import validate
from personal_kind_fit import KINDS
from personal_value_fit import ARCHIVE, DATA, PINNED, ROOT, SCOPES, digest
from physical_policy_bank import scope_players


WORKER_DATA = None


def initialize():
    global WORKER_DATA
    WORKER_DATA = json.loads(DATA.read_bytes())


def fit_one(actor):
    games = [game for game in scope_players(WORKER_DATA, actor['scope'])[actor['name']]
             if game['aid'] in actor['trainedAids'] and game['availableAt'] < actor['trainingCut']]
    if len(games) != actor['trainingGames'][actor['name']]:
        raise ValueError('Context fit changed pinned personal actor membership')
    kind = np.asarray([actor['kindModel']['weights'][name] for name in KINDS])
    residual = fit_context(games, kind, np.asarray(actor['withinWeights']), actor['trainingCut'],
                           set(actor['trainedAids']), WORKER_DATA['valueFeatures'])
    if len(games) != residual['trainingGames'] or not set(residual['trainedAids']).issubset(actor['trainedAids']):
        raise ValueError('Context residual introduced unauthorized observations')
    return {'id': actor['id'], 'name': actor['name'], 'scope': actor['scope'], 'choiceResidual': residual}


def evaluate(data, bank, requests, fitted):
    actors = {actor['id']: actor for actor in bank['models']}
    models = {model['id']: model['choiceResidual'] for model in fitted}
    selections = {(row['name'], row['start']): row['models'] for row in bank['selections']}
    players = {}
    for name, games in data['players'].items():
        held = sorted([game for game in games if game.get('initialNewLevel')], key=lambda game: game['t'])[-20:]
        campaigns = {aid: request for request in requests['requests'] if request['name'] == name for aid in request['excludedAids']}
        rows = []
        for game in held:
            campaign = campaigns.get(game['aid'])
            if campaign is None:
                rows.append({'aid': game['aid'], 'level': game['lv'], 'status': 'no-campaign-model'})
                continue
            scopes = {}
            for scope in SCOPES:
                identity = selections[name, campaign['start']][scope]
                actor, residual = actors[identity], models[identity]
                if residual['trainingCut'] > campaign['start'] or (residual['availableThrough'] is not None and residual['availableThrough'] >= campaign['start']):
                    raise ValueError('Context residual arrived after opening')
                if set(residual['trainedAids']) & set(campaign['excludedAids']):
                    raise ValueError('Context residual trained on target campaign')
                observed = next(item for item in scope_players(data, scope)[name] if item['aid'] == game['aid'])
                kind = np.asarray([actor['kindModel']['weights'][kind] for kind in KINDS])
                within = np.asarray(actor['withinWeights'])
                scopes[scope] = {method: score_context([observed], kind, within, residual, min(stages, len(residual['trees'])))
                                 for method, stages in [('control', 0), ('context8', 8), ('context24', 24)]}
            rows.append({'aid': game['aid'], 'level': game['lv'], 'opening': campaign['start'], 'scores': scopes})
        summaries = {}
        for scope in SCOPES:
            summaries[scope] = {}
            for method in ['control', 'context8', 'context24']:
                scores = [row['scores'][scope][method] for row in rows if 'scores' in row]
                count = sum(score['decisions'] for score in scores)
                summaries[scope][method] = {'prefixes': len(scores), 'decisions': count,
                    **{field: sum(score[field] * score['decisions'] for score in scores if score['decisions']) / count if count else None
                       for field in ['jointLogLoss', 'topActionAccuracy']}}
        players[name] = {'candidatePrefixes': len(held), 'models': summaries, 'rows': rows}
    return players


def main():
    sources = [Path(__file__), *[Path(__file__).with_name(name) for name in [
        'personal_context.py', 'personal_value.py', 'personal_value_fit.py', 'personal_full_choice_fit.py',
        'personal_kind_fit.py', 'personal_policy_fit.py', 'physical_policy_bank.py']]]
    source_hashes = {source.name: digest(source) for source in sources}
    prefix_path = ARCHIVE / 'experiments/personal-value-2026-10-18T01-27-33-959Z/analysis/archive/personal-bots/policy-value-prefix-data.json'
    bank_path = PINNED / 'analysis/archive/personal-bots/physical-memory-policy-bank.json'
    requests_path = PINNED / 'analysis/archive/personal-bots/physical-count-requests.json'
    controls_path = PINNED / 'analysis/personal-bots/personal-memory-action-evaluation.json'
    paths = [DATA, prefix_path, bank_path, requests_path, controls_path]
    hashes = {path.relative_to(ROOT).as_posix(): digest(path) for path in paths}
    manifest = json.loads((PINNED / 'manifest.json').read_bytes())
    for path in [bank_path, requests_path, controls_path]:
        if digest(path) != manifest['files'][path.relative_to(PINNED).as_posix()]:
            raise ValueError('Pinned context control evidence changed')
    if digest(DATA) != digest(prefix_path):
        raise ValueError('Context prefix data differs from pinned actual-tap measurements')
    data = json.loads(DATA.read_bytes())
    validate(data)
    prefix_fingerprint = data['fingerprint']
    del data
    gc.collect()
    bank, requests, controls = (json.loads(path.read_bytes()) for path in [bank_path, requests_path, controls_path])
    actors = [actor for actor in bank['models'] if actor['scope'] in SCOPES]
    models = []
    print('Fitting', len(actors), 'own-person contextual choice residuals', flush=True)
    with ProcessPoolExecutor(max_workers=2, initializer=initialize) as pool:
        futures = [pool.submit(fit_one, actor) for actor in actors]
        for future in as_completed(futures):
            models.append(future.result())
            if len(models) % 25 == 0:
                print('Fitted', len(models), '/', len(actors), 'contextual personal actors', flush=True)
    models.sort(key=lambda model: model['id'])
    data = json.loads(DATA.read_bytes())
    players = evaluate(data, bank, requests, models)
    validate(data)
    for name, player in players.items():
        for scope in SCOPES:
            previous, current = controls['players'][name]['models'][scope], player['models'][scope]['control']
            for field in ['decisions', 'jointLogLoss', 'topActionAccuracy']:
                if not math.isclose(previous[field], current[field], rel_tol=1e-12, abs_tol=1e-12):
                    raise ValueError('Context experiment changed a pinned control')
    if hashes != {path.relative_to(ROOT).as_posix(): digest(path) for path in paths} or source_hashes != {source.name: digest(source) for source in sources}:
        raise ValueError('Context fit inputs changed during measurement')
    model_file = ARCHIVE / 'personal-context-models.json'
    model_file.write_text(json.dumps({'prefixFingerprint': prefix_fingerprint, 'inputHashes': hashes,
        'fitSourceHashes': source_hashes, 'models': models}), encoding='utf-8')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory-personal-context-actions',
              'targetMet': False, 'personalOnly': True, 'prefixFingerprint': prefix_fingerprint,
              'inputHashes': hashes, 'fitSourceHashes': source_hashes, 'modelsSha256': digest(model_file),
              'players': players, 'models': len(models),
              'note': 'Nonlinear own-person choice residuals against unchanged pinned personal actors. Actual one-tap features, '
                      'frozen picture knowledge, older availability and target exclusions remain intact. '
                      'Eight/twenty-four trees are declared diagnostics, not selected from held results. '
                      'No outcome labels or other people fit these preferences. All original held action prefixes remain accounted for. '
                      'Action likelihood is not winning-try accuracy, an autonomous policy promotion or a new frozen forecast.'}
    (ROOT / 'analysis/personal-bots/personal-context-action-evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: row['models'] for name, row in players.items()}, indent=2), flush=True)


if __name__ == '__main__':
    main()
