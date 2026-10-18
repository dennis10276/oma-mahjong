import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from personal_value_fit import ARCHIVE, ROOT, digest


def contained(root, name):
    root = root.resolve()
    path = (root / name).resolve()
    if not path.is_relative_to(root) or path == root:
        raise ValueError('Frozen-run path escapes its declared source or destination')
    return path


def materialize(snapshot, source_root, runs_root, runtime_names=()):
    manifest = json.loads((snapshot / 'manifest.json').read_bytes())
    selected = {}
    for filename, expected in manifest['files'].items():
        selected[filename] = (contained(snapshot, filename), expected)
    for filename, expected in manifest.get('externalPinnedDependencies', {}).items():
        if filename in selected and selected[filename][1] != expected:
            raise ValueError('Frozen-run manifest contains conflicting dependencies')
        if filename not in selected:
            selected[filename] = (contained(source_root, filename), expected)
    runtime_dependencies = {}
    for filename in runtime_names:
        if filename not in selected:
            source = contained(source_root, filename)
            selected[filename] = (source, digest(source))
        runtime_dependencies[filename] = selected[filename][1]
    required = ['tools/sim/refit/personal_known_plan_count_data.js', 'www/hard.js']
    if any(filename not in selected for filename in required):
        raise ValueError('Frozen-run snapshot does not contain its count engine')
    needed = 0
    for filename, (path, expected) in selected.items():
        contained(runs_root, filename)
        if digest(path) != expected:
            raise ValueError('Frozen-run source differs from the pinned measurement: ' + filename)
        needed += path.stat().st_size
    if shutil.disk_usage(source_root).free < needed + 1024 ** 3:
        raise ValueError('Insufficient disk space to freeze inputs while retaining a one-GiB reserve')
    stamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z').replace(':', '-').replace('.', '-')
    folder = runs_root / ('known-plan-' + stamp)
    folder.mkdir(parents=True)
    copied = {}
    for filename, (source, expected) in selected.items():
        destination = contained(folder, filename)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        if digest(destination) != expected or digest(source) != expected:
            raise ValueError('Frozen-run input changed while being copied')
        copied[filename] = expected
    proof = {'made': datetime.now(timezone.utc).isoformat(), 'inputSnapshot': str(snapshot.resolve()),
             'inputManifestSha256': digest(snapshot / 'manifest.json'), 'sourceInputs': copied,
             'additionalRuntimeDependencies': runtime_dependencies,
             'requiredEnvironment': {'TABLES': 'tools/sim/refit/tables'},
             'targetMet': False, 'note': 'Independent copied runtime/data closure, with every transitive declared input verified. '
                 'Node module-relative paths resolve inside this run, not the mutable working checkout. '
                 'Only run outputs/progress are written here; editing or refreshing the original checkout cannot change these source inputs. '
                 'This prepares computation, not a winning-try accuracy claim.'}
    (folder / 'run-manifest.json').write_text(json.dumps(proof, indent=2), encoding='utf-8')
    return folder


def main(name):
    snapshots = (ARCHIVE / 'experiments').resolve()
    snapshot = Path(name)
    snapshot = snapshot.resolve() if snapshot.is_absolute() else contained(snapshots, name)
    if not snapshot.is_relative_to(snapshots):
        raise ValueError('Use an explicitly pinned experiment snapshot from this workspace')
    manifest = json.loads((snapshot / 'manifest.json').read_bytes())
    if manifest.get('evidence') != 'historical-exploratory-known-plan-count-pilot':
        raise ValueError('Use a complete paired-count pilot closure, not a feature-only snapshot')
    if 'tools/sim/refit/personal_known_plan_count_fit.py' not in manifest['files']:
        raise ValueError('Frozen winning-count run also needs its predeclared scoring source')
    runtime_names = ['tools/sim/refit/mimic/' + name + '.json' for name in ['Dennisisdebeste', 'Mrs_Doubtfire', 'PUK', 'Gerda']]
    folder = materialize(snapshot, ROOT, ARCHIVE / 'runs', runtime_names)
    print(json.dumps({'runRoot': str(folder), 'snapshot': str(snapshot),
                      'environment': {'TABLES': str(folder / 'tools/sim/refit/tables')},
                      'command': ['node', 'tools/sim/refit/personal_known_plan_count_data.js']}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('snapshot')
    main(parser.parse_args().snapshot)
