import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import scipy

from personal_known_plan_fit import summarize
from personal_outcome_styles import fit_styles, score_styles
from personal_plan_fit import pinned_read
from personal_value_fit import ARCHIVE, PINNED, ROOT, digest
from public_plan_reference import load_reference


REFERENCE = ARCHIVE / 'experiments/personal-clock-strategy-actions-2026-10-18T11-30-12-648Z'
CONTROL = ARCHIVE / 'experiments/personal-known-plan-actions-2026-10-18T07-00-31-837Z'
DATA_FILE = 'analysis/archive/personal-bots/policy-clock-strategy-prefix-data.json'


def main():
    data, reference = load_reference(REFERENCE, DATA_FILE)
    if data['pilot'] or data['prefixes'] != 398 or data['totals']['calls'] != 33543:
        raise ValueError('Outcome-style fitting requires the unchanged complete natural-prefix cohort')
    source_files = {Path(__file__).resolve()}
    for module in sys.modules.values():
        filename = getattr(module, '__file__', None)
        if filename and Path(filename).resolve().parent == Path(__file__).resolve().parent:
            source_files.add(Path(filename).resolve())
    source_hashes = {path.name: digest(path) for path in source_files}
    input_files = [PINNED / 'manifest.json', PINNED / 'analysis/archive/personal-bots/physical-memory-policy-bank.json',
                   PINNED / 'analysis/archive/personal-bots/physical-count-requests.json', CONTROL / 'manifest.json',
                   CONTROL / 'analysis/personal-bots/personal-known-plan-action-evaluation.json']
    input_hashes = {**reference['referenceHashes'], **{path.relative_to(ROOT).as_posix(): digest(path) for path in input_files}}
    bank = pinned_read(PINNED, 'analysis/archive/personal-bots/physical-memory-policy-bank.json')
    requests = pinned_read(PINNED, 'analysis/archive/personal-bots/physical-count-requests.json')
    previous = pinned_read(CONTROL, 'analysis/personal-bots/personal-known-plan-action-evaluation.json')
    actors = {actor['id']: actor for actor in bank['models'] if actor['scope'] == 'ownAll'}
    if len(actors) != 138:
        raise ValueError('Outcome-style fitting changed frozen actor identities')
    models = {}
    progress = ROOT / 'analysis/personal-bots/personal-outcome-styles-fit-progress.jsonl'
    progress.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'models': len(actors), 'reference': reference}) + '\n', encoding='utf-8')
    for position, (identity, actor) in enumerate(actors.items(), 1):
        models[identity] = fit_styles(data['players'][actor['name']], actor)
        with progress.open('a', encoding='utf-8') as stream:
            stream.write(json.dumps({'completed': position, 'id': identity, 'name': actor['name']}) + '\n')
    by_request = {(row['name'], row['start']): row for row in requests['requests']}
    for selection in bank['selections']:
        model = models[selection['models']['ownAll']]
        if (model['trainingCut'] > selection['start']
                or model['availableThrough'] is not None and model['availableThrough'] >= selection['start']
                or set(model['trainedAids']) & set(by_request[selection['name'], selection['start']]['excludedAids'])
                or any(label['availableAt'] >= selection['start'] for label in model['labelledGames'])):
            raise ValueError('Outcome-style fitting used a target or unavailable earlier outcome')
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
            control = score_styles(game, actor, model, enabled=False)
            expected = original['scores']['control']
            if control['decisions'] != expected['decisions'] or any(abs(control[key] - expected[key]) > 1e-12
                                                                   for key in ['jointLogLoss', 'topActionAccuracy']):
                raise ValueError('Outcome-style scoring changed an immutable static-policy action control')
            rows.append({key: value for key, value in original.items() if key != 'scores'}
                        | {'scores': {'control': control, 'outcomeStyles': score_styles(game, actor, model)}})
        initial, retries = [row for row in rows if row['initial']], [row for row in rows if not row['initial']]
        players[name] = {'initialCandidates': old['initialCandidates'], 'campaignCandidates': old['campaignCandidates'],
                         'initialModels': {method: summarize(initial, method) for method in ['control', 'outcomeStyles']},
                         'retryModels': {method: summarize(retries, method) for method in ['control', 'outcomeStyles']}, 'rows': rows}
        for current, expected in [(players[name]['initialModels']['control'], old['initialModels']['control']),
                                  (players[name]['retryModels']['control'], old['retryModels']['control'])]:
            if current['decisions'] != expected['decisions'] or any(current[key] is not None and abs(current[key] - expected[key]) > 1e-12
                                                                 for key in ['jointLogLoss', 'topActionAccuracy']):
                raise ValueError('Outcome-style scoring changed held initial/retry control summaries')
    if (any(digest(path) != source_hashes[path.name] for path in source_files)
            or any(digest(ROOT / name) != expected for name, expected in input_hashes.items())):
        raise ValueError('Outcome-style sources or immutable inputs changed during fitting')
    model_file = ARCHIVE / 'personal-outcome-styles-models.json'
    model_file.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory',
        'targetMet': False, 'personalOnly': True, 'scope': 'ownAll', 'reference': reference,
        'fitSourceHashes': source_hashes, 'inputHashes': input_hashes,
        'models': [{'id': identity, 'name': actors[identity]['name'], 'scope': 'ownAll', 'outcomeStyles': model}
                   for identity, model in models.items()]}), encoding='utf-8')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory', 'targetMet': False,
              'personalOnly': True, 'scope': 'ownAll', 'models': 138, 'reference': reference,
              'modelsSha256': digest(model_file), 'fitSourceHashes': source_hashes, 'inputHashes': input_hashes,
              'runtimeVersions': {'numpy': np.__version__, 'scipy': scipy.__version__},
              'actionControlsMatched': sum('scores' in row for player in players.values() for row in player['rows']),
              'players': players, 'note': 'Own earlier natural success/failure prefixes anchor correlated whole-attempt '
                  'behavioral experts, not guaranteed outcomes. Runtime samples one expert before each attempt; '
                  'next-action evaluation filters from previously observed choices only and never selects from target outcomes. '
                  'Censored boundaries are not failures. All138 memberships/197 static controls remain fixed. '
                  'No autonomous winning-count improvement or prospective80% claim is established.'}
    (ROOT / 'analysis/personal-bots/personal-outcome-styles-action-evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: {key: player[key] for key in ['initialModels', 'retryModels']} for name, player in players.items()}, indent=2))


if __name__ == '__main__':
    main()
