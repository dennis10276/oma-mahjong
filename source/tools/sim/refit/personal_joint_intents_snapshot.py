import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_known_plan_run import contained
from personal_value_fit import ARCHIVE, ROOT, digest


def main(mode):
    model_file = ARCHIVE / 'personal-tray-intents-models.json'
    runtime_file = ROOT / 'analysis/personal-bots/joint-intents-runtime-audit.json'
    native_file = ARCHIVE / 'personal-joint-intents-native.json'
    bank, runtime = [json.loads(path.read_bytes()) for path in (model_file, runtime_file)]
    if (len(bank['models']) != 33 or runtime['modelsSha256'] != digest(model_file)
            or runtime['nativeSha256'] != digest(native_file) or runtime['prefixes'] != 445 or runtime['decisions'] != 39268):
        raise ValueError('Joint intent preservation lost complete model/runtime controls')
    data = json.loads((ROOT / bank['dataFile']).read_bytes())
    feature_parent = ARCHIVE / 'experiments/personal-tray-intents-features-2026-10-18T20-24-17-195Z'
    feature_manifest_file = feature_parent / 'manifest.json'
    feature_manifest = json.loads(feature_manifest_file.read_bytes())
    dependencies = {feature_manifest_file.relative_to(ROOT).as_posix(): digest(feature_manifest_file)}
    aliases, files = {}, set()
    declared = {**bank['inputHashes'], **data['sourceHashes'], **runtime['sourceHashes']}
    declared.update({'tools/sim/refit/' + name: expected for name, expected in bank['sourceHashes'].items()})
    first = None
    if mode != 'actions':
        first_file = ROOT / 'analysis/personal-bots/joint-intents-first-audit.json'
        first = json.loads(first_file.read_bytes())
        if first['exactFirstAttemptResultControls'] != 29:
            raise ValueError('Joint initial-play diagnosis dropped a fixed recent target')
        input_data = json.loads((ARCHIVE / 'personal-fresh-count-input.json').read_bytes())
        expected = 32 * sum(row['game']['clock'] is not None for row in input_data['recent'])
        if first['matchedClockPrefixPairs'] != expected:
            raise ValueError('Joint initial-play diagnosis lost exact active-clock prefix pairs')
        if (mode == 'first' and first['computationCaps'] != 0) or (mode == 'censored' and first['computationCaps'] == 0):
            raise ValueError('Use explicit censored preservation for computation-limited simulations')
        declared.update(first['sourceHashes'])
        files.update([first_file.relative_to(ROOT).as_posix(), 'analysis/personal-bots/joint-intents-first-output.txt'])
    for name, expected in declared.items():
        source = contained(ROOT, name)
        if digest(source) != expected:
            raise ValueError('Joint intent source/input changed: ' + name)
        if '/experiments/' in name or '/runs/' in name:
            dependencies[name] = expected
        elif name.startswith('tools/') or name.startswith('www/'):
            files.add(name)
        elif feature_manifest['files'].get(name) == expected:
            pinned = feature_parent / name
            if digest(pinned) != expected:
                raise ValueError('Frozen tray feature parent changed')
            resolved = pinned.relative_to(ROOT).as_posix()
            aliases[name] = resolved
            dependencies[resolved] = expected
        else:
            files.add(name)
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix in ('.py', '.js', '.md'))
    files.update(path.relative_to(ROOT).as_posix() for path in (Path(__file__).parent / 'fixtures').glob('*.json'))
    files.update(path.relative_to(ROOT).as_posix() for path in (model_file, runtime_file, native_file))
    files.update(['tests/t_personal_bots.js', 'analysis/personal-bots/WORK_LOG.md',
                  'analysis/personal-bots/tray-intents-fit-output.txt', 'analysis/personal-bots/joint-intents-native-output.txt',
                  'analysis/personal-bots/joint-intents-runtime-output.txt', 'analysis/personal-bots/joint-intents-tests-output.txt',
                  'analysis/personal-bots/joint-intents-js-tests-output.txt', 'analysis/personal-bots/personal-fresh-forecasts.jsonl',
                  'analysis/personal-bots/personal-fresh-prospective-results.json'])
    files.update(['analysis/personal-bots/handoff-gap-audit.json', 'analysis/personal-bots/handoff-gap-output.txt'])
    parent = ARCHIVE / 'experiments/personal-clock-intents-actions-2026-10-18T20-14-16-102Z/manifest.json'
    previous = json.loads(parent.read_bytes())
    dependencies[parent.relative_to(ROOT).as_posix()] = digest(parent)
    forecast_file = ROOT / 'analysis/personal-bots/personal-fresh-forecasts.jsonl'
    if digest(forecast_file) != previous['experimentalNumericLedgerUnchanged']:
        raise ValueError('Existing experimental numeric forecasts changed')
    for name, expected in previous['ledgerHashesUnchanged'].items():
        filename = 'analysis/personal-bots/' + name + '-forecasts.json'
        if digest(ROOT / filename) != expected:
            raise ValueError('An original numeric forecast ledger changed')
        files.add(filename)
        files.add('analysis/personal-bots/' + name + '-results.json')
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-joint-intents-' + mode + '-' + stamp)
    folder.mkdir()
    copied = {}
    for filename in sorted(files):
        source, destination = contained(ROOT, filename), contained(folder, filename)
        expected = digest(source)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source.read_bytes())
        if digest(source) != expected or digest(destination) != expected:
            raise ValueError('Joint intent source changed during preservation')
        copied[filename] = expected
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'own-joint-clock-tray-intents-' + mode,
        'targetMet': False, 'files': copied, 'externalPinnedDependencies': dependencies, 'resolvedPinnedInputs': aliases,
        'actualFitRequest': bank['actualFitRequest'], 'actualModelReadyAt': bank['made'],
        'ledgerHashesUnchanged': previous['ledgerHashesUnchanged'], 'experimentalNumericLedgerUnchanged': digest(forecast_file),
        'regressionFixturesAreNotFittingLabels': True,
        'note': 'Exact fitting bytes retain their original logical paths; resolvedPinnedInputs explicitly maps unchanged large inputs '
            'to the already immutable feature checkpoint, avoiding duplicate raw exports. Runtime sources and fitted models are copied here. '
            'Training parity/initial survival do not establish whole winning-attempt accuracy or80% prospective success. '
            'Clock-prefix hashes cover only actual active-clock taps; result controls do not prove complete post-clock path equality. '
            'Any computation cap is censoring, never a human loss. Existing numeric forecasts/misses remain unchanged.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
    print(json.dumps({'folder': str(folder), 'files': len(copied), 'dependencies': len(dependencies), 'resolvedInputs': len(aliases)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['actions', 'first', 'censored'])
    main(parser.parse_args().mode)
