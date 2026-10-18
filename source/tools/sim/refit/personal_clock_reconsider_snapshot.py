import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    output = ROOT / 'analysis/personal-bots'
    fitted = json.loads((output / 'personal-clock-reconsider-action-evaluation.json').read_bytes())
    runtime = json.loads((output / 'personal-clock-reconsider-runtime-audit.json').read_bytes())
    if (fitted['targetMet'] or runtime['targetMet'] or fitted['models'] != 138
            or fitted['actionControlsMatched'] != 197 or runtime['prefixes'] != 197
            or runtime['probabilityDecisions'] != 38028 or runtime['models'] != 138):
        raise ValueError('Selective reconsideration lost its fixed personal/action controls')
    model_file = ARCHIVE / 'personal-clock-reconsider-models.json'
    if digest(model_file) != fitted['modelsSha256']:
        raise ValueError('Selective reconsideration models changed')
    files = set(fitted['inputHashes'])
    for name, expected in fitted['inputHashes'].items():
        if digest(ROOT / name) != expected:
            raise ValueError('Selective reconsideration immutable input changed: ' + name)
    for name, expected in fitted['fitSourceHashes'].items():
        if digest(Path(__file__).with_name(name)) != expected:
            raise ValueError('Selective reconsideration fit source changed: ' + name)
    fingerprint = hashlib.sha256()
    for name in runtime['fingerprintFiles']:
        fingerprint.update(name.encode())
        fingerprint.update((ROOT / name).read_bytes())
        files.add(name)
    if fingerprint.hexdigest() != runtime['fingerprint']:
        raise ValueError('Selective reconsideration native/runtime proof changed')
    extras = ['attempt-scoring-change-audit.json', 'physical-known-plan-count-8plus-evaluation.json',
              'known-plan-full-preservation.json']
    for name in extras:
        report = json.loads((output / name).read_bytes())
        if report.get('targetMet', False):
            raise ValueError('Exploratory checkpoint cannot assert the prospective target')
        for filename, expected in report.get('sourceHashes', {}).items():
            if digest(ROOT / filename) != expected:
                raise ValueError('Retained scoring evidence changed: ' + filename)
            files.add(filename)
        snapshot = report.get('beforeSnapshot') or report.get('sourceSnapshot')
        if name == 'known-plan-full-preservation.json':
            snapshot = report['snapshot']
        if snapshot:
            manifest_file = ROOT / snapshot / 'manifest.json'
            expected = report.get('manifestSha256')
            if expected and digest(manifest_file) != expected:
                raise ValueError('Retained scoring snapshot manifest changed')
            files.add(manifest_file.relative_to(ROOT).as_posix())
            if name == 'known-plan-full-preservation.json':
                manifest = json.loads(manifest_file.read_bytes())
                for filename, expected in manifest['files'].items():
                    pinned = ROOT / snapshot / filename
                    if digest(pinned) != expected:
                        raise ValueError('Completed known-plan snapshot content changed')
                    files.add(pinned.relative_to(ROOT).as_posix())
                for filename, expected in manifest['externalPinnedDependencies'].items():
                    if digest(ROOT / filename) != expected:
                        raise ValueError('Completed known-plan snapshot dependency changed')
                    files.add(filename)
        files.add((output / name).relative_to(ROOT).as_posix())
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir()
                 if path.suffix in ['.js', '.py', '.md'])
    files.update(path.relative_to(ROOT).as_posix() for path in (Path(__file__).parent / 'fixtures').glob('*.json'))
    files.update('analysis/personal-bots/' + name for name in [
        'personal-clock-reconsider-action-evaluation.json', 'personal-clock-reconsider-runtime-audit.json',
        'personal-clock-reconsider-fit-output.txt', 'personal-clock-reconsider-runtime-output.txt',
        'reconsider-tests-output.txt', 'WORK_LOG.md'])
    files.update([model_file.relative_to(ROOT).as_posix(), 'tests/t_personal_bots.js'])
    dependencies = {name: digest(ROOT / name) for name in files if '/experiments/' in name or '/runs/' in name}
    files.difference_update(dependencies)
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-clock-reconsider-actions-' + stamp)
    folder.mkdir()
    hashes = {}
    for name in sorted(files):
        destination = folder / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((ROOT / name).read_bytes())
        hashes[name] = digest(destination)
        if hashes[name] != digest(ROOT / name):
            raise ValueError('Checkpoint source changed during preservation')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory-selective-reconsideration',
                'targetMet': False, 'files': hashes, 'externalPinnedDependencies': dependencies,
                'scoringRule': fitted['futureWinningCountScoringRule'],
                'note': 'Retains all138 own fits/197 controls/38028 native-runtime probability decisions. '
                    'Also retains unchanged fixed forecasts under the authorized8+ rule and the completed full-known-plan evidence. '
                    'Zero fitted reconsideration rates are a no-change result, not a promoted clock strategy or winning-count gain. '
                    'No forecasts or outcomes are rewritten; no prospective80% claim.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({'folder': str(folder), 'files': len(hashes), 'dependencies': len(dependencies)}, indent=2))


if __name__ == '__main__':
    main()
