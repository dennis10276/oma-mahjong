import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from personal_full_choice_fit import fit_person, prior_of
from personal_kind_fit import encode
from personal_outcome_styles import fit_styles
from personal_prefix_versions import select_prefixes, training_identity
from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    bank_file = ARCHIVE / 'personal-prefix-versions.json'
    request_file = ARCHIVE / 'personal-fresh-count-requests.json'
    bank, schedule = [json.loads(path.read_bytes()) for path in [bank_file, request_file]]
    input_hashes = {path.relative_to(ROOT).as_posix(): digest(path) for path in [bank_file, request_file]}
    if schedule['targetMet'] or schedule['inputHashes'][bank_file.relative_to(ROOT).as_posix()] != input_hashes[bank_file.relative_to(ROOT).as_posix()]:
        raise ValueError('Recent own fitting changed the prefix bank used to schedule targets')
    sources = {Path(__file__).resolve()}
    for module in sys.modules.values():
        filename = getattr(module, '__file__', None)
        if filename and Path(filename).resolve().parent == Path(__file__).resolve().parent:
            sources.add(Path(filename).resolve())
    source_hashes = {path.name: digest(path) for path in sources}
    models, selections = {}, []
    progress = ROOT / 'analysis/personal-bots/personal-fresh-recent-fit-progress.jsonl'
    progress.write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(), 'requests': len(schedule['requests'])}) + '\n', encoding='utf-8')
    for position, request in enumerate(schedule['requests'], 1):
        name, cutoff = request['name'], request['start']
        games = select_prefixes(bank, name, cutoff, request['excludedAids'])
        identity, roster = training_identity(name, games)
        if identity not in models:
            kind, within, count = fit_person(games, cutoff, prior_of(bank), len(bank['kindContextFeatures']))
            actor = {'id': identity, 'name': name, 'scope': 'ownAll', 'trainingCut': cutoff,
                     'availableThrough': max((game['availableAt'] for game in games), default=None),
                     'trainingGames': {name: count}, 'trainedAids': sorted(game['aid'] for game in games),
                     'trainedVersions': [{'aid': aid, 'availableAt': available, 'versionSha256': version} for aid, available, version in roster],
                     'kindModel': encode(kind), 'withinWeights': within.tolist(), 'jointChoice': False,
                     'retryMemoryMode': 'none', 'physicalSingleStep': False, 'historicalExploratoryOnly': True}
            models[identity] = {**actor, 'outcomeStyles': fit_styles(games, actor)}
        actor = models[identity]
        if (actor['trainingCut'] > cutoff or actor['availableThrough'] is not None and actor['availableThrough'] >= cutoff
                or set(actor['trainedAids']) & set(request['excludedAids'])):
            raise ValueError('Historical recent actor used a target or later-created chunk')
        selections.append({'name': name, 'start': cutoff, 'id': identity})
        with progress.open('a', encoding='utf-8') as stream:
            stream.write(json.dumps({'completed': position, 'name': name, 'start': cutoff, 'trainingGames': len(games)}) + '\n')
    if (any(digest(path) != source_hashes[path.name] for path in sources)
            or any(digest(ROOT / filename) != expected for filename, expected in input_hashes.items())):
        raise ValueError('Recent historical own fitting inputs or sources changed')
    output = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-client-time-asof-own-fit',
              'targetMet': False, 'personalOnly': True, 'inputHashes': input_hashes, 'sourceHashes': source_hashes,
              'models': list(models.values()), 'selections': selections,
              'note': 'Every target uses only earlier-created own prefix versions and excludes its entire campaign. '
                  'No later completion is joined solely byAID. This is historical exploratory fitting: queued client timestamps '
                  'do not prove server receipt or an actual pre-start model. Genuine future models separately require real '
                  'saved-snapshot observation and later numeric freezes. Old276 boards/80 held IDs and all numeric ledgers remain unchanged.'}
    filename = ARCHIVE / 'personal-fresh-recent-models.json'
    filename.write_text(json.dumps(output), encoding='utf-8')
    print(json.dumps({'models': len(models), 'requests': len(selections), 'modelsSha256': digest(filename)}, indent=2))


if __name__ == '__main__':
    main()
