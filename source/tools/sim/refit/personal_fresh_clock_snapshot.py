import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    data_file = ARCHIVE / 'personal-fresh-clock-prefixes.json'
    model_file = ARCHIVE / 'personal-fresh-clock-models.json'
    native_file = ARCHIVE / 'personal-fresh-clock-native.json'
    runtime_file = ROOT / 'analysis/personal-bots/fresh-clock-runtime-audit.json'
    first_file = ROOT / 'analysis/personal-bots/fresh-clock-first-audit.json'
    data, bank, runtime, first = [json.loads(path.read_bytes()) for path in (data_file, model_file, runtime_file, first_file)]
    if (bank['dataSha256'] != digest(data_file) or runtime['modelsSha256'] != digest(model_file)
            or runtime['dataSha256'] != digest(data_file) or runtime['nativeSha256'] != digest(native_file)
            or runtime['prefixes'] != 445 or runtime['decisions'] != 39268
            or first['exactFirstAttemptControls'] != 29 or first['computationCaps'] != 0):
        raise ValueError('Fresh clock preservation lost its full parity or first-attempt controls')
    files, dependencies = set(), {}
    declared = {**data['sourceHashes'], **bank['inputHashes'], **runtime['sourceHashes'], **first['sourceHashes']}
    declared.update({'tools/sim/refit/' + name: expected for name, expected in bank['sourceHashes'].items()})
    for name, expected in declared.items():
        if digest(ROOT / name) != expected:
            raise ValueError('Fresh clock source/input changed: ' + name)
        if '/experiments/' in name or '/runs/' in name:
            dependencies[name] = expected
        else:
            files.add(name)
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix in ('.py', '.js', '.md'))
    files.update(path.relative_to(ROOT).as_posix() for path in (data_file, model_file, native_file, runtime_file, first_file))
    files.update(['tests/t_personal_bots.js', 'analysis/personal-bots/WORK_LOG.md',
                  'analysis/personal-bots/fresh-clock-data-output.txt', 'analysis/personal-bots/fresh-clock-fit-output.txt',
                  'analysis/personal-bots/fresh-clock-native-output.txt', 'analysis/personal-bots/fresh-clock-runtime-output.txt',
                  'analysis/personal-bots/fresh-clock-first-output.txt', 'analysis/personal-bots/fresh-clock-tests-output.txt',
                  'analysis/personal-bots/fresh-clock-js-tests-output.txt', 'analysis/personal-bots/personal-fresh-forecasts.jsonl'])
    forecast_parent = ARCHIVE / 'experiments/personal-fresh-count-scored-2026-10-18T16-19-59-198Z'
    forecast_manifest = forecast_parent / 'manifest.json'
    forecast_name = 'analysis/personal-bots/personal-fresh-forecasts.jsonl'
    forecast_hash = json.loads(forecast_manifest.read_bytes())['files'][forecast_name]
    if digest(ROOT / forecast_name) != forecast_hash:
        raise ValueError('Fresh clock research changed existing experimental numeric forecasts')
    dependencies[forecast_manifest.relative_to(ROOT).as_posix()] = digest(forecast_manifest)
    older = ARCHIVE / 'experiments/personal-clock-strategy-actions-2026-10-18T11-30-12-648Z'
    old_name = 'analysis/archive/personal-bots/personal-clock-strategy-models.json'
    old_file = older / old_name
    old_manifest = json.loads((older / 'manifest.json').read_bytes())
    if digest(old_file) != old_manifest['files'][old_name]:
        raise ValueError('Old clock membership controls changed')
    dependencies[old_file.relative_to(ROOT).as_posix()] = digest(old_file)
    old_models = json.loads(old_file.read_bytes())['models']
    unchanged = {}
    for entry in bank['models']:
        if entry['historicalExploratoryOnly']:
            continue
        model = entry['clockStrategy']
        previous = [item['clockStrategy'] for item in old_models if item['name'] == entry['name']
                    and item['clockStrategy']['trainedAids'] == model['trainedAids']]
        if previous:
            difference = max(float(np.max(np.abs(np.asarray(model[key]) - previous[0][key]))) for key in ('weights', 'switchWeights', 'priors'))
            if difference > 1e-12:
                raise ValueError('Unchanged own clock training membership changed its control parameters')
            unchanged[entry['name']] = difference
    if set(unchanged) != {'Mrs. Doubtfire', 'PUK'}:
        raise ValueError('Fresh clock preservation lost its two unchanged-person controls')
    ledgers = json.loads((ROOT / 'analysis/personal-bots/predictive-tail-audit.json').read_bytes())['ledgerHashesUnchanged']
    for name, expected in ledgers.items():
        filename = 'analysis/personal-bots/' + name + '-forecasts.json'
        if digest(ROOT / filename) != expected:
            raise ValueError('Earlier numeric forecast ledger changed')
        files.add(filename)
        files.add('analysis/personal-bots/' + name + '-results.json')
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-fresh-clock-actions-' + stamp)
    folder.mkdir()
    copied = {}
    for filename in sorted(files):
        source, destination = ROOT / filename, folder / filename
        expected = digest(source)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source.read_bytes())
        if digest(source) != expected or digest(destination) != expected:
            raise ValueError('Fresh clock source changed during preservation')
        copied[filename] = expected
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'fresh-own-clock-actions-and-first-attempt-diagnosis',
                'targetMet': False, 'files': copied, 'externalPinnedDependencies': dependencies,
                'unchangedPersonParameterControls': unchanged, 'ledgerHashesUnchanged': ledgers,
                'experimentalNumericLedgerUnchanged': forecast_hash,
                'actualClockFitRequest': bank['actualFitRequest'], 'actualClockModelReadyAt': bank['made'],
                'note': 'All445 exact annotated versions,33 independently own-person fits, full native/runtime parity and29 first-attempt controls. '
                    'Original static actor source stays pinned separately. Full winning-attempt simulations are not yet measured for this new clock fit. '
                    'Existing prospective numbers/misses are retained, never overwritten. No80% success or promotion is established.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
    print(json.dumps({'folder': str(folder), 'files': len(copied), 'dependencies': len(dependencies),
                      'unchangedPersonControls': unchanged}, indent=2))


if __name__ == '__main__':
    main()
