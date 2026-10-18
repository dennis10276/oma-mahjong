import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from personal_clock_intents import fit_intents, score_intents
from personal_clock_strategy import score_strategy
from personal_fresh_clock_fit import checked_training
from personal_full_choice_fit import score
from personal_prefix_versions import semantic_prefix
from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    snapshot = ARCHIVE / 'experiments/personal-fresh-clock-actions-2026-10-18T16-30-12-344Z'
    manifest = json.loads((snapshot / 'manifest.json').read_bytes())
    inputs = {(snapshot / 'manifest.json').relative_to(ROOT).as_posix(): digest(snapshot / 'manifest.json')}
    def read(folder, name, declared):
        source = folder / name
        expected = declared['files'][name]
        if digest(source) != expected:
            raise ValueError('Persistent clock fit input changed: ' + name)
        inputs[source.relative_to(ROOT).as_posix()] = expected
        return json.loads(source.read_bytes())
    data = read(snapshot, 'analysis/archive/personal-bots/personal-fresh-clock-prefixes.json', manifest)
    previous = read(snapshot, 'analysis/archive/personal-bots/personal-fresh-clock-models.json', manifest)
    fits = ARCHIVE / 'experiments/personal-fresh-own-fits-2026-10-18T15-59-12-900Z'
    fit_manifest = json.loads((fits / 'manifest.json').read_bytes())
    future = read(fits, 'analysis/archive/personal-bots/personal-fresh-own-models.json', fit_manifest)
    historical = read(fits, 'analysis/archive/personal-bots/personal-fresh-recent-models.json', fit_manifest)
    schedule = read(fits, 'analysis/archive/personal-bots/personal-fresh-count-requests.json', fit_manifest)
    if data['prefixes'] != 445 or data['decisions'] != 39268:
        raise ValueError('Intent fitting needs all445 exact public annotation versions')
    for games in data['players'].values():
        for game in games:
            if semantic_prefix(game)[1] != game['versionSha256']:
                raise ValueError('Intent input annotations changed the natural human choices')
    sources = {Path(__file__).resolve()}
    for module in sys.modules.values():
        filename = getattr(module, '__file__', None)
        if filename and Path(filename).resolve().parent == Path(__file__).resolve().parent:
            sources.add(Path(filename).resolve())
    hashes = {path.name: digest(path) for path in sources}
    request = int(datetime.now(timezone.utc).timestamp() * 1000)
    actors = future['models'] + historical['models']
    models, diagnostics = [], []
    progress = ROOT / 'analysis/personal-bots/clock-intents-fit-progress.jsonl'
    progress.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'actualRequest': request, 'models': len(actors)}) + '\n', encoding='utf8')
    for actor in actors:
        training = checked_training(data, actor)
        model = fit_intents(training, actor)
        models.append({'id': actor['id'], 'name': actor['name'], 'historicalExploratoryOnly': actor.get('historicalExploratoryOnly', False),
                       'clockIntents': model})
        with progress.open('a', encoding='utf8') as stream:
            stream.write(json.dumps({'completed': len(models), 'name': actor['name'], 'clockChoices': model['trainingClockChoices'],
                                     'priors': model['priors']}) + '\n')
        print('Own persistent clock fits', len(models), '/', len(actors), flush=True)
    by_id = {entry['id']: entry['clockIntents'] for entry in models}
    for target in schedule['recent']:
        selection = next(row for row in historical['selections'] if row['name'] == target['name'] and row['start'] == target['start'])
        actor = next(actor for actor in actors if actor['id'] == selection['id'])
        if (actor['trainingCut'] > target['start'] or set(actor['trainedAids']) & set(target['excludedAids'])
                or actor['availableThrough'] is not None and actor['availableThrough'] >= target['start']):
            raise ValueError('Intent evaluation used a target campaign or later action')
        games = [game for game in data['players'][actor['name']] if game['aid'] in target['excludedAids']]
        kind = np.asarray([actor['kindModel']['weights'][name] for name in ['flip', 'pair', 'single', 'fatal']])
        old = next(entry['clockStrategy'] for entry in previous['models'] if entry['id'] == actor['id'])
        diagnostics.append({'name': target['name'], 'lv': target['lv'], 'start': target['start'], 'prefixes': len(games),
            'base': score(games, kind, np.asarray(actor['withinWeights'])),
            'adaptiveClock': score_strategy(games, actor, old), 'persistentIntents': score_intents(games, actor, by_id[actor['id']])})
    if any(digest(path) != hashes[path.name] for path in sources) or any(digest(ROOT / name) != expected for name, expected in inputs.items()):
        raise ValueError('Intent fitting source/input changed during computation')
    output = {'made': datetime.now(timezone.utc).isoformat(), 'actualFitRequest': request, 'evidence': 'own-persistent-clock-intents-fit',
        'targetMet': False, 'personalOnly': True, 'sourceHashes': hashes, 'inputHashes': inputs, 'models': models,
        'recentActionDiagnostics': diagnostics, 'annotationSnapshot': snapshot.relative_to(ROOT).as_posix(),
        'staticActorSnapshot': fits.relative_to(ROOT).as_posix(),
        'note': 'Own-person intent priors and causal switching, not universal greedy finishing or synthetic winning labels. '
                'All33 exact static actor/version memberships retained. No clock evidence disables intent control. '
                'Earlier client-time diagnostics remain exploratory; actual availability for future forecasts begins at made, not inherited trainingCut. '
                'Requires runtime parity and complete autonomous winning-count evaluation; no existing forecast is changed.'}
    filename = ARCHIVE / 'personal-clock-intents-models.json'
    filename.write_text(json.dumps(output), encoding='utf8')
    print(json.dumps({'models': len(models), 'targetMet': False, 'modelsSha256': digest(filename)}, indent=2))


if __name__ == '__main__':
    main()
