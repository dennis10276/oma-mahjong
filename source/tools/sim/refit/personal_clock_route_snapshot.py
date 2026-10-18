import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_clock_route import FEATURES, PARAMETERS
from personal_known_plan_snapshot import validate_data
from personal_value_fit import ARCHIVE, ROOT, digest


def validate_clock_data(data, pilot=False):
    if (data.get('targetMet') is not False or data.get('evidence') != 'public-clock-route-feature-parity'
            or data.get('pilot') != pilot or data.get('prefixes') != (8 if pilot else 398)
            or data.get('features') != FEATURES or data.get('parameters') != PARAMETERS
            or not pilot and data.get('totals', {}).get('calls') != 33543):
        raise ValueError('Clock-route snapshot changed its feature controls or claimed unsupported success')


def main(mode):
    pilot = mode == 'pilot'
    filename = ('analysis/personal-bots/personal-clock-route-throughput-audit.json' if pilot
                else 'analysis/archive/personal-bots/policy-clock-route-prefix-data.json')
    data = json.loads((ROOT / filename).read_bytes())
    validate_clock_data(data, pilot)
    validate_data(data)
    files = set(data['fingerprintFiles'])
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix in ['.js', '.py', '.md'])
    files.update([filename, 'tests/t_personal_bots.js', 'analysis/personal-bots/WORK_LOG.md',
                  'analysis/archive/realdata/snapshot.json', 'analysis/archive/realdata/scores.json',
                  'tools/sim/refit/attempts.json',
                  'analysis/personal-bots/personal-clock-route-' + ('pilot' if pilot else 'full') + '-progress.jsonl',
                  'analysis/personal-bots/personal-clock-route-' + ('pilot' if pilot else 'data') + '-output.txt'])
    files.update('tools/sim/refit/mimic/' + name + '.json' for name in ['Dennisisdebeste', 'Mrs_Doubtfire', 'PUK', 'Gerda'])
    for name in ['prospective', 'kind-prospective', 'count-profile-prospective', 'progression-prospective']:
        files.update('analysis/personal-bots/' + name + suffix + '.json' for suffix in ['-forecasts', '-results'])
    for name in ['clock-route-tests-output.txt', 'personal-clock-exit-audit.json', 'personal-clock-exit-output.txt',
                 'personal-known-plan-run-preparation.json']:
        candidate = ROOT / 'analysis/personal-bots' / name
        if candidate.exists():
            files.add(candidate.relative_to(ROOT).as_posix())
    diagnostic_file = ROOT / 'analysis/personal-bots/personal-clock-exit-audit.json'
    if diagnostic_file.exists():
        diagnostic = json.loads(diagnostic_file.read_bytes())
        for name, expected in diagnostic['sourceHashes'].items():
            if digest(ROOT / name) != expected:
                raise ValueError('Refresh the source-matched clock ownership diagnostic before snapshotting')
            files.add(name)
        diagnostic_root = Path(diagnostic['inputRoot'])
        for name, expected in diagnostic['inputHashes'].items():
            source = diagnostic_root / name
            if digest(source) != expected:
                raise ValueError('Frozen diagnostic input changed')
            files.add(source.relative_to(ROOT).as_posix())
        manifest = diagnostic_root / 'run-manifest.json'
        if digest(manifest) != diagnostic['inputManifestSha256']:
            raise ValueError('Diagnostic input manifest changed')
        files.add(manifest.relative_to(ROOT).as_posix())
    if mode == 'actions':
        model_file = ARCHIVE / 'personal-clock-route-models.json'
        report_file = ROOT / 'analysis/personal-bots/personal-clock-route-action-evaluation.json'
        report = json.loads(report_file.read_bytes())
        if (report['targetMet'] or report['models'] != 138 or report['actionControlsMatched'] != 197
                or report['dataSha256'] != digest(ROOT / filename) or report['modelsSha256'] != digest(model_file)):
            raise ValueError('Clock-route action fit changed its cohort, controls or model evidence')
        for name, expected in report['fitSourceHashes'].items():
            if digest(Path(__file__).with_name(name)) != expected:
                raise ValueError('Clock-route fitting source changed')
        for name, expected in report['inputHashes'].items():
            if digest(ROOT / name) != expected:
                raise ValueError('Frozen personal actor or action-control parent changed')
            files.add(name)
        files.update([model_file.relative_to(ROOT).as_posix(), report_file.relative_to(ROOT).as_posix(),
                      'analysis/personal-bots/personal-clock-route-fit-output.txt'])
        runtime_file = ROOT / 'analysis/personal-bots/personal-clock-route-runtime-audit.json'
        runtime = json.loads(runtime_file.read_bytes())
        if runtime['targetMet'] or runtime['prefixes'] != 197 or runtime['probabilityDecisions'] != 38028 or runtime['models'] != 138:
            raise ValueError('Clock-route native/runtime proof changed its fixed control cohort')
        fingerprint = hashlib.sha256()
        for name in runtime['fingerprintFiles']:
            fingerprint.update(name.encode())
            fingerprint.update((ROOT / name).read_bytes())
            files.add(name)
        if fingerprint.hexdigest() != runtime['fingerprint']:
            raise ValueError('Clock-route runtime sources or evidence changed')
        files.update([runtime_file.relative_to(ROOT).as_posix(), 'analysis/personal-bots/personal-clock-route-runtime-output.txt'])
    dependencies = {}
    for name in list(files):
        if '/experiments/' in name or '/runs/' in name:
            dependencies[name] = digest(ROOT / name)
            files.remove(name)
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-clock-route-' + mode + '-' + stamp)
    folder.mkdir()
    hashes = {}
    for name in sorted(files):
        destination = folder / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((ROOT / name).read_bytes())
        hashes[name] = digest(destination)
        if hashes[name] != digest(ROOT / name):
            raise ValueError('Source changed while preserving clock-route evidence')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'mode': mode, 'evidence': 'historical-exploratory',
                'targetMet': False, 'files': hashes, 'externalPinnedDependencies': dependencies,
                'note': 'Original action cohorts, independent personal fits, sources and genuine forecast ledgers retained. '
                    'Clock-controller diagnosis is descriptive only. No winning-count result or prospective promotion is claimed.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({'folder': str(folder), 'files': len(hashes), 'dependencies': len(dependencies)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['pilot', 'features', 'actions'])
    main(parser.parse_args().mode)
