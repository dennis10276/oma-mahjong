import json
from datetime import datetime, timezone

from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    report_file = ROOT / 'analysis/personal-bots/app158-compatibility.json'
    report = json.loads(report_file.read_bytes())
    if report['targetMet'] or report['version'] != '1.58' or report['fixedLevelsChecked'] != 218:
        raise ValueError('App compatibility evidence lost its complete fixed-board comparison')
    files = set(report['sourceHashes'])
    for filename, expected in report['sourceHashes'].items():
        if digest(ROOT / filename) != expected:
            raise ValueError('App compatibility comparison source changed before preservation')
    upstream = ROOT / report['upstream']
    if digest(upstream / 'manifest.json') != report['upstreamManifestSha256']:
        raise ValueError('Immutable upstream reference manifest changed')
    manifest = json.loads((upstream / 'manifest.json').read_bytes())
    for filename, expected in manifest['files'].items():
        if digest(upstream / filename) != expected:
            raise ValueError('Immutable upstream reference content changed')
        files.add((upstream / filename).relative_to(ROOT).as_posix())
    files.update([report_file.relative_to(ROOT).as_posix(), (upstream / 'manifest.json').relative_to(ROOT).as_posix(),
                  'analysis/personal-bots/app158-compatibility-output.txt', 'tools/sim/refit/personal_app_reference_snapshot.py'])
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('app158-compatibility-' + stamp)
    folder.mkdir()
    hashes = {}
    for filename in sorted(files):
        destination = folder / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((ROOT / filename).read_bytes())
        hashes[filename] = digest(destination)
        if hashes[filename] != digest(ROOT / filename):
            raise ValueError('App compatibility content changed during preservation')
    (folder / 'manifest.json').write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(),
        'evidence': report['evidence'], 'targetMet': False, 'files': hashes,
        'note': 'Complete218-board immutable app1.58 comparison, before registering the newly verified alias. '
            'Read-only source evidence, not a release, bot fit or winning-count result.'}, indent=2), encoding='utf-8')
    print(json.dumps({'folder': str(folder), 'files': len(hashes)}, indent=2))


if __name__ == '__main__':
    main()
