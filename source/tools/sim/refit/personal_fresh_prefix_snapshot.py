import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    data_file = ARCHIVE / 'policy-value-prefix-data.json'
    data = json.loads(data_file.read_bytes())
    if (data['physicalSingleStep'] or not data['immediateValueMeasured'] or len(data['features']) != 76
            or len(data['kindContextFeatures']) != 26):
        raise ValueError('Fresh own-person fitting needs the full physical immediate-feature schema')
    fingerprint = hashlib.sha256()
    for filename in data['fingerprintFiles']:
        fingerprint.update(filename.encode())
        fingerprint.update((ROOT / filename).read_bytes())
    if fingerprint.hexdigest() != data['fingerprint']:
        raise ValueError('Fresh natural prefixes changed before preservation')
    files = set(data['fingerprintFiles'])
    files.update([data_file.relative_to(ROOT).as_posix(), 'analysis/archive/realdata/snapshot.json',
                  'analysis/personal-bots/fresh-prefix-value-output.txt', 'analysis/personal-bots/WORK_LOG.md',
                  'tests/t_personal_bots.js', 'tools/sim/refit/attempts.json'])
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir()
                 if path.suffix in ['.py', '.js', '.md'])
    files.update(path.relative_to(ROOT).as_posix() for path in (Path(__file__).parent / 'fixtures').glob('*.json'))
    app_snapshot = ARCHIVE / 'experiments/app158-compatibility-2026-10-18T15-40-59-893Z'
    app_manifest = json.loads((app_snapshot / 'manifest.json').read_bytes())
    dependencies = {(app_snapshot / 'manifest.json').relative_to(ROOT).as_posix(): digest(app_snapshot / 'manifest.json')}
    for filename, expected in app_manifest['files'].items():
        source = app_snapshot / filename
        if digest(source) != expected:
            raise ValueError('Verified app1.58 compatibility evidence changed')
        dependencies[source.relative_to(ROOT).as_posix()] = expected
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-fresh-prefixes-' + stamp)
    folder.mkdir()
    hashes = {}
    for filename in sorted(files):
        destination = folder / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((ROOT / filename).read_bytes())
        hashes[filename] = digest(destination)
        if hashes[filename] != digest(ROOT / filename):
            raise ValueError('Fresh-prefix source changed while being preserved')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'fresh-natural-prefixes-for-asof-personal-fitting',
                'targetMet': False, 'files': hashes, 'externalPinnedDependencies': dependencies,
                'featureFingerprint': data['fingerprint'], 'players': {name: len(games) for name, games in data['players'].items()},
                'note': 'New immutable prefix versions, not replacements for earlier source snapshots. '
                    'Only the latest own version actually available before a request may train that actor. '
                    'Later completion of an old AID cannot be merged into its earlier incomplete version. '
                    'No numeric forecast or outcome is rewritten, and no80% result is claimed.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({'folder': str(folder), 'files': len(hashes), 'players': manifest['players']}, indent=2))


if __name__ == '__main__':
    main()
