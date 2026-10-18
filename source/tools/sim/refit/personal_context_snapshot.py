import json
from datetime import datetime, timezone
from pathlib import Path

from personal_full_choice_fit import validate
from personal_value_fit import ARCHIVE, DATA, ROOT, digest


def main():
    report_file = ROOT / 'analysis/personal-bots/personal-context-action-evaluation.json'
    report = json.loads(report_file.read_bytes())
    if report['targetMet'] or report['evidence'] != 'historical-exploratory-personal-context-actions':
        raise ValueError('Context snapshot must preserve exploratory status')
    dependencies = {}
    for name, expected in report['inputHashes'].items():
        if digest(ROOT / name) != expected:
            raise ValueError('Context input changed before snapshot')
        if '/experiments/' in name:
            base, remainder = name.split('/experiments/', 1)
            experiment, relative = remainder.split('/', 1)
            parent = ROOT / base / 'experiments' / experiment
            manifest_path = parent / 'manifest.json'
            manifest = json.loads(manifest_path.read_bytes())
            if manifest['files'][relative] != expected:
                raise ValueError('Context dependency differs from immutable parent manifest')
            dependencies[name] = expected
            dependencies[manifest_path.relative_to(ROOT).as_posix()] = digest(manifest_path)
    for name, expected in report['fitSourceHashes'].items():
        if digest(Path(__file__).with_name(name)) != expected:
            raise ValueError('Context source changed before snapshot')
    if digest(ARCHIVE / 'personal-context-models.json') != report['modelsSha256']:
        raise ValueError('Context models changed before snapshot')
    data = json.loads(DATA.read_bytes())
    validate(data)
    restart_file = ROOT / 'analysis/personal-bots/personal-restart-state-audit.json'
    restart = json.loads(restart_file.read_bytes())
    validate(restart)
    if restart['targetMet'] or restart['evidence'] != 'human-restart-state-diagnostic-only':
        raise ValueError('Restart audit must preserve diagnostic status')
    bank_hash = next(value for name, value in report['inputHashes'].items() if name.endswith('/physical-memory-policy-bank.json'))
    request_hash = next(value for name, value in report['inputHashes'].items() if name.endswith('/physical-count-requests.json'))
    if restart['pinnedActorBankSha256'] != bank_hash or restart['pinnedRequestsSha256'] != request_hash:
        raise ValueError('Restart audit actors differ from pinned context controls')
    files = set(data['fingerprintFiles'])
    files.update(restart['fingerprintFiles'])
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir()
                 if path.suffix in ['.js', '.py', '.md'])
    files.update([DATA.relative_to(ROOT).as_posix(), report_file.relative_to(ROOT).as_posix(),
                  'analysis/archive/personal-bots/personal-context-models.json',
                  'analysis/personal-bots/personal-context-fit-output.txt',
                  'analysis/personal-bots/personal-context-float64-aborted-output.txt',
                  'analysis/personal-bots/personal-restart-state-audit.json',
                  'analysis/personal-bots/personal-restart-state-output.txt',
                  'analysis/personal-bots/WORK_LOG.md', 'tests/t_personal_bots.js',
                  'analysis/personal-bots/progression-prospective-results.json'])
    files.update('analysis/personal-bots/' + name + '-forecasts.json' for name in
                 ['prospective', 'kind-prospective', 'count-profile-prospective', 'progression-prospective'])
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-context-actions-' + stamp)
    folder.mkdir()
    hashes = {}
    for name in sorted(files):
        source = ROOT / name
        destination = folder / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source.read_bytes())
        hashes[name] = digest(destination)
        if hashes[name] != digest(source):
            raise ValueError('Context source changed during snapshot')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': report['evidence'], 'targetMet': False,
                'files': hashes, 'externalPinnedDependencies': dependencies, 'winningCountMeasurement': 'not-run',
                'additionalDiagnostics': ['human-restart-state-diagnostic-only'],
                'note': 'Own-person nonlinear choice residuals with unchanged pinned base action controls. '
                        'External immutable parents and their manifests are required at the exact paths/hashes. '
                        'All context measurements, models, sources, raw inputs and unchanged numeric ledgers are copied. '
                        'Action likelihood is not winning-try accuracy, an autonomous policy promotion, a release or a new forecast.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(folder, len(files), 'pinned files,', len(dependencies), 'explicit parent dependencies')


if __name__ == '__main__':
    main()
