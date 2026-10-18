import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from personal_clock_strategy import FEATURES, PARAMETERS, fit_strategy, score_strategy
from personal_full_choice_fit import score
from personal_known_plan_fit import EPISODE, summarize
from personal_plan_fit import pinned_read
from personal_value_fit import ARCHIVE, PINNED, ROOT, digest


DATA = ARCHIVE / 'policy-clock-strategy-prefix-data.json'


def validate_data(data):
    fingerprint = hashlib.sha256()
    for name in data['fingerprintFiles']:
        fingerprint.update(name.encode())
        fingerprint.update((ROOT / name).read_bytes())
    if (fingerprint.hexdigest() != data['fingerprint'] or data['targetMet'] or data['pilot']
            or data['prefixes'] != 398 or data['totals']['calls'] != 33543
            or data['features'] != FEATURES or data['parameters'] != PARAMETERS):
        raise ValueError('Adaptive clock fitting requires complete source-matched unchanged-prefix features')


def evaluate(data, actors, models, previous):
    players = {}
    for name, old in previous['players'].items():
        rows = []
        for original in old['rows']:
            if 'scores' not in original:
                rows.append({key: value for key, value in original.items() if key != 'lineage'})
                continue
            identity = original['lineage']['ownAll']['id']
            actor, model = actors[identity], models[identity]
            if model['trainingCut'] > original['opening'] or model['availableThrough'] is not None and model['availableThrough'] >= original['opening']:
                raise ValueError('Adaptive clock model used unavailable target-campaign actions')
            game = next(game for game in data['players'][name] if game['aid'] == original['aid'])
            kind = np.asarray([actor['kindModel']['weights'][kind] for kind in ['flip', 'pair', 'single', 'fatal']])
            control = score([game], kind, np.asarray(actor['withinWeights']))
            control = {key: control[key] for key in ['decisions', 'jointLogLoss', 'topActionAccuracy']}
            expected = original['scores']['ownAll']['control']
            if control['decisions'] != expected['decisions'] or any(abs(control[key] - expected[key]) > 1e-12 for key in ['jointLogLoss', 'topActionAccuracy']):
                raise ValueError('Adaptive clock evaluation changed an immutable action control')
            rows.append({'aid': game['aid'], 'level': game['lv'], 'opening': original['opening'], 'initial': original['initial'],
                         'initialNewLevel': bool(game.get('initialNewLevel')),
                         'scores': {'control': control, 'adaptiveClock': score_strategy([game], actor, model)},
                         'lineage': {'id': identity, 'trainingCut': model['trainingCut'], 'availableThrough': model['availableThrough']}})
        initial, retries = [row for row in rows if row['initial']], [row for row in rows if not row['initial']]
        players[name] = {'initialCandidates': old['initialCandidates'], 'campaignCandidates': old['campaignCandidates'],
                         'initialModels': {method: summarize(initial, method) for method in ['control', 'adaptiveClock']},
                         'retryModels': {method: summarize(retries, method) for method in ['control', 'adaptiveClock']}, 'rows': rows}
        for current, expected in [(players[name]['initialModels']['control'], old['initialModels']['ownAll']['control']),
                                  (players[name]['retryModels']['control'], old['retryModels']['ownAll']['control'])]:
            if current['decisions'] != expected['decisions'] or any(current[key] is not None and abs(current[key] - expected[key]) > 1e-12
                                                                 for key in ['jointLogLoss', 'topActionAccuracy']):
                raise ValueError('Adaptive clock evaluation changed held initial/retry summaries')
    return players


def main():
    data = json.loads(DATA.read_bytes())
    validate_data(data)
    names = ['personal_clock_strategy.py', 'personal_clock_strategy_snapshot.py', 'personal_full_choice_fit.py',
             'personal_known_plan.py', 'personal_known_plan_fit.py', 'personal_known_plan_snapshot.py',
             'personal_plan_fit.py', 'personal_value_fit.py', 'personal_policy_fit.py', 'personal_kind_fit.py']
    source_files = [Path(__file__), *[Path(__file__).with_name(name) for name in names]]
    source_hashes = {path.name: digest(path) for path in source_files}
    data_hash = digest(DATA)
    input_files = [PINNED / 'manifest.json', PINNED / 'analysis/archive/personal-bots/physical-memory-policy-bank.json',
                   PINNED / 'analysis/archive/personal-bots/physical-count-requests.json', EPISODE / 'manifest.json',
                   EPISODE / 'analysis/personal-bots/personal-plan-action-evaluation.json']
    input_hashes = {path.relative_to(ROOT).as_posix(): digest(path) for path in input_files}
    bank = pinned_read(PINNED, 'analysis/archive/personal-bots/physical-memory-policy-bank.json')
    requests = pinned_read(PINNED, 'analysis/archive/personal-bots/physical-count-requests.json')
    previous = pinned_read(EPISODE, 'analysis/personal-bots/personal-plan-action-evaluation.json')
    actors = {actor['id']: actor for actor in bank['models'] if actor['scope'] == 'ownAll'}
    if len(actors) != 138:
        raise ValueError('Adaptive clock own-person membership changed')
    models = {}
    progress = ROOT / 'analysis/personal-bots/personal-clock-strategy-fit-progress.jsonl'
    progress.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'models': len(actors), 'dataSha256': data_hash}) + '\n', encoding='utf-8')
    for position, (identity, actor) in enumerate(actors.items(), 1):
        models[identity] = fit_strategy(data['players'][actor['name']], actor)
        with progress.open('a', encoding='utf-8') as stream:
            stream.write(json.dumps({'completed': position, 'id': identity, 'name': actor['name']}) + '\n')
        if position % 10 == 0:
            print('Adaptive clock models', position, '/', len(actors), flush=True)
    by_request = {(row['name'], row['start']): row for row in requests['requests']}
    for selection in bank['selections']:
        model = models[selection['models']['ownAll']]
        if (model['trainingCut'] > selection['start']
                or model['availableThrough'] is not None and model['availableThrough'] >= selection['start']
                or set(model['trainedAids']) & set(by_request[selection['name'], selection['start']]['excludedAids'])):
            raise ValueError('Adaptive clock fit used target-campaign or future actions')
    players = evaluate(data, actors, models, previous)
    validate_data(data)
    if (digest(DATA) != data_hash or any(digest(path) != source_hashes[path.name] for path in source_files)
            or any(digest(ROOT / name) != expected for name, expected in input_hashes.items())):
        raise ValueError('Adaptive clock inputs/sources changed during fitting')
    model_file = ARCHIVE / 'personal-clock-strategy-models.json'
    model_file.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory',
        'targetMet': False, 'personalOnly': True, 'scope': 'ownAll', 'dataSha256': data_hash,
        'fitSourceHashes': source_hashes, 'inputHashes': input_hashes,
        'models': [{'id': identity, 'name': actors[identity]['name'], 'scope': 'ownAll', 'clockStrategy': model}
                   for identity, model in models.items()]}), encoding='utf-8')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory', 'targetMet': False,
              'personalOnly': True, 'scope': 'ownAll', 'models': len(models), 'dataSha256': data_hash,
              'modelsSha256': digest(model_file), 'fitSourceHashes': source_hashes, 'inputHashes': input_hashes,
              'actionControlsMatched': sum('scores' in row for player in players.values() for row in player['rows']),
              'players': players, 'note': 'Two exchangeable strategies, own-person route/pair preferences and context-dependent switching. '
                  'All138 earlier-only memberships,197 per-prefix controls and eight summary controls are fixed. '
                  'Held evaluation uses forward filtering with past actions only, never smoothed future states. '
                  'Generic clock planning must be disabled. Action-fit evidence cannot establish winning-try accuracy or future80% success.'}
    (ROOT / 'analysis/personal-bots/personal-clock-strategy-action-evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: {key: player[key] for key in ['initialModels', 'retryModels']} for name, player in players.items()}, indent=2))


if __name__ == '__main__':
    main()
