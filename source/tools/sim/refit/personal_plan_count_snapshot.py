import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_plan_count_fit import validate_plan_count
from personal_value_fit import ARCHIVE, ROOT, digest


def validate_bytes(data, include_names=False):
    fingerprint = hashlib.sha256()
    for name in data['fingerprintFiles']:
        if include_names:
            fingerprint.update(name.encode())
        fingerprint.update((ROOT / name).read_bytes())
    if fingerprint.hexdigest() != data['fingerprint']:
        raise ValueError('Episode runtime/count sources changed before snapshot')


def main(mode):
    runtime_file = ROOT / 'analysis/personal-bots/personal-plan-runtime-audit.json'
    runtime = json.loads(runtime_file.read_bytes())
    validate_bytes(runtime, include_names=True)
    if runtime['targetMet'] or runtime['prefixes'] != 197 or runtime['probabilityDecisions'] != 152112 or runtime['methodComparisons'] != 1576:
        raise ValueError('Episode runtime parity coverage differs')
    files = set(runtime['fingerprintFiles'])
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix in ['.js', '.py', '.md'])
    files.update(['tests/t_personal_bots.js', 'analysis/personal-bots/WORK_LOG.md',
                  'analysis/personal-bots/personal-plan-runtime-audit.json', 'analysis/personal-bots/personal-plan-runtime-output.txt',
                  'analysis/personal-bots/personal-episode-feature-runtime-output.txt',
                  'analysis/personal-bots/context-tests-output.txt', 'analysis/personal-bots/progression-prospective-results.json'])
    if mode == 'terminal-memory':
        diagnostic_file = ROOT / 'analysis/personal-bots/personal-terminal-memory-audit.json'
        diagnostic = json.loads(diagnostic_file.read_bytes())
        validate_bytes(diagnostic, include_names=True)
        if diagnostic['targetMet'] or diagnostic['controlPrefixes'] != 398 or diagnostic['controlDecisions'] != 33543 or diagnostic['repairedPictures'] != 38 or diagnostic['remainingMissingPictures'] != 0:
            raise ValueError('Terminal memory repair differs from the unchanged feature/physics controls')
        files.update(diagnostic['fingerprintFiles'])
        files.update([diagnostic_file.relative_to(ROOT).as_posix(), 'analysis/personal-bots/personal-terminal-memory-output.txt',
                      'analysis/personal-bots/terminal-memory-tests-output.txt'])
    if mode == 'pilot':
        path = ROOT / 'analysis/personal-bots/personal-plan-throughput-audit.json'
        pilot = json.loads(path.read_bytes())
        validate_bytes(pilot)
        if pilot['targetMet'] or len(pilot['rows']) != 276 or pilot['controlChainsMatched'] != 828 or pilot['planRuns'] != 2 or pilot['planAttempts'] != 3:
            raise ValueError('Episode pilot cohort/control scope differs')
        files.update(pilot['fingerprintFiles'])
        files.update([path.relative_to(ROOT).as_posix(), 'analysis/personal-bots/personal-plan-throughput-output.txt',
                      'analysis/personal-bots/personal-plan-count-pilot-progress.jsonl'])
    if mode in ['full', 'censored']:
        name = 'physical-plan-censored-count-data.json' if mode == 'censored' else 'physical-plan-count-data.json'
        path = ARCHIVE / name
        data = json.loads(path.read_bytes())
        validate_bytes(data)
        if len(data['rows']) != 276 or len(data['comparisonEpisodes']) != 80 or data['controlChainsMatched'] != 828:
            raise ValueError('Episode count cohort/control scope differs')
        files.update(data['fingerprintFiles'])
        files.update([path.relative_to(ROOT).as_posix(), 'analysis/personal-bots/personal-plan-count-output.txt',
                      'analysis/personal-bots/personal-plan-count-full-progress.jsonl'])
        if mode == 'full':
            validate_plan_count(data)
            report_file = ROOT / 'analysis/personal-bots/physical-plan-count-evaluation.json'
            report = json.loads(report_file.read_bytes())
            if report['targetMet'] or not report['personalOnly'] or report['dataSha256'] != digest(path) or report['controlPredictionsMatched'] != 252 or report['coverage']['heldOutEpisodes'] != 80:
                raise ValueError('Episode count report differs from completed measurement')
            files.update([report_file.relative_to(ROOT).as_posix(), 'analysis/archive/personal-bots/physical-plan-count-scored.json',
                          'analysis/personal-bots/personal-plan-count-fit-output.txt'])
        elif data['validUncensoredSimulation'] or data['planComputationCaps'] <= 0:
            raise ValueError('Censored episode snapshot must preserve failed computation quality')
        for name in ['personal-terminal-observation', 'personal-failure-stage']:
            diagnostic_file = ROOT / ('analysis/personal-bots/' + name + '-audit.json')
            if diagnostic_file.exists():
                diagnostic = json.loads(diagnostic_file.read_bytes())
                validate_bytes(diagnostic, include_names=True)
                if diagnostic['targetMet']:
                    raise ValueError('A mechanism diagnostic cannot establish future winning-count accuracy')
                files.update(diagnostic['fingerprintFiles'])
                files.update([diagnostic_file.relative_to(ROOT).as_posix(),
                              'analysis/personal-bots/' + name + '-output.txt'])
        files.add('analysis/personal-bots/episode-tests-output.txt')
    files.update('analysis/personal-bots/' + name + '-forecasts.json' for name in
                 ['prospective', 'kind-prospective', 'count-profile-prospective', 'progression-prospective'])
    dependencies = {}
    for name in list(files):
        if '/experiments/' in name:
            dependencies[name] = digest(ROOT / name)
            files.remove(name)
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-episode-' + mode + '-' + stamp)
    folder.mkdir()
    hashes = {}
    for name in sorted(files):
        source = ROOT / name
        destination = folder / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source.read_bytes())
        hashes[name] = digest(destination)
        if hashes[name] != digest(source):
            raise ValueError('Episode source changed during snapshot')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory-episode-' + mode,
                'targetMet': False, 'winningCountMeasurement': 'historical-only' if mode == 'full' else 'not-valid-for-accuracy' if mode == 'censored' else 'not-run',
                'files': hashes, 'externalPinnedDependencies': dependencies,
                'note': 'Own-person isolated attempt preferences, declared independent-step/fixed/adaptive ablations and explicit computation censoring. '
                        'Current feature/physics parity and held likelihood match immutable source/model parents. '
                        'Pilot and censored data cannot substitute for valid full counts. Full historical counts still cannot establish genuinely frozen future80% success. '
                        'Original numeric ledgers and failed prospective cohort clocks remain unchanged.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(folder, len(files), 'pinned files,', len(dependencies), 'explicit immutable dependencies')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['runtime', 'pilot', 'full', 'censored', 'terminal-memory'])
    main(parser.parse_args().mode)
