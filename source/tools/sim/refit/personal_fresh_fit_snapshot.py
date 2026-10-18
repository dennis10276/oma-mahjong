import json
from datetime import datetime, timezone
from pathlib import Path

from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    names = ['personal-fresh-own-evaluation.json', 'personal-fresh-own-native-bridge.json',
             'personal-fresh-own-runtime-audit.json', 'personal-prefix-versions-evaluation.json']
    reports = {name: json.loads((ROOT / 'analysis/personal-bots' / name).read_bytes()) for name in names}
    runtime = reports['personal-fresh-own-runtime-audit.json']
    if (runtime['targetMet'] or runtime['models'] != 4 or runtime['prefixes'] != 445
            or runtime['probabilityDecisions'] != 78536):
        raise ValueError('Fresh own-person runtime bridge lost complete numeric coverage')
    files = set()
    for name, report in reports.items():
        if report['targetMet']:
            raise ValueError('A fitting/runtime checkpoint cannot claim prospective80%')
        files.add('analysis/personal-bots/' + name)
        for filename, expected in report.get('inputHashes', {}).items():
            if digest(ROOT / filename) != expected:
                raise ValueError('Fresh fitting/runtime input changed: ' + filename)
            files.add(filename)
        for filename, expected in report.get('sourceHashes', {}).items():
            source = Path(__file__).with_name(filename)
            if digest(source) != expected:
                raise ValueError('Fresh fitting/runtime source changed: ' + filename)
            files.add(source.relative_to(ROOT).as_posix())
    import hashlib
    fingerprint = hashlib.sha256()
    for filename in runtime['fingerprintFiles']:
        fingerprint.update(filename.encode())
        fingerprint.update((ROOT / filename).read_bytes())
        files.add(filename)
    if fingerprint.hexdigest() != runtime['fingerprint']:
        raise ValueError('Fresh native/runtime probability proof changed')
    recent_file = ARCHIVE / 'personal-fresh-recent-models.json'
    recent = json.loads(recent_file.read_bytes())
    if recent['targetMet'] or len(recent['models']) != 29 or len(recent['selections']) != 29:
        raise ValueError('Fresh historical recent fit lost its entire29-campaign schedule')
    for filename, expected in recent['inputHashes'].items():
        if digest(ROOT / filename) != expected:
            raise ValueError('Fresh historical request input changed')
        files.add(filename)
    for filename, expected in recent['sourceHashes'].items():
        if digest(Path(__file__).with_name(filename)) != expected:
            raise ValueError('Fresh historical fitting source changed')
    requests = json.loads((ARCHIVE / 'personal-fresh-count-requests.json').read_bytes())
    if len(requests['recent']) != 29 or len(requests['future']) != 95:
        raise ValueError('Fresh fixed recent/future schedule changed')
    for filename, expected in requests['inputHashes'].items():
        if digest(ROOT / filename) != expected:
            raise ValueError('Fresh count-request source or board changed')
        files.add(filename)
    files.add(recent_file.relative_to(ROOT).as_posix())
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir()
                 if path.suffix in ['.js', '.py', '.md'])
    files.update(path.relative_to(ROOT).as_posix() for path in (Path(__file__).parent / 'fixtures').glob('*.json'))
    files.update('analysis/personal-bots/' + name for name in [
        'personal-fresh-own-fit-output.txt', 'personal-fresh-own-native-output.txt', 'personal-fresh-own-runtime-output.txt',
        'personal-prefix-versions-output.txt', 'personal-fresh-count-requests-output.txt', 'personal-fresh-recent-fit-output.txt',
        'fresh-prefix-preservation.json', 'outcome-styles-full-preservation.json', 'fresh-own-tests-output.txt', 'WORK_LOG.md'])
    files.add('tests/t_personal_bots.js')
    dependencies = {filename: digest(ROOT / filename) for filename in files if '/experiments/' in filename or '/runs/' in filename}
    files.difference_update(dependencies)
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-fresh-own-fits-' + stamp)
    folder.mkdir()
    hashes = {}
    for filename in sorted(files):
        destination = folder / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((ROOT / filename).read_bytes())
        hashes[filename] = digest(destination)
        if hashes[filename] != digest(ROOT / filename):
            raise ValueError('Fresh personal checkpoint changed during preservation')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'fresh-own-fit-and-runtime-only', 'targetMet': False,
                'files': hashes, 'externalPinnedDependencies': dependencies, 'strictFutureModels': 4,
                'historicalClientTimeModels': 29,
                'note': 'Preserves445 own fitting prefixes/78536 native-runtime probability decisions, four fresh personal models '
                    'and29 explicitly historical recent models. Future requests require real source observation; queued '
                    'client timestamps alone do not prove historical server availability. The95 future board tasks are NOT numeric forecasts. '
                    'No winning-count gain, prospective model promotion or80% success is established.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({'folder': str(folder), 'files': len(hashes), 'dependencies': len(dependencies)}, indent=2))


if __name__ == '__main__':
    main()
