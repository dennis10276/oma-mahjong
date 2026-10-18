import json
from datetime import datetime, timezone
from pathlib import Path

from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    model_file = ARCHIVE / 'personal-clock-intents-models.json'
    native_file = ARCHIVE / 'personal-clock-intents-native.json'
    runtime_file = ROOT / 'analysis/personal-bots/clock-intents-runtime-audit.json'
    first_file = ROOT / 'analysis/personal-bots/clock-intents-first-audit.json'
    score_file = ROOT / 'analysis/personal-bots/personal-fresh-prospective-results.json'
    bank, native, runtime, first, score = [json.loads(path.read_bytes()) for path in (model_file, native_file, runtime_file, first_file, score_file)]
    if (len(bank['models']) != 33 or runtime['modelsSha256'] != digest(model_file) or native['modelsSha256'] != digest(model_file)
            or runtime['nativeSha256'] != digest(native_file) or runtime['prefixes'] != 445 or runtime['decisions'] != 39268
            or first['exactFirstAttemptControls'] != 29 or first['computationCaps'] != 0):
        raise ValueError('Persistent intent preservation lost its complete numerical/result controls')
    if (first['summaries']['Dennisisdebeste']['ownIntentZero']['wins'] != 31
            or first['summaries']['Dennisisdebeste']['ownClockIntents']['wins'] != 53):
        raise ValueError('Persistent intent first-attempt diagnostic results changed')
    files, dependencies = set(), {}
    declared = {**bank['inputHashes'], **runtime['sourceHashes'], **first['sourceHashes']}
    declared.update({'tools/sim/refit/' + name: expected for name, expected in bank['sourceHashes'].items()})
    for name, expected in declared.items():
        source = ROOT / name
        if digest(source) != expected:
            raise ValueError('Persistent intent input/source changed: ' + name)
        if '/experiments/' in name or '/runs/' in name:
            dependencies[name] = expected
        else:
            files.add(name)
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix in ('.py', '.js', '.md'))
    files.update(path.relative_to(ROOT).as_posix() for path in (model_file, native_file, runtime_file, first_file, score_file))
    files.update(['tests/t_personal_bots.js', 'analysis/personal-bots/WORK_LOG.md',
                  'analysis/personal-bots/clock-intents-fit-output.txt', 'analysis/personal-bots/clock-intents-native-output.txt',
                  'analysis/personal-bots/clock-intents-runtime-output.txt', 'analysis/personal-bots/clock-intents-first-output.txt',
                  'analysis/personal-bots/clock-intents-tests-output.txt', 'analysis/personal-bots/clock-intents-js-tests-output.txt',
                  'analysis/personal-bots/clock-intents-live-score-output.txt', 'analysis/personal-bots/personal-fresh-forecasts.jsonl'])
    outcomes = Path(score['outcomesFile']).resolve()
    if not outcomes.is_relative_to(ARCHIVE) or digest(outcomes) != score['outcomesSha256']:
        raise ValueError('Live prospective scoring source changed or escaped the local archive')
    for filename in ('personal-outcomes.json', 'manifest.json', 'plays.json', 'scores.json'):
        files.add((outcomes.parent / filename).relative_to(ROOT).as_posix())
    forecast_name = 'analysis/personal-bots/personal-fresh-forecasts.jsonl'
    parent_manifest = ARCHIVE / 'experiments/personal-fresh-clock-actions-2026-10-18T16-30-12-344Z/manifest.json'
    parent = json.loads(parent_manifest.read_bytes())
    dependencies[parent_manifest.relative_to(ROOT).as_posix()] = digest(parent_manifest)
    if digest(ROOT / forecast_name) != parent['experimentalNumericLedgerUnchanged'] or digest(ROOT / forecast_name) != score['ledgerSha256']:
        raise ValueError('Existing95 experimental numeric predictions changed')
    for name, expected in parent['ledgerHashesUnchanged'].items():
        filename = 'analysis/personal-bots/' + name + '-forecasts.json'
        if digest(ROOT / filename) != expected:
            raise ValueError('An original numeric prediction ledger changed')
        files.add(filename)
        files.add('analysis/personal-bots/' + name + '-results.json')
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-clock-intents-actions-' + stamp)
    folder.mkdir()
    copied = {}
    for filename in sorted(files):
        source, destination = ROOT / filename, folder / filename
        expected = digest(source)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source.read_bytes())
        if digest(source) != expected or digest(destination) != expected:
            raise ValueError('Persistent intent source changed during preservation')
        copied[filename] = expected
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'own-persistent-clock-intents-actions-and-first-attempt-diagnosis',
        'targetMet': False, 'files': copied, 'externalPinnedDependencies': dependencies,
        'actualIntentFitRequest': bank['actualFitRequest'], 'actualIntentReadyAt': bank['made'],
        'ledgerHashesUnchanged': parent['ledgerHashesUnchanged'], 'experimentalNumericLedgerUnchanged': digest(ROOT / forecast_name),
        'firstAttemptControlScope': '29 exact arrays of win/why/left/moves result records; full tap logs were not retained. '
            'The first-audit note’s word trajectories must not be read as proof of identical full tap paths.',
        'note': '33 own-person intent fits,445 training-prefix numerical controls and29 first-attempt result controls. '
            'Clock failures improve but tray failures remain; full winning-attempt chains and80% prospective accuracy are not established. '
            'No existing numeric forecast is replaced, including already-open151 and the newly observed Mrs105 miss. '
            'Referenced parent artifacts are hash-pinned; this is not a claim of copying every transitive parent experiment file.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
    print(json.dumps({'folder': str(folder), 'files': len(copied), 'dependencies': len(dependencies)}, indent=2))


if __name__ == '__main__':
    main()
