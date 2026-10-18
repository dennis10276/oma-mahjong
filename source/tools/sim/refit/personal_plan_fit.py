import gc
import hashlib
import json
import math
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from personal_full_choice_fit import score
from personal_kind_fit import KINDS
from personal_plan import fit_plan, retry_links, score_plan
from personal_value_fit import ARCHIVE, PINNED, ROOT, SCOPES, digest
from physical_policy_bank import scope_players


ACTION = ARCHIVE / 'experiments/personal-context-actions-2026-10-18T01-55-11-704Z'
DATA = ACTION / 'analysis/archive/personal-bots/policy-value-prefix-data.json'
WORKER_DATA = None


def pinned_read(parent, name):
    manifest = json.loads((parent / 'manifest.json').read_bytes())
    path = parent / name
    if digest(path) != manifest['files'][name]:
        raise ValueError('Personal plan input differs from immutable parent')
    return json.loads(path.read_bytes())


def annotate(data, requests, count):
    rows = {(row['name'], row['start']): row for row in count['rows']}
    campaigns = {(request['name'], aid): rows.get((request['name'], request['start']))
                 for request in requests['requests'] for aid in request['excludedAids']}
    variants = [data['players'], data['memoryPlayers']['configured']]
    for players in variants:
        for name, games in players.items():
            for game in games:
                row = campaigns.get((name, game['aid']))
                game.update(campaignStart=row['start'] if row else None, campaignBoard=row['board'] if row else None,
                            campaignBoardChanged=row.get('boardChangedWithinCampaign', False) if row else False)
    return data


def initialize():
    global WORKER_DATA
    WORKER_DATA = annotate(json.loads(DATA.read_bytes()),
        pinned_read(PINNED, 'analysis/archive/personal-bots/physical-count-requests.json'),
        pinned_read(PINNED, 'analysis/archive/personal-bots/physical-memory-count-data.json'))


def fit_one(actor):
    games = [game for game in scope_players(WORKER_DATA, actor['scope'])[actor['name']]
             if game['aid'] in actor['trainedAids'] and game['availableAt'] < actor['trainingCut']]
    if len(games) != actor['trainingGames'][actor['name']]:
        raise ValueError('Personal plan changed pinned actor membership')
    kind = np.asarray([actor['kindModel']['weights'][name] for name in KINDS])
    model = fit_plan(games, kind, np.asarray(actor['withinWeights']), actor['trainingCut'], set(actor['trainedAids']))
    if model['trainingGames'] != len(games) or not set(model['trainedAids']).issubset(actor['trainedAids']):
        raise ValueError('Personal plan introduced unauthorized observations')
    allowed = {game['aid'] for game in games}
    if any(link['previous'] not in allowed or link['current'] not in allowed for link in model['transitionLinks']):
        raise ValueError('Personal retry transition introduced an unavailable prefix')
    return {'id': actor['id'], 'name': actor['name'], 'scope': actor['scope'], 'episodePlan': model}


def compact(value, step=False):
    return {'decisions': value['decisions'], 'jointLogLoss': value['stepLogLoss' if step else 'jointLogLoss'],
            'topActionAccuracy': value['stepTopActionAccuracy' if step else 'topActionAccuracy']}


def summarize(rows, scope):
    result = {}
    for method in ['control', 'independentStep', 'fixedEpisode', 'adaptiveEpisode']:
        scores = [row['scores'][scope][method] for row in rows if 'scores' in row]
        count = sum(value['decisions'] for value in scores)
        result[method] = {'prefixes': len(scores), 'decisions': count,
            **{field: sum(value[field] * value['decisions'] for value in scores if value['decisions']) / count if count else None
               for field in ['jointLogLoss', 'topActionAccuracy']}}
    return result


def evaluate(data, bank, requests, models):
    actors = {actor['id']: actor for actor in bank['models']}
    plans = {model['id']: model['episodePlan'] for model in models}
    selections = {(row['name'], row['start']): row['models'] for row in bank['selections']}
    campaigns = {(request['name'], aid): request for request in requests['requests'] for aid in request['excludedAids']}
    players = {}
    for name, games in data['players'].items():
        initial = sorted([game for game in games if game.get('initialNewLevel')], key=lambda game: game['t'])[-20:]
        initial_ids = {game['aid'] for game in initial}
        held_campaigns = {campaigns[name, game['aid']]['start'] for game in initial if (name, game['aid']) in campaigns}
        candidates = sorted([game for game in games if game['aid'] in initial_ids
                             or ((name, game['aid']) in campaigns and campaigns[name, game['aid']]['start'] in held_campaigns)], key=lambda game: game['t'])
        state = {}
        rows = []
        for observed in candidates:
            campaign = campaigns.get((name, observed['aid']))
            if campaign is None:
                rows.append({'aid': observed['aid'], 'level': observed['lv'], 'initial': observed['aid'] in initial_ids, 'status': 'no-campaign-model'})
                continue
            scores, lineage = {}, {}
            for scope in SCOPES:
                identity = selections[name, campaign['start']][scope]
                actor, plan = actors[identity], plans[identity]
                if plan['trainingCut'] > campaign['start'] or (plan['availableThrough'] is not None and plan['availableThrough'] >= campaign['start']):
                    raise ValueError('Personal episode model is unavailable before the target campaign')
                if set(plan['trainedAids']) & set(campaign['excludedAids']):
                    raise ValueError('Personal episode model trained on target campaign')
                game = next(item for item in scope_players(data, scope)[name] if item['aid'] == observed['aid'])
                if any(source['availableAt'] >= game['t'] for source in game.get('memorySources', [])):
                    raise ValueError('Episode evaluation uses later memory sources')
                kind = np.asarray([actor['kindModel']['weights'][kind] for kind in KINDS])
                within = np.asarray(actor['withinWeights'])
                fixed = score_plan(game, kind, within, plan)
                previous = state.get((scope, campaign['start']))
                link = retry_links([previous['game'], game]) if previous else []
                prior = None
                if link:
                    reason = link[0][2]
                    prior = np.asarray(previous['posterior']) @ np.asarray(plan['transitions'][reason])
                adaptive = score_plan(game, kind, within, plan, prior)
                control = score([game], kind, within)
                scores[scope] = {'control': {key: control[key] for key in ['decisions', 'jointLogLoss', 'topActionAccuracy']},
                                 'independentStep': compact(fixed, True), 'fixedEpisode': compact(fixed), 'adaptiveEpisode': compact(adaptive)}
                lineage[scope] = {'id': identity, 'trainingCut': plan['trainingCut'], 'availableThrough': plan['availableThrough'],
                                  'previousObservedRetry': previous['game']['aid'] if link else None,
                                  'transitionReason': link[0][2] if link else None}
                state[scope, campaign['start']] = {'game': game, 'posterior': adaptive['posterior']}
            rows.append({'aid': observed['aid'], 'level': observed['lv'], 'opening': campaign['start'],
                         'initial': observed['aid'] in initial_ids, 'scores': scores, 'lineage': lineage})
        first_rows = [row for row in rows if row['initial']]
        retry_rows = [row for row in rows if not row['initial']]
        players[name] = {'initialCandidates': len(initial), 'campaignCandidates': len(candidates),
                         'initialModels': {scope: summarize(first_rows, scope) for scope in SCOPES},
                         'retryModels': {scope: summarize(retry_rows, scope) for scope in SCOPES},
                         'transitionApplications': {scope: sum(bool(row.get('lineage', {}).get(scope, {}).get('previousObservedRetry')) for row in rows) for scope in SCOPES},
                         'rows': rows}
    return players


def main():
    sources = [Path(__file__), *[Path(__file__).with_name(name) for name in [
        'personal_plan.py', 'personal_full_choice_fit.py', 'personal_kind_fit.py', 'personal_policy_fit.py',
        'personal_value.py', 'personal_value_fit.py', 'physical_policy_bank.py']]]
    source_hashes = {source.name: digest(source) for source in sources}
    names = {'bank': 'physical-memory-policy-bank.json', 'requests': 'physical-count-requests.json',
             'count': 'physical-memory-count-data.json'}
    paths = [DATA, *[PINNED / 'analysis/archive/personal-bots' / name for name in names.values()],
             PINNED / 'analysis/personal-bots/personal-memory-action-evaluation.json']
    hashes = {path.relative_to(ROOT).as_posix(): digest(path) for path in paths}
    data = pinned_read(ACTION, 'analysis/archive/personal-bots/policy-value-prefix-data.json')
    fingerprint = hashlib.sha256()
    for name in data['fingerprintFiles']:
        fingerprint.update(name.encode())
        fingerprint.update((ACTION / name).read_bytes())
    if fingerprint.hexdigest() != data['fingerprint']:
        raise ValueError('Archived prefix source/data lineage changed')
    prefix_fingerprint = data['fingerprint']
    del data
    gc.collect()
    bank, requests, count = (pinned_read(PINNED, 'analysis/archive/personal-bots/' + names[key]) for key in ['bank', 'requests', 'count'])
    controls = pinned_read(PINNED, 'analysis/personal-bots/personal-memory-action-evaluation.json')
    actors = [actor for actor in bank['models'] if actor['scope'] in SCOPES]
    models = []
    progress_file = ROOT / 'analysis/personal-bots/personal-plan-fit-progress.jsonl'
    with progress_file.open('w', encoding='utf-8') as progress:
        progress.write(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'inputHashes': hashes, 'fitSourceHashes': source_hashes, 'plannedModels': len(actors)}) + '\n')
        progress.flush()
        print('Fitting', len(actors), 'independent own-person episode-style models', flush=True)
        with ProcessPoolExecutor(max_workers=2, initializer=initialize) as pool:
            futures = [pool.submit(fit_one, actor) for actor in actors]
            for future in as_completed(futures):
                fitted = future.result()
                models.append(fitted)
                model = fitted['episodePlan']
                event = {'made': datetime.now(timezone.utc).isoformat(), 'completed': len(models), 'total': len(actors),
                         'name': fitted['name'], 'scope': fitted['scope'], 'trainingGames': model['trainingGames'],
                         'trainingChoices': model['trainingChoices'], 'retryLinks': len(model['transitionLinks'])}
                progress.write(json.dumps(event) + '\n')
                progress.flush()
                if len(models) % 25 == 0:
                    print('Fitted', len(models), '/', len(actors), 'personal coherent episode models', flush=True)
    models.sort(key=lambda model: model['id'])
    data = annotate(json.loads(DATA.read_bytes()), requests, count)
    players = evaluate(data, bank, requests, models)
    for name, player in players.items():
        for scope in SCOPES:
            previous, measured = controls['players'][name]['models'][scope], player['initialModels'][scope]['control']
            for field in ['decisions', 'jointLogLoss', 'topActionAccuracy']:
                if not math.isclose(previous[field], measured[field], rel_tol=1e-12, abs_tol=1e-12):
                    raise ValueError('Episode experiment changed pinned initial-action controls')
    if hashes != {path.relative_to(ROOT).as_posix(): digest(path) for path in paths} or source_hashes != {source.name: digest(source) for source in sources}:
        raise ValueError('Personal episode fitting inputs changed during measurement')
    model_file = ARCHIVE / 'personal-plan-models.json'
    model_file.write_text(json.dumps({'prefixFingerprint': prefix_fingerprint, 'inputHashes': hashes,
                                    'fitSourceHashes': source_hashes, 'models': models}), encoding='utf-8')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory-personal-episode-actions',
              'targetMet': False, 'personalOnly': True, 'prefixFingerprint': prefix_fingerprint,
              'inputHashes': hashes, 'fitSourceHashes': source_hashes, 'modelsSha256': digest(model_file),
              'models': len(models), 'players': players,
              'note': 'Two coherent per-attempt preferences fit only each person\'s earlier available natural choices against unchanged pinned actors. '
                      'The independent-step mixture is a declared ablation using the same fitted components without within-attempt plan persistence. '
                      'Initial-new priors exclude replay/retry habits; retry matrices use only adjacent same-board older natural failures. '
                      'Held likelihood filters latent plans using only earlier actual choices, never later choices; adaptive retry diagnostics condition only on earlier available observed failures. '
                      'Those human sequences are supplied for behavior diagnostics, not new-level forecasts or autonomous simulation. '
                      'No target winning count, family habits, prescribed greedy preference, new forecast or prospective80% claim is used.'}
    (ROOT / 'analysis/personal-bots/personal-plan-action-evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: {'initial': player['initialModels'], 'retries': player['retryModels'],
                            'transitionApplications': player['transitionApplications']} for name, player in players.items()}, indent=2), flush=True)


if __name__ == '__main__':
    main()
