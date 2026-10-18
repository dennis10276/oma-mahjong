import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_value_fit import ARCHIVE, ROOT, digest


def main(mode='diagnostic'):
    filename = 'analysis/personal-bots/personal-clock-crowding-audit.json'
    report = json.loads((ROOT / filename).read_bytes())
    if (report['targetMet'] or report['evidence'] != 'observed-public-clock-crowding-diagnostic'
            or report['clockStates'] != 1111 or len(report['rows']) != 1111):
        raise ValueError('Clock crowding diagnostic changed its complete observed-state cohort')
    for name, expected in report['sourceHashes'].items():
        if digest(ROOT / name) != expected:
            raise ValueError('Clock crowding diagnostic source/input changed: ' + name)
    files = set(report['sourceHashes'])
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix in ['.py', '.md'])
    files.update([filename, 'analysis/personal-bots/personal-clock-crowding-output.txt', 'analysis/personal-bots/WORK_LOG.md',
                  'analysis/personal-bots/clock-strategy-tests-output.txt', 'tests/t_personal_bots.js',
                  'tools/sim/refit/test_personal_clock_crowding.js'])
    if mode != 'diagnostic':
        model_file = ARCHIVE / 'personal-clock-crowding-models.json'
        fit_report_file = ROOT / 'analysis/personal-bots/personal-clock-crowding-action-evaluation.json'
        fitted = json.loads(fit_report_file.read_bytes())
        if fitted['targetMet'] or fitted['models'] != 138 or fitted['actionControlsMatched'] != 197 or digest(model_file) != fitted['modelsSha256']:
            raise ValueError('Clock crowding fit changed its fixed model/action controls')
        for name, expected in fitted['inputHashes'].items():
            if digest(ROOT / name) != expected:
                raise ValueError('Clock crowding fit input changed')
            files.add(name)
        for name, expected in fitted['fitSourceHashes'].items():
            if digest(Path(__file__).with_name(name)) != expected:
                raise ValueError('Clock crowding fitting source changed')
        files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir() if path.suffix == '.js')
        files.update([model_file.relative_to(ROOT).as_posix(), fit_report_file.relative_to(ROOT).as_posix(),
                      'analysis/personal-bots/personal-clock-crowding-fit-output.txt'])
        if mode == 'cue-actions':
            runtime_file = ROOT / 'analysis/personal-bots/personal-clock-crowding-runtime-audit.json'
            runtime = json.loads(runtime_file.read_bytes())
            if runtime['targetMet'] or runtime['prefixes'] != 197 or runtime['probabilityDecisions'] != 38028 or runtime['models'] != 138:
                raise ValueError('Clock crowding runtime proof lost its declared controls')
            fingerprint = hashlib.sha256()
            for name in runtime['fingerprintFiles']:
                fingerprint.update(name.encode())
                fingerprint.update((ROOT / name).read_bytes())
                files.add(name)
            if fingerprint.hexdigest() != runtime['fingerprint']:
                raise ValueError('Clock crowding runtime proof source/input changed')
            files.update([runtime_file.relative_to(ROOT).as_posix(), 'analysis/personal-bots/personal-clock-crowding-runtime-output.txt'])
    dependencies = {}
    for name in list(files):
        if '/experiments/' in name:
            dependencies[name] = digest(ROOT / name)
            files.remove(name)
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-clock-crowding-' + mode + '-' + stamp)
    folder.mkdir()
    hashes = {}
    for name in sorted(files):
        destination = folder / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((ROOT / name).read_bytes())
        hashes[name] = digest(destination)
        if hashes[name] != digest(ROOT / name):
            raise ValueError('Clock crowding source changed during preservation')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'mode': mode,
                'evidence': 'invalid-empty-cue-mask' if mode == 'cue-failed' else 'historical-exploratory' if mode == 'cue-actions' else report['evidence'], 'targetMet': False,
                'files': hashes, 'externalPinnedDependencies': dependencies,
                'note': 'Complete public-state crowding audit retained; direct clock matching is distinguished from pairing before the clock. '
                    'Cue-failed preserves the rejected F14-only mask: actual tray matches are single-tap actions and were missed. '
                    'Descriptive historical evidence only, not a winning-count result, model promotion or80% claim.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({'folder': str(folder), 'files': len(hashes), 'dependencies': len(dependencies)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', nargs='?', default='diagnostic', choices=['diagnostic', 'cue-failed', 'cue-actions'])
    main(parser.parse_args().mode)
