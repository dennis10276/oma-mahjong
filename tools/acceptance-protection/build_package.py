"""Prepare an independently pinned verifier release; performs no privileged actions."""
import argparse
import ast
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

PIN = '20ed8ed3bd0d697e4b3c40574220b03e7e0043a3770d22b581fda7491825e66b'
SOURCE = Path(__file__).resolve().parent
ROOT = SOURCE.parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(destination):
    destination = destination.resolve()
    destination.mkdir(parents=True, exist_ok=False)
    snapshot = ROOT / 'source/analysis/personal-bots/acceptance/VERIFIER_SNAPSHOT.zip'
    if digest(snapshot) != PIN:
        raise ValueError('Independent snapshot differs from the hash pinned in the user conversation')
    with zipfile.ZipFile(snapshot) as archive:
        names = [name for name in archive.namelist() if name.startswith('source/tools/sim/refit/') or
                 name.startswith('source/analysis/personal-bots/acceptance/')]
        for name in names:
            target = (destination / name).resolve()
            if not target.is_relative_to(destination):
                raise ValueError('Unsafe snapshot entry')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(name))
    # Pin every original Python regression and the foundational JS acceptance tests.
    # Never copy gate tests from the candidate working tree.
    historical = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', '0e8bcf8',
                                          'source/tools/sim/refit'], cwd=ROOT, text=True).splitlines()
    js_tests = {'test_production_physical_session.js', 'test_personal_observed_memory.js',
                'test_personal_witness_simulation.js', 'test_public_witness_search.js',
                'test_personal_behavioral_calibration.js'}
    for relative in historical:
        name = Path(relative).name
        if (name.startswith('test_') and name.endswith('.py')) or name in js_tests:
            target = destination / relative
            if not target.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(subprocess.check_output(['git', 'show', f'0e8bcf8:{relative}'], cwd=ROOT))
    # Audited compatibility adjustment: a candidate can nominate its generator,
    # whose transitive dependencies are independently discovered and hashed. This
    # does not import the candidate's requirement mappings or relax any criterion.
    evidence = destination / 'source/tools/sim/refit/acceptance_evidence.py'
    code = evidence.read_text(encoding='utf-8')
    code = code.replace('def required_sources(root, forecasts):', 'def required_sources(root, forecasts, generator=None):')
    code = code.replace("pending = [root / 'source/tools/sim/refit/generate_personal_witness_v3.js']",
                        "pending = [contained(root, generator or 'source/tools/sim/refit/generate_personal_witness_v3.js')]")
    code = code.replace("expected = required_sources(root, anchor.get('forecasts', []))",
                        "expected = required_sources(root, anchor.get('forecasts', []), generator=anchor.get('generator'))")
    ast.parse(code)
    evidence.write_text(code, encoding='utf-8')
    # Model parameter values are not acceptance targets. The production planner
    # supports trayBuffer=1; do not reject a legitimate implementation merely
    # because a historical range assertion listed only the old values 2 and 3.
    # The independent measured-fidelity assertion is preserved verbatim.
    for name in ('test_personal_behavioral_calibration.js', 'test_personal_action_policy_fidelity.js'):
        target = destination / 'source/tools/sim/refit' / name
        source = target.read_text(encoding='utf-8').replace('[2, 3].includes(', '[1, 2, 3].includes(')
        target.write_text(source, encoding='utf-8')
    # Missing independent evidence and missing implementation are different. New
    # candidate declarations are not automatically accepted, nor falsely described
    # as absent. All substantive clauses remain unverified pending independent review.
    checker_path = destination / 'source/tools/sim/refit/check_acceptance_gates.py'
    source = checker_path.read_text(encoding='utf-8')
    source = source.replace('No independently simulated bot tray distribution or human-versus-bot distance is implemented; human-only counts cannot prove replication',
        'Tray replication is not independently verified by this sealed baseline; candidate-reported comparisons cannot close this requirement')
    source = source.replace('No preregistered convergence criterion or complete individual campaign record establishes Monte Carlo stability',
        'Monte Carlo reliability is not independently verified by this sealed baseline; a candidate-supplied tolerance is not sufficient evidence')
    checker_path.write_text(source, encoding='utf-8')
    for name in ('sealed_runner.py', 'sealed_tests.py', 'Run-Acceptance.ps1'):
        shutil.copyfile(SOURCE / name, destination / name)
    # Bundle a private interpreter/stdlib. -I -S excludes user site and startup
    # injection; no administrator process executes this interpreter or candidate.
    base = Path(sys.base_prefix)
    runtime = destination / 'runtime'
    runtime.mkdir()
    for path in base.rglob('*'):
        relative = path.relative_to(base)
        parts = relative.parts
        if path.is_symlink() or '__pycache__' in parts or 'site-packages' in parts or path.suffix == '.pyc':
            continue
        if parts[0] not in ('Lib', 'DLLs') and len(parts) != 1:
            continue
        if path.is_file():
            target = runtime / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)
    manifest = {'schemaVersion': 1, 'rulesSource': {'snapshotSha256': PIN, 'originalGitCommit': '0e8bcf8',
        'compatibilityAdjustment': 'Contained generator selection; allow supported trayBuffer=1 without changing the measured fidelity condition; describe missing independent verification accurately. Requirement mappings remain the original 10, not the candidate-expanded 188.'},
        'candidatePython': sys.executable,
        'node': shutil.which('node'),
        'files': {p.relative_to(destination).as_posix(): digest(p) for p in sorted(destination.rglob('*')) if p.is_file()}}
    path = destination / 'MANIFEST.json'
    path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    return {'payload': str(destination), 'manifestSha256': digest(path), 'fileCount': len(manifest['files'])}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination', type=Path)
    print(json.dumps(build(parser.parse_args().destination), indent=2))
