import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

from personal_full_choice_fit import validate
from personal_value_fit import ARCHIVE, DATA, PINNED, ROOT, digest


def main(alignment=False):
    report_file = ROOT / 'analysis/personal-bots/personal-value-count-evaluation.json'
    report = json.loads(report_file.read_bytes())
    if report['targetMet'] or report['evidence'] != 'historical-exploratory-personal-value':
        raise ValueError('Value snapshot must preserve exploratory status')
    for name, expected in report['inputHashes'].items():
        if digest(ARCHIVE / name) != expected:
            raise ValueError('Value measurement changed before snapshot')
    for name, expected in report['fitSourceHashes'].items():
        if digest(Path(__file__).with_name(name)) != expected:
            raise ValueError('Value fit source changed before snapshot')
    for name, field in [('personal-value-models.json', 'modelsSha256'),
                        ('personal-value-opening-features.json', 'openingFeaturesSha256'),
                        ('personal-value-count-scored.json', 'scoredSha256')]:
        if digest(ARCHIVE / name) != report[field]:
            raise ValueError('Value output changed before snapshot')
    data = json.loads(DATA.read_bytes())
    openings = json.loads((ARCHIVE / 'personal-value-openings.json').read_bytes())
    validate(data)
    validate(openings)
    parent_manifest = json.loads((PINNED / 'manifest.json').read_bytes())
    parent_files = {'prefix': 'policy-memory-prefix-data.json', 'bank': 'physical-memory-policy-bank.json',
                    'requests': 'physical-count-requests.json', 'count': 'physical-memory-count-data.json',
                    'scored': 'physical-memory-count-scored.json'}
    dependencies = {}
    for key, name in parent_files.items():
        relative = 'analysis/archive/personal-bots/' + name
        path = PINNED / relative
        if digest(path) != report['pinnedControlHashes'][key] or digest(path) != parent_manifest['files'][relative]:
            raise ValueError('Pinned value control changed before snapshot')
        dependencies[path.relative_to(ROOT).as_posix()] = digest(path)
    files = set(data['fingerprintFiles'] + openings['fingerprintFiles'])
    files.update(path.relative_to(ROOT).as_posix() for path in Path(__file__).parent.iterdir()
                 if path.suffix in ['.js', '.py', '.md'])
    files.update('analysis/archive/personal-bots/' + name for name in report['inputHashes'])
    files.update('analysis/archive/personal-bots/' + name for name in
                 ['personal-value-models.json', 'personal-value-opening-features.json', 'personal-value-count-scored.json'])
    files.update(['tests/t_personal_bots.js', 'analysis/personal-bots/WORK_LOG.md',
                  'analysis/personal-bots/personal-value-count-evaluation.json',
                  'analysis/personal-bots/personal-value-fit-output.txt',
                  'analysis/personal-bots/personal-value-openings-output.txt',
                  'analysis/personal-bots/progression-prospective-results.json'])
    files.update('analysis/personal-bots/' + name + '-forecasts.json' for name in
                 ['prospective', 'kind-prospective', 'count-profile-prospective', 'progression-prospective'])
    if alignment:
        action_file = ROOT / 'analysis/personal-bots/personal-value-action-evaluation.json'
        action = json.loads(action_file.read_bytes())
        if action['targetMet'] or action['evidence'] != 'historical-exploratory-personal-value-alignment':
            raise ValueError('Value alignment must preserve exploratory status')
        for name, expected in action['inputHashes'].items():
            if digest(ROOT / name) != expected:
                raise ValueError('Value alignment input changed before snapshot')
        for name, expected in action['fitSourceHashes'].items():
            if digest(Path(__file__).with_name(name)) != expected:
                raise ValueError('Value alignment source changed before snapshot')
        if digest(ARCHIVE / 'personal-value-alignment-models.json') != action['modelsSha256']:
            raise ValueError('Value alignment models changed before snapshot')
        control_name = 'analysis/personal-bots/personal-memory-action-evaluation.json'
        control_path = PINNED / control_name
        if digest(control_path) != parent_manifest['files'][control_name]:
            raise ValueError('Pinned action controls changed before snapshot')
        controls = json.loads(control_path.read_bytes())
        for name, scopes in action['players'].items():
            for scope, measured in scopes.items():
                previous = controls['players'][name]['models'][scope]
                current = measured['methods']['control']
                for field in ['decisions', 'jointLogLoss', 'topActionAccuracy']:
                    if not math.isclose(previous[field], current[field], rel_tol=1e-12, abs_tol=1e-12):
                        raise ValueError('Value alignment changed a pinned action control')
        dependencies[control_path.relative_to(ROOT).as_posix()] = digest(control_path)
        files.update(['analysis/archive/personal-bots/personal-value-alignment-models.json',
                      'analysis/personal-bots/personal-value-action-evaluation.json',
                      'analysis/personal-bots/personal-value-action-output.txt'])
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = ARCHIVE / 'experiments' / ('personal-value-' + ('alignment-' if alignment else '') + stamp)
    folder.mkdir()
    hashes = {}
    for name in sorted(files):
        source = ROOT / name
        destination = folder / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source.read_bytes())
        hashes[name] = digest(destination)
        if hashes[name] != digest(source):
            raise ValueError('Source changed during value snapshot')
    manifest = {'made': datetime.now(timezone.utc).isoformat(), 'evidence': action['evidence'] if alignment else report['evidence'], 'targetMet': False,
                'files': hashes, 'externalPinnedDependencies': dependencies,
                'note': 'Own-person value-critic experiment with unchanged original personal actors/count controls. '
                        'External controls remain in the named immutable memory archive; their exact paths/hashes are required. '
                        'All new measurements, fits, count scores, raw inputs, sources and unchanged numeric ledgers are copied. '
                        'When alignment is included, every action control also matches its pinned earlier metrics. '
                        'This is not a prospective 80% claim, a released bot or a new forecast.'}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(folder, len(files), 'pinned files,', len(dependencies), 'explicit pinned dependencies')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--alignment', action='store_true')
    main(parser.parse_args().alignment)
