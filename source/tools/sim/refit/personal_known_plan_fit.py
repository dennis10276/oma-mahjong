import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from personal_full_choice_fit import score
from personal_kind_fit import KINDS
from personal_known_plan import fit_plan, score_plan
from personal_known_plan_snapshot import validate_data
from personal_plan_fit import pinned_read
from personal_value_fit import ARCHIVE, PINNED, ROOT, digest


EPISODE = ARCHIVE / 'experiments/personal-episode-actions-2026-10-18T05-33-43-593Z'
DATA = ARCHIVE / 'policy-known-plan-prefix-data.json'


def summarize(rows, method):
    scores = [row['scores'][method] for row in rows if 'scores' in row]
    count = sum(value['decisions'] for value in scores)
    return {'prefixes': len(scores), 'decisions': count,
            **{field: sum(value[field] * value['decisions'] for value in scores if value['decisions']) / count if count else None
               for field in ['jointLogLoss', 'topActionAccuracy']}}


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
                raise ValueError('Known-plan model was not available before target campaign')
            game = next(game for game in data['players'][name] if game['aid'] == original['aid'])
            kind = np.asarray([actor['kindModel']['weights'][kind] for kind in KINDS])
            control = score([game], kind, np.asarray(actor['withinWeights']))
            control = {key: control[key] for key in ['decisions', 'jointLogLoss', 'topActionAccuracy']}
            expected = original['scores']['ownAll']['control']
            if control['decisions'] != expected['decisions'] or any(abs(control[key] - expected[key]) > 1e-12 for key in ['jointLogLoss', 'topActionAccuracy']):
                raise ValueError('Known-plan evaluation changed an immutable per-prefix action control')
            rows.append({'aid': game['aid'], 'level': game['lv'], 'opening': original['opening'], 'initial': original['initial'],
                         'scores': {'control': control, 'knownPlan': score_plan([game], actor, model)},
                         'lineage': {'id': identity, 'trainingCut': model['trainingCut'], 'availableThrough': model['availableThrough']}})
        initial, retries = [row for row in rows if row['initial']], [row for row in rows if not row['initial']]
        players[name] = {'initialCandidates': old['initialCandidates'], 'campaignCandidates': old['campaignCandidates'],
                         'initialModels': {method: summarize(initial, method) for method in ['control', 'knownPlan']},
                         'retryModels': {method: summarize(retries, method) for method in ['control', 'knownPlan']}, 'rows': rows}
        for current, expected in [(players[name]['initialModels']['control'], old['initialModels']['ownAll']['control']),
                                  (players[name]['retryModels']['control'], old['retryModels']['ownAll']['control'])]:
            if current['decisions'] != expected['decisions'] or any(current[key] is not None and abs(current[key] - expected[key]) > 1e-12
                                                                 for key in ['jointLogLoss', 'topActionAccuracy']):
                raise ValueError('Known-plan evaluation changed held initial/retry action summaries')
    return players


def main():
    data = json.loads(DATA.read_bytes())
    validate_data(data)
    if data['pilot'] or data['prefixes'] != 398 or data['totals']['calls'] != 33543:
        raise ValueError('Own-person fitting requires complete unchanged-prefix instrumentation, not a pilot')
    source_files = [Path(__file__), *[Path(__file__).with_name(name) for name in [
        'personal_known_plan.py', 'personal_full_choice_fit.py', 'personal_kind_fit.py', 'personal_policy_fit.py',
        'personal_known_plan_snapshot.py', 'personal_plan_fit.py', 'personal_value_fit.py']]]
    source_hashes = {source.name: digest(source) for source in source_files}
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
        raise ValueError('Own-person known-plan actor coverage changed')
    models = {}
    progress_file = ROOT / 'analysis/personal-bots/personal-known-plan-fit-progress.jsonl'
    progress_file.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'models': len(actors), 'dataSha256': data_hash}) + '\n', encoding='utf-8')
    for position, (identity, actor) in enumerate(actors.items(), 1):
        model = fit_plan(data['players'][actor['name']], actor)
        models[identity] = model
        with progress_file.open('a', encoding='utf-8') as stream:
            stream.write(json.dumps({'completed': position, 'id': identity, 'name': actor['name'],
                                     'made': datetime.now(timezone.utc).isoformat()}) + '\n')
        if position % 10 == 0:
            print('Known-plan models', position, '/', len(actors), flush=True)
    by_request = {(row['name'], row['start']): row for row in requests['requests']}
    for selection in bank['selections']:
        identity = selection['models']['ownAll']
        model = models[identity]
        request = by_request[selection['name'], selection['start']]
        if model['trainingCut'] > selection['start'] or model['availableThrough'] is not None and model['availableThrough'] >= selection['start']:
            raise ValueError('Known-plan fit availability differs from the frozen actor')
        if set(model['trainedAids']) & set(request['excludedAids']):
            raise ValueError('Known-plan fit used a target campaign action')
    players = evaluate(data, actors, models, previous)
    validate_data(data)
    if (digest(DATA) != data_hash or any(digest(source) != source_hashes[source.name] for source in source_files)
            or any(digest(ROOT / name) != expected for name, expected in input_hashes.items())):
        raise ValueError('Known-plan inputs or fitting sources changed during fitting')
    model_file = ARCHIVE / 'personal-known-plan-models.json'
    model_file.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory',
        'targetMet': False, 'personalOnly': True, 'scope': 'ownAll', 'dataSha256': data_hash, 'fitSourceHashes': source_hashes, 'inputHashes': input_hashes,
        'models': [{'id': identity, 'name': actors[identity]['name'], 'scope': 'ownAll', 'knownPlan': model} for identity, model in models.items()]}), encoding='utf-8')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory', 'targetMet': False,
              'personalOnly': True, 'scope': 'ownAll', 'models': len(models), 'dataSha256': data_hash,
              'modelsSha256': digest(model_file), 'fitSourceHashes': source_hashes, 'inputHashes': input_hashes,
              'actionControlsMatched': sum('scores' in row for player in players.values() for row in player['rows']),
              'players': players, 'note': 'Same earlier-only ownAll memberships and unchanged held initial/retry prefix cohorts. '
                  'Independent bounded per-person route preferences are fitted to observed choices, never target winning counts. '
                  'Planning boundaries have coefficient zero. No carry-memory fit or autonomous winning-count measurement is claimed. '
                  'Action likelihood and historical improvements cannot establish the frozen future80% target.'}
    (ROOT / 'analysis/personal-bots/personal-known-plan-action-evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: {key: player[key] for key in ['initialModels', 'retryModels']} for name, player in players.items()}, indent=2))


if __name__ == '__main__':
    main()
