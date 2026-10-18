import json
from datetime import datetime, timezone
from pathlib import Path

from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    report_file = ROOT / 'analysis/personal-bots/personal-clock-dig-throughput-audit.json'
    report = json.loads(report_file.read_bytes())
    if (report['targetMet'] or report['evidence'] != 'clock-digging-feature-pilot'
            or len(report['rows']) != 8 or report['calls'] != 712 or len(report['features']) != 9):
        raise ValueError('Clock-digging pilot changed its declared controls or claimed unsupported success')
    files = set(report['sourceHashes'])
    for name, expected in report['sourceHashes'].items():
        if digest(ROOT / name) != expected:
            raise ValueError('Clock-digging pilot source or input changed: ' + name)
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix in ['.py', '.md'])
    files.update([report_file.relative_to(ROOT).as_posix(), 'analysis/personal-bots/personal-clock-dig-pilot-output.txt',
                  'analysis/personal-bots/WORK_LOG.md', 'tests/t_personal_bots.js',
                  'analysis/archive/realdata/snapshot.json', 'analysis/archive/realdata/scores.json',
                  'tools/sim/refit/attempts.json', 'analysis/personal-bots/clock-route-tests-output.txt'])
    files.update('tools/sim/refit/mimic/' + name + '.json' for name in ['Dennisisdebeste', 'Mrs_Doubtfire', 'PUK', 'Gerda'])
    for name in ['prospective', 'kind-prospective', 'count-profile-prospective', 'progression-prospective']:
        files.update('analysis/personal-bots/' + name + suffix + '.json' for suffix in ['-forecasts', '-results'])
    dependencies = {}
    for name in list(files):
        if '/experiments/' in name:
            dependencies[name] = digest(ROOT / name)
            files.remove(name)
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-clock-dig-pilot-' + stamp)
    folder.mkdir()
    hashes = {}
    for name in sorted(files):
        destination = folder / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((ROOT / name).read_bytes())
        hashes[name] = digest(destination)
        if hashes[name] != digest(ROOT / name):
            raise ValueError('Clock-digging source changed while being preserved')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'clock-digging-feature-pilot',
                'targetMet': False, 'files': hashes, 'externalPinnedDependencies': dependencies,
                'note': 'Preserves the separate human-motivated clock-probing feature prototype and unchanged pilot controls. '
                    'No adaptive policy fit, winning-count accuracy or prospective model promotion is claimed.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({'folder': str(folder), 'files': len(hashes), 'dependencies': len(dependencies)}, indent=2))


if __name__ == '__main__':
    main()
