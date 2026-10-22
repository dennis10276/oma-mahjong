"""Run the independently pinned acceptance rules, never a repository's gate definitions."""
import argparse
import ctypes
import hashlib
import importlib
import json
from pathlib import Path
import sys

SEALED = Path(__file__).resolve().parent


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    if sys.platform == 'win32' and ctypes.windll.shell32.IsUserAnAdmin():
        raise SystemExit('REFUSED: run acceptance without administrator privileges. Candidate code must never run elevated.')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repository', type=Path, required=True)
    parser.add_argument('--ledger', required=True)
    parser.add_argument('--outcomes')
    parser.add_argument('--output', default='ACCEPTANCE_GATE.json')
    args = parser.parse_args()
    manifest_path = SEALED / 'MANIFEST.json'
    manifest = json.loads(manifest_path.read_bytes())
    for relative, expected in manifest['files'].items():
        path = (SEALED / relative).resolve()
        if not path.is_relative_to(SEALED) or not path.is_file() or sha(path) != expected:
            raise SystemExit(f'REFUSED: protected verifier integrity failure: {relative}')
    repo = args.repository.resolve(strict=True)
    if repo == SEALED or repo.is_relative_to(SEALED):
        raise SystemExit('Repository must be a separate, editable candidate checkout')
    refit = repo / 'source/tools/sim/refit'
    trusted_refit = SEALED / 'source/tools/sim/refit'
    sys.path.insert(0, str(trusted_refit))
    # -I -S plus the bundled interpreter excludes repository/site startup hooks.
    checker = importlib.import_module('check_acceptance_gates')
    checker.ROOT = repo
    checker.REFIT = refit
    checker.AUDIT = SEALED / 'source/analysis/personal-bots/acceptance'
    checker.DEFAULT_LEDGER = (repo / args.ledger).resolve()
    python_worker = manifest['candidatePython']
    node_worker = manifest['node']
    original_command = checker.command

    def command(argv, timeout=180):
        argv = list(map(str, argv))
        if argv[0] == 'node':
            argv[0] = node_worker
        if len(argv) > 4 and argv[0] == sys.executable and '-m' in argv and 'unittest' in argv:
            pattern = argv[argv.index('-p') + 1]
            argv = [sys.executable, '-I', '-S', '-B', str(SEALED / 'sealed_tests.py'),
                    str(repo), pattern, python_worker]
        elif argv[0] == sys.executable:
            # Diagnostics imports the candidate's dependencies. This is an
            # unprivileged subprocess, never an administrator/SYSTEM process.
            argv[0] = python_worker
        return original_command(argv, timeout)

    def node(script):
        path = trusted_refit / script
        if not path.is_file():
            return checker.record([f'No independently pinned test: {script}'])
        # Compile pinned test bytes with the candidate's logical module location,
        # so relative imports exercise candidate code without using candidate tests.
        source = "const fs=require('fs'),Module=require('module'),path=require('path');" \
            "const logical=process.argv[2],m=new Module(logical,module);" \
            "m.filename=logical;m.paths=Module._nodeModulePaths(path.dirname(logical));" \
            "m._compile(fs.readFileSync(process.argv[1],'utf8'),logical);"
        receipt = command([node_worker, '-e', source, str(path), str(refit / script)])
        return checker.record([] if receipt['exitCode'] == 0 else [f'Pinned {script} failed'], receipt=receipt)

    checker.command = command
    checker.node = node
    print(f'PROTECTED VERIFIER: {SEALED}', flush=True)
    print(f'Protected manifest SHA256: {sha(manifest_path)}', flush=True)
    print('Repository verifier/mappings/tests are NOT authoritative. Unverified requirements stay open.', flush=True)
    sys.argv = ['sealed-check', '--ledger', str(checker.DEFAULT_LEDGER),
                '--output', str((repo / args.output).resolve())]
    if args.outcomes:
        sys.argv.extend(['--outcomes', str((repo / args.outcomes).resolve())])
    else:
        checker.DEFAULT_OUTCOMES = repo / 'source/analysis/archive/personal-bots/live-openings-2026-10-20T15-29-12-622Z/personal-outcomes.json'
    result = checker.main()
    output = (repo / args.output).resolve()
    if output.exists():
        report = json.loads(output.read_bytes())
        report['verifierAuthority'] = {'directory': str(SEALED),
            'manifestSha256': sha(manifest_path), 'rulesSource': manifest['rulesSource'],
            'repositoryGateDefinitionsUsed': False,
            'reportSecurity': 'Local report is editable and is not a signed certification; verify the protected console run independently.'}
        output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return result


if __name__ == '__main__':
    sys.exit(main())
