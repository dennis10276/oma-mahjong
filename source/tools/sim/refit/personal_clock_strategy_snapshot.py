import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_value_fit import ARCHIVE, ROOT, digest


def main(mode):
    pilot = mode in ['pilot', 'failed']
    filename = ('analysis/personal-bots/personal-clock-strategy-throughput-audit.json' if pilot
                else 'analysis/archive/personal-bots/policy-clock-strategy-prefix-data.json')
    data = json.loads((ROOT / filename).read_bytes())
    expected = data['fingerprint']
    if mode == 'failed':
        header = json.loads((ROOT / 'analysis/personal-bots/personal-clock-strategy-full-progress.jsonl').read_text().splitlines()[0])
        expected = header['fingerprint']
    fingerprint = hashlib.sha256()
    for name in data['fingerprintFiles']:
        fingerprint.update(name.encode())
        fingerprint.update((ROOT / name).read_bytes())
    if fingerprint.hexdigest() != expected or data['targetMet']:
        raise ValueError('Clock-strategy source/input evidence changed')
    if mode != 'failed' and (data['pilot'] != pilot or data['prefixes'] != (8 if pilot else 398)
                             or data['totals']['calls'] != (712 if pilot else 33543)):
        raise ValueError('Clock-strategy cohort changed')
    files = set(data['fingerprintFiles'])
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix in ['.js', '.py', '.md'])
    files.update([filename, 'analysis/personal-bots/WORK_LOG.md', 'tests/t_personal_bots.js'])
    for candidate in (ROOT / 'analysis/personal-bots').glob('personal-clock-strategy-*'):
        if candidate.is_file():
            files.add(candidate.relative_to(ROOT).as_posix())
    if mode == 'actions':
        report_file = ROOT / 'analysis/personal-bots/personal-clock-strategy-action-evaluation.json'
        model_file = ARCHIVE / 'personal-clock-strategy-models.json'
        report = json.loads(report_file.read_bytes())
        if (report['targetMet'] or report['models'] != 138 or report['actionControlsMatched'] != 197
                or report['dataSha256'] != digest(ROOT / filename) or report['modelsSha256'] != digest(model_file)):
            raise ValueError('Adaptive clock fit changed frozen memberships or action controls')
        for name, expected_hash in report['inputHashes'].items():
            if digest(ROOT / name) != expected_hash:
                raise ValueError('Adaptive clock actor/control parent changed')
            files.add(name)
        for name, expected_hash in report['fitSourceHashes'].items():
            if digest(Path(__file__).with_name(name)) != expected_hash:
                raise ValueError('Adaptive clock fitting source changed')
        files.update([report_file.relative_to(ROOT).as_posix(), model_file.relative_to(ROOT).as_posix()])
        runtime_file = ROOT / 'analysis/personal-bots/personal-clock-strategy-runtime-audit.json'
        runtime = json.loads(runtime_file.read_bytes())
        if (runtime['targetMet'] or runtime['prefixes'] != 197 or runtime['probabilityDecisions'] != 38028
                or runtime['models'] != 138 or runtime['featureFingerprint'] != data['fingerprint']):
            raise ValueError('Adaptive clock native/runtime proof lost its exact controls')
        runtime_hash = hashlib.sha256()
        for name in runtime['fingerprintFiles']:
            runtime_hash.update(name.encode())
            runtime_hash.update((ROOT / name).read_bytes())
            files.add(name)
        if runtime_hash.hexdigest() != runtime['fingerprint']:
            raise ValueError('Adaptive clock runtime sources or evidence changed')
        files.add(runtime_file.relative_to(ROOT).as_posix())
    dependencies = {}
    for name in list(files):
        if '/experiments/' in name:
            dependencies[name] = digest(ROOT / name)
            files.remove(name)
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-clock-strategy-' + mode + '-' + stamp)
    folder.mkdir()
    hashes = {}
    for name in sorted(files):
        destination = folder / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((ROOT / name).read_bytes())
        hashes[name] = digest(destination)
        if hashes[name] != digest(ROOT / name):
            raise ValueError('Source changed during clock-strategy preservation')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'mode': mode, 'evidence': 'failed-feature-instrumentation' if mode == 'failed' else 'historical-exploratory',
                'targetMet': False, 'files': hashes, 'externalPinnedDependencies': dependencies,
                'note': 'Same original action cohorts and per-person policy memberships. Failed instrumentation is not valid fitting/count data. '
                    'No winning-count forecast, prospective promotion or80% claim is established.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({'folder': str(folder), 'files': len(hashes), 'dependencies': len(dependencies)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['failed', 'pilot', 'features', 'actions'])
    main(parser.parse_args().mode)
