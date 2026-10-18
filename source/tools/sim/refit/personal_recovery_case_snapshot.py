import json
from datetime import datetime, timezone
from pathlib import Path

from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    report_file = ROOT / 'analysis/personal-bots/personal-recovery-level150.json'
    report = json.loads(report_file.read_bytes())
    bee = report['beeDeferral']
    if (report['targetMet'] or report['evidence'] != 'retrospective-public-recovery-case'
            or report['exactPhysicalFrameControls'] != 209 or bee['exactCounterfactualPhysicsControls'] != 209
            or bee['originalManualTaps'] != bee['counterfactualManualTaps']
            or not all(bee[key] for key in ['finalAliveIdentical', 'finalTrayIdentical', 'finalMovesIdentical'])
            or bee['originalWindowMaximumTray'] != 3 or bee['counterfactualWindowMaximumTray'] != 2):
        raise ValueError('Level150 recovery evidence lost its exact physical or pressure controls')
    files = set(report['sourceHashes'])
    for filename, expected in report['sourceHashes'].items():
        if digest(ROOT / filename) != expected:
            raise ValueError('Level150 case source or raw recording changed: ' + filename)
    before = ARCHIVE / 'experiments/prospective-score-2026-10-18T15-07-41-859Z'
    manifest_file = before / 'manifest.json'
    previous = json.loads(manifest_file.read_bytes())
    ledgers = ['prospective', 'kind-prospective', 'count-profile-prospective', 'progression-prospective']
    ledger_hashes = {}
    for name in ledgers:
        filename = 'analysis/personal-bots/' + name + '-forecasts.json'
        ledger_hashes[name] = digest(ROOT / filename)
        if ledger_hashes[name] != previous['files'][filename]:
            raise ValueError('The recovery review must not rewrite or append numeric forecasts')
        files.add(filename)
        files.add('analysis/personal-bots/' + name + '-results.json')
    files.update([report_file.relative_to(ROOT).as_posix(), 'analysis/archive/personal-bots/prospective-outcomes.json',
                  'analysis/personal-bots/level150-user-clarification.json', 'analysis/personal-bots/level150-recovery.md',
                  'analysis/personal-bots/level150-tests-output.txt', 'analysis/personal-bots/WORK_LOG.md',
                  'tools/sim/refit/fixtures/recovery-level150.json', 'tools/sim/refit/test_personal_recovery_case.js',
                  'tools/sim/refit/test_public_recovery_graph.js', 'tools/sim/refit/personal_recovery_case_snapshot.py',
                  'tests/t_personal_bots.js'])
    files.update('analysis/personal-bots/' + filename for filename in [
        'personal-recovery-level150-output.txt', 'level150-refresh-output.txt', 'level150-outcomes-output.txt',
        'level150-progression-score-output.txt', 'level150-prospective-score-output.txt',
        'level150-kind-score-output.txt', 'level150-count-score-output.txt'])
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-level150-recovery-' + stamp)
    folder.mkdir()
    hashes = {}
    for filename in sorted(files):
        destination = folder / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((ROOT / filename).read_bytes())
        hashes[filename] = digest(destination)
        if hashes[filename] != digest(ROOT / filename):
            raise ValueError('Level150 case changed during preservation')
    primary = json.loads((ROOT / 'analysis/personal-bots/progression-prospective-results.json').read_bytes())
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': report['evidence'], 'targetMet': False,
                'files': hashes, 'externalPinnedDependencies': {manifest_file.relative_to(ROOT).as_posix(): digest(manifest_file)},
                'ledgerHashesUnchanged': ledger_hashes, 'scoringRule': primary['scoringRule'],
                'note': 'Human confirmed the bee at4:32 occupied the SECOND tray spot unnecessarily, not either third-slot event. '
                    'Exact209-tap retrospective deferral avoids local third-slot pressure and reaches the same six-tile pre-auto state. '
                    'Unknown public routes remain unresolved; no uniqueness or future bot prediction is invented. '
                    'All four numeric forecast ledgers remain byte-identical. Level150 was frozen as1 and actually won on3: retain the miss.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({'folder': str(folder), 'files': len(hashes)}, indent=2))


if __name__ == '__main__':
    main()
