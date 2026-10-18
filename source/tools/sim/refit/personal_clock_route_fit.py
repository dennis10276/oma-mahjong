import json
from datetime import datetime, timezone
from pathlib import Path

from personal_clock_route import FEATURES, PARAMETERS, fit_route
from personal_known_plan_fit import EPISODE, evaluate
from personal_known_plan_snapshot import validate_data
from personal_plan_fit import pinned_read
from personal_value_fit import ARCHIVE, PINNED, ROOT, digest


DATA = ARCHIVE / 'policy-clock-route-prefix-data.json'


def main():
    data = json.loads(DATA.read_bytes())
    validate_data(data)
    if (data['pilot'] or data['prefixes'] != 398 or data['totals']['calls'] != 33543
            or data['features'] != FEATURES or data['parameters'] != PARAMETERS):
        raise ValueError('Clock-route fitting requires all original prefixes with declared public route features')
    source_files = [path for path in Path(__file__).parent.iterdir() if path.suffix == '.py']
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
        raise ValueError('Frozen own-person actor membership changed')
    models = {}
    progress = ROOT / 'analysis/personal-bots/personal-clock-route-fit-progress.jsonl'
    progress.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'models': len(actors), 'dataSha256': data_hash}) + '\n', encoding='utf-8')
    for position, (identity, actor) in enumerate(actors.items(), 1):
        models[identity] = fit_route(data['players'][actor['name']], actor)
        with progress.open('a', encoding='utf-8') as stream:
            stream.write(json.dumps({'completed': position, 'id': identity, 'name': actor['name']}) + '\n')
        if position % 10 == 0:
            print('Clock-route models', position, '/', len(actors), flush=True)
    by_request = {(row['name'], row['start']): row for row in requests['requests']}
    for selection in bank['selections']:
        model = models[selection['models']['ownAll']]
        if (model['trainingCut'] > selection['start']
                or model['availableThrough'] is not None and model['availableThrough'] >= selection['start']
                or set(model['trainedAids']) & set(by_request[selection['name'], selection['start']]['excludedAids'])):
            raise ValueError('Clock-route fit used a target campaign or unavailable action')
    players = evaluate(data, actors, models, previous)
    for player in players.values():
        for group in ['initialModels', 'retryModels']:
            player[group]['clockRoute'] = player[group].pop('knownPlan')
        for row in player['rows']:
            if 'scores' in row:
                row['scores']['clockRoute'] = row['scores'].pop('knownPlan')
    validate_data(data)
    if (digest(DATA) != data_hash or any(digest(path) != source_hashes[path.name] for path in source_files)
            or any(digest(ROOT / name) != expected for name, expected in input_hashes.items())):
        raise ValueError('Clock-route fitting inputs or sources changed during fitting')
    model_file = ARCHIVE / 'personal-clock-route-models.json'
    model_file.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory',
        'targetMet': False, 'personalOnly': True, 'scope': 'ownAll', 'dataSha256': data_hash,
        'fitSourceHashes': source_hashes, 'inputHashes': input_hashes,
        'models': [{'id': identity, 'name': actors[identity]['name'], 'scope': 'ownAll', 'clockRoute': model}
                   for identity, model in models.items()]}), encoding='utf-8')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory', 'targetMet': False,
              'personalOnly': True, 'scope': 'ownAll', 'models': len(models), 'dataSha256': data_hash,
              'modelsSha256': digest(model_file), 'fitSourceHashes': source_hashes, 'inputHashes': input_hashes,
              'actionControlsMatched': sum('scores' in row for player in players.values() for row in player['rows']),
              'players': players, 'note': 'Same frozen ownAll action memberships and unchanged held initial/retry cohorts. '
                  '197 per-prefix and eight summary controls must remain exact. Each person fits their own clock route preferences. '
                  'No generic clock planner may bypass these choices in autonomous evaluation. '
                  'Action likelihood cannot establish winning-count accuracy or the genuinely frozen future80% target.'}
    (ROOT / 'analysis/personal-bots/personal-clock-route-action-evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: {key: player[key] for key in ['initialModels', 'retryModels']} for name, player in players.items()}, indent=2))


if __name__ == '__main__':
    main()
