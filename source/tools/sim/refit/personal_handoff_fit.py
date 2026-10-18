import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from personal_fresh_clock_fit import checked_training
from personal_handoff import HandoffState, fit_handoff
from personal_joint_sequence import JointState
from personal_value_fit import ARCHIVE, ROOT, digest


def score_game(games, actor, base_model, model):
    totals = {'decisions': 0, 'baseLoss': 0., 'handoffLoss': 0., 'baseHits': 0., 'handoffHits': 0., 'cueOpportunities': 0}
    for game in games:
        state = HandoffState(actor, base_model, model, bool(game.get('initialNewLevel')))
        for decision in game['decisions']:
            if decision['k'] < 0:
                state.previous = None
                continue
            evaluated = state.evaluate(decision)
            before, after, selected = evaluated['base']['values'], evaluated['values'], decision['k']
            totals['baseLoss'] -= math.log(max(1e-300, before[selected]))
            totals['handoffLoss'] -= math.log(max(1e-300, after[selected]))
            for values, field in ((before, 'baseHits'), (after, 'handoffHits')):
                ties = np.isclose(values, values.max(), rtol=1e-8, atol=1e-12)
                totals[field] += float(ties[selected]) / ties.sum()
            totals['decisions'] += 1
            totals['cueOpportunities'] += evaluated['cue'] is not None
            state.observe(decision, selected, evaluated)
    count = totals['decisions']
    return {'decisions': count, 'cueOpportunities': totals['cueOpportunities'],
        'base': {'jointLogLoss': totals['baseLoss'] / count if count else None, 'topActionAccuracy': totals['baseHits'] / count if count else None},
        'handoff': {'jointLogLoss': totals['handoffLoss'] / count if count else None, 'topActionAccuracy': totals['handoffHits'] / count if count else None}}


def main():
    snapshot = ARCHIVE / 'experiments/personal-joint-intents-first-2026-10-18T20-50-31-269Z'
    manifest_file = snapshot / 'manifest.json'
    manifest = json.loads(manifest_file.read_bytes())
    inputs = {manifest_file.relative_to(ROOT).as_posix(): digest(manifest_file)}
    def read(name):
        if name in manifest['files']:
            source, expected = snapshot / name, manifest['files'][name]
        else:
            resolved = manifest.get('resolvedPinnedInputs', {}).get(name, name)
            if '/experiments/' not in resolved and '/runs/' not in resolved:
                raise ValueError('Handoff fit requires an immutable resolved input: ' + name)
            source, expected = ROOT / resolved, manifest['externalPinnedDependencies'][resolved]
        if digest(source) != expected:
            raise ValueError('Handoff pinned input changed: ' + name)
        inputs[source.relative_to(ROOT).as_posix()] = expected
        return json.loads(source.read_bytes()), source
    base_bank, base_file = read('analysis/archive/personal-bots/personal-tray-intents-models.json')
    data, data_file = read(base_bank['dataFile'])
    native, native_file = read('analysis/archive/personal-bots/personal-joint-intents-native.json')
    if native['dataSha256'] != digest(data_file) or native['modelsSha256'] != digest(base_file):
        raise ValueError('Handoff baseline cache differs from its actual fitted model/data')
    future, future_file = read(base_bank['staticActorSnapshot'] + '/analysis/archive/personal-bots/personal-fresh-own-models.json')
    historical, historical_file = read(base_bank['staticActorSnapshot'] + '/analysis/archive/personal-bots/personal-fresh-recent-models.json')
    schedule, schedule_file = read(base_bank['staticActorSnapshot'] + '/analysis/archive/personal-bots/personal-fresh-count-requests.json')
    for name, expected in base_bank['sourceHashes'].items():
        if digest(Path(__file__).with_name(name)) != expected:
            raise ValueError('Immutable base fitting source changed before handoff fitting')
    references = {(row['modelId'], row['aid'], row['availableAt']): {decision['index']: decision for decision in row['decisions']}
                  for row in native['references']}
    if len(references) != 445:
        raise ValueError('Handoff cache must retain all445 exact own training references')
    actors, by_id = future['models'] + historical['models'], {entry['id']: entry for entry in base_bank['models']}
    if len(by_id) != 33:
        raise ValueError('Handoff fitting lost the33 independently own base-model memberships')
    sources = {Path(__file__).resolve()}
    for module in sys.modules.values():
        filename = getattr(module, '__file__', None)
        if filename and Path(filename).resolve().parent == Path(__file__).resolve().parent:
            sources.add(Path(filename).resolve())
    hashes = {path.name: digest(path) for path in sources}
    runtime_hashes = {name: digest(Path(__file__).with_name(name)) for name in ('personal_handoff_choice.js', 'personal_handoff_cues.js', 'personal_joint_intents_choice.js')}
    request = int(datetime.now(timezone.utc).timestamp() * 1000)
    progress = ROOT / 'analysis/personal-bots/handoff-fit-progress.jsonl'
    progress.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'actualRequest': request, 'stage': 'verify-native-offset-cache'}) + '\n', encoding='utf8')
    controls, maximum_difference = 0, 0.
    for actor in future['models']:
        for game in data['players'][actor['name']]:
            state = JointState(actor, by_id[actor['id']], bool(game.get('initialNewLevel')))
            reference = references[actor['id'], game['aid'], game['availableAt']]
            for index, decision in enumerate(game['decisions']):
                if decision['k'] < 0:
                    continue
                evaluated = state.evaluate(decision)
                difference = float(np.max(np.abs(evaluated['values'] - reference[index]['probabilities'])))
                maximum_difference = max(maximum_difference, difference)
                if difference >= 1e-12:
                    raise ValueError('Handoff sampler changed a frozen base probability vector')
                state.observe(decision, decision['k'], evaluated)
                for phase, values in state.posterior.items():
                    difference = float(np.max(np.abs(values - reference[index]['posteriorAfter'][phase])))
                    maximum_difference = max(maximum_difference, difference)
                    if difference >= 1e-12:
                        raise ValueError('Handoff sampler changed a frozen base posterior')
                controls += 1
    if controls != 39268:
        raise ValueError('Handoff offset controls dropped natural decisions')
    models = []
    for actor in actors:
        training = checked_training(data, actor)
        model = fit_handoff(training, actor, by_id[actor['id']], references=references)
        models.append({'id': actor['id'], 'name': actor['name'], 'historicalExploratoryOnly': actor.get('historicalExploratoryOnly', False),
                       'handoff': model})
        with progress.open('a', encoding='utf8') as stream:
            stream.write(json.dumps({'completed': len(models), 'name': actor['name'], 'samples': model['trainingSamples'], 'clockSamples': model['trainingClockSamples']}) + '\n')
        print('Own conditional handoffs', len(models), '/', len(actors), flush=True)
    models_by_id = {entry['id']: entry['handoff'] for entry in models}
    diagnostics = []
    for target in schedule['recent']:
        selection = next(row for row in historical['selections'] if row['name'] == target['name'] and row['start'] == target['start'])
        actor = next(actor for actor in actors if actor['id'] == selection['id'])
        if (actor['trainingCut'] > target['start'] or set(actor['trainedAids']) & set(target['excludedAids'])
                or actor['availableThrough'] is not None and actor['availableThrough'] >= target['start']):
            raise ValueError('Handoff action diagnostic used a target or later own prefix')
        games = [game for game in data['players'][actor['name']] if game['aid'] in target['excludedAids']]
        diagnostics.append({'name': target['name'], 'lv': target['lv'], 'start': target['start'],
            **score_game(games, actor, by_id[actor['id']], models_by_id[actor['id']])})
    if (any(digest(path) != hashes[path.name] for path in sources)
            or any(digest(Path(__file__).with_name(name)) != expected for name, expected in runtime_hashes.items())
            or any(digest(ROOT / name) != expected for name, expected in inputs.items())):
        raise ValueError('Handoff fitting source/input changed during computation')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'actualFitRequest': request, 'evidence': 'own-conditional-handoff-fit',
        'targetMet': False, 'personalOnly': True, 'sourceHashes': hashes, 'runtimeSourceHashes': runtime_hashes, 'inputHashes': inputs,
        'baseSnapshot': snapshot.relative_to(ROOT).as_posix(), 'baseFile': base_file.relative_to(ROOT).as_posix(),
        'dataFile': data_file.relative_to(ROOT).as_posix(), 'futureActorFile': future_file.relative_to(ROOT).as_posix(),
        'historicalActorFile': historical_file.relative_to(ROOT).as_posix(),
        'baseOffsetControls': controls, 'maximumBaseOffsetDifference': maximum_difference, 'models': models, 'recentActionDiagnostics': diagnostics,
        'note': 'Independently own earlier-only targeted handoff odds, not winning labels or generic greedy matching. '
                'Future actor training offsets reuse fully verified native causal references; historical models compute their own earlier-only offsets. '
                'Recent diagnostics are client-time historical action evidence, not actual pre-opening winning-count accuracy. '
                'New readiness begins at made. Runtime parity, full autonomous first-clear counts and genuinely frozen future predictions remain required.'}
    filename = ARCHIVE / 'personal-handoff-models.json'
    filename.write_text(json.dumps(report), encoding='utf8')
    print(json.dumps({'models': len(models), 'baseOffsetControls': controls, 'targetMet': False, 'modelsSha256': digest(filename)}, indent=2))


if __name__ == '__main__':
    main()
