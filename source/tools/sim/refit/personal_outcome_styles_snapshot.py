import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_value_fit import ARCHIVE, ROOT, digest


PROFILES = ['ownOutcomeBase0', 'ownOutcomeStyles0']
FROZEN = ARCHIVE / 'runs/known-plan-2026-10-18T10-47-22-831Z'
PARENT = ARCHIVE / 'experiments/personal-known-plan-count-scored-2026-10-18T15-09-37-493Z'


def validate_count(data, pilot=False):
    if (data['targetMet'] or data['runs'] != (2 if pilot else 32) or data['attempts'] != (3 if pilot else 32)
            or data['controlChainsMatched'] != 276 or len(data['rows']) != 276
            or len(set(data['comparisonEpisodes'])) != 80
            or len({(row['name'], row['start']) for row in data['rows']}) != 276):
        raise ValueError('Outcome-style count evidence changed its cohort or sampling scope')
    caps = 0
    for row in data['rows']:
        counters = row['computationCaps'] if pilot else row['outcomeStyleComputationCaps']
        if set(counters) != set(PROFILES):
            raise ValueError('Outcome-style count evidence lost a paired profile')
        for profile in PROFILES:
            value = counters[profile]
            if type(value) is not int or value < 0 or row['chains'][profile].get('computationCensored', 0) != value:
                raise ValueError('Outcome-style count censoring is inconsistent')
            caps += value
    if caps or data['computationCaps'] != caps or not data['validUncensoredSimulation']:
        raise ValueError('Censored outcome-style counts cannot be scored as human failures')


def verify_fingerprint(report):
    fingerprint = hashlib.sha256()
    for name in report['fingerprintFiles']:
        fingerprint.update(name.encode())
        fingerprint.update((ROOT / name).read_bytes())
    if fingerprint.hexdigest() != report['fingerprint']:
        raise ValueError('Outcome-style declared source/input fingerprint changed')


def main(mode):
    report_file = ROOT / 'analysis/personal-bots/personal-outcome-styles-action-evaluation.json'
    runtime_file = ROOT / 'analysis/personal-bots/personal-outcome-styles-runtime-audit.json'
    model_file = ARCHIVE / 'personal-outcome-styles-models.json'
    fitted, runtime = [json.loads(path.read_bytes()) for path in [report_file, runtime_file]]
    if (fitted['targetMet'] or runtime['targetMet'] or fitted['models'] != 138
            or fitted['actionControlsMatched'] != 197 or runtime['prefixes'] != 197
            or runtime['probabilityDecisions'] != 38028 or digest(model_file) != fitted['modelsSha256']):
        raise ValueError('Outcome-style action fit lost its fixed controls')
    files = set(fitted['inputHashes']) | set(runtime['fingerprintFiles'])
    for name, expected in fitted['inputHashes'].items():
        if digest(ROOT / name) != expected:
            raise ValueError('Outcome-style immutable fitting input changed')
    for name, expected in fitted['fitSourceHashes'].items():
        if digest(Path(__file__).with_name(name)) != expected:
            raise ValueError('Outcome-style fitting source changed')
    verify_fingerprint(runtime)
    closure_file = FROZEN / 'run-manifest.json'
    closure = json.loads(closure_file.read_bytes())
    files.add(closure_file.relative_to(ROOT).as_posix())
    for name, expected in closure['sourceInputs'].items():
        path = FROZEN / name
        if digest(path) != expected:
            raise ValueError('Outcome-style frozen board reconstruction dependency changed')
        files.add(path.relative_to(ROOT).as_posix())
    parent_manifest = json.loads((PARENT / 'manifest.json').read_bytes())
    files.add((PARENT / 'manifest.json').relative_to(ROOT).as_posix())
    for name in ['analysis/archive/personal-bots/physical-known-plan-count-data.json',
                 'analysis/archive/personal-bots/physical-known-plan-count-scored.json']:
        path = PARENT / name
        if digest(path) != parent_manifest['files'][name]:
            raise ValueError('Outcome-style fixed count parent changed')
        files.add(path.relative_to(ROOT).as_posix())
    if mode != 'actions':
        count_file = (ROOT / 'analysis/personal-bots/personal-outcome-styles-count-pilot.json' if mode == 'pilot'
                      else ARCHIVE / 'physical-outcome-styles-count-data.json')
        counts = json.loads(count_file.read_bytes())
        validate_count(counts, mode == 'pilot')
        verify_fingerprint(counts)
        files.update(counts['fingerprintFiles'])
        files.add(count_file.relative_to(ROOT).as_posix())
        if mode == 'scored':
            score_file = ROOT / 'analysis/personal-bots/physical-outcome-styles-count-evaluation.json'
            score = json.loads(score_file.read_bytes())
            if score['targetMet'] or score['dataSha256'] != digest(count_file) or score['controlChainsMatched'] != 276:
                raise ValueError('Outcome-style scored evidence differs from uncensored counts')
            for name, expected in score['scoringSourceHashes'].items():
                if digest(Path(__file__).with_name(name)) != expected:
                    raise ValueError('Outcome-style scoring source changed')
            files.update([score_file.relative_to(ROOT).as_posix(),
                          'analysis/archive/personal-bots/physical-outcome-styles-count-scored.json',
                          'analysis/personal-bots/personal-outcome-styles-count-fit-output.txt'])
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir()
                 if path.suffix in ['.js', '.py', '.md'])
    files.update(path.relative_to(ROOT).as_posix() for path in (Path(__file__).parent / 'fixtures').glob('*.json'))
    files.update([path.relative_to(ROOT).as_posix() for path in [report_file, runtime_file, model_file]])
    files.update(['www/hard.js', 'www/layouts.js', 'tests/t_personal_bots.js',
                  'analysis/personal-bots/personal-outcome-styles-fit-output.txt',
                  'analysis/personal-bots/personal-outcome-styles-runtime-output.txt',
                  'analysis/personal-bots/outcome-styles-tests-output.txt', 'analysis/personal-bots/WORK_LOG.md'])
    dependencies = {name: digest(ROOT / name) for name in files if '/experiments/' in name or '/runs/' in name}
    files.difference_update(dependencies)
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-outcome-styles-' + mode + '-' + stamp)
    folder.mkdir()
    hashes = {}
    for name in sorted(files):
        destination = folder / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((ROOT / name).read_bytes())
        hashes[name] = digest(destination)
        if hashes[name] != digest(ROOT / name):
            raise ValueError('Outcome-style checkpoint changed during preservation')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'mode': mode, 'targetMet': False,
                'evidence': 'historical-exploratory-outcome-styles-' + mode, 'files': hashes,
                'externalPinnedDependencies': dependencies,
                'note': 'All138 own actors/197 controls/38028 native-runtime probability decisions retained. '
                    'Natural outcome labels anchor earlier training only; simulated style is never guaranteed to win. '
                    'The frozen reconstruction closure retains276 boards/80 held progression IDs. '
                    'Pilot evidence cannot score winning attempts. Full historical counts do not establish prospective80%.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({'folder': str(folder), 'files': len(hashes), 'dependencies': len(dependencies)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['actions', 'pilot', 'counts', 'scored'])
    main(parser.parse_args().mode)
