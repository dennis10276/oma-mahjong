import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_value_fit import ARCHIVE, ROOT, digest


def validate_data(data):
    fingerprint = hashlib.sha256()
    for name in data['fingerprintFiles']:
        fingerprint.update(name.encode())
        fingerprint.update((ROOT / name).read_bytes())
    if fingerprint.hexdigest() != data['fingerprint'] or data['targetMet']:
        raise ValueError('Known-plan instrumentation changed or claimed unsupported winning-count success')


def main(mode):
    name = 'analysis/personal-bots/personal-known-plan-throughput-audit.json' if mode in ['pilot', 'failed'] else 'analysis/archive/personal-bots/policy-known-plan-prefix-data.json'
    data = json.loads((ROOT / name).read_bytes())
    if mode == 'failed':
        progress_file = ROOT / 'analysis/personal-bots/personal-known-plan-failed-boundary-progress.jsonl'
        header = json.loads(progress_file.read_text(encoding='utf-8').splitlines()[0])
        data = {'fingerprintFiles': data['fingerprintFiles'], 'fingerprint': header['fingerprint'], 'targetMet': False,
                'pilot': False, 'prefixes': header['prefixes']}
    validate_data(data)
    if data['pilot'] != (mode == 'pilot') or data['prefixes'] != (8 if mode == 'pilot' else 398):
        raise ValueError('Known-plan snapshot lost its declared prefix cohort')
    if mode not in ['pilot', 'failed'] and data['totals']['calls'] != 33543:
        raise ValueError('Known-plan snapshot lost unchanged action controls')
    files = set(data['fingerprintFiles'])
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix in ['.js', '.py', '.md'])
    files.update([name, 'tests/t_personal_bots.js', 'analysis/personal-bots/WORK_LOG.md',
                  'analysis/personal-bots/known-plan-tests-output.txt', 'analysis/personal-bots/progression-prospective-results.json',
                  'analysis/personal-bots/personal-known-plan-' + ('pilot' if mode == 'pilot' else 'full') + '-progress.jsonl',
                  'analysis/personal-bots/personal-known-plan-' + ('pilot' if mode == 'pilot' else 'data') + '-output.txt'])
    files.update('analysis/personal-bots/' + path.name for path in (ROOT / 'analysis/personal-bots').glob('personal-known-plan-failed-*') if path.is_file())
    files.update('analysis/personal-bots/' + name + '-forecasts.json' for name in
                 ['prospective', 'kind-prospective', 'count-profile-prospective', 'progression-prospective'])
    if mode == 'actions':
        report_file = ROOT / 'analysis/personal-bots/personal-known-plan-action-evaluation.json'
        report = json.loads(report_file.read_bytes())
        model_file = ARCHIVE / 'personal-known-plan-models.json'
        if report['targetMet'] or report['models'] != 138 or report['dataSha256'] != digest(ROOT / name) or report['modelsSha256'] != digest(model_file):
            raise ValueError('Known-plan action fit differs from current feature data or independently fitted actors')
        files.update([report_file.relative_to(ROOT).as_posix(), model_file.relative_to(ROOT).as_posix(),
                      'analysis/personal-bots/personal-known-plan-fit-output.txt'])
        for filename, expected in report['inputHashes'].items():
            if digest(ROOT / filename) != expected:
                raise ValueError('Known-plan frozen actor or held action-control parent changed')
            files.add(filename)
    dependencies = {}
    for filename in list(files):
        if '/experiments/' in filename:
            dependencies[filename] = digest(ROOT / filename)
            files.remove(filename)
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-known-plan-' + mode + '-' + stamp)
    folder.mkdir()
    hashes = {}
    for filename in sorted(files):
        destination = folder / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((ROOT / filename).read_bytes())
        hashes[filename] = digest(destination)
        if hashes[filename] != digest(ROOT / filename):
            raise ValueError('Known-plan source changed during snapshot')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'historical-exploratory-known-plan-' + mode,
                'targetMet': False, 'winningCountMeasurement': 'not-run', 'files': hashes, 'externalPinnedDependencies': dependencies,
                'note': 'Public known-only bounded route features, physical parity and independent own-person action fitting. '
                        'Unknown pictures and covered orientations are masked; observation opportunities and planning limits are not natural losses. '
                        'Neither a feature pilot nor improved action likelihood establishes frozen future winning-try accuracy. '
                        'Old numeric forecasts, failed prospective cohort clocks and per-person training membership remain unchanged.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(folder, len(files), 'pinned files,', len(dependencies), 'explicit immutable dependencies')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['pilot', 'features', 'actions', 'failed'])
    main(parser.parse_args().mode)
