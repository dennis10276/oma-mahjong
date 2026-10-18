import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_known_plan_run import contained
from personal_value_fit import ARCHIVE, ROOT, digest


def main(run):
    run = run.resolve()
    if not run.is_relative_to(ARCHIVE / 'runs'):
        raise ValueError('Preserve an explicitly copied local count run')
    manifest = json.loads((run / 'run-manifest.json').read_bytes())
    dependencies = {}
    for filename, expected in manifest['sourceInputs'].items():
        source = contained(run, filename)
        if digest(source) != expected:
            raise ValueError('Independent count runtime changed')
        dependencies[source.relative_to(ROOT).as_posix()] = expected
    for filename in ['run-manifest.json', 'analysis/archive/personal-bots/physical-fresh-count-data.json',
                     'analysis/personal-bots/personal-fresh-count-pilot.json',
                     'analysis/personal-bots/personal-fresh-count-pilot-output.txt',
                     'analysis/personal-bots/personal-fresh-count-full-output.txt',
                     'analysis/personal-bots/personal-fresh-count-evaluation.json']:
        source = contained(run, filename)
        dependencies[source.relative_to(ROOT).as_posix()] = digest(source)
    evaluation = json.loads((run / 'analysis/personal-bots/personal-fresh-count-evaluation.json').read_bytes())
    if evaluation['coverage']['heldRetained'] != 80 or evaluation['coverage']['heldScored'] != 80:
        raise ValueError('Fresh scoring must explicitly retain all80 original fixed target IDs')
    for name, expected in evaluation['scoringSourceHashes'].items():
        if digest(Path(__file__).parent / name) != expected:
            raise ValueError('Corrected scoring source changed after evaluation')
    audit = json.loads((ROOT / 'analysis/personal-bots/predictive-tail-audit.json').read_bytes())
    files = {path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir()
             if path.suffix in ('.py', '.js', '.md')}
    files.update(['tests/t_personal_bots.js', 'analysis/personal-bots/WORK_LOG.md',
                  'analysis/personal-bots/level150-user-clarification.json', 'analysis/personal-bots/level150-recovery.md',
                  'analysis/personal-bots/fresh-count-scorer-correction.json',
                  'analysis/personal-bots/fresh-count-environment.json',
                  'analysis/personal-bots/fresh-first-attempt-failure-audit.json',
                  'analysis/personal-bots/fresh-first-attempt-failure-output.txt',
                  'analysis/personal-bots/fresh-count-tests-output.txt', 'analysis/personal-bots/fresh-count-js-tests-output.txt',
                  'analysis/personal-bots/personal-fresh-forecasts.jsonl', 'analysis/personal-bots/fresh-count-freeze-output.txt'])
    for name, expected in audit['ledgerHashesUnchanged'].items():
        filename = 'analysis/personal-bots/' + name + '-forecasts.json'
        if digest(ROOT / filename) != expected:
            raise ValueError('An earlier numeric forecast ledger changed')
        files.add(filename)
        files.add('analysis/personal-bots/' + name + '-results.json')
    ledger = [json.loads(line) for line in (ROOT / 'analysis/personal-bots/personal-fresh-forecasts.jsonl').read_text(encoding='utf8').splitlines()]
    for snapshot in ledger:
        live = contained(ROOT, snapshot['liveSnapshot'])
        for filename in ['manifest.json', 'plays.json', 'scores.json']:
            source = live / filename
            dependencies[source.relative_to(ROOT).as_posix()] = digest(source)
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-fresh-count-scored-' + stamp)
    folder.mkdir()
    hashes = {}
    for filename in sorted(files):
        source, destination = contained(ROOT, filename), contained(folder, filename)
        expected = digest(source)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source.read_bytes())
        if digest(destination) != expected or digest(source) != expected:
            raise ValueError('Fresh count preservation changed during copying')
        hashes[filename] = expected
    (folder / 'manifest.json').write_text(json.dumps({'made': datetime.now(timezone.utc).isoformat(),
        'evidence': 'fresh-own-count-historical-evaluation-and-prospective-numeric-freeze', 'targetMet': False,
        'files': hashes, 'externalPinnedDependencies': dependencies,
        'ledgerHashesUnchanged': audit['ledgerHashesUnchanged'], 'countRun': run.relative_to(ROOT).as_posix(),
        'note': 'Original pre-pilot raw-count scorer and subsequently corrected80-target scoring source are both retained with distinct hashes. '
                'Future numeric forecasts have their actual later freeze time and live opening snapshot; no historical result proves80% future accuracy. '
                'All earlier genuine forecast misses remain unchanged. Common-memory control settings are not proven individual memory estimates.'}, indent=2), encoding='utf8')
    print(json.dumps({'folder': str(folder), 'files': len(hashes), 'dependencies': len(dependencies)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('run', type=Path)
    main(parser.parse_args().run)
