import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from personal_known_plan_run import contained
from personal_value_fit import ARCHIVE, ROOT, digest


def main(variant='clipped'):
    if variant not in ('clipped', 'log'):
        raise ValueError('Unknown attention feature variant')
    suffix = '-log' if variant == 'log' else ''
    model_name = 'analysis/archive/personal-bots/personal-attention' + suffix + '-models.json'
    native_name = 'analysis/archive/personal-bots/personal-attention' + suffix + '-native.json'
    runtime_name = 'analysis/personal-bots/attention' + suffix + '-runtime-audit.json'
    first_name = 'analysis/personal-bots/attention' + suffix + '-first-audit.json'
    bank = json.loads((ROOT / model_name).read_bytes())
    native = json.loads((ROOT / native_name).read_bytes())
    runtime = json.loads((ROOT / runtime_name).read_bytes())
    first = json.loads((ROOT / first_name).read_bytes())
    if (bank.get('variant', 'clipped') != variant or len(bank['models']) != 4 or native['modelsSha256'] != digest(ROOT / model_name)
            or runtime['modelsSha256'] != digest(ROOT / model_name) or runtime['nativeSha256'] != digest(ROOT / native_name)
            or runtime['prefixes'] != 445 or runtime['decisions'] != 39268
            or first['modelsSha256'] != digest(ROOT / model_name) or first['exactZeroPhysicalPathControls'] != 8):
        raise ValueError('Attention preservation needs complete own fitting and numerical/physical controls')
    declared = {**bank['inputHashes'], **runtime['sourceHashes'], **first['sourceHashes']}
    declared.update({'tools/sim/refit/' + name: expected for name, expected in {**bank['sourceHashes'], **bank['runtimeSourceHashes']}.items()})
    copied, dependencies = {}, {}
    for name, expected in declared.items():
        original = contained(ROOT, name)
        if digest(original) != expected:
            raise ValueError('Attention preservation input changed: ' + name)
        if '/experiments/' in name or '/runs/' in name:
            dependencies[name] = expected
        else:
            copied[name] = expected
    for filename in Path(__file__).parent.iterdir():
        if filename.suffix in ('.py', '.js', '.md'):
            copied[filename.relative_to(ROOT).as_posix()] = digest(filename)
    for filename in (Path(__file__).parent / 'fixtures').glob('*.json'):
        copied[filename.relative_to(ROOT).as_posix()] = digest(filename)
    for name in (model_name, native_name, runtime_name, first_name, 'analysis/personal-bots/attention' + suffix + '-fit-output.txt',
                 'analysis/personal-bots/attention' + suffix + '-runtime-audit-output.txt', 'analysis/personal-bots/attention' + suffix + '-first-audit-output.txt',
                 'analysis/personal-bots/attention' + suffix + '-python-tests-output.txt', 'analysis/personal-bots/attention' + suffix + '-js-tests-output.txt',
                 'analysis/personal-bots/temperature-cycle-audit.json', 'analysis/personal-bots/temperature-cycle-audit-output.txt',
                 'analysis/personal-bots/WORK_LOG.md', 'tests/t_personal_bots.js'):
        copied[name] = digest(ROOT / name)
    needed = sum((ROOT / name).stat().st_size for name in copied)
    if shutil.disk_usage(ROOT).free < needed + 1024 ** 3:
        raise ValueError('Preserve a one-GiB free-space reserve')
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-attention' + suffix + '-first-' + stamp)
    folder.mkdir()
    for name, expected in copied.items():
        target = contained(folder, name)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
        if digest(target) != expected or digest(ROOT / name) != expected:
            raise ValueError('Attention closure changed during preservation')
    proof = {'made': datetime.now(timezone.utc).isoformat(), 'variant': variant, 'evidence': 'own-attention-action-and-bounded-path-stage-only',
             'targetMet': False, 'files': copied, 'externalPinnedDependencies': dependencies,
             'wholeCountMeasurementIncluded': False,
             'note': 'Own four-person action fit, all445-prefix native parity and eight complete zero-policy physical-path controls. '
                     'Bounded paths are diagnostics only. Existing live temperature-count outputs belong to a DIFFERENT controller, '
                     'are not copied as completed attention calibration, and cannot establish future count accuracy.'}
    (folder / 'manifest.json').write_text(json.dumps(proof, indent=2), encoding='utf-8')
    result = {'snapshot': folder.relative_to(ROOT).as_posix(), 'manifestSha256': digest(folder / 'manifest.json'),
              'files': len(copied), 'dependencies': len(dependencies), 'targetMet': False}
    (ROOT / ('analysis/personal-bots/attention' + suffix + '-preservation.json')).write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--variant', choices=('clipped', 'log'), default='clipped')
    main(parser.parse_args().variant)
