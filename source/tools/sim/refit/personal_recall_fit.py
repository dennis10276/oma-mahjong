import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from personal_full_choice_fit import fit_person, prior_of, score
from personal_kind_fit import encode
from personal_prefix_versions import semantic_prefix, select_prefixes, training_identity
from personal_value_fit import ARCHIVE, ROOT, digest


MODES = ('none', 'configured', 'full')
RUNTIME_RECALL = {'none': 0, 'configured': [.75, .5, .75], 'full': 1}


def materialize(base, prepared, mode):
    if mode not in MODES or prepared['type'] != 'personalRecallAlternatives-v1':
        raise ValueError('Unknown consistent recall feature alternative')
    players = {}
    for name, games in base['players'].items():
        alternatives = prepared['alternatives'].get(mode, {}).get(name, [])
        by_aid = {game['aid']: game for game in alternatives}
        if len(by_aid) != len(alternatives) or set(by_aid) - {game['aid'] for game in games}:
            raise ValueError('Recall alternative lost exact original attempt membership')
        players[name] = []
        for original in games:
            alternate = by_aid.get(original['aid'])
            if alternate is None:
                players[name].append(original)
                continue
            if (alternate['originalVersionSha256'] != original['versionSha256']
                    or alternate['t'] != original['t'] or alternate['availableAt'] != original['availableAt']
                    or not alternate['inheritedPictures'] or not alternate['memorySources']):
                raise ValueError('Recall alternative changed its actual causal base version')
            if any(source['availableAt'] >= original['t'] or source['aid'] == original['aid']
                   for source in alternate['memorySources']):
                raise ValueError('Recall alternative contains a current/future observation')
            prefix, identity = semantic_prefix(alternate)
            players[name].append({**prefix, 'versionSha256': identity,
                'observedAt': original['observedAt'], 'originalVersionSha256': original['versionSha256'],
                'inheritedPictures': alternate['inheritedPictures']})
    return {**{key: base[key] for key in ('type', 'features', 'kindContextFeatures', 'base')}, 'players': players}


def blocked_split(games, limit=20):
    if len(games) <= limit:
        raise ValueError('Recall calibration needs earlier own history and a distinct recent block')
    held = sorted(games, key=lambda game: (game['t'], game['aid']))[-limit:]
    cutoff = min(game['t'] for game in held)
    levels = {game['lv'] for game in held}
    excluded = sorted(game['aid'] for game in games if game['lv'] in levels)
    return cutoff, excluded, [game['aid'] for game in held]


def fitted_actor(bank, name, mode, cutoff, excluded=(), historical=False):
    games = select_prefixes(bank, name, cutoff, excluded, strict_observed=not historical)
    if not games:
        raise ValueError('Consistent recall actor requires its own earlier natural history')
    identity, roster = training_identity(name, games)
    tagged = hashlib.sha256(json.dumps(['ownConsistentRecall-v1', mode, identity], separators=(',', ':')).encode()).hexdigest()
    kind, within, count = fit_person(games, cutoff, prior_of(bank), len(bank['kindContextFeatures']))
    actor = {'id': tagged, 'name': name, 'scope': 'ownAll', 'trainingCut': cutoff,
        'availableThrough': max(game['availableAt'] for game in games),
        'inputObservedThrough': max(game['observedAt'] for game in games), 'trainingGames': {name: count},
        'trainedAids': sorted(game['aid'] for game in games),
        'trainedVersions': [{'aid': aid, 'availableAt': available, 'versionSha256': version} for aid, available, version in roster],
        'kindModel': encode(kind), 'withinWeights': within.tolist(), 'jointChoice': False, 'physicalSingleStep': False,
        'retryMemoryMode': mode, 'runtimeRecall': RUNTIME_RECALL[mode], 'historicalExploratoryOnly': historical}
    if actor['availableThrough'] >= cutoff or set(actor['trainedAids']) & set(excluded):
        raise ValueError('Recall actor used a held level or unavailable own source')
    return actor, kind, within


def main():
    prepared_file = ARCHIVE / 'personal-recall-prefix-data.json'
    prepared = json.loads(prepared_file.read_bytes())
    base_file = ROOT / prepared['baseFile']
    if digest(base_file) != prepared['baseSha256'] or prepared['totals']['physicalControls'] != 445:
        raise ValueError('Recall fitting lost all frozen natural-prefix controls')
    base = json.loads(base_file.read_bytes())
    handoff_file = ARCHIVE / 'personal-handoff-models.json'
    handoff = json.loads(handoff_file.read_bytes())
    actor_file = ROOT / handoff['futureActorFile']
    previous = {actor['name']: actor for actor in json.loads(actor_file.read_bytes())['models']}
    inputs = {path.relative_to(ROOT).as_posix(): digest(path) for path in (prepared_file, base_file, handoff_file, actor_file)}
    inputs.update(prepared['sourceHashes'])
    for name, expected in inputs.items():
        if digest(ROOT / name) != expected:
            raise ValueError('Consistent recall fitting input changed: ' + name)
    request = int(datetime.now(timezone.utc).timestamp() * 1000)
    if datetime.fromisoformat(prepared['made'].replace('Z', '+00:00')).timestamp() * 1000 >= request:
        raise ValueError('Actual recall feature readiness must precede fitting')
    sources = {Path(__file__).resolve()}
    for module in sys.modules.values():
        filename = getattr(module, '__file__', None)
        if filename and Path(filename).resolve().parent == Path(__file__).resolve().parent:
            sources.add(Path(filename).resolve())
    hashes = {path.name: digest(path) for path in sources}
    progress = ROOT / 'analysis/personal-bots/recall-fit-progress.jsonl'
    progress.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'actualFitRequest': request, 'plannedModels': 24}) + '\n', encoding='utf8')
    splits = {name: blocked_split(games) for name, games in base['players'].items()}
    models, diagnostics, future, controls = [], {}, {}, {}
    for mode in MODES:
        bank = materialize(base, prepared, mode)
        for name in bank['players']:
            cutoff, excluded, held_aids = splits[name]
            actor, kind, within = fitted_actor(bank, name, mode, cutoff, excluded, historical=True)
            held = [game for game in bank['players'][name] if game['aid'] in held_aids]
            if len(held) != 20 or any(game['t'] < cutoff for game in held):
                raise ValueError('Recall held block changed across alternatives')
            diagnostic = score(held, kind, within)
            diagnostics.setdefault(name, {})[mode] = {'modelId': actor['id'], 'trainingCut': cutoff,
                'trainingGames': actor['trainingGames'][name], 'excludedAids': excluded, 'heldAids': held_aids, **diagnostic}
            models.append(actor)
            actor, kind, within = fitted_actor(bank, name, mode, request)
            actor['featureReadyAt'] = prepared['made']
            models.append(actor)
            future.setdefault(name, {})[mode] = actor['id']
            if mode == 'none':
                original = previous[name]
                difference = max(float(np.max(np.abs(within - original['withinWeights']))),
                    max(float(np.max(np.abs(np.asarray(actor['kindModel']['weights'][kind_name])
                        - original['kindModel']['weights'][kind_name]))) for kind_name in actor['kindModel']['weights']))
                if actor['trainedAids'] != original['trainedAids'] or difference >= 1e-10:
                    raise ValueError('No-memory own refit changed exact original static controls')
                controls[name] = {'maximumWeightDifference': difference, 'trainingGames': actor['trainingGames'][name]}
            with progress.open('a', encoding='utf8') as stream:
                stream.write(json.dumps({'completed': len(models), 'name': name, 'mode': mode}) + '\n')
            print('Own recall-consistent fits', len(models), '/24', name, mode, flush=True)
    selected = {name: min(MODES, key=lambda mode: diagnostics[name][mode]['jointLogLoss']) for name in diagnostics}
    if (any(digest(path) != hashes[path.name] for path in sources)
            or any(digest(ROOT / name) != expected for name, expected in inputs.items())):
        raise ValueError('Consistent recall fitting source/input changed during computation')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'actualFitRequest': request,
        'targetMet': False, 'evidence': 'own-consistent-recall-static-fit-and-blocked-action-calibration-only',
        'personalOnly': True, 'sourceHashes': hashes, 'inputHashes': inputs, 'preparedFile': prepared_file.relative_to(ROOT).as_posix(),
        'baseFile': prepared['baseFile'], 'models': models, 'futureActorIds': future,
        'ownBlockedCalibration': diagnostics, 'selectedRecallMode': selected, 'originalStaticControls': controls,
        'selectionRule': 'Lowest own blocked20-prefix joint action log loss; stable none/configured/full ties. No family or current target outcomes.',
        'note': 'Each mode is refitted independently against the declared generic prior, not a borrowed no-memory actor with memory turned on. '
                'Blocked action calibration excludes every attempt on all levels in that person’s recent20-prefix block, not just one targetAID. '
                'Client-time blocked models are historical exploratory; recalled held features condition on actual earlier target observations and are not opening forecasts. '
                'Selection is calibrated on that block and is not an independent selected-model test or winning-count accuracy. '
                'Future actors require this actual new readiness and fresh live opening checks. Clock/tray intent heads and planning features are not reused after recall changes. '
                'Matched autonomous whole-count tests and genuine pre-opening numeric freezes remain required. No existing numeric forecast or miss changes; no80% success is established.'}
    filename = ARCHIVE / 'personal-recall-models.json'
    filename.write_text(json.dumps(report), encoding='utf8')
    print(json.dumps({'models': len(models), 'selectedRecallMode': selected, 'originalStaticControls': controls,
        'modelsSha256': digest(filename)}, indent=2))


if __name__ == '__main__':
    main()
