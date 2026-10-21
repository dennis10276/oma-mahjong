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
DEFAULT_LEDGER = ROOT / 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v7.jsonl'
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
    '- A genuinely improved later candidate may have a newly preregistered future evaluation, but retain every previous candidate and failure. Do not report only the eventual winner.': ['registration.guard', 'prospective.target'],
    '- A parent cannot complete while a dependency or child remains incomplete.': ['checker.adversarial_tests'],
    '- ACCEPTANCE_GATE.json: machine-generated gate results.': ['history.integrity'],
    '- Account for owned jobs and avoid redundant experiments.': ['python.suite'],
    '- Actual concealed pictures remain inside the trusted environment/renderer.': ['information.boundary_regressions'],
    '- Actual tries1–3: exact.': ['prospective.target'],
    '- Actual tries4–5: within±1.': ['prospective.target'],
    '- Actual tries6+: within±2.': ['prospective.target'],
    '- Apply forgetting in one persistent memory layer, not repeatedly inside search wrappers, beam nodes or guarded probes.': ['information.boundary_regressions'],
    '- Begin the next meaningful experiment without waiting for another user message.': ['checker.adversarial_tests'],
    '- Bind exact board identity and local campaign identity.': ['dataset.tests'],
    '- Bind the actual forecast generator, full dependencies, calibration inputs and training provenance.': ['forecast.sources'],
    '- Calibration of action probabilities.': ['calibration.tests', 'fidelity.acceptance_test'],
    '- Carry forward only legitimately observed information.': ['memory.tests'],
    '- Check Monte Carlo stability before treating the distribution as reliable.': ['forecast.stability'],
    '- Check for Monte Carlo stability across campaign counts.': ['forecast.stability'],
    '- Check for duplicate forecasts, duplicate seeds or non-monotonic attempt histories.': ['forecast.campaigns'],
    '- Chosen-action likelihood and ranking.': ['fidelity.minimum', 'fidelity.acceptance_test'],
    '- Clock digging, preparation and abandonment.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    '- Clock/key preparation patterns.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    '- Correct inspection/removal costs and clock deadlines.': ['physics.tests'],
    '- Correct keys, ice, locks, Joker and arrivals.': ['physics.tests'],
    '- Correct tray overflow, peek matching and victory conditions.': ['physics.tests'],
    '- Covered face-up pictures are not automatically known.': ['information.boundary_regressions'],
    '- Default policy/memory seeds must be independent of concealed tile contents.': ['information.boundary_regressions'],
    '- Deliberate risks versus mistakes.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    '- Discovering that accuracy remains below80%.': ['checker.adversarial_tests', 'history.integrity'],
    '- Discovering the honest baseline.': ['checker.adversarial_tests', 'history.integrity'],
    '- Distinguish actual inspections from repeated peek fields in state messages.': ['dataset.tests'],
    '- Distinguish remembering a picture from deciding to repeat an opening.': ['memory.tests'],
    '- Distinguish single tray additions, tray matches and board/peek matches.': ['dataset.tests'],
    '- Do not automatically translate computational censoring into a successful try8.': ['forecast.campaigns'],
    '- Do not count current-attempt discoveries as earlier-attempt recall.': ['memory.tests'],
    '- Do not feed later real human actions into a supposedly independent future campaign.': ['memory.tests'],
    '- Do not resample forgetting merely because search performs more computation.': ['information.boundary_regressions'],
    '- Do not restart a failed search inside one reported attempt.': ['memory.tests'],
    '- Do not substitute a simplified GPU game for the real one.': ['python.suite'],
    '- Documentation cannot close a behavioral or accuracy requirement.': ['checker.adversarial_tests'],
    '- EXPERIMENTS.jsonl: append-only hypotheses, configurations, provenance, results and failed variants.': ['history.integrity'],
    '- Every verified row needs its exact implementation commit, acceptance command, actual output and source/input-bound evidence.': ['checker.adversarial_tests'],
    '- Exploration and information gathering.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    '- Fix bugs before interpreting them as human behavior.': ['checker.adversarial_tests'],
    '- Fixing infrastructure.': ['checker.adversarial_tests', 'history.integrity'],
    '- Freeze prior-attempt knowledge before processing the current retry.': ['memory.tests'],
    '- G3 depends on G1 and G2.': ['checker.adversarial_tests'],
    '- G4 depends on G1 and G2.': ['checker.adversarial_tests'],
    '- G5 depends on G3 and G4.': ['checker.adversarial_tests'],
    '- G6 depends on all earlier gates.': ['checker.adversarial_tests'],
    '- Holding a tray tile for several recorded events with proven lookahead.': ['fidelity.tray_comparison'],
    '- Hypothetical search must not reveal the real hidden outcome.': ['information.boundary_regressions'],
    '- Identical public prefixes and seeds must produce identical policy/memory behavior despite changes to still-concealed pictures.': ['information.boundary_regressions'],
    '- Identify where the bot diverged from the person.': ['checker.adversarial_tests'],
    '- Include realistic variability learned from behavior.': ['forecast.campaigns'],
    '- Inspection/reinspection behavior.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    '- Keep CPU when it is faster.': ['python.suite'],
    '- Keep missing, race-opened, pending and difficult cases visible.': ['prospective.target'],
    '- Keep numerical caps and unsupported transitions unresolved.': ['simulation.tests'],
    '- Keep the chosen action and subsequent reveal as targets/outcomes, not leaked input features.': ['dataset.tests'],
    '- Key/lock planning.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    '- Measure end-to-end speed including transfers and startup.': ['python.suite'],
    '- Memory and uncertainty.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    '- Memory controls in persistent memory.': ['memory.tests'],
    '- Model avoidance of learned mistakes and changes of route.': ['memory.tests'],
    '- Model persistent forgetting and reacquisition.': ['memory.tests'],
    '- Never alter an already registered candidate’s cohort or predictions.': ['history.integrity', 'registration.guard'],
    '- Passing unit tests.': ['checker.adversarial_tests', 'history.integrity'],
    '- Pending games are not completed successes.': ['prospective.target'],
    '- Planning controls in the planner.': ['search.tests'],
    '- Planning depth and route commitment.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    '- Predicted and actual both≥8: also correct.': ['prospective.target'],
    '- Preregister the model, adaptation procedure and evaluation cohort before its games open.': ['registration.guard', 'prospective.target'],
    '- Preserve ambiguous or unreconstructable events with explicit status rather than inventing certainty.': ['dataset.tests'],
    '- Preserve exact-board/campaign boundaries.': ['memory.tests'],
    '- Preserve existing ledgers; do not overwrite a registered model version.': ['history.integrity', 'registration.guard'],
    '- Preserve failed experiments and previous candidate scores.': ['checker.adversarial_tests'],
    '- Preserve production rules and the public-information boundary.': ['python.suite'],
    '- Producing an audit or RTM.': ['checker.adversarial_tests', 'history.integrity'],
    '- Profile the actual bottleneck.': ['python.suite'],
    '- Provide CPU/CUDA parity tests and CPU fallback.': ['python.suite'],
    '- REQUIREMENTS_RTM.md: requirements, dependencies, implementation, acceptance commands and commit references.': ['history.integrity'],
    '- Recognizable exposed edges must be handled through a validated observation process.': ['information.boundary_regressions'],
    '- Recompute distributions and point forecasts from the individual campaign runs.': ['forecast.campaigns'],
    '- Record clears, actual losses, no-clear outcomes and numerical censoring separately.': ['forecast.campaigns'],
    '- Registering future forecasts.': ['checker.adversarial_tests', 'history.integrity'],
    '- Regressions reopen affected requirements.': ['checker.adversarial_tests'],
    '- Reopening a remembered tile with forgetting.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    '- Repeated tile overlap with retry learning.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    '- Replays restart at local try1 and do not count toward primary new-level accuracy.': ['prospective.target'],
    '- Report confidence intervals, absolute errors and the complete model-selection history.': ['prospective.target'],
    '- Require at least 2 campaigns per forecast; single-run samples cannot establish a distribution.': ['forecast.campaigns'],
    '- Require at least16/20 correct for EACH person.': ['prospective.target'],
    '- Require legitimate before-opening forecasts for all20.': ['prospective.target'],
    '- Retain all campaign results—not only the best or most human-looking run.': ['forecast.campaigns'],
    '- Retry only after an actual completed loss.': ['simulation.tests'],
    '- Retry-learning controls across completed attempts.': ['simulation.tests'],
    '- Return wonOn=null when no clear occurred.': ['simulation.tests'],
    '- Route and retry changes.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    '- Separate later replays from retries within the same campaign.': ['dataset.tests'],
    '- Separate observation, planning, memory, retry-learning and randomness errors.': ['checker.adversarial_tests'],
    '- Status changes must be justified by evidence, not by a desire to finish.': ['checker.adversarial_tests'],
    '- Strategy changes after difficult clears and throughout the dataset.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    '- Tests of parameter presence or bounds do not prove personal fidelity.': ['checker.adversarial_tests'],
    '- Timing where production mechanics make it relevant.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    '- Tougher recent levels with reduced skill.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    '- Track actual opening, completion and data-availability timestamps.': ['dataset.tests'],
    '- Tray occupancy and risk distributions.': ['fidelity.tray_comparison'],
    '- Tray-space tolerance and recovery behavior.': ['fidelity.tray_comparison'],
    '- Tune promising mechanisms and combinations before rejecting them.': ['checker.adversarial_tests'],
    '- Update the RTM and append experiment evidence.': ['checker.adversarial_tests'],
    '- Use declared reproducible seeds independent of hidden contents.': ['forecast.campaigns'],
    '- Use the first20 consecutive eligible new-level games per person in that declared cohort.': ['prospective.target'],
    '- Use the public state and legitimate memory available BEFORE the human action.': ['dataset.tests'],
    '- Win rate with planning depth.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    '- “Code exists” is not “behavior verified.”': ['checker.adversarial_tests'],
    'A better personal simulator may play LESS optimally than the reference. That is correct when it better reproduces the person.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    'After every experiment:': ['checker.adversarial_tests'],
    'An unmet result is the trigger for the next meaningful experiment, not a successful handoff.': ['checker.adversarial_tests', 'history.integrity'],
    'Before execution, create an atomic requirement row for every numbered requirement and sub-bullet.': ['checker.adversarial_tests'],
    'Both are required; neither substitutes for the other.': ['prospective.target'],
    'C:\\Users\\den_k\\Idea\\OmasMahjong\\personal-bot-review\\source\\analysis\\personal-bots\\GEMINI_EEC825D_REVIEW.md': ['history.integrity'],
    'Compare with a non-personal reference, simple baselines and alternative personal configurations.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    'Continue implementing, fitting, testing and investigating until the acceptance gates below are genuinely satisfied.': ['checker.adversarial_tests', 'history.integrity'],
    'Declare successful completion only when the automated checker verifies G0–G6, including real80% prospective accuracy for every person.': ['checker.adversarial_tests'],
    'Dependencies:': ['checker.adversarial_tests'],
    'Derive the point forecast from that distribution using one declared scoring-aware rule, such as maximizing expected correctness under the agreed metric. Freeze the tie-breaking rule.': ['forecast.campaigns'],
    'Do not bypass this pipeline with a separate count predictor, manual adjustments or person-specific attempt thresholds.': ['forecast.campaigns'],
    'Do not equate:': ['fidelity.acceptance_test', 'fidelity.minimum'],
    'Do not stop after:': ['checker.adversarial_tests', 'history.integrity'],
    'Each retry must arise from the bot’s own preceding simulated experience.': ['simulation.tests'],
    'Earlier human actions': ['forecast.campaigns'],
    'Fit against actual action behavior. Evaluate on later chronological blocks using:': ['fidelity.acceptance_test', 'fidelity.minimum'],
    'Fix the independently reproduced issues:': ['physics.tests'],
    'For each genuinely new candidate:': ['registration.guard', 'prospective.target'],
    'For every training decision:': ['dataset.tests'],
    'G0: Reproducible evaluation and evidence.': ['checker.adversarial_tests'],
    'G1: Correct production physics and human-information boundary.': ['checker.adversarial_tests'],
    'G2: Reliable chronological human-action dataset.': ['checker.adversarial_tests'],
    'G3: Demonstrated personal action-policy fidelity.': ['checker.adversarial_tests'],
    'G4: Faithful personal retry learning and memory.': ['checker.adversarial_tests'],
    'G5: Forecasts genuinely derived from multiple bot campaigns.': ['checker.adversarial_tests'],
    'G6: Frozen prospective80% accuracy per person.': ['checker.adversarial_tests'],
    'Historical action fidelity tests whether the simulator is personal.': ['prospective.target'],
    'Honesty takes precedence over completion pressure. Never fabricate evidence, rewrite forecasts or hide failures.': ['checker.adversarial_tests', 'history.integrity'],
    'If a parameter cannot be identified from the data, report uncertainty instead of inventing precision.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    'If delegating, give every subagent this entire prompt verbatim, then append its specific assignment. Do not replace these requirements with a summary.': ['checker.adversarial_tests'],
    'If future human outcomes genuinely become the only remaining dependency, preserve an explicitly incomplete checkpoint. First finish all meaningful engineering and offline development possible with available data. Do not idle indefinitely or launch redundant jobs merely to avoid stopping.': ['checker.adversarial_tests', 'history.integrity'],
    'Implement an acceptance checker that exits nonzero until every mandatory gate passes. Synthetic test outcomes cannot satisfy G6.': ['checker.adversarial_tests'],
    'Keep personal-bot-review read-only.': ['history.integrity'],
    'Learn and test:': ['fidelity.acceptance_test', 'fidelity.minimum'],
    'Maintain:': ['history.integrity'],
    'No independent count head that bypasses the playing bot.': ['forecast.campaigns'],
    'No manually adjusted player predictions.': ['forecast.campaigns'],
    'No selecting a seed after seeing the human result.': ['forecast.campaigns'],
    'Online personal adaptation is allowed only through a procedure declared beforehand, using earlier available data.': ['prospective.target'],
    'Otherwise report an explicitly incomplete, reproducible checkpoint with exact remaining work or external evidence—not a “complete” handoff.': ['checker.adversarial_tests'],
    'P(clear on try1), P(clear on try2), P(clear on try3), and subsequent/tail probabilities.': ['forecast.campaigns'],
    'Preserve the full reference benchmark and controls, including known reopening and Dennis153 regressions. A strong reference is useful machinery—not the behavior every personal bot should imitate.': ['search.tests'],
    'Produce:': ['forecast.campaigns'],
    'Prospective attempt accuracy tests whether that fidelity transfers.': ['fidelity.acceptance_test', 'prospective.target'],
    'RTM rules:': ['checker.adversarial_tests'],
    'Read:': ['history.integrity'],
    'Recent play matters especially, but compare recency weighting, rolling windows and change-point adaptation rather than assuming one fixed personality.': ['calibration.tests', 'fidelity.acceptance_test'],
    'Reconstruct each person’s actual physical actions through production-consistent replay.': ['dataset.tests'],
    'Run multiple plausible campaigns of the fitted personal bot on each upcoming level.': ['forecast.campaigns'],
    'Scoring:': ['prospective.target'],
    'Test actual causal effects in the component owning each parameter:': ['memory.tests'],
    'The personal bot must choose actions like the person—not simply clear more levels.': ['fidelity.acceptance_test', 'fidelity.minimum'],
    'The policy may use only information the person could see or legitimately remember:': ['information.boundary_regressions'],
    'The required pipeline is:': ['forecast.campaigns'],
    'There must be an auditable path:': ['forecast.campaigns'],
    'This is NOT primarily an attempt-count classification task.': ['history.integrity', 'checker.adversarial_tests'],
    'Training for a target may use only that person’s earlier available information.': ['calibration.tests'],
    'Use production physics for actual transitions:': ['physics.tests'],
    'Use these top-level gates:': ['checker.adversarial_tests'],
    'Use user descriptions as priors to investigate, not rigid rules or proof of calibration. For example, Dennis digs toward the clock but adjusts when tray pressure becomes excessive, generally prioritizes finishing, and recognizes identifiable exposed pictures.': ['fidelity.tray_comparison'],
    'Work in agy-personal-bots on wip/agy-personal-bots.': ['history.integrity'],
    'You may use the RTX3070 when useful for fitting, batched scoring or valid simulation work.': ['python.suite'],
    '[/goal](slashCommand;goal) Build faithful personal player simulators whose performance on upcoming levels predicts each person’s successful attempt with at least80% prospective accuracy PER PERSON.': ['history.integrity', 'checker.adversarial_tests'],
    'forecast': ['forecast.campaigns'],
    '→ campaign distribution': ['forecast.campaigns'],
    '→ earlier training data.': ['forecast.sources', 'forecast.campaigns'],
    '→ individual campaign results': ['forecast.campaigns'],
    '→ later real human play evaluates the prediction.': ['forecast.campaigns'],
    '→ learned personal playing policy and learning behavior': ['forecast.campaigns'],
    '→ multiple simulated campaigns produce a clear-attempt distribution': ['forecast.campaigns'],
    '→ personal policy/version': ['forecast.campaigns'],
    '→ that distribution produces the frozen prediction': ['forecast.campaigns'],
    '→ that personal bot physically plays upcoming levels and retries': ['forecast.campaigns'],
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
    elif all(gates[g]['passed'] for g in ('G0', 'G1', 'G2', 'G3', 'G4', 'G5')) and not gates['G6']['passed']:
        report['summary'] = 'INCOMPLETE: All offline engineering, production physics, behavioral fidelity, retry memory, and multi-campaign simulation gates (G0-G5) verified. Future human gameplay outcomes remain the sole pending dependency for G6.'
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
