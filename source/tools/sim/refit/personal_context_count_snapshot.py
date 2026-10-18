import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_full_choice_fit import validate
from personal_value_fit import ARCHIVE, ROOT, digest


def validate_bytes(data):
    fingerprint = hashlib.sha256()
    for name in data['fingerprintFiles']:
        fingerprint.update((ROOT / name).read_bytes())
    if fingerprint.hexdigest() != data['fingerprint']:
        raise ValueError('Context count/pilot sources changed before snapshot')


def main(mode):
    runtime_file = ROOT / 'analysis/personal-bots/personal-context-runtime-audit.json'
    runtime = json.loads(runtime_file.read_bytes())
    validate(runtime)
    if runtime['targetMet'] or runtime['runtimePrefixes'] != 398 or runtime['runtimeDecisions'] != 33543 or runtime['unsupported'] or runtime['maskedInspectionRows']:
        raise ValueError('Context runtime parity is incomplete')
    files = set(runtime['fingerprintFiles'])
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir()
                 if path.suffix in ['.js', '.py', '.md'])
    files.update(['tests/t_personal_bots.js', 'analysis/personal-bots/WORK_LOG.md',
                  'analysis/personal-bots/personal-context-runtime-audit.json',
                  'analysis/personal-bots/personal-context-runtime-output.txt',
                  'analysis/personal-bots/personal-context-repeat-guard-audit.json',
                  'analysis/personal-bots/personal-context-repeat-guard-output.txt',
                  'analysis/personal-bots/context-tests-output.txt',
                  'analysis/personal-bots/progression-prospective-results.json'])
    dependencies = {}
    action = ROOT / runtime['pinnedActionExperiment']
    memory = ARCHIVE / 'experiments/personal-memory-2026-10-18T00-43-24-647Z'
    for parent, names in [(action, ['analysis/archive/personal-bots/policy-value-prefix-data.json',
                                   'analysis/archive/personal-bots/personal-context-models.json',
                                   'analysis/personal-bots/personal-context-action-evaluation.json']),
                          (memory, ['analysis/archive/personal-bots/physical-memory-policy-bank.json',
                                    'analysis/archive/personal-bots/physical-count-requests.json',
                                    'analysis/archive/personal-bots/physical-memory-count-data.json',
                                    'analysis/archive/personal-bots/physical-memory-count-scored.json'])]:
        manifest = json.loads((parent / 'manifest.json').read_bytes())
        dependencies[(parent / 'manifest.json').relative_to(ROOT).as_posix()] = digest(parent / 'manifest.json')
        for name in names:
            path = parent / name
            if digest(path) != manifest['files'][name]:
                raise ValueError('Pinned context runtime dependency changed')
            dependencies[path.relative_to(ROOT).as_posix()] = digest(path)
    if mode == 'pilot':
        file = ROOT / 'analysis/personal-bots/personal-context-throughput-audit.json'
        pilot = json.loads(file.read_bytes())
        validate_bytes(pilot)
        if pilot['targetMet'] or len(pilot['rows']) != 276 or pilot['controlChainsMatched'] != 552 or pilot['contextRuns'] != 2 or pilot['contextAttempts'] != 1:
            raise ValueError('Context throughput pilot coverage differs')
        files.update(pilot['fingerprintFiles'])
        files.update([file.relative_to(ROOT).as_posix(), 'analysis/personal-bots/personal-context-throughput-output.txt'])
    if mode == 'full':
        file = ARCHIVE / 'physical-context-count-data.json'
        data = json.loads(file.read_bytes())
        validate_bytes(data)
        report_file = ROOT / 'analysis/personal-bots/physical-context-count-evaluation.json'
        report = json.loads(report_file.read_bytes())
        if (report['targetMet'] or not report['personalOnly'] or report['dataSha256'] != digest(file)
            or report['coverage']['heldOutEpisodes'] != 80 or report['controlPredictionsMatched'] != 252
            or not data['validUncensoredSimulation'] or data['contextComputationCaps'] != 0):
            raise ValueError('Context full count measurement/report differs')
        files.update(data['fingerprintFiles'])
        files.update([file.relative_to(ROOT).as_posix(), report_file.relative_to(ROOT).as_posix(),
                      'analysis/archive/personal-bots/physical-context-count-scored.json',
                      'analysis/personal-bots/personal-context-count-output.txt', 'analysis/personal-bots/personal-context-count-fit-output.txt'])
    files.update('analysis/personal-bots/' + name + '-forecasts.json' for name in
                 ['prospective', 'kind-prospective', 'count-profile-prospective', 'progression-prospective'])
    for name in list(files):
        if '/experiments/' in name:
            dependencies[name] = digest(ROOT / name)
            files.remove(name)
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-context-' + mode + '-' + stamp)
    folder.mkdir()
    hashes = {}
    for name in sorted(files):
        source = ROOT / name
        destination = folder / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source.read_bytes())
        hashes[name] = digest(destination)
        if hashes[name] != digest(source):
            raise ValueError('Context source changed during snapshot')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory-context-' + mode,
                'targetMet': False, 'winningCountMeasurement': 'historical-only' if mode == 'full' else 'not-run',
                'files': hashes, 'externalPinnedDependencies': dependencies,
                'note': 'Optional known-feature personal context runtime, unchanged original numeric forecasts, and explicit parent model/data lineage. '
                        'The former two-reinspection mismatch is retained as diagnostic evidence; its intermediate runtime source was not separately pinned. '
                        'Pilot samples are throughput/computation-boundary diagnostics, never winning-count accuracy. '
                        'Full count claims require zero computation boundaries and matching fixed controls/coverage, and still cannot prove genuine future80% success.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(folder, len(files), 'pinned files,', len(dependencies), 'explicit immutable dependencies')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['runtime', 'pilot', 'full'])
    main(parser.parse_args().mode)
