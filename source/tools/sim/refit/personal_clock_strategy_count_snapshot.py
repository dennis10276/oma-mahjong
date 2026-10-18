import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    filename = 'analysis/personal-bots/personal-clock-strategy-count-throughput-audit.json'
    data = json.loads((ROOT / filename).read_bytes())
    if (data['targetMet'] or not data['pilot'] or data['runs'] != 2 or data['attempts'] != 3
            or len(data['rows']) != 276 or len(set(data['comparisonEpisodes'])) != 80
            or data['controlChainsMatched'] != 552 or data['clockStrategyComputationCaps'] != 0):
        raise ValueError('Adaptive clock pilot lost its fixed cohort/control chains or is censored')
    fingerprint = hashlib.sha256()
    for name in data['fingerprintFiles']:
        fingerprint.update(name.encode())
        fingerprint.update((ROOT / name).read_bytes())
    if fingerprint.hexdigest() != data['fingerprint']:
        raise ValueError('Adaptive clock pilot source or inputs changed')
    if any(stats['genericClockPlans'] for row in data['rows'] for stats in row['stats'].values()):
        raise ValueError('Generic clock planning bypassed personal choices')
    files = set(data['fingerprintFiles'])
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix in ['.js', '.py', '.md'])
    files.update([filename, 'analysis/personal-bots/personal-clock-strategy-count-pilot-output.txt',
                  'analysis/personal-bots/personal-clock-strategy-count-pilot-progress.jsonl', 'analysis/personal-bots/WORK_LOG.md'])
    dependencies = {}
    for name in list(files):
        if '/experiments/' in name or '/runs/' in name:
            dependencies[name] = digest(ROOT / name)
            files.remove(name)
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-clock-strategy-count-pilot-' + stamp)
    folder.mkdir()
    hashes = {}
    for name in sorted(files):
        destination = folder / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((ROOT / name).read_bytes())
        hashes[name] = digest(destination)
        if hashes[name] != digest(ROOT / name):
            raise ValueError('Adaptive clock pilot source changed during preservation')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'mode': 'pilot', 'evidence': 'adaptive-clock-count-pilot',
                'targetMet': False, 'files': hashes, 'externalPinnedDependencies': dependencies,
                'note': '276 unchanged boards,80 held IDs,552 exact old-engine full controls, zero generic clock decisions/caps. '
                    'No-clock current paired chains are exact. Two-run/three-try pilot only: no human winning labels, accuracy score or80% claim.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({'folder': str(folder), 'files': len(hashes), 'dependencies': len(dependencies)}, indent=2))


if __name__ == '__main__':
    main()
