import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from personal_known_plan_run import contained
from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    data_file = ARCHIVE / 'personal-tray-intents-prefixes.json'
    data = json.loads(data_file.read_bytes())
    if data['totals']['prefixes'] != 445 or data['totals']['calls'] != 39268 or data['targetMet']:
        raise ValueError('Tray feature preservation needs all445 exact retained controls')
    files, dependencies = {data_file.relative_to(ROOT).as_posix()}, {}
    for name, expected in {**data['sourceHashes'], **data['inputHashes']}.items():
        if digest(contained(ROOT, name)) != expected:
            raise ValueError('Tray feature source/input changed before preservation: ' + name)
        if '/experiments/' in name or '/runs/' in name:
            dependencies[name] = expected
        else:
            files.add(name)
    for folder, names in [
        (ARCHIVE / 'experiments/personal-fresh-own-fits-2026-10-18T15-59-12-900Z',
         ['personal-fresh-own-models.json', 'personal-fresh-recent-models.json', 'personal-fresh-count-requests.json']),
        (ARCHIVE / 'experiments/personal-clock-intents-actions-2026-10-18T20-14-16-102Z', ['personal-clock-intents-models.json'])]:
        manifest_file = folder / 'manifest.json'
        manifest = json.loads(manifest_file.read_bytes())
        dependencies[manifest_file.relative_to(ROOT).as_posix()] = digest(manifest_file)
        for filename in names:
            name = 'analysis/archive/personal-bots/' + filename
            source = folder / name
            if digest(source) != manifest['files'][name]:
                raise ValueError('Pinned tray fit actor/clock input changed')
            dependencies[source.relative_to(ROOT).as_posix()] = digest(source)
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix in ('.py', '.js', '.md'))
    files.update(['tests/t_personal_bots.js', 'analysis/personal-bots/WORK_LOG.md', 'analysis/personal-bots/tray-intents-data-output.txt',
                  'analysis/personal-bots/tray-intents-tests-output.txt', 'analysis/personal-bots/tray-intents-js-tests-output.txt',
                  'analysis/personal-bots/personal-fresh-forecasts.jsonl', 'analysis/personal-bots/personal-fresh-prospective-results.json'])
    parent = ARCHIVE / 'experiments/personal-clock-intents-actions-2026-10-18T20-14-16-102Z/manifest.json'
    previous = json.loads(parent.read_bytes())
    forecast_file = ROOT / 'analysis/personal-bots/personal-fresh-forecasts.jsonl'
    if digest(forecast_file) != previous['experimentalNumericLedgerUnchanged']:
        raise ValueError('Existing95 experimental numeric predictions changed')
    for name, expected in previous['ledgerHashesUnchanged'].items():
        filename = 'analysis/personal-bots/' + name + '-forecasts.json'
        if digest(ROOT / filename) != expected:
            raise ValueError('An original numeric forecast ledger changed')
        files.add(filename)
        files.add('analysis/personal-bots/' + name + '-results.json')
    risk_folder = ARCHIVE / 'experiments/personal-tray-intents-cycle-risk-2026-10-18T20-21-36-625Z'
    risk_manifest = json.loads((risk_folder / 'manifest.json').read_text(encoding='utf-8-sig'))
    for filename, expected in risk_manifest['files'].items():
        source = risk_folder / filename
        if digest(source) != expected:
            raise ValueError('Intentionally retired cycle-risk prototype changed')
        dependencies[source.relative_to(ROOT).as_posix()] = expected
    dependencies[(risk_folder / 'manifest.json').relative_to(ROOT).as_posix()] = digest(risk_folder / 'manifest.json')
    needed = sum(contained(ROOT, name).stat().st_size for name in files)
    if shutil.disk_usage(ROOT).free < needed + 1024 ** 3:
        raise ValueError('Insufficient free space for tray feature preservation')
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-tray-intents-features-' + stamp)
    folder.mkdir()
    copied = {}
    for filename in sorted(files):
        source, destination = contained(ROOT, filename), contained(folder, filename)
        expected = digest(source)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source.read_bytes())
        if digest(source) != expected or digest(destination) != expected:
            raise ValueError('Tray feature/source changed during copying')
        copied[filename] = expected
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'public-tray-intent-features-and-corrected-prototype-only',
        'targetMet': False, 'files': copied, 'externalPinnedDependencies': dependencies,
        'ledgerHashesUnchanged': previous['ledgerHashesUnchanged'], 'experimentalNumericLedgerUnchanged': digest(forecast_file),
        'note': 'All445 versions/39,268 physical frames retain original natural choices/results and separate clock12/tray5 public annotations. '
            'Corrected recovery intent refuses pointless known non-pair reinspection. Original rejected source/progress remains pinned separately. '
            'Model fitting may still be live; mutable progress/output files are deliberately not represented as frozen completed model evidence. '
            'No new winning-count result, numeric forecast or80% claim is established.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
    print(json.dumps({'folder': str(folder), 'files': len(copied), 'dependencies': len(dependencies), 'bytes': needed}, indent=2))


if __name__ == '__main__':
    main()
