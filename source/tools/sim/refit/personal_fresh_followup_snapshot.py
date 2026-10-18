import json
from datetime import datetime, timezone
from pathlib import Path

from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    audit_file = ROOT / 'analysis/personal-bots/predictive-tail-audit.json'
    audit = json.loads(audit_file.read_bytes())
    if audit['targetMet'] or audit['analyticNumericControlsMatched'] != 1008 or audit['campaigns'] != 252:
        raise ValueError('Fresh follow-up lost the complete original analytic tail controls')
    files = set(audit['sourceHashes'])
    for filename, expected in audit['sourceHashes'].items():
        if digest(ROOT / filename) != expected:
            raise ValueError('Predictive tail audit source changed')
    fits = ARCHIVE / 'experiments/personal-fresh-own-fits-2026-10-18T15-59-12-900Z'
    fit_manifest = json.loads((fits / 'manifest.json').read_bytes())
    dependencies = {(fits / 'manifest.json').relative_to(ROOT).as_posix(): digest(fits / 'manifest.json')}
    for filename, expected in fit_manifest['files'].items():
        source = fits / filename
        if digest(source) != expected:
            raise ValueError('Original fresh own fitting source or numeric parameters changed')
        dependencies[source.relative_to(ROOT).as_posix()] = expected
    for filename, expected in fit_manifest['externalPinnedDependencies'].items():
        if digest(ROOT / filename) != expected:
            raise ValueError('Fresh own immutable input dependency changed')
        dependencies[filename] = expected
    for name, expected in audit['ledgerHashesUnchanged'].items():
        filename = 'analysis/personal-bots/' + name + '-forecasts.json'
        if digest(ROOT / filename) != expected:
            raise ValueError('Fresh follow-up must not alter existing numeric forecasts')
        files.add(filename)
        files.add('analysis/personal-bots/' + name + '-results.json')
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir()
                 if path.suffix in ['.js', '.py', '.md'])
    files.update(path.relative_to(ROOT).as_posix() for path in (Path(__file__).parent / 'fixtures').glob('*.json'))
    files.update(['tests/t_personal_bots.js', 'analysis/personal-bots/WORK_LOG.md',
                  audit_file.relative_to(ROOT).as_posix(), 'analysis/personal-bots/predictive-tail-audit-output.txt',
                  'analysis/personal-bots/fresh-final-tests-output.txt', 'analysis/personal-bots/fresh-own-fit-preservation.json',
                  'analysis/personal-bots/outcome-styles-full-preservation.json',
                  'analysis/archive/personal-bots/prospective-outcomes.json'])
    for filename in list(files):
        if '/experiments/' in filename or '/runs/' in filename:
            dependencies[filename] = digest(ROOT / filename)
            files.remove(filename)
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-fresh-tail-followup-' + stamp)
    folder.mkdir()
    hashes = {}
    for filename in sorted(files):
        destination = folder / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((ROOT / filename).read_bytes())
        hashes[filename] = digest(destination)
        if hashes[filename] != digest(ROOT / filename):
            raise ValueError('Fresh follow-up source changed during preservation')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'fresh-fit-followup-and-tail-correction-only',
                'targetMet': False, 'files': hashes, 'externalPinnedDependencies': dependencies,
                'fitSourceSnapshot': fits.relative_to(ROOT).as_posix(),
                'ledgerHashesUnchanged': audit['ledgerHashesUnchanged'],
                'note': 'Fresh model parameters retain their actual immutable pre-tail-correction fitting source. '
                    'This checkpoint separately preserves corrected future count-head optimization and its1008-control audit. '
                    'The95 future board tasks are not numeric forecasts; autonomous fresh counts/freezes remain outstanding. '
                    'Existing genuine scores and all earlier misses are retained. No80% success is established.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({'folder': str(folder), 'files': len(hashes), 'dependencies': len(dependencies)}, indent=2))


if __name__ == '__main__':
    main()
