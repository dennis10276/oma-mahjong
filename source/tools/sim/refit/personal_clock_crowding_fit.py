import json
from datetime import datetime, timezone
from pathlib import Path

from personal_clock_crowding import fit_cue, score_cue
from personal_clock_strategy_fit import DATA, validate_data
from personal_known_plan_fit import summarize
from personal_plan_fit import pinned_read
from personal_value_fit import ARCHIVE, PINNED, ROOT, digest


BASE = ARCHIVE / 'experiments/personal-clock-strategy-actions-2026-10-18T11-30-12-648Z'


def main():
    data = json.loads(DATA.read_bytes())
    validate_data(data)
    source_files = [Path(__file__), *[Path(__file__).with_name(name) for name in [
        'personal_clock_crowding.py', 'personal_clock_strategy.py', 'personal_clock_strategy_fit.py',
        'personal_known_plan_fit.py', 'personal_full_choice_fit.py', 'personal_known_plan.py',
        'personal_plan_fit.py', 'personal_value_fit.py', 'personal_policy_fit.py', 'personal_kind_fit.py']]]
    source_hashes = {path.name: digest(path) for path in source_files}
    input_files = [PINNED / 'manifest.json', PINNED / 'analysis/archive/personal-bots/physical-memory-policy-bank.json',
                   PINNED / 'analysis/archive/personal-bots/physical-count-requests.json', BASE / 'manifest.json',
                   BASE / 'analysis/archive/personal-bots/personal-clock-strategy-models.json',
                   BASE / 'analysis/personal-bots/personal-clock-strategy-action-evaluation.json']
    input_hashes = {path.relative_to(ROOT).as_posix(): digest(path) for path in input_files}
    data_hash = digest(DATA)
    bank = pinned_read(PINNED, 'analysis/archive/personal-bots/physical-memory-policy-bank.json')
    requests = pinned_read(PINNED, 'analysis/archive/personal-bots/physical-count-requests.json')
    base_bank = pinned_read(BASE, 'analysis/archive/personal-bots/personal-clock-strategy-models.json')
    previous = pinned_read(BASE, 'analysis/personal-bots/personal-clock-strategy-action-evaluation.json')
    if previous['dataSha256'] != data_hash:
        raise ValueError('Clock crowding changed its frozen public-feature source')
    actors = {actor['id']: actor for actor in bank['models'] if actor['scope'] == 'ownAll'}
    base_models = {row['id']: row['clockStrategy'] for row in base_bank['models']}
    if len(actors) != 138 or set(base_models) != set(actors):
        raise ValueError('Clock crowding changed frozen personal-model identities')
    models = {identity: fit_cue(data['players'][actor['name']], actor, base_models[identity]) for identity, actor in actors.items()}
    by_request = {(row['name'], row['start']): row for row in requests['requests']}
    for selection in bank['selections']:
        model = models[selection['models']['ownAll']]
        if (model['trainingCut'] > selection['start']
                or model['availableThrough'] is not None and model['availableThrough'] >= selection['start']
                or set(model['trainedAids']) & set(by_request[selection['name'], selection['start']]['excludedAids'])):
            raise ValueError('Clock crowding learned from unavailable or target-campaign actions')
    players = {}
    for name, old in previous['players'].items():
        rows = []
        for original in old['rows']:
            if 'scores' not in original:
                rows.append({key: value for key, value in original.items() if key != 'lineage'})
                continue
            identity = original['lineage']['id']
            actor, model = actors[identity], models[identity]
            game = next(game for game in data['players'][name] if game['aid'] == original['aid'])
            control = score_cue([game], actor, model, enabled=False)
            expected = original['scores']['adaptiveClock']
            if control['decisions'] != expected['decisions'] or any(abs(control[key] - expected[key]) > 1e-12
                                                                   for key in ['jointLogLoss', 'topActionAccuracy']):
                raise ValueError('Clock crowding changed an immutable auxiliary-policy action control')
            rows.append({key: value for key, value in original.items() if key != 'scores'}
                        | {'scores': {'control': control, 'crowdingCue': score_cue([game], actor, model)}})
        initial, retries = [row for row in rows if row['initial']], [row for row in rows if not row['initial']]
        players[name] = {'initialCandidates': old['initialCandidates'], 'campaignCandidates': old['campaignCandidates'],
                         'initialModels': {method: summarize(initial, method) for method in ['control', 'crowdingCue']},
                         'retryModels': {method: summarize(retries, method) for method in ['control', 'crowdingCue']}, 'rows': rows}
        for current, expected in [(players[name]['initialModels']['control'], old['initialModels']['adaptiveClock']),
                                  (players[name]['retryModels']['control'], old['retryModels']['adaptiveClock'])]:
            if current['decisions'] != expected['decisions'] or any(current[key] is not None and abs(current[key] - expected[key]) > 1e-12
                                                                 for key in ['jointLogLoss', 'topActionAccuracy']):
                raise ValueError('Clock crowding changed initial/retry auxiliary-policy summaries')
    validate_data(data)
    if (digest(DATA) != data_hash or any(digest(path) != source_hashes[path.name] for path in source_files)
            or any(digest(ROOT / name) != expected for name, expected in input_hashes.items())):
        raise ValueError('Clock crowding sources/inputs changed during fitting')
    model_file = ARCHIVE / 'personal-clock-crowding-models.json'
    model_file.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory',
        'targetMet': False, 'personalOnly': True, 'scope': 'ownAll', 'dataSha256': data_hash,
        'fitSourceHashes': source_hashes, 'inputHashes': input_hashes,
        'models': [{'id': identity, 'name': actors[identity]['name'], 'scope': 'ownAll', 'crowdingCue': model}
                   for identity, model in models.items()]}), encoding='utf-8')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory', 'targetMet': False,
              'personalOnly': True, 'scope': 'ownAll', 'models': len(models), 'dataSha256': data_hash,
              'modelsSha256': digest(model_file), 'fitSourceHashes': source_hashes, 'inputHashes': input_hashes,
              'actionControlsMatched': sum('scores' in row for player in players.values() for row in player['rows']),
              'players': players, 'note': 'Own earlier initial/retry cue rates, triggered only by public tray crowding plus a known pair '
                  'with a found acceptable within-budget clock exit. No new inferred latent-mode separation is claimed. '
                  'All138 own-person memberships,197 auxiliary-policy action controls and eight summaries are fixed. '
                  'One current-baseline pseudo-observation shrinks sparse own evidence; no data leaves the baseline unchanged. '
                  'No target winning labels, prospective model promotion, winning-count improvement or80% claim is established.'}
    (ROOT / 'analysis/personal-bots/personal-clock-crowding-action-evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: {key: player[key] for key in ['initialModels', 'retryModels']} for name, player in players.items()}, indent=2))


if __name__ == '__main__':
    main()
