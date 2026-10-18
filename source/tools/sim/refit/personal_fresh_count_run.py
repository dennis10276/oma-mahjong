import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from personal_known_plan_run import contained
from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    filename = 'analysis/archive/personal-bots/personal-fresh-count-input.json'
    data = json.loads((ROOT / filename).read_bytes())
    if data['restoredRecentBoardControls'] != 29 or len(data['comparisonEpisodes']) != 80:
        raise ValueError('Fresh run needs the unchanged controls and exact restored boards')
    selected = {filename: digest(ROOT / filename), **data['sourceHashes']}
    fits = contained(ROOT, data['modelSnapshot'])
    manifest = json.loads((fits / 'manifest.json').read_bytes())
    for name, expected in manifest['files'].items():
        selected[(fits / name).relative_to(ROOT).as_posix()] = expected
    for name, expected in manifest['externalPinnedDependencies'].items():
        if name in selected and selected[name] != expected:
            raise ValueError('Conflicting pinned fitting dependency')
        selected[name] = expected
    for folder, suffixes in [(Path(__file__).parent, ('.py', '.js', '.md')),
                             (ROOT / 'www', ('.js',)), (Path(__file__).parent / 'tables', ('.json', '.js')),
                             (Path(__file__).parent / 'mimic', ('.json',))]:
        for source in folder.iterdir():
            if source.is_file() and source.suffix in suffixes:
                name = source.relative_to(ROOT).as_posix()
                expected = digest(source)
                if name in selected and selected[name] != expected:
                    raise ValueError('Fresh input source changed before freezing: ' + name)
                selected[name] = expected
    for name, expected in selected.items():
        if digest(contained(ROOT, name)) != expected:
            raise ValueError('Fresh run input does not match its pinned bytes: ' + name)
    needed = sum(contained(ROOT, name).stat().st_size for name in selected)
    if shutil.disk_usage(ROOT).free < needed + 1024 ** 3:
        raise ValueError('Insufficient free space for independent fresh count run')
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'runs' / ('fresh-count-' + stamp)
    folder.mkdir(parents=True)
    for name, expected in selected.items():
        source, destination = contained(ROOT, name), contained(folder, name)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        if digest(source) != expected or digest(destination) != expected:
            raise ValueError('Fresh run source changed during copying')
    (folder / 'analysis/personal-bots').mkdir(parents=True, exist_ok=True)
    (folder / 'run-manifest.json').write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(),
        'evidence': 'fresh-own-count-independent-runtime-and-input-closure', 'targetMet': False,
        'sourceInputs': selected, 'fittingManifestSha256': digest(fits / 'manifest.json'),
        'parentScope': 'Pinned parent count data and manifest; no claim of copying every earlier parent experiment dependency.',
        'note': 'Run pilot and full in this same immutable runtime. The predeclared scoring source is included before any pilot results. '
                'Only computation outputs/progress may change. Numeric forecasts require a subsequent live check.'}, indent=2), encoding='utf-8')
    print(json.dumps({'runRoot': str(folder), 'files': len(selected), 'bytes': needed,
        'pilot': ['node', 'tools/sim/refit/personal_fresh_count_data.js', 'pilot'],
        'full': ['node', 'tools/sim/refit/personal_fresh_count_data.js']}, indent=2))


if __name__ == '__main__':
    main()
