import hashlib
import json
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

from personal_full_choice_fit import fit_models, fit_person, fit_person_joint, prior_of, validate
from personal_kind_fit import encode


ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'analysis/archive/personal-bots/policy-prefix-data.json'
REQUESTS = ROOT / 'analysis/archive/personal-bots/physical-count-requests.json'
OUTPUT = ROOT / 'analysis/archive/personal-bots/physical-policy-bank.json'
WORKER_DATA = None
MEMORY_SCOPES = {'ownCarryAll': 'configured', 'ownRecallAll': 'full'}


def scope_players(data, scope):
    mode = MEMORY_SCOPES.get(scope)
    return data['memoryPlayers'][mode] if mode else data['players']


def eligible_players(players, request, scope):
    excluded = set(request.get('excludedAids', []))
    own_only = scope.startswith('own')
    return {name: [game for game in games if game['availableAt'] < request['start'] and game['aid'] not in excluded
                   and all(source['aid'] not in excluded and source['availableAt'] < request['start']
                           and source['availableAt'] < game.get('t', game['availableAt'])
                           and source['availableAt'] <= game['availableAt'] for source in game.get('memorySources', []))
                   and (scope in ['all', 'ownAll', 'ownJointAll', *MEMORY_SCOPES] or game.get('initialNewLevel', False))]
            for name, games in players.items() if not own_only or name == request['name']}


def training_key(players, name, scope, single_step=False, intent=False, schema=None, pair_intent=False):
    roster = sorted((person, game['aid'], game['availableAt'], tuple(sorted((source['aid'], source['availableAt'])
                     for source in game.get('memorySources', [])))) for person, games in players.items() for game in games)
    key = hashlib.sha256(json.dumps([name, scope, single_step, intent, schema, pair_intent, roster], separators=(',', ':')).encode()).hexdigest()
    return key, roster


def schema_of(data):
    return [data.get('features'), data.get('kindContextFeatures'), data.get('retryMemoryMeasured', False)]


def plan_models(data, requests, scopes=('all', 'novel', 'ownAll', 'ownNovel')):
    planned, selections = {}, []
    for request in requests:
        models = {}
        for scope in scopes:
            players = eligible_players(scope_players(data, scope), request, scope)
            key, roster = training_key(players, request['name'], scope, data.get('physicalSingleStep', False), data.get('followThroughMeasured', False), schema_of(data), data.get('pairFollowThroughMeasured', False))
            cutoff = max((item[2] for item in roster), default=-1) + 1
            if cutoff > request['start']:
                raise ValueError('Policy model is unavailable at the requested opening')
            planned.setdefault(key, {'id': key, 'name': request['name'], 'scope': scope,
                                     'trainingCut': cutoff, 'request': request, 'roster': roster})
            models[scope] = key
        selections.append({'name': request['name'], 'start': request['start'], 'models': models})
    return list(planned.values()), selections


def initialize(data_file=None):
    global WORKER_DATA
    WORKER_DATA = json.loads(Path(data_file or DATA).read_bytes())


def follow_through_of(games, field='followThroughSamples', trays=(1, 2, 3)):
    opportunities, followed = [0.0] * 4, [0.0] * 4
    for age, game in enumerate(reversed(sorted(games, key=lambda item: item['availableAt']))):
        weight = 0.5 ** (age / 20)
        for sample in game.get(field, []):
            tray = sample['tray']
            if tray not in trays or type(sample['followed']) is not bool:
                raise ValueError('Invalid observed follow-through opportunity')
            opportunities[tray] += weight
            followed[tray] += weight * sample['followed']
    return {'probabilities': [(1 + followed[tray]) / (2 + opportunities[tray]) if tray in trays else 0.0 for tray in range(4)],
            'opportunities': opportunities, 'followed': followed,
            'note': 'Own earlier natural ' + field + ' after clock clearing, by tray occupancy; twenty-prefix decay and independent Beta(1,1) priors. This is a next-action rate, not winning-attempt accuracy.'}


def fit_one(task):
    players = eligible_players(scope_players(WORKER_DATA, task['scope']), task['request'], task['scope'])
    key, roster = training_key(players, task['name'], task['scope'], WORKER_DATA.get('physicalSingleStep', False), WORKER_DATA.get('followThroughMeasured', False), schema_of(WORKER_DATA), WORKER_DATA.get('pairFollowThroughMeasured', False))
    if key != task['id'] or json.dumps(roster) != json.dumps(task['roster']):
        raise ValueError('Policy bank membership changed')
    joint = task['scope'].startswith('ownJoint')
    if task['scope'].startswith('own'):
        fitter = fit_person_joint if joint else fit_person
        kind, within, count = fitter(players[task['name']], task['trainingCut'], prior_of(WORKER_DATA),
                                     len(WORKER_DATA['kindContextFeatures']))
        counts = {task['name']: count}
    else:
        kind, within, counts = fit_models(players, task['name'], task['trainingCut'], prior_of(WORKER_DATA),
                                          len(WORKER_DATA['kindContextFeatures']))
    return {key: task[key] for key in ['id', 'name', 'scope', 'trainingCut']} | {
        'availableThrough': max((item[2] for item in roster), default=None),
        'trainingGames': counts, 'trainedAids': sorted({aid for item in roster for aid in [item[1], *[source[0] for source in item[3]]]}),
        'retryMemoryMode': MEMORY_SCOPES.get(task['scope'], 'none'),
        'kindModel': encode(kind), 'withinWeights': within.tolist(), 'jointChoice': joint,
        'physicalSingleStep': WORKER_DATA.get('physicalSingleStep', False),
        **({'followThrough': follow_through_of(players[task['name']])} if WORKER_DATA.get('followThroughMeasured') else {}),
        **({'pairFollowThrough': follow_through_of(players[task['name']], 'pairFollowThroughSamples', (0, 1, 2, 3))}
           if WORKER_DATA.get('pairFollowThroughMeasured') else {})}


def main():
    experiment = sys.argv[1] if len(sys.argv) > 1 else 'physical'
    if experiment not in ['physical', 'joint', 'keys', 'single', 'intent', 'relation', 'sequence', 'memory']:
        raise ValueError('Unknown policy bank experiment')
    data_file = DATA.with_name('policy-' + experiment + '-prefix-data.json') if experiment in ['intent', 'single', 'relation', 'sequence', 'memory'] else DATA
    raw, requests_raw = data_file.read_bytes(), REQUESTS.read_bytes()
    data, requests = json.loads(raw), json.loads(requests_raw)
    if bool(data.get('physicalSingleStep', False)) != (experiment == 'single'):
        raise ValueError('Policy bank scoring mode does not match its feature dataset')
    if experiment == 'intent' and not data.get('followThroughMeasured'):
        raise ValueError('Intent bank requires observed follow-through samples')
    if experiment == 'relation' and ('knownPairPrep' not in data['features'] or 'knownPairPrepShare' not in data['kindContextFeatures']):
        raise ValueError('Relational bank requires observed pair-preparation features')
    if experiment == 'sequence' and not data.get('pairFollowThroughMeasured'):
        raise ValueError('Sequence bank requires observed pair follow-through samples')
    if experiment == 'memory' and not data.get('retryMemoryMeasured'):
        raise ValueError('Memory bank requires observation-source dependencies')
    validate(data)
    sources = [Path(__file__), Path(__file__).with_name('personal_full_choice_fit.py'),
               Path(__file__).with_name('personal_kind_fit.py'), Path(__file__).with_name('personal_policy_fit.py')]
    source_hashes = {source.name: hashlib.sha256(source.read_bytes()).hexdigest() for source in sources}
    scopes = ('ownAll', 'ownNovel', *MEMORY_SCOPES) if experiment == 'memory' else ('ownAll', 'ownNovel') if experiment in ['keys', 'single', 'intent', 'relation', 'sequence'] else ('ownAll', 'ownNovel', 'ownJointAll', 'ownJointNovel') if experiment == 'joint' else ('all', 'novel', 'ownAll', 'ownNovel')
    planned, selections = plan_models(data, requests['requests'], scopes)
    models = []
    print('Fitting', len(planned), 'strictly earlier-available physical models for', len(selections), 'openings', flush=True)
    with ProcessPoolExecutor(max_workers=2 if experiment == 'memory' else 3, initializer=initialize, initargs=(str(data_file),)) as pool:
        futures = {pool.submit(fit_one, task): task for task in planned}
        for future in as_completed(futures):
            model = future.result()
            models.append(model)
            print(len(models), '/', len(planned), model['name'], model['scope'], model['trainingGames'], flush=True)
    validate(data)
    if raw != data_file.read_bytes() or requests_raw != REQUESTS.read_bytes() or source_hashes != {
            source.name: hashlib.sha256(source.read_bytes()).hexdigest() for source in sources}:
        raise ValueError('Policy bank inputs changed while fitting')
    result = {'made': datetime.now(timezone.utc).isoformat(), 'scope': data['scope'],
              'prefixFingerprint': data['fingerprint'], 'prefixDataSha256': hashlib.sha256(raw).hexdigest(),
              'requestsSha256': hashlib.sha256(requests_raw).hexdigest(), 'fitSources': source_hashes,
              'features': data['features'], 'kindContextFeatures': data['kindContextFeatures'],
              'selections': selections, 'models': models,
              'note': 'Every model uses strictly earlier available prefixes and excludes all target-campaign aids. Own scopes fit only that person, once, against a declared generic prior; no family recordings or family fitted prior. Novel scopes use first attempts on first-clear progression, not winning-prefix selection. No target winning-count labels enter fitting. This is not forecast accuracy.'}
    output = OUTPUT.with_name('physical-' + ('key' if experiment == 'keys' else experiment) + '-policy-bank.json') if experiment != 'physical' else OUTPUT
    output.write_text(json.dumps(result), encoding='utf-8')
    print('Saved physical policy bank', len(models), flush=True)


if __name__ == '__main__':
    main()
