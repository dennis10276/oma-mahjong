import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_known_plan_run import contained
from personal_value_fit import ARCHIVE, ROOT, digest


def main(mode):
    model_file = ARCHIVE / 'personal-recall-models.json'
    prepared_file = ARCHIVE / 'personal-recall-prefix-data.json'
    native_file = ARCHIVE / 'personal-recall-native.json'
    runtime_file = ROOT / 'analysis/personal-bots/recall-runtime-audit.json'
    fast_file = ROOT / 'analysis/personal-bots/clock-fast-audit.json'
    pilot_file = ROOT / 'analysis/personal-bots/recall-count-pilot.json'
    model, prepared, runtime, fast, pilot = [json.loads(path.read_bytes())
        for path in (model_file, prepared_file, runtime_file, fast_file, pilot_file)]
    if (len(model['models']) != 24 or runtime['modelsSha256'] != digest(model_file)
            or runtime['nativeSha256'] != digest(native_file) or runtime['preparedSha256'] != digest(prepared_file)
            or runtime['futureTrainingPrefixes'] != 1335 or runtime['blockedCalibrationPrefixes'] != 240
            or runtime['probabilityDecisions'] != 143412 or fast['prefixes'] != 445 or fast['decisions'] != 39268
            or fast['exactAutonomousPathPairs'] != 6 or pilot['computationCaps'] != 0
            or pilot['originalConfiguredPilotControls'] != 29 or len(pilot['rows']) != 29):
        raise ValueError('Recall preservation lost complete own fit/numerical/physics/search/pilot controls')
    declared = {**model['inputHashes'], **prepared['sourceHashes'], **runtime['sourceHashes'], **fast['sourceHashes'], **pilot['sourceHashes']}
    declared.update({'tools/sim/refit/' + name: expected for name, expected in model['sourceHashes'].items()})
    files, dependencies, aliases = set(), {}, {}
    if mode != 'pilot':
        counts_file = ARCHIVE / 'personal-recall-count-data.json'
        counts = json.loads(counts_file.read_bytes())
        if counts['pairedPilotChainsMatched'] != 58 or counts['firstAttemptRateControls'] != 29 or len(counts['rows']) != 29:
            raise ValueError('Recall whole-count stage lost paired pilot/initial controls')
        if mode == 'full' and counts['computationCaps'] or mode == 'censored' and not counts['computationCaps']:
            raise ValueError('Preserve computational censoring explicitly')
        declared.update(counts['sourceHashes'])
        files.add(counts_file.relative_to(ROOT).as_posix())
        files.update(['analysis/personal-bots/recall-count-full-output.txt', 'analysis/personal-bots/recall-count-full-progress.jsonl',
                      'analysis/personal-bots/recall-count-score-output.txt'])
        if mode == 'full':
            evaluation_file = ROOT / 'analysis/personal-bots/recall-count-evaluation.json'
            evaluation = json.loads(evaluation_file.read_bytes())
            if evaluation['dataSha256'] != digest(counts_file) or evaluation['coverage']['fixedTargets'] != 29:
                raise ValueError('Recall count evaluation does not match actual complete measurement')
            declared.update({'tools/sim/refit/' + name: expected for name, expected in evaluation['scoringSourceHashes'].items()})
            files.add(evaluation_file.relative_to(ROOT).as_posix())
            if evaluation['baselineFile'] is not None:
                source = Path(evaluation['baselineFile']).resolve()
                if not source.is_relative_to(ARCHIVE) or digest(source) != evaluation['baselineSha256']:
                    raise ValueError('Configured full baseline changed or escaped the archive')
                files.add(source.relative_to(ROOT).as_posix())
    feature_parent = ARCHIVE / 'experiments/personal-tray-intents-features-2026-10-18T20-24-17-195Z'
    feature_manifest = json.loads((feature_parent / 'manifest.json').read_bytes())
    dependencies[(feature_parent / 'manifest.json').relative_to(ROOT).as_posix()] = digest(feature_parent / 'manifest.json')
    for name, expected in declared.items():
        source = contained(ROOT, name)
        if digest(source) != expected:
            raise ValueError('Recall source/input changed: ' + name)
        if '/experiments/' in name or '/runs/' in name:
            dependencies[name] = expected
        elif (name.startswith('analysis/archive/realdata/') or name.startswith('analysis/archive/replays/')) and feature_manifest['files'].get(name) == expected:
            pinned = feature_parent / name
            if digest(pinned) != expected:
                raise ValueError('Pinned natural recording source changed')
            aliases[name] = pinned.relative_to(ROOT).as_posix()
            dependencies[aliases[name]] = expected
        else:
            files.add(name)
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix in ('.py', '.js', '.md'))
    files.update(path.relative_to(ROOT).as_posix() for path in (Path(__file__).parent / 'fixtures').glob('*.json'))
    files.update(path.relative_to(ROOT).as_posix() for path in (model_file, prepared_file, native_file, runtime_file, fast_file, pilot_file))
    files.update(['tests/t_personal_bots.js', 'analysis/personal-bots/WORK_LOG.md',
                  'analysis/personal-bots/recall-coverage-audit.json', 'analysis/personal-bots/retry-cycle-probe.json'])
    for stage in ('recall-coverage', 'recall-prepare', 'recall-fit', 'recall-native', 'recall-runtime', 'retry-cycle-probe',
                  'clock-fast-audit', 'clock-fast-tests', 'clock-fast-js-tests', 'recall-count-pilot'):
        files.add('analysis/personal-bots/' + stage + '-output.txt')
    files.update(['analysis/personal-bots/recall-fit-progress.jsonl', 'analysis/personal-bots/recall-count-pilot-progress.jsonl'])
    handoff = json.loads((ARCHIVE / 'personal-handoff-models.json').read_bytes())
    parent_file = ROOT / handoff['baseSnapshot'] / 'manifest.json'
    parent = json.loads(parent_file.read_bytes())
    dependencies[parent_file.relative_to(ROOT).as_posix()] = digest(parent_file)
    ledger = ROOT / 'analysis/personal-bots/personal-fresh-forecasts.jsonl'
    if digest(ledger) != parent['experimentalNumericLedgerUnchanged']:
        raise ValueError('Existing experimental numeric forecasts changed')
    files.add(ledger.relative_to(ROOT).as_posix())
    for name, expected in parent['ledgerHashesUnchanged'].items():
        filename = 'analysis/personal-bots/' + name + '-forecasts.json'
        if digest(ROOT / filename) != expected:
            raise ValueError('An original numeric forecast ledger changed')
        files.add(filename)
        files.add('analysis/personal-bots/' + name + '-results.json')
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-consistent-recall-' + mode + '-' + stamp)
    folder.mkdir()
    copied = {}
    for name in sorted(files):
        source, destination = contained(ROOT, name), contained(folder, name)
        expected = digest(source)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source.read_bytes())
        if digest(source) != expected or digest(destination) != expected:
            raise ValueError('Recall source changed during preservation')
        copied[name] = expected
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'targetMet': False, 'evidence': 'own-consistent-recall-and-exact-cached-clock-' + mode,
        'files': copied, 'externalPinnedDependencies': dependencies, 'resolvedPinnedInputs': aliases,
        'actualFitRequest': model['actualFitRequest'], 'actualModelReadyAt': model['made'], 'wholeCountMeasurementIncluded': mode != 'pilot',
        'ledgerHashesUnchanged': parent['ledgerHashesUnchanged'], 'experimentalNumericLedgerUnchanged': digest(ledger),
        'note': 'Separate own recall fits/calibration and numerical references; exact clock search and autonomous path parity; paired lifecycle controls. '
                'Recall alternatives are hypotheses, not measured human memory. Fixed zero recall historical counts are post-hoc exploratory, not pre-opening held accuracy. '
                'Only completed stage outputs are copied; live full-count output is not represented as finished. '
                'Original numeric forecasts/misses stay unchanged. No80% success is established. '
                'Current source bytes include post-769e6b7 research changes; this manifest, not that Git checkpoint alone, binds these runtime files.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
    print(json.dumps({'folder': str(folder), 'files': len(copied), 'dependencies': len(dependencies), 'resolvedInputs': len(aliases)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['pilot', 'full', 'censored'])
    main(parser.parse_args().mode)
