import json
from datetime import datetime, timezone
from pathlib import Path

from attempt_count_fit import SCORING_RULE
from personal_clock_reconsider import fit_reconsideration, score_reconsideration
from personal_known_plan_fit import summarize
from personal_plan_fit import pinned_read
from personal_value_fit import ARCHIVE, PINNED, ROOT, digest
from public_plan_reference import load_reference


BASE = ARCHIVE / 'experiments/personal-clock-strategy-actions-2026-10-18T11-30-12-648Z'
DATA_FILE = 'analysis/archive/personal-bots/policy-clock-strategy-prefix-data.json'


def main():
    data, reference = load_reference(BASE, DATA_FILE)
    if data['pilot'] or data['prefixes'] != 398 or data['totals']['calls'] != 33543:
        raise ValueError('Selective clock fitting requires the entire immutable public-feature cohort')
    source_files = [Path(__file__), *[Path(__file__).with_name(name) for name in [
        'personal_clock_reconsider.py', 'personal_clock_strategy.py', 'public_plan_reference.py',
        'personal_known_plan_fit.py', 'personal_full_choice_fit.py', 'personal_known_plan.py',
        'personal_plan_fit.py', 'personal_value_fit.py', 'personal_policy_fit.py', 'personal_kind_fit.py', 'attempt_count_fit.py']]]
    source_hashes = {path.name: digest(path) for path in source_files}
    input_files = [PINNED / 'manifest.json', PINNED / 'analysis/archive/personal-bots/physical-memory-policy-bank.json',
                   PINNED / 'analysis/archive/personal-bots/physical-count-requests.json', BASE / 'manifest.json',
                   BASE / 'analysis/archive/personal-bots/personal-clock-strategy-models.json',
                   BASE / 'analysis/personal-bots/personal-clock-strategy-action-evaluation.json']
    input_hashes = {**reference['referenceHashes'], **{path.relative_to(ROOT).as_posix(): digest(path) for path in input_files}}
    bank = pinned_read(PINNED, 'analysis/archive/personal-bots/physical-memory-policy-bank.json')
    requests = pinned_read(PINNED, 'analysis/archive/personal-bots/physical-count-requests.json')
    base_bank = pinned_read(BASE, 'analysis/archive/personal-bots/personal-clock-strategy-models.json')
    previous = pinned_read(BASE, 'analysis/personal-bots/personal-clock-strategy-action-evaluation.json')
    if previous['dataSha256'] != reference['dataSha256']:
        raise ValueError('Selective reconsideration changed its frozen feature/control parent')
    actors = {actor['id']: actor for actor in bank['models'] if actor['scope'] == 'ownAll'}
    base_models = {row['id']: row['clockStrategy'] for row in base_bank['models']}
    if len(actors) != 138 or set(base_models) != set(actors):
        raise ValueError('Selective reconsideration changed per-person model identities')
    models = {}
    progress = ROOT / 'analysis/personal-bots/personal-clock-reconsider-fit-progress.jsonl'
    progress.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'models': 138, 'reference': reference}) + '\n', encoding='utf-8')
    for position, (identity, actor) in enumerate(actors.items(), 1):
        models[identity] = fit_reconsideration(data['players'][actor['name']], actor, base_models[identity])
        with progress.open('a', encoding='utf-8') as stream:
            stream.write(json.dumps({'completed': position, 'id': identity, 'name': actor['name']}) + '\n')
    by_request = {(row['name'], row['start']): row for row in requests['requests']}
    for selection in bank['selections']:
        model = models[selection['models']['ownAll']]
        if (model['trainingCut'] > selection['start']
                or model['availableThrough'] is not None and model['availableThrough'] >= selection['start']
                or set(model['trainedAids']) & set(by_request[selection['name'], selection['start']]['excludedAids'])):
            raise ValueError('Selective reconsideration used target or unavailable own actions')
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
            control = score_reconsideration([game], actor, model, enabled=False)
            expected = original['scores']['adaptiveClock']
            if control['decisions'] != expected['decisions'] or any(abs(control[key] - expected[key]) > 1e-12
                                                                   for key in ['jointLogLoss', 'topActionAccuracy']):
                raise ValueError('Selective reconsideration changed an immutable auxiliary-policy control')
            rows.append({key: value for key, value in original.items() if key != 'scores'}
                        | {'scores': {'control': control, 'reconsider': score_reconsideration([game], actor, model)}})
        initial, retries = [row for row in rows if row['initial']], [row for row in rows if not row['initial']]
        players[name] = {'initialCandidates': old['initialCandidates'], 'campaignCandidates': old['campaignCandidates'],
                         'initialModels': {method: summarize(initial, method) for method in ['control', 'reconsider']},
                         'retryModels': {method: summarize(retries, method) for method in ['control', 'reconsider']}, 'rows': rows}
        for current, expected in [(players[name]['initialModels']['control'], old['initialModels']['adaptiveClock']),
                                  (players[name]['retryModels']['control'], old['retryModels']['adaptiveClock'])]:
            if current['decisions'] != expected['decisions'] or any(current[key] is not None and abs(current[key] - expected[key]) > 1e-12
                                                                 for key in ['jointLogLoss', 'topActionAccuracy']):
                raise ValueError('Selective reconsideration changed initial/retry control summaries')
    if (any(digest(path) != source_hashes[path.name] for path in source_files)
            or any(digest(ROOT / name) != expected for name, expected in input_hashes.items())):
        raise ValueError('Selective reconsideration source/immutable inputs changed during fitting')
    model_file = ARCHIVE / 'personal-clock-reconsider-models.json'
    model_file.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory',
        'targetMet': False, 'personalOnly': True, 'scope': 'ownAll', 'reference': reference,
        'fitSourceHashes': source_hashes, 'inputHashes': input_hashes,
        'models': [{'id': identity, 'name': actors[identity]['name'], 'scope': 'ownAll', 'reconsider': model}
                   for identity, model in models.items()]}), encoding='utf-8')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory', 'targetMet': False,
              'personalOnly': True, 'scope': 'ownAll', 'models': 138, 'reference': reference,
              'modelsSha256': digest(model_file), 'fitSourceHashes': source_hashes, 'inputHashes': input_hashes,
              'futureWinningCountScoringRule': SCORING_RULE,
              'actionControlsMatched': sum('scores' in row for player in players.values() for row in player['rows']),
              'players': players, 'note': 'Selective own-person reconsideration: only known bad clock proposals donate mass to '
                  'known acceptable pair alternatives; all unrelated safe choices are unchanged. '
                  'Old138 memberships/197 auxiliary controls remain fixed. The immutable loader validates original training source '
                  'without pretending refreshed root data have its old fingerprint. No winning-count or future80% success is established.'}
    (ROOT / 'analysis/personal-bots/personal-clock-reconsider-action-evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: {key: player[key] for key in ['initialModels', 'retryModels']} for name, player in players.items()}, indent=2))


if __name__ == '__main__':
    main()
