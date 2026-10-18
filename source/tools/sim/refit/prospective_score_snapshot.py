import json
from datetime import datetime, timezone
from pathlib import Path

from progression_score import same_model_ledger, score_progression
from prospective import score_ledger
from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    output = ROOT / 'analysis/personal-bots'
    episodes_file = ARCHIVE / 'prospective-outcomes.json'
    episodes = json.loads(episodes_file.read_bytes())
    names = ['prospective', 'kind-prospective', 'count-profile-prospective', 'progression-prospective']
    ledgers = {name: json.loads((output / (name + '-forecasts.json')).read_bytes()) for name in names}
    reports = {name: json.loads((output / (name + '-results.json')).read_bytes()) for name in names}
    for name in names:
        expected = (score_progression(same_model_ledger(ledgers[name], ledgers['count-profile-prospective']), episodes,
                                     ledgers[name][0]['progressionStartLevels']) if name == 'progression-prospective'
                    else score_ledger(ledgers[name], episodes))
        for field in ['players', 'scored', 'cohort', 'targetMet', 'cohortStartsAfter', 'scoringRule']:
            if reports[name][field] != expected[field]:
                raise ValueError('Saved prospective score differs from unchanged frozen-ledger reconstruction: ' + name + '/' + field)
        if any(row['frozenAt'] >= row['start'] for row in reports[name]['scored']):
            raise ValueError('A forecast was not frozen before its scored campaign opened')
    snapshot_file = ROOT / 'analysis/archive/realdata/snapshot.json'
    raw_snapshot = json.loads(snapshot_file.read_bytes())
    files = {episodes_file.relative_to(ROOT).as_posix(), snapshot_file.relative_to(ROOT).as_posix(),
             'analysis/personal-bots/WORK_LOG.md', 'tools/sim/refit/attempts.json',
             'analysis/personal-bots/clock-strategy-refresh-output.txt',
             'analysis/personal-bots/clock-strategy-prospective-score-output.txt',
             'analysis/personal-bots/clock-strategy-progression-score-output.txt'}
    files.update('analysis/archive/' + name for name in raw_snapshot['files'])
    files.update('analysis/personal-bots/' + name + suffix + '.json' for name in names for suffix in ['-forecasts', '-results'])
    files.update('tools/sim/refit/mimic/' + name + '.json' for name in ['Dennisisdebeste', 'Mrs_Doubtfire', 'PUK', 'Gerda'])
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix in ['.js', '.py', '.md'])
    files.update(path.relative_to(ROOT).as_posix() for path in (Path(__file__).parent / 'fixtures').glob('*.json'))
    files.update(['www/hard.js', 'www/layouts.js', 'tests/t_personal_bots.js', 'analysis/personal-bots/clock-strategy-tests-output.txt'])
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('prospective-score-' + stamp)
    folder.mkdir()
    hashes = {}
    for name in sorted(files):
        destination = folder / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((ROOT / name).read_bytes())
        hashes[name] = digest(destination)
        if hashes[name] != digest(ROOT / name):
            raise ValueError('Prospective score source/input changed while being preserved')
    primary = reports['progression-prospective']
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'prospective-frozen-score-only',
                'targetMet': primary['targetMet'], 'scoringRule': primary['scoringRule'], 'files': hashes,
                'rawDownloadedAt': raw_snapshot['downloadedAt'],
                'ledgerHashes': {name: hashes['analysis/personal-bots/' + name + '-forecasts.json'] for name in names},
                'primaryCohort': primary['cohort'],
                'note': 'All four saved scores recompute exactly from preserved frozen ledgers and episode-relative outcomes. '
                    'Raw exports are retained as context; this is score-only evidence, not a new bot fit or reconstructed-board simulation proof. '
                    'Earlier same-model misses and replay exclusions remain unchanged. No ledger append, model promotion or new forecast freeze.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({'folder': str(folder), 'files': len(hashes), 'primaryCohort': primary['cohort'], 'targetMet': primary['targetMet']}, indent=2))


if __name__ == '__main__':
    main()
