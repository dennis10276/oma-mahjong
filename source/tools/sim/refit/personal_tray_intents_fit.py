import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from personal_clock_intents import score_intents
from personal_fresh_clock_fit import checked_training
from personal_full_choice_fit import score
from personal_prefix_versions import semantic_prefix
from personal_tray_intents import fit_tray_intents, score_tray_intents
from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    data_file = ARCHIVE / 'personal-tray-intents-prefixes.json'
    data = json.loads(data_file.read_bytes())
    inputs = {data_file.relative_to(ROOT).as_posix(): digest(data_file)}
    if data['totals']['prefixes'] != 445 or data['totals']['calls'] != 39268:
        raise ValueError('Own tray intents need all445 exact natural public annotations')
    for name, expected in data['sourceHashes'].items():
        if digest(ROOT / name) != expected:
            raise ValueError('Tray intent annotations changed source: ' + name)
    for games in data['players'].values():
        for game in games:
            if semantic_prefix(game)[1] != game['versionSha256']:
                raise ValueError('Tray annotations changed an original own semantic version')
            for decision in game['decisions']:
                if np.any(decision['knownPlan']) and np.any(decision['trayPlan']):
                    raise ValueError('Clock and tray intent phases overlap')
    clock_snapshot = ARCHIVE / 'experiments/personal-clock-intents-actions-2026-10-18T20-14-16-102Z'
    def read(folder, filename):
        manifest_file = folder / 'manifest.json'
        manifest = json.loads(manifest_file.read_bytes())
        source = folder / filename
        expected = manifest['files'][filename]
        if digest(source) != expected:
            raise ValueError('Pinned own intent input changed: ' + filename)
        inputs[manifest_file.relative_to(ROOT).as_posix()] = digest(manifest_file)
        inputs[source.relative_to(ROOT).as_posix()] = expected
        return json.loads(source.read_bytes())
    clock_bank = read(clock_snapshot, 'analysis/archive/personal-bots/personal-clock-intents-models.json')
    fits = ARCHIVE / 'experiments/personal-fresh-own-fits-2026-10-18T15-59-12-900Z'
    future = read(fits, 'analysis/archive/personal-bots/personal-fresh-own-models.json')
    historical = read(fits, 'analysis/archive/personal-bots/personal-fresh-recent-models.json')
    schedule = read(fits, 'analysis/archive/personal-bots/personal-fresh-count-requests.json')
    sources = {Path(__file__).resolve()}
    for module in sys.modules.values():
        filename = getattr(module, '__file__', None)
        if filename and Path(filename).resolve().parent == Path(__file__).resolve().parent:
            sources.add(Path(filename).resolve())
    hashes = {path.name: digest(path) for path in sources}
    request = int(datetime.now(timezone.utc).timestamp() * 1000)
    actors, models, diagnostics = future['models'] + historical['models'], [], []
    progress = ROOT / 'analysis/personal-bots/tray-intents-fit-progress.jsonl'
    progress.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'actualRequest': request, 'models': len(actors)}) + '\n', encoding='utf8')
    for actor in actors:
        training = checked_training(data, actor)
        model = fit_tray_intents(training, actor)
        clock_model = next(entry['clockIntents'] for entry in clock_bank['models'] if entry['id'] == actor['id'])
        models.append({'id': actor['id'], 'name': actor['name'], 'historicalExploratoryOnly': actor.get('historicalExploratoryOnly', False),
                       'clockIntents': clock_model, 'trayIntents': model})
        with progress.open('a', encoding='utf8') as stream:
            stream.write(json.dumps({'completed': len(models), 'name': actor['name'], 'trainingChoices': model['trainingChoices'], 'priors': model['priors']}) + '\n')
        print('Own tray intent fits', len(models), '/', len(actors), flush=True)
    for target in schedule['recent']:
        selection = next(row for row in historical['selections'] if row['name'] == target['name'] and row['start'] == target['start'])
        actor = next(actor for actor in actors if actor['id'] == selection['id'])
        model = next(entry for entry in models if entry['id'] == actor['id'])
        if set(actor['trainedAids']) & set(target['excludedAids']):
            raise ValueError('Own tray action evaluation trained on its target campaign')
        games = [game for game in data['players'][actor['name']] if game['aid'] in target['excludedAids']]
        kind = np.asarray([actor['kindModel']['weights'][name] for name in ['flip', 'pair', 'single', 'fatal']])
        base = score(games, kind, np.asarray(actor['withinWeights']))
        clock = score_intents(games, actor, model['clockIntents'])
        tray = score_tray_intents(games, actor, model['trayIntents'])
        combined = {'decisions': base['decisions'], **{key: clock[key] + tray[key] - base[key] if base[key] is not None else None
                    for key in ('jointLogLoss', 'topActionAccuracy')}}
        diagnostics.append({'name': target['name'], 'lv': target['lv'], 'start': target['start'], 'prefixes': len(games),
                            'base': base, 'clockOnly': clock, 'trayOnly': tray, 'combined': combined})
    if any(digest(path) != hashes[path.name] for path in sources) or any(digest(ROOT / name) != expected for name, expected in inputs.items()):
        raise ValueError('Tray intent fitting inputs/sources changed during computation')
    output = {'made': datetime.now(timezone.utc).isoformat(), 'actualFitRequest': request, 'evidence': 'own-persistent-clock-and-tray-intent-fit',
        'targetMet': False, 'personalOnly': True, 'sourceHashes': hashes, 'inputHashes': inputs, 'models': models,
        'recentActionDiagnostics': diagnostics, 'clockSnapshot': clock_snapshot.relative_to(ROOT).as_posix(),
        'staticActorSnapshot': fits.relative_to(ROOT).as_posix(), 'dataFile': data_file.relative_to(ROOT).as_posix(),
        'note': 'Own earlier-only ordinary/match/recovery switching. The already measured clock model is retained exactly. '
                'Mutually exclusive public phases allow additive diagnostic likelihood differences; runtime compound policy still requires parity. '
                'No current target outcome or other-person behavior enters fitting. Actual readiness begins at made. '
                'Complete autonomous first-clear counts and genuine future freezes remain required; existing numeric forecasts stay unchanged.'}
    filename = ARCHIVE / 'personal-tray-intents-models.json'
    filename.write_text(json.dumps(output), encoding='utf8')
    print(json.dumps({'models': len(models), 'targetMet': False, 'modelsSha256': digest(filename)}, indent=2))


if __name__ == '__main__':
    main()
