import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    name = 'analysis/personal-bots/personal-clock-route-count-throughput-audit.json'
    data = json.loads((ROOT / name).read_bytes())
    if (data['targetMet'] or not data['pilot'] or data['runs'] != 2 or data['attempts'] != 3
            or len(data['rows']) != 276 or len(set(data['comparisonEpisodes'])) != 80
            or data['controlChainsMatched'] != 552 or data['clockRouteComputationCaps'] != 0):
        raise ValueError('Clock-route paired pilot lost its fixed controls or has computation censoring')
    fingerprint = hashlib.sha256()
    for filename in data['fingerprintFiles']:
        fingerprint.update(filename.encode())
        fingerprint.update((ROOT / filename).read_bytes())
    if fingerprint.hexdigest() != data['fingerprint']:
        raise ValueError('Clock-route paired pilot inputs or sources changed')
    if any(stats['genericClockPlans'] for row in data['rows'] for stats in row['stats'].values()):
        raise ValueError('Generic clock planning bypassed the fitted personal choices')
    files = set(data['fingerprintFiles'])
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix in ['.js', '.py', '.md'])
    files.update([name, 'analysis/personal-bots/personal-clock-route-count-pilot-output.txt',
                  'analysis/personal-bots/personal-clock-route-count-pilot-progress.jsonl', 'analysis/personal-bots/WORK_LOG.md'])
    dependencies = {}
    for filename in list(files):
        if '/experiments/' in filename or '/runs/' in filename:
            dependencies[filename] = digest(ROOT / filename)
            files.remove(filename)
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-clock-route-count-pilot-' + stamp)
    folder.mkdir()
    hashes = {}
    for filename in sorted(files):
        destination = folder / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((ROOT / filename).read_bytes())
        hashes[filename] = digest(destination)
        if hashes[filename] != digest(ROOT / filename):
            raise ValueError('Clock-route pilot source changed during preservation')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'mode': 'pilot', 'evidence': 'clock-route-count-pilot',
                'targetMet': False, 'files': hashes, 'externalPinnedDependencies': dependencies,
                'note': '276 unchanged boards,80 held IDs,552 exact old-engine full control chains, zero generic clock decisions and zero caps. '
                    'Two-run/three-try throughput evidence only; no human winning labels, accuracy score or prospective promotion.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({'folder': str(folder), 'files': len(hashes), 'dependencies': len(dependencies)}, indent=2))


if __name__ == '__main__':
    main()
