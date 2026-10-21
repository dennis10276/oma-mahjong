"""Fail-closed acceptance audit. No model registration or forecast writes occur here."""
import argparse
from datetime import datetime, timezone
import json
import subprocess
import sys
import time
from pathlib import Path

from acceptance_evidence import (BASELINE_SHA256, CONTRACT_SHA256, NAMES, digest,
    validate_stability,
    fidelity_errors, parse_contract, prospective_errors, rollup, tray_comparison_errors,
    validate_campaigns, validate_sources, verify_baseline)

ROOT = Path(__file__).resolve().parents[4]
REFIT = ROOT / 'source/tools/sim/refit'
AUDIT = ROOT / 'source/analysis/personal-bots/acceptance'
DEFAULT_LEDGER = ROOT / 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v3.jsonl'
DEFAULT_OUTCOMES = ROOT / 'source/analysis/archive/personal-bots/live-openings-2026-10-20T15-29-12-622Z/personal-outcomes.json'


def command(argv, timeout=180):
    started = time.monotonic()
    try:
        res = subprocess.run(argv, cwd=ROOT, capture_output=True, text=True, timeout=timeout, encoding='utf-8')
        return {'command': argv, 'cwd': str(ROOT), 'exitCode': res.returncode,
                'durationSeconds': round(time.monotonic() - started, 3),
                'stdout': res.stdout, 'stderr': res.stderr}
    except (OSError, subprocess.TimeoutExpired) as error:
        return {'command': argv, 'cwd': str(ROOT), 'exitCode': None, 'error': str(error),
                'durationSeconds': round(time.monotonic() - started, 3)}


def record(errors=(), **details):
    return {'status': 'FAIL' if errors else 'PASS', 'errors': list(errors), **details}


def node(script):
    receipt = command(['node', str(REFIT / script)])
    return record([] if receipt['exitCode'] == 0 else [f'{script} did not pass'], receipt=receipt)


def load_ledger(path):
    snapshots = [json.loads(line) for line in path.read_text(encoding='utf-8-sig').splitlines() if line.strip()]
    if len(snapshots) != 1:
        raise ValueError('A registered candidate must have exactly one immutable anchor; adaptation needs its own validated protocol')
    return snapshots[0]


def collect_checks(ledger_path, outcomes_path):
    checks = {}
    checks['history.integrity'] = record(verify_baseline(ROOT, (AUDIT / 'AUDIT_BASELINE.json').read_bytes()))
    for ident, filename in [('physics.tests', 'test_production_physical_session.js'),
                            ('information.boundary_regressions', 'test_personal_information_boundary.js'),
                            ('memory.tests', 'test_personal_observed_memory.js'),
                            ('simulation.tests', 'test_personal_witness_simulation.js'),
                            ('search.tests', 'test_public_witness_search.js'),
                            ('calibration.tests', 'test_personal_behavioral_calibration.js'),
                            ('dataset.tests', 'test_human_decision_dataset.js'),
                            ('registration.guard', 'test_personal_registration_guard.js')]:
        checks[ident] = node(filename)
    # This is a behavioral acceptance test: an honest negative result is expected
    # to keep G3 open, not to be recategorized as infrastructure success.
    checks['fidelity.acceptance_test'] = node('test_personal_action_policy_fidelity.js')
    evaluator = command(['node', '-e', "const {evaluateActionPolicyFidelity:e}=require('./source/tools/sim/refit/personal_action_policy_evaluation.js'); console.log(JSON.stringify({sample20:e(20),sample30:e(30)}));"])
    try:
        if evaluator['exitCode'] != 0:
            raise ValueError('Action evaluator did not complete')
        results = json.loads(evaluator['stdout'])
        errors = [f'{sample}: {error}' for sample, values in results.items() for error in fidelity_errors(values)]
        if set(results) != {'sample20', 'sample30'}:
            errors.append('Both declared sample sizes are required')
        checks['fidelity.minimum'] = record(errors, measurements=results, receipt=evaluator,
            limitation='A minimum screen only. Passing this cannot establish all G3 requirements, independent test blocks, probability calibration or personal identification.')
    except (ValueError, TypeError) as error:
        checks['fidelity.minimum'] = record([str(error)], receipt=evaluator)
    try:
        tray_errors = [f'{sample}: {error}' for sample, values in results.items() for error in tray_comparison_errors(values)]
        checks['fidelity.tray_comparison'] = record(tray_errors,
            measurements={sample: {name: results[sample][name].get('trayComparison') for name in NAMES if name in results.get(sample, {})} for sample in ('sample20', 'sample30')},
            limitation='Evaluates simulated bot rollout tray occupancy against human chronological test decisions.')
    except Exception as error:
        checks['fidelity.tray_comparison'] = record(['No independently simulated bot tray distribution or human-versus-bot distance is implemented; human-only counts cannot prove replication'])
    try:
        anchor = load_ledger(ledger_path)
        checks['forecast.sources'] = record(validate_sources(ROOT, anchor), model=anchor.get('model'))
        checks['forecast.campaigns'] = record(validate_campaigns(anchor), model=anchor.get('model'), forecastCount=len(anchor.get('forecasts', [])))
        checks['forecast.stability'] = record(validate_stability(anchor), model=anchor.get('model'))
    except (OSError, ValueError, TypeError, KeyError) as error:
        anchor = None
        for ident in ('forecast.sources', 'forecast.campaigns', 'forecast.stability'):
            checks[ident] = record([str(error)])
    checks['prospective.target'] = evaluate_prospective(ledger_path, outcomes_path, anchor)
    receipt = command([sys.executable, '-B', '-m', 'unittest', 'discover', '-s', str(REFIT), '-p', 'test_acceptance_evidence.py', '-v'], timeout=180)
    checks['checker.adversarial_tests'] = record([] if receipt['exitCode'] == 0 else ['Adversarial checker tests failed'], receipt=receipt)
    receipt = command([sys.executable, '-B', '-m', 'unittest', 'discover', '-s', str(REFIT), '-p', 'test_*.py'], timeout=180)
    checks['python.suite'] = record([] if receipt['exitCode'] == 0 else ['Python regression suite failed'], receipt=receipt)
    return checks


def evaluate_prospective(ledger_path, outcomes_path, anchor=None):
    try:
        anchor = anchor or load_ledger(ledger_path)
        # Always evaluate the selected candidate, never use a baseline model's score.
        receipt = command([sys.executable, '-B', str(REFIT / 'personal_forecast_diagnostics.py'), str(ledger_path), str(outcomes_path)])
        if receipt['exitCode'] != 0:
            return record(['Prospective scorer failed'], receipt=receipt)
        report = json.loads(receipt['stdout'])
        errors = prospective_errors(report)
        if report.get('model') != anchor.get('model'):
            errors.append('Scorer evaluated a different candidate')
        raw = json.loads(outcomes_path.read_bytes())
        if raw.get('evidence') != 'separate-live-completed-and-pending-outcomes':
            errors.append('Synthetic/test outcomes cannot satisfy G6')
        # Rebuild episodes from the independently archived plays and manifest in
        # memory. Declaring evidence="live" in JSON is insufficient.
        reconstruction = command(['node', '-e', "const fs=require('fs'); const {buildReport}=require('./source/tools/sim/refit/personal_live_outcomes.js'); const report=buildReport(process.argv[1]); console.log(JSON.stringify(report));", str(outcomes_path.parent)])
        if reconstruction['exitCode'] != 0:
            errors.append('Live outcome provenance could not be reconstructed')
        else:
            rebuilt = json.loads(reconstruction['stdout'])
            for key in ('episodes', 'observedAt', 'liveManifestSha256', 'playsSha256', 'previousOutcomeSha256', 'unresolvedBoards'):
                if raw.get(key) != rebuilt.get(key):
                    errors.append(f'Live outcome differs from archived evidence: {key}')
        if raw.get('unresolvedBoards', 0):
            errors.append('Unresolved board identities require explicit cohort audit; they cannot silently disappear')
        if not anchor.get('model', '').startswith('source-bound-personal-witness-'):
            errors.append('Selected candidate is not the personal playing-policy pipeline')
        # Frozen-source authentication remains mandatory independently of numeric scores.
        source_errors = validate_sources(ROOT, anchor)
        if source_errors:
            errors.append('Candidate source/input provenance is not authenticated; see forecast.sources')
        return record(errors, ledger=str(ledger_path.resolve()), ledgerSha256=digest(ledger_path.read_bytes()),
            outcomes=str(outcomes_path.resolve()), outcomesSha256=digest(outcomes_path.read_bytes()),
            measurements=report, receipt=receipt, outcomeReconstruction=reconstruction,
            limitation='Local archive consistency is not proof of server authenticity; an independent reviewer must retain the raw live export.')
    except (OSError, ValueError, TypeError, KeyError) as error:
        return record([str(error)], ledger=str(ledger_path), outcomes=str(outcomes_path))


# Explicit, narrow verification bindings. Every unmapped original clause stays
# UNVERIFIED. A future implementation needs a substantive verifier here, not an
# edited PASS field in a report. Unit tests do not close entire behavioral sections.
REQUIREMENT_CHECKS = {
    '- Preserve existing ledgers; do not overwrite a registered model version.': ['history.integrity', 'registration.guard'],
    '- Never alter an already registered candidate’s cohort or predictions.': ['history.integrity', 'registration.guard'],
    '- Require at least16/20 correct for EACH person.': ['prospective.target'],
    '- Require legitimate before-opening forecasts for all20.': ['prospective.target'],
    '- Pending games are not completed successes.': ['prospective.target'],
    '- Separate later replays from retries within the same campaign.': ['dataset.tests'],
    '- Retain all campaign results—not only the best or most human-looking run.': ['forecast.campaigns'],
    '- Bind the actual forecast generator, full dependencies, calibration inputs and training provenance.': ['forecast.sources'],
    '- A parent cannot complete while a dependency or child remains incomplete.': ['checker.adversarial_tests'],
    '- Status changes must be justified by evidence, not by a desire to finish.': ['checker.adversarial_tests'],
    '- Tray occupancy and risk distributions.': ['fidelity.tray_comparison'],
    '- Tray-space tolerance and recovery behavior.': ['fidelity.tray_comparison'],
    '- Chosen-action likelihood and ranking.': ['fidelity.minimum', 'fidelity.acceptance_test'],
    '- Default policy/memory seeds must be independent of concealed tile contents.': ['information.boundary_regressions'],
    '- Apply forgetting in one persistent memory layer, not repeatedly inside search wrappers, beam nodes or guarded probes.': ['information.boundary_regressions'],
    '- Freeze prior-attempt knowledge before processing the current retry.': ['memory.tests'],
    '- Do not count current-attempt discoveries as earlier-attempt recall.': ['memory.tests'],
    '- Return wonOn=null when no clear occurred.': ['simulation.tests'],
    '- Correct tray overflow, peek matching and victory conditions.': ['physics.tests'],
    '- Correct keys, ice, locks, Joker and arrivals.': ['physics.tests'],
    '- Correct inspection/removal costs and clock deadlines.': ['physics.tests'],
    '- Retry only after an actual completed loss.': ['simulation.tests'],
    '- Keep the chosen action and subsequent reveal as targets/outcomes, not leaked input features.': ['dataset.tests'],
    '- Distinguish actual inspections from repeated peek fields in state messages.': ['dataset.tests'],
    '- Distinguish single tray additions, tray matches and board/peek matches.': ['dataset.tests'],
    '- Bind exact board identity and local campaign identity.': ['dataset.tests'],
    '- Require at least 2 campaigns per forecast; single-run samples cannot establish a distribution.': ['forecast.campaigns'],
    '- Recompute distributions and point forecasts from the individual campaign runs.': ['forecast.campaigns'],
    '- Check for duplicate forecasts, duplicate seeds or non-monotonic attempt histories.': ['forecast.campaigns'],
    '- Check for Monte Carlo stability across campaign counts.': ['forecast.stability'],
}

CHECK_GATES = {
    'history.integrity': 'G0', 'checker.adversarial_tests': 'G0', 'physics.tests': 'G1',
    'python.suite': 'G0',
    'information.boundary_regressions': 'G1',
    'memory.tests': 'G4', 'simulation.tests': 'G1', 'search.tests': 'G1',
    'calibration.tests': 'G2', 'dataset.tests': 'G2', 'registration.guard': 'G5',
    'fidelity.acceptance_test': 'G3', 'fidelity.minimum': 'G3', 'fidelity.tray_comparison': 'G3',
    'forecast.sources': 'G5', 'forecast.campaigns': 'G5', 'forecast.stability': 'G5',
    'prospective.target': 'G6',
}


def requirement_rows():
    rows = parse_contract((AUDIT / 'EXECUTION_CONTRACT.txt').read_bytes())
    for row in rows:
        row['checks'] = REQUIREMENT_CHECKS.get(row['requirement'], [])
    for ident, gate in CHECK_GATES.items():
        rows.append({'id': f'AUDIT.{ident}', 'section': 'audit', 'sourceLine': None,
                     'requirement': f'Independent evidence check: {ident}', 'gate': gate,
                     'checks': [ident]})
    return rows


def evidence_hashes(extra_paths=()):
    paths = [*REFIT.glob('*.py'), *REFIT.glob('*.js'), *REFIT.glob('tables/*.js'),
             ROOT / 'source/www/hard.js', ROOT / 'source/www/layouts.js',
             AUDIT / 'EXECUTION_CONTRACT.txt', AUDIT / 'AUDIT_BASELINE.json', ROOT / 'EXPERIMENTS.jsonl',
             ROOT / 'AGENTS.md', ROOT / 'GEMINI.md', ROOT / 'ACCEPTANCE_REVIEW.md',
             ROOT / 'source/analysis/personal-bots/personal-behavioral-fit.json']
    paths.extend((ROOT / 'source/analysis/archive/replays').glob('*.json'))
    paths.extend(extra_paths)
    return {(p.relative_to(ROOT).as_posix() if p.is_relative_to(ROOT) else str(p)):
            digest(p.read_bytes()) if p.exists() else 'MISSING' for p in sorted(set(paths))}


def render_rtm(report):
    lines = ['# Requirements Traceability Matrix', '',
        'Generated by `python -B source/tools/sim/refit/check_acceptance_gates.py` from the pinned user contract.',
        'INCOMPLETE. Unmapped or missing behavioral evidence is UNVERIFIED. Documentation and parameter bounds cannot close it.',
        f"Evidence Git HEAD: `{report['git']['head']}`. Working tree changes and source/input hashes are recorded in ACCEPTANCE_GATE.json; an uncommitted implementation has no verified implementation commit.",
        'Earlier claims remain in `source/analysis/personal-bots/acceptance/REQUIREMENTS_RTM.before-hardening.md`.', '',
        '| Gate | Verified / total | Status | Unmet dependencies |', '| --- | --- | --- | --- |']
    for gate, value in report['gates'].items():
        lines.append(f"| {gate} | {value['verifiedRequirements']} / {value['requirements']} | {value['status']} | {', '.join(value['unmetDependencies']) or 'None'} |")
    lines += ['', '| ID | Contract line | Gate | Requirement (verbatim) | Checks / actual result | Status |',
              '| --- | --- | --- | --- | --- | --- |']
    for row in report['requirements']:
        evidence = ('Rollup of all ' + str(len(row['children'])) + ' children' if row.get('children') else
            '; '.join(f"{c}: {report['checks'].get(c, {}).get('status', 'UNVERIFIED')}" for c in row['checks']) or 'No substantive verifier implemented')
        text = row['requirement'].replace('|', '&#124;')
        lines.append(f"| {row['id']} | {row['sourceLine'] or 'audit'} | {row['gate']} | {text} | {evidence} | {row['status']} |")
    lines += ['', 'Every original nonempty requirement line is retained. Compound clauses remain open until all their parts have evidence.',
        'Gate dependencies are enforced independently of local row results. The JSON report contains commands, actual outputs, hashes and failure reasons.',
        'No valid implementation commit is inferred from a claim in an experiment or an older RTM. Add an independently checked implementation/evidence binding before promoting an unverified row.', '']
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ledger', type=Path, default=DEFAULT_LEDGER)
    parser.add_argument('--outcomes', type=Path, default=DEFAULT_OUTCOMES)
    parser.add_argument('--output', type=Path, default=ROOT / 'ACCEPTANCE_GATE.json')
    args = parser.parse_args()
    output = args.output.resolve()
    # Reports must never be written over a selected ledger, raw evidence or source.
    if (output in (args.ledger.resolve(), args.outcomes.resolve()) or output.suffix != '.json'
            or (output.is_relative_to(ROOT / 'source') and not output.is_relative_to(AUDIT / 'runs'))):
        parser.error('Output must be a JSON report outside source inputs (or under acceptance/runs), never a ledger or outcome file')
    raw_inputs = [args.ledger.resolve(), args.outcomes.resolve(),
                  args.outcomes.resolve().parent / 'manifest.json', args.outcomes.resolve().parent / 'plays.json',
                  ROOT / 'source/analysis/archive/personal-bots/prospective-outcomes.json']
    before = evidence_hashes(raw_inputs)
    checks = collect_checks(args.ledger.resolve(), args.outcomes.resolve())
    if evidence_hashes(raw_inputs) != before:
        checks['history.integrity'] = record(['Sources or inputs changed while the audit ran; discard mixed-version evidence'])
    rows, gates = rollup(requirement_rows(), checks)
    head = command(['git', 'rev-parse', 'HEAD'])
    dirty = command(['git', 'status', '--porcelain=v1', '--untracked-files=all'])
    report = {'schemaVersion': 2, 'evaluatedAt': datetime.now(timezone.utc).isoformat(),
        'allGatesPassed': all(g['passed'] for g in gates.values()),
        'summary': 'INCOMPLETE: substantive engineering/evidence gaps remain. Future human outcomes are not the only dependency.',
        'contractSha256': CONTRACT_SHA256, 'baselineSha256': BASELINE_SHA256,
        'git': {'head': head.get('stdout', '').strip(), 'status': dirty.get('stdout', ''),
                'implementationCommitVerified': False},
        'selectedLedger': str(args.ledger.resolve()), 'selectedOutcomes': str(args.outcomes.resolve()),
        'sourceAndInputHashes': before, 'checks': checks, 'requirements': rows, 'gates': gates}
    if report['allGatesPassed']:
        report['summary'] = 'All mandatory requirements and dependent gates verified by this audit.'
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    (ROOT / 'REQUIREMENTS_RTM.json').write_text(json.dumps({'contractSha256': CONTRACT_SHA256, 'requirements': rows}, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    (ROOT / 'REQUIREMENTS_RTM.md').write_text(render_rtm(report), encoding='utf-8')
    for gate, value in gates.items():
        print(f"{gate}: {value['status']} ({value['verifiedRequirements']}/{value['requirements']} requirements verified)")
    for ident, value in checks.items():
        if value['status'] != 'PASS':
            print(f"FAIL {ident}: " + '; '.join(value['errors'][:3]))
    print(report['summary'])
    return 0 if report['allGatesPassed'] else 1


if __name__ == '__main__':
    sys.exit(main())
