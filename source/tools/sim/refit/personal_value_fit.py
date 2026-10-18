import gc
import hashlib
import json
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from attempt_count_fit import NAMES, FACTORIES, accuracy, best_prediction, completed_before
from personal_count_fit import features_of, histories
from personal_full_choice_fit import probabilities, validate
from personal_kind_fit import KINDS
from personal_value import fit_value, opening_value
from physical_policy_bank import scope_players


ROOT = Path(__file__).resolve().parents[3]
ARCHIVE = ROOT / 'analysis/archive/personal-bots'
PINNED = ARCHIVE / 'experiments/personal-memory-2026-10-18T00-43-24-647Z'
DATA = ARCHIVE / 'policy-value-prefix-data.json'
SCOPES = ('ownAll', 'ownCarryAll')
WORKER_DATA = None


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def validate_controls(current, previous):
    count = 0
    for mode in ['none', 'configured']:
        current_players = current['players'] if mode == 'none' else current['memoryPlayers'][mode]
        previous_players = previous['players'] if mode == 'none' else previous['memoryPlayers'][mode]
        if current_players.keys() != previous_players.keys():
            raise ValueError('Value instrumentation changed the personal roster')
        for name, games in current_players.items():
            if len(games) != len(previous_players[name]):
                raise ValueError('Value instrumentation changed observed prefixes')
            for game, original in zip(games, previous_players[name]):
                stripped = {**game, 'decisions': [{key: value for key, value in decision.items() if key != 'immediate'}
                                                for decision in game['decisions']]}
                if stripped != original:
                    raise ValueError('Value instrumentation changed a control decision: ' + game['aid'])
                count += len(game['decisions'])
    return count


def initialize(data_file):
    global WORKER_DATA
    WORKER_DATA = json.loads(Path(data_file).read_bytes())


def fit_one(actor):
    games = [game for game in scope_players(WORKER_DATA, actor['scope'])[actor['name']]
             if game['aid'] in actor['trainedAids'] and game['availableAt'] < actor['trainingCut']]
    if len(games) != actor['trainingGames'][actor['name']]:
        raise ValueError('Value fitting changed pinned actor membership')
    model = fit_value(games, actor['trainingCut'], WORKER_DATA['valueFeatures'])
    if not set(model['trainedAids']).issubset(actor['trainedAids']):
        raise ValueError('Value fitting introduced an unauthorized observation')
    return {'id': actor['id'], 'name': actor['name'], 'scope': actor['scope'], 'value': model}


def count_before(rows, target):
    return [row for row in completed_before(rows, target['start']) if row['name'] == target['name']
            and (not target.get('firstClear', False) or row.get('firstClear', True))]


def count_inputs(rows, target, profiles, runs, value_features):
    base, _ = features_of(rows, target, profiles, runs, True)
    values = value_features[target['name'], target['start']]
    return {'controlForest': base, 'valueForest': base + values, 'valueBoosted': base + values,
            'valueOnlyForest': [target['lv'], *target['physical'], *histories(rows, target, True), *values]}


def select_before_test(scored, held, methods):
    players = {}
    for name in NAMES:
        testing = [row for row in held if row['name'] == name]
        cutoff = min(row['start'] for row in testing)
        development = [row for row in scored if row['name'] == name and row['end'] < cutoff]
        chosen = max(methods, key=lambda method: accuracy(development, method)['accuracy']) if development else 'alwaysFirst'
        players[name] = {'developmentEpisodes': len(development), 'selectionCut': cutoff,
                         'developmentAvailableThrough': max((row['end'] for row in development), default=None),
                         'developmentMethods': {method: accuracy(development, method) for method in methods},
                         'methods': {method: accuracy(testing, method) for method in methods},
                         'selectedBeforeTest': chosen, 'selectedScore': accuracy(testing, chosen)}
    return players


def evaluate_counts(data, features, original_scored):
    rows, runs = data['rows'], data['runs']
    profiles = [profile for profile, config in data['profiles'].items() if config.get('scope', '').startswith('own')]
    if 'ownAll' not in profiles:
        raise ValueError('Value count evaluation needs the own-only reference')
    inputs = {(row['name'], row['start']): count_inputs(rows, row, profiles, runs, features) for row in rows}
    originals = {(row['name'], row['start']): row for row in original_scored}
    scored = []
    for target in sorted(rows, key=lambda row: row['start']):
        if target['firstAttempt'] != 1 or target['wonOn'] is None:
            continue
        before = count_before(rows, target)
        if len(before) < 6:
            continue
        predictions = {'alwaysFirst': 1}
        for method in ['controlForest', 'valueForest', 'valueBoosted', 'valueOnlyForest']:
            model = FACTORIES['boosted' if method == 'valueBoosted' else 'forest']()
            model.fit([inputs[row['name'], row['start']][method] for row in before], [row['wonOn'] for row in before])
            probability = model.predict_proba([inputs[target['name'], target['start']][method]])[0]
            predictions[method] = best_prediction(dict(zip(map(int, model.classes_), map(float, probability))))
        key = target['name'], target['start']
        if predictions['controlForest'] != originals[key]['predictions']['controlForest']:
            raise ValueError('Value evaluation changed the pinned control prediction')
        scored.append({key: target[key] for key in ['name', 'lv', 'start', 'end', 'wonOn', 'board', 'assisted', 'openingRecorded', 'source']} |
                      {'predictions': predictions, 'trainingGames': len(before), 'availableThrough': max(row['end'] for row in before)})
        if len(scored) % 25 == 0:
            print('Scored', len(scored), 'rolling own-person count heads', flush=True)
    if set(originals) != {(row['name'], row['start']) for row in scored}:
        raise ValueError('Value evaluation changed count coverage')
    comparisons = set(data['comparisonEpisodes'])
    held = [row for row in scored if row['name'] + '|' + str(row['start']) in comparisons]
    if len(held) != len(comparisons):
        raise ValueError('Value evaluation omitted held campaigns')
    methods = list(scored[0]['predictions'])
    return scored, {'coverage': {'episodes': len(rows), 'scoredEpisodes': len(scored), 'heldOutEpisodes': len(held),
                                'heldOutAssisted': sum(row['assisted'] for row in held),
                                'heldWithRecordedOpening': sum(row['openingRecorded'] for row in held)},
                    'heldOut': {method: accuracy(held, method) for method in methods},
                    'players': select_before_test(scored, held, methods)}


def main():
    sources = [Path(__file__), *[Path(__file__).with_name(name) for name in [
        'personal_value.py', 'personal_count_fit.py', 'attempt_count_fit.py', 'attempt_hazard.py', 'board_recall_eval.py',
        'personal_full_choice_fit.py', 'personal_kind_fit.py', 'personal_policy_fit.py', 'physical_policy_bank.py']]]
    source_hashes = {source.name: digest(source) for source in sources}
    manifest = json.loads((PINNED / 'manifest.json').read_bytes())
    names = {'prefix': 'policy-memory-prefix-data.json', 'bank': 'physical-memory-policy-bank.json',
             'requests': 'physical-count-requests.json', 'count': 'physical-memory-count-data.json',
             'scored': 'physical-memory-count-scored.json'}
    paths = {key: PINNED / 'analysis/archive/personal-bots' / name for key, name in names.items()}
    pinned_hashes = {key: digest(path) for key, path in paths.items()}
    for key, path in paths.items():
        if pinned_hashes[key] != manifest['files'][path.relative_to(PINNED).as_posix()]:
            raise ValueError('Pinned memory evidence changed')
    input_paths = [DATA, ARCHIVE / 'personal-value-openings.json']
    input_hashes = {path.name: digest(path) for path in input_paths}
    data, openings = (json.loads(path.read_bytes()) for path in input_paths)
    validate(data)
    validate(openings)
    if not data.get('immediateValueMeasured') or len(data['valueFeatures']) != 102:
        raise ValueError('Expected actual-tap value measurements')
    unchanged_choices = validate_controls(data, json.loads(paths['prefix'].read_bytes()))
    bank, requests, count_data, original_scored = (json.loads(paths[key].read_bytes()) for key in ['bank', 'requests', 'count', 'scored'])
    if openings['parentDataSha256'] != pinned_hashes['count'] or openings['pinnedActorBankSha256'] != pinned_hashes['bank']:
        raise ValueError('Opening probes do not match pinned personal actors')
    if bank['requestsSha256'] != pinned_hashes['requests'] or bank['prefixDataSha256'] != pinned_hashes['prefix']:
        raise ValueError('Pinned actor dependencies differ')
    value_features = data['valueFeatures']
    prefix_fingerprint = data['fingerprint']
    actors = [actor for actor in bank['models'] if actor['scope'] in SCOPES]
    del data
    gc.collect()
    print('Verified', unchanged_choices, 'unchanged control decisions; fitting', len(actors), 'own value critics', flush=True)
    models = []
    with ProcessPoolExecutor(max_workers=2, initializer=initialize, initargs=(str(DATA),)) as pool:
        futures = [pool.submit(fit_one, actor) for actor in actors]
        for future in as_completed(futures):
            models.append(future.result())
            if len(models) % 25 == 0:
                print('Fitted', len(models), '/', len(actors), 'own value critics', flush=True)
    models.sort(key=lambda model: model['id'])
    model_map = {model['id']: model for model in models}
    actor_map = {actor['id']: actor for actor in actors}
    selections = {(row['name'], row['start']): row['models'] for row in bank['selections']}
    request_map = {(row['name'], row['start']): row for row in requests['requests']}
    count_map = {(row['name'], row['start']): row for row in count_data['rows']}
    opening_features = {}
    feature_rows = []
    for opening in openings['rows']:
        key = opening['name'], opening['start']
        if opening['board'] != count_map[key]['board'] or opening['lv'] != count_map[key]['lv']:
            raise ValueError('Opening value board differs')
        values, lineage = [], {}
        for scope in SCOPES:
            identity = selections[key][scope]
            actor, critic = actor_map[identity], model_map[identity]['value']
            if critic['trainingCut'] > opening['start'] or (critic['availableThrough'] is not None and critic['availableThrough'] >= opening['start']):
                raise ValueError('Opening value critic is not available before opening')
            if set(critic['trainedAids']) & set(request_map[key]['excludedAids']):
                raise ValueError('Value critic trained on target campaign')
            kind = np.asarray([actor['kindModel']['weights'][name] for name in KINDS])
            values.extend(opening_value(opening, kind, np.asarray(actor['withinWeights']), critic, probabilities))
            lineage[scope] = {'actor': identity, 'trainingCut': critic['trainingCut'], 'availableThrough': critic['availableThrough']}
        if not np.all(np.isfinite(values)):
            raise ValueError('Nonfinite opening value')
        opening_features[key] = values
        feature_rows.append({key: opening[key] for key in ['name', 'start', 'lv', 'board']} | {'values': values, 'lineage': lineage})
    if opening_features.keys() != count_map.keys():
        raise ValueError('Missing pre-tap campaign values')
    scored, results = evaluate_counts(count_data, opening_features, original_scored)
    if source_hashes != {source.name: digest(source) for source in sources} or input_hashes != {path.name: digest(path) for path in input_paths}:
        raise ValueError('Value experiment inputs changed during fitting')
    validate(json.loads(DATA.read_bytes()))
    validate(openings)
    model_file = ARCHIVE / 'personal-value-models.json'
    model_file.write_text(json.dumps({'prefixFingerprint': prefix_fingerprint, 'inputHashes': input_hashes,
        'pinnedControlHashes': pinned_hashes, 'fitSourceHashes': source_hashes, 'models': models}), encoding='utf-8')
    feature_file = ARCHIVE / 'personal-value-opening-features.json'
    feature_file.write_text(json.dumps({'features': [scope + '.' + name for scope in SCOPES for name in
        ['actorWeightedQ', 'maxQ', 'minQ', 'stdQ', 'mostLikelyActionQ']], 'modelsSha256': digest(model_file),
        'openingsSha256': input_hashes['personal-value-openings.json'], 'rows': feature_rows}), encoding='utf-8')
    scored_file = ARCHIVE / 'personal-value-count-scored.json'
    scored_file.write_text(json.dumps(scored), encoding='utf-8')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory-personal-value',
              'targetMet': False, 'personalOnly': True, 'prefixFingerprint': prefix_fingerprint,
              'inputHashes': input_hashes, 'pinnedControlHashes': pinned_hashes, 'fitSourceHashes': source_hashes,
              'modelsSha256': digest(model_file), 'openingFeaturesSha256': digest(feature_file),
              'scoredSha256': digest(scored_file), 'unchangedControlDecisions': unchanged_choices,
              'valueCritics': len(models), 'valueFeatures': value_features, **results,
              'note': 'Each opening uses only its own earlier-available personal actor and natural trajectory value critic. '
                      'Target campaign observations, assistance boundaries, missing and unfinished outcomes cannot train the critic. '
                      'Each historical count-training row retains its own pre-opening critic, never a later refit. '
                      'All pinned count controls and held campaigns, including assisted wins, are preserved. '
                      'Methods are selected independently per person before that person\'s held cohort. '
                      'This is observational exploratory research, not causal action-value proof, an autonomous policy change, '
                      'or genuine prospective 80% accuracy. Numeric forecast ledgers remain unchanged.'}
    (ROOT / 'analysis/personal-bots/personal-value-count-evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({name: {'selected': player['selectedBeforeTest'], 'score': player['selectedScore'],
                            'methods': player['methods']} for name, player in report['players'].items()}, indent=2), flush=True)


if __name__ == '__main__':
    main()
