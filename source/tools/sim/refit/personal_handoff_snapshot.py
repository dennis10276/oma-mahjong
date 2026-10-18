import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_known_plan_run import contained
from personal_value_fit import ARCHIVE, ROOT, digest


def main(mode):
    model_file = ARCHIVE / 'personal-handoff-models.json'
    native_file = ARCHIVE / 'personal-handoff-native.json'
    runtime_file = ROOT / 'analysis/personal-bots/handoff-runtime-audit.json'
    first_file = ROOT / 'analysis/personal-bots/handoff-first-audit.json'
    counts_file = ARCHIVE / 'personal-handoff-count-data.json'
    score_file = ROOT / 'analysis/personal-bots/handoff-count-evaluation.json'
    live_score_file = ROOT / 'analysis/personal-bots/personal-fresh-prospective-results.json'
    bank, runtime, first, live_score = [json.loads(path.read_bytes())
        for path in (model_file, runtime_file, first_file, live_score_file)]
    counts = json.loads(counts_file.read_bytes()) if mode != 'first' else None
    if (runtime['modelsSha256'] != digest(model_file) or runtime['nativeSha256'] != digest(native_file)
            or runtime['prefixes'] != 445 or runtime['decisions'] != 39268 or len(bank['models']) != 33
            or first['resultControls'] != 29 or first['firstDivergenceCueControls'] != 928
            or counts is not None and (counts['pairedPilotChainsMatched'] != 58 or counts['firstAttemptRateControls'] != 58)):
        raise ValueError('Handoff preservation lost complete fit/numerical/physical/chain controls')
    if (mode == 'first' and first['computationCaps']
            or mode == 'full' and (counts['computationCaps'] or first['computationCaps'])
            or mode == 'censored' and not (counts['computationCaps'] or first['computationCaps'])):
        raise ValueError('Use explicit censored preservation for computation-limited diagnostics')
    declared = {**bank['inputHashes'], **runtime['sourceHashes'], **first['sourceHashes']}
    if counts is not None:
        declared.update(counts['sourceHashes'])
    declared.update({'tools/sim/refit/' + name: expected for name, expected in bank['sourceHashes'].items()})
    files, dependencies = set(), {}
    if mode == 'full':
        score = json.loads(score_file.read_bytes())
        if score['dataSha256'] != digest(counts_file) or score['coverage']['fixedTargets'] != 29:
            raise ValueError('Handoff count diagnostic does not match its complete frozen measurement')
        declared.update({'tools/sim/refit/' + name: expected for name, expected in score['scoringSourceHashes'].items()})
        files.add(score_file.relative_to(ROOT).as_posix())
    for name, expected in declared.items():
        source = contained(ROOT, name)
        if digest(source) != expected:
            raise ValueError('Handoff source/input changed: ' + name)
        if '/experiments/' in name or '/runs/' in name:
            dependencies[name] = expected
        else:
            files.add(name)
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix in ('.py', '.js', '.md'))
    files.update(path.relative_to(ROOT).as_posix() for path in (Path(__file__).parent / 'fixtures').glob('*.json'))
    files.update(path.relative_to(ROOT).as_posix() for path in (model_file, native_file, runtime_file, first_file, live_score_file))
    if counts is not None:
        files.add(counts_file.relative_to(ROOT).as_posix())
    files.update(['tests/t_personal_bots.js', 'analysis/personal-bots/WORK_LOG.md',
        'analysis/personal-bots/personal-fresh-forecasts.jsonl'])
    stages = ['fit', 'native', 'runtime', 'first', 'count-pilot', 'tests', 'js-tests', 'live-score', 'diff-check']
    if counts is not None:
        stages += ['count-full', 'count-score']
    for stage in stages:
        files.add('analysis/personal-bots/handoff-' + stage + '-output.txt')
    for stage in ['fit', 'first', 'count-pilot'] + (['count-full'] if counts is not None else []):
        files.add('analysis/personal-bots/handoff-' + stage + '-progress.jsonl')
    outcomes = Path(live_score['outcomesFile']).resolve()
    if not outcomes.is_relative_to(ARCHIVE) or digest(outcomes) != live_score['outcomesSha256']:
        raise ValueError('Live outcome source changed or escaped the archive')
    for name in ('personal-outcomes.json', 'manifest.json', 'plays.json', 'scores.json'):
        files.add((outcomes.parent / name).relative_to(ROOT).as_posix())
    parent_file = ROOT / bank['baseSnapshot'] / 'manifest.json'
    parent = json.loads(parent_file.read_bytes())
    dependencies[parent_file.relative_to(ROOT).as_posix()] = digest(parent_file)
    ledger = ROOT / 'analysis/personal-bots/personal-fresh-forecasts.jsonl'
    if digest(ledger) != parent['experimentalNumericLedgerUnchanged'] or digest(ledger) != live_score['ledgerSha256']:
        raise ValueError('Existing experimental numeric predictions changed')
    for name, expected in parent['ledgerHashesUnchanged'].items():
        filename = 'analysis/personal-bots/' + name + '-forecasts.json'
        if digest(ROOT / filename) != expected:
            raise ValueError('An original numeric forecast ledger changed')
        files.add(filename)
        files.add('analysis/personal-bots/' + name + '-results.json')
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-handoff-' + mode + '-' + stamp)
    folder.mkdir()
    copied = {}
    for name in sorted(files):
        source, destination = contained(ROOT, name), contained(folder, name)
        expected = digest(source)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source.read_bytes())
        if digest(source) != expected or digest(destination) != expected:
            raise ValueError('Handoff source changed during preservation')
        copied[name] = expected
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'own-conditional-handoff-' + mode,
        'targetMet': False, 'files': copied, 'externalPinnedDependencies': dependencies,
        'actualFitRequest': bank['actualFitRequest'], 'actualModelReadyAt': bank['made'],
        'wholeCountMeasurementIncluded': counts is not None,
        'ledgerHashesUnchanged': parent['ledgerHashesUnchanged'], 'experimentalNumericLedgerUnchanged': digest(ledger),
        'regressionFixturesAreNotFittingLabels': True,
        'note': '33 separately fitted handoff heads,445 numerical prefix controls and29 paired initial diagnostics. '
                'Whole retry chains are included only when wholeCountMeasurementIncluded is true; live computation outputs are not snapshotted as finished. '
                'Better held recorded-choice likelihood did not improve initial autonomous wins; no promotion. '
                'Whole-count diagnostics remain historical client-time evidence, not genuine pre-opening accuracy. '
                'No existing numeric forecast or miss is reset, including newly observed first-clear campaigns. '
                'Runtime and actual fitting bytes are copied; immutable ancestor inputs remain hash-pinned dependencies, '
                'not a claim of copying every transitive ancestor file. No80% success is established.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
    print(json.dumps({'folder': str(folder), 'files': len(copied), 'dependencies': len(dependencies)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['first', 'full', 'censored'])
    main(parser.parse_args().mode)
