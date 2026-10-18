import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from personal_clock_strategy import FEATURES, PARAMETERS, fit_strategy, score_strategy
from personal_full_choice_fit import score
from personal_prefix_versions import select_prefixes, semantic_prefix, training_identity
from personal_value_fit import ARCHIVE, ROOT, digest


def checked_training(data, actor):
    versions = select_prefixes(data, actor['name'], actor['trainingCut'],
                               strict_observed=not actor.get('historicalExploratoryOnly', False))
    identity, roster = training_identity(actor['name'], versions)
    expected = sorted((row['aid'], row['availableAt'], row['versionSha256']) for row in actor['trainedVersions'])
    if identity != actor['id'] or roster != expected or len(versions) != actor['trainingGames'][actor['name']]:
        raise ValueError('Fresh clock fitting changed the exact own-person prefix-version membership')
    return versions


def main():
    data_file = ARCHIVE / 'personal-fresh-clock-prefixes.json'
    data_hash = digest(data_file)
    data = json.loads(data_file.read_bytes())
    if (data['prefixes'] != 445 or data['totals']['reused'] != 398 or data['totals']['reconstructed'] != 47
            or data['clockFeatures'] != FEATURES or data['clockParameters'] != PARAMETERS or data['targetMet']):
        raise ValueError('Fresh clock fitting needs the complete445 exact public annotations')
    for filename, expected in data['sourceHashes'].items():
        if digest(ROOT / filename) != expected:
            raise ValueError('Fresh clock annotation source changed: ' + filename)
    for games in data['players'].values():
        for game in games:
            if semantic_prefix(game)[1] != game['versionSha256']:
                raise ValueError('Clock annotations changed an original semantic version')
    fits = ARCHIVE / 'experiments/personal-fresh-own-fits-2026-10-18T15-59-12-900Z'
    manifest = json.loads((fits / 'manifest.json').read_bytes())
    banks, inputs = [], {data_file.relative_to(ROOT).as_posix(): data_hash, **data['sourceHashes']}
    for filename in ['personal-fresh-own-models.json', 'personal-fresh-recent-models.json']:
        name = 'analysis/archive/personal-bots/' + filename
        source = fits / name
        if digest(source) != manifest['files'][name]:
            raise ValueError('Fresh clock static actor bank changed')
        inputs[source.relative_to(ROOT).as_posix()] = digest(source)
        banks.append(json.loads(source.read_bytes()))
    actors = banks[0]['models'] + banks[1]['models']
    sources = {Path(__file__).resolve()}
    for module in sys.modules.values():
        filename = getattr(module, '__file__', None)
        if filename and Path(filename).resolve().parent == Path(__file__).resolve().parent:
            sources.add(Path(filename).resolve())
    hashes = {path.name: digest(path) for path in sources}
    actual_request = int(datetime.now(timezone.utc).timestamp() * 1000)
    models = []
    progress = ROOT / 'analysis/personal-bots/fresh-clock-fit-progress.jsonl'
    progress.write_text(json.dumps({'actualRequest': actual_request, 'actors': len(actors), 'targetMet': False}) + '\n', encoding='utf8')
    for actor in actors:
        training = checked_training(data, actor)
        model = fit_strategy(training, actor)
        if model['trainedAids'] != sorted(actor['trainedAids']):
            raise ValueError('Fresh clock model lost its frozen own membership')
        models.append({'id': actor['id'], 'name': actor['name'], 'historicalExploratoryOnly': actor.get('historicalExploratoryOnly', False),
                       'clockStrategy': model})
        with progress.open('a', encoding='utf8') as stream:
            stream.write(json.dumps({'completed': len(models), 'name': actor['name'], 'clockChoices': model['trainingClockChoices']}) + '\n')
        print('Fresh own clock fits', len(models), '/', len(actors), flush=True)
    by_id = {model['id']: model['clockStrategy'] for model in models}
    evaluations = []
    schedule_file = fits / 'analysis/archive/personal-bots/personal-fresh-count-requests.json'
    if digest(schedule_file) != manifest['files']['analysis/archive/personal-bots/personal-fresh-count-requests.json']:
        raise ValueError('Fresh clock evaluation schedule changed')
    inputs[schedule_file.relative_to(ROOT).as_posix()] = digest(schedule_file)
    schedule = json.loads(schedule_file.read_bytes())
    for request in schedule['recent']:
        selection = next(row for row in banks[1]['selections'] if row['name'] == request['name'] and row['start'] == request['start'])
        actor = next(actor for actor in actors if actor['id'] == selection['id'])
        if set(actor['trainedAids']) & set(request['excludedAids']):
            raise ValueError('Recent clock action evaluation trained on its own campaign')
        games = [game for game in data['players'][actor['name']] if game['aid'] in request['excludedAids']]
        kind = np.asarray([actor['kindModel']['weights'][name] for name in ['flip', 'pair', 'single', 'fatal']])
        evaluations.append({'name': request['name'], 'lv': request['lv'], 'start': request['start'], 'modelId': actor['id'],
            'prefixes': len(games), 'base': score(games, kind, np.asarray(actor['withinWeights'])),
            'clockStrategy': score_strategy(games, actor, by_id[actor['id']])})
    if (digest(data_file) != data_hash or any(digest(path) != hashes[path.name] for path in sources)
            or any(digest(ROOT / name) != expected for name, expected in inputs.items())):
        raise ValueError('Fresh clock fitting inputs changed while computing')
    report = {'made': datetime.now(timezone.utc).isoformat(), 'actualFitRequest': actual_request,
        'evidence': 'fresh-own-clock-fit-and-historical-action-diagnostics', 'targetMet': False, 'personalOnly': True,
        'dataSha256': data_hash, 'sourceHashes': hashes, 'inputHashes': inputs, 'models': models, 'recentActionDiagnostics': evaluations,
        'note': 'Own-person causal clock strategy fits preserve exact previously frozen static actors and version membership. '
                'Recent client-time diagnostics remain historical exploratory. Actual clock model readiness is this bank’s made time, '
                'not the inherited static actor trainingCut. No old numeric forecast is changed. '
                'Public bounded route/pair/exit preferences may favor or oppose digging; no universal greedy controller. '
                'Still requires native/runtime parity, complete autonomous count evaluation and pre-opening numeric forecasts.'}
    output = ARCHIVE / 'personal-fresh-clock-models.json'
    output.write_text(json.dumps(report), encoding='utf8')
    print(json.dumps({'models': len(models), 'futureModels': len(banks[0]['models']), 'historicalModels': len(banks[1]['models']),
                      'modelFileSha256': digest(output), 'targetMet': False}, indent=2))


if __name__ == '__main__':
    main()
