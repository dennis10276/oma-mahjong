import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from personal_attention_count_fit import select_attention_temperatures
from personal_known_plan_run import contained
from personal_policy_temperature_fit import validate_sources
from personal_value_fit import ARCHIVE, ROOT, digest


def main():
    model_file = ARCHIVE / 'personal-attention-log-temperature-models.json'
    model = json.loads(model_file.read_bytes())
    data_file = Path(model['dataFile']).resolve()
    data = json.loads(data_file.read_bytes())
    source_root = validate_sources(data, data_file)
    if (digest(data_file) != model['dataSha256'] or data['computationCaps'] != 0 or len(data['rows']) != 80
            or data['exactZeroPilotControls'] != 80 or data['exactCompletedBaselineControls'] != 80
            or data['pairedPilotControls'] != 16 or model['selected'] != select_attention_temperatures(data, model['actualFitRequest'])):
        raise ValueError('Preserve only the actual complete own-controller calibration with all controls')
    inputs = json.loads((source_root / 'analysis/archive/personal-bots/personal-attention-count-input.json').read_bytes())
    original_file = Path(inputs['originalRunRoot']) / 'analysis/archive/personal-bots/personal-policy-temperature-data.json'
    original = json.loads(original_file.read_bytes())
    if original['runs'] != 8 or original['attempts'] != 8 or len(original['rows']) != 80:
        raise ValueError('The separate baseline must actually be a complete80-board8x8 measurement')
    for row in data['rows']:
        previous = next(value for value in original['rows'] if value['name'] == row['name'] and value['start'] == row['start'])
        if (previous['modelId'] != row['staticActorId'] or previous['board'] != row['board']
                or previous['chains']['confidence100'] != row['fullBaseline']):
            raise ValueError('Independent completed baseline crosscheck failed')
    dependencies = {data_file.relative_to(ROOT).as_posix(): digest(data_file),
                    original_file.relative_to(ROOT).as_posix(): digest(original_file)}
    for relative, expected in data['sourceHashes'].items():
        path = contained(source_root, relative)
        if digest(path) != expected:
            raise ValueError('Actual completed count runtime changed')
        dependencies[path.relative_to(ROOT).as_posix()] = expected
    copied = {}
    for filename in Path(__file__).parent.iterdir():
        if filename.suffix in ('.py', '.js', '.md'):
            copied[filename.relative_to(ROOT).as_posix()] = digest(filename)
    for filename in (Path(__file__).parent / 'fixtures').glob('*.json'):
        copied[filename.relative_to(ROOT).as_posix()] = digest(filename)
    for name in ('personal-attention-log-temperature-models.json', 'personal-attention-log-models.json'):
        relative = 'analysis/archive/personal-bots/' + name
        copied[relative] = digest(ROOT / relative)
    for name in ('attention-count-fit-output.txt', 'attention-count-training-summary.json', 'attention-hazard-probe.json',
                 'attention-hazard-probe-output.txt', 'attention-future-python-tests-output.txt', 'attention-future-js-tests-output.txt',
                 'policy-temperature-count-fit-summary.json', 'attention-count-preparation-output.txt', 'WORK_LOG.md'):
        relative = 'analysis/personal-bots/' + name
        copied[relative] = digest(ROOT / relative)
    for name in model['sourceHashes']:
        relative = 'tools/sim/refit/' + name
        if copied[relative] != model['sourceHashes'][name]:
            raise ValueError('Actual own count fitting code changed')
    copied['tests/t_personal_bots.js'] = digest(ROOT / 'tests/t_personal_bots.js')
    ledgers = {}
    expected_ledgers = {
        'prospective-forecasts.json': '58de3c411ba779071e6c7f7d30c360cce7f69986465948e0543a044003f13057',
        'kind-prospective-forecasts.json': '98b8409ede1146938e8495b598706d07fba424ec31dc9b4017081bf61988cd27',
        'count-profile-prospective-forecasts.json': '1e3bd3ba0ae3780aee63791128d4e6a5f031ff073ba8bcddc4599f041de2db62',
        'progression-prospective-forecasts.json': 'e98206e69c55013ffd54544ad8320e2b54d5040b752041941849d98d99e09938',
        'personal-fresh-forecasts.jsonl': '03120392b71ef34411688d3e77f5ecfabaafc988767b672594cddc2fec84ca8e',
    }
    for filename, expected in expected_ledgers.items():
        relative = 'analysis/personal-bots/' + filename
        copied[relative] = digest(ROOT / relative)
        if copied[relative] != expected:
            raise ValueError('An original numeric forecast ledger changed: ' + filename)
        ledgers[relative] = copied[relative]
    if shutil.disk_usage(ROOT).free < sum((ROOT / name).stat().st_size for name in copied) + 1024 ** 3:
        raise ValueError('Preserve one-GiB free-space reserve')
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-attention-count-complete-' + stamp)
    folder.mkdir()
    for relative, expected in copied.items():
        target = contained(folder, relative)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, target)
        if digest(target) != expected or digest(ROOT / relative) != expected:
            raise ValueError('Count-calibration preservation source changed')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': 'complete-own-attention-count-calibration-training-only',
                'targetMet': False, 'files': copied, 'externalPinnedDependencies': dependencies, 'wholeCountMeasurementIncluded': True,
                'exactCompletedBaselineCrosschecks': 80, 'originalNumericLedgerHashes': ledgers,
                'note': 'Complete80-board count calibration, not held or genuine future accuracy. The measured runtime/data remain '
                        'pinned at their actual immutable run paths; current developing forecast code is preserved separately, '
                        'not retroactively called the measurement source. Scalar hazard correction is retained as a failed '
                        'development hypothesis. No new-family numeric forecast has been frozen.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    result = {'snapshot': folder.relative_to(ROOT).as_posix(), 'manifestSha256': digest(folder / 'manifest.json'),
              'files': len(copied), 'dependencies': len(dependencies), 'targetMet': False}
    (ROOT / 'analysis/personal-bots/attention-count-preservation.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
