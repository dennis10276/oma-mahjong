"""Adversarial verifier tests. Synthetic fixtures here can never supply G6 evidence."""
import copy
import json
from pathlib import Path
import tempfile
import unittest

from acceptance_evidence import (NAMES, GATE_DEPENDENCIES, digest, fidelity_errors,
    parse_contract, point_forecast, prospective_errors, required_sources, rollup,
    scoring, tray_comparison_errors, validate_campaigns, validate_sources, validate_stability, verify_baseline)

ROOT = Path(__file__).resolve().parents[4]
AUDIT = ROOT / 'source/analysis/personal-bots/acceptance'


def fidelity():
    return {name: {'evaluatedDecisions': 20, 'personalFidelityVerified': True,
                   'top1Accuracy': {'personalBot': .3, 'referenceBot': .2, 'randomBaseline': .1}}
            for name in NAMES}


def tray_fidelity():
    return {name: {'humanTrayDistribution': {'0': .25, '1': .45, '2': .25, '3': .05},
                   'botTrayDistribution': {'0': .20, '1': .40, '2': .30, '3': .10},
                   'trayComparison': {'totalVariationDistance': .10, 'wassersteinDistance': .15,
                                     'replicatesDistribution': True}}
            for name in NAMES}


def prospective():
    return {'numericalTarget80Met': True, 'warnings': [], 'players': {
        name: {'cohort': {'opened': 20, 'completed': 20, 'eligibleFrozenForecasts': 20,
                         'correct': 16, 'accuracy': .8, 'pending': 0, 'missingForecastsOrOpening': 0}}
        for name in NAMES}}


def candidate():
    return {'forecasts': [{'name': NAMES[0], 'lv': 1, 'campaignCount': 2,
        'campaignDistribution': {'noClear': 0, **{f'try{a}': 1 if a == 1 else 0 for a in range(1, 9)}},
        'predictedAttempt': 1, 'campaignResults': [
            {'seed': seed, 'wonOn': 1, 'history': [{'status': 'cleared'}]} for seed in (1, 2)]}]}


class AcceptanceEvidenceTests(unittest.TestCase):
    def test_contract_covers_every_original_nonempty_nonheading_line(self):
        raw = (AUDIT / 'EXECUTION_CONTRACT.txt').read_bytes()
        rows = parse_contract(raw)
        self.assertGreater(len(rows), 150)
        self.assertEqual(len({r['id'] for r in rows}), len(rows))
        self.assertEqual(set(r['section'] for r in rows), set(range(11)))
        original = raw.decode('utf-8-sig').splitlines()
        self.assertEqual({r['sourceLine'] for r in rows},
                         {i for i, line in enumerate(original, 1) if line.strip()})
        for row in rows:
            self.assertEqual(row['requirement'], original[row['sourceLine'] - 1].strip())

    def test_deleted_or_reworded_contract_is_rejected(self):
        raw = (AUDIT / 'EXECUTION_CONTRACT.txt').read_bytes()
        with self.assertRaises(ValueError):
            parse_contract(raw.replace(b'80%', b'70%', 1))

    def test_current_protected_history_matches_independent_pin(self):
        self.assertEqual([], verify_baseline(ROOT, (AUDIT / 'AUDIT_BASELINE.json').read_bytes()))

    def test_rebaselining_cannot_hide_modified_history(self):
        data = json.loads((AUDIT / 'AUDIT_BASELINE.json').read_bytes())
        data['immutableFiles'] = {}
        self.assertTrue(verify_baseline(ROOT, json.dumps(data).encode()))

    def test_rewritten_experiment_or_ledger_is_rejected(self):
        raw = (AUDIT / 'AUDIT_BASELINE.json').read_bytes()
        base = json.loads(raw)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for relative in [*base['immutableFiles'], 'EXPERIMENTS.jsonl']:
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((ROOT / relative).read_bytes())
            self.assertFalse(verify_baseline(root, raw))
            path = root / 'EXPERIMENTS.jsonl'
            path.write_bytes(path.read_bytes().replace(b'EXP-001', b'EXP-999', 1))
            self.assertTrue(verify_baseline(root, raw))
            ledger = root / next(p for p in base['immutableFiles'] if p.endswith('v3.jsonl'))
            ledger.write_bytes(b'{"targetMet":true}\n')
            self.assertTrue(any('Protected historical' in e for e in verify_baseline(root, raw)))

    def test_fidelity_real_comparison_passes_minimum_only(self):
        self.assertEqual([], fidelity_errors(fidelity()))

    def test_fidelity_zero_accuracy_cannot_pass_with_valid_parameter_bounds(self):
        data = fidelity()
        data[NAMES[-1]]['top1Accuracy']['personalBot'] = 0
        self.assertTrue(fidelity_errors(data))

    def test_fidelity_self_reported_false_is_not_ignored(self):
        data = fidelity()
        data[NAMES[-1]]['personalFidelityVerified'] = False
        self.assertTrue(fidelity_errors(data))

    def test_averaging_cannot_hide_failed_person(self):
        data = fidelity()
        data[NAMES[-1]]['top1Accuracy']['personalBot'] = .05
        self.assertTrue(fidelity_errors(data))

    def test_missing_person_and_nan_are_rejected(self):
        data = fidelity()
        del data[NAMES[-1]]
        self.assertTrue(fidelity_errors(data))
        data = fidelity()
        data[NAMES[0]]['top1Accuracy']['personalBot'] = float('nan')
        self.assertTrue(fidelity_errors(data))

    def test_tray_comparison_passes_valid_data(self):
        self.assertEqual([], tray_comparison_errors(tray_fidelity()))

    def test_tray_comparison_rejects_missing_person(self):
        data = tray_fidelity()
        del data[NAMES[-1]]
        self.assertTrue(tray_comparison_errors(data))

    def test_tray_comparison_rejects_excessive_distance(self):
        data = tray_fidelity()
        data[NAMES[-1]]['trayComparison']['totalVariationDistance'] = 0.55
        self.assertTrue(tray_comparison_errors(data))

    def test_tray_comparison_rejects_unverified_flag(self):
        data = tray_fidelity()
        data[NAMES[-1]]['trayComparison']['replicatesDistribution'] = False
        self.assertTrue(tray_comparison_errors(data))

    def test_tray_comparison_rejects_missing_distribution(self):
        data = tray_fidelity()
        data[NAMES[-1]]['botTrayDistribution'] = {}
        self.assertTrue(tray_comparison_errors(data))

    def test_only_complete_per_person_cohort_can_pass_numeric_screen(self):
        self.assertFalse(prospective_errors(prospective()))

    def test_pending_cannot_disappear_from_denominator(self):
        data = prospective()
        data['players'][NAMES[0]]['cohort'].update(completed=19, correct=19, accuracy=1, pending=1)
        self.assertTrue(prospective_errors(data))

    def test_race_opened_forecast_blocks_even_with_80_percent_correct(self):
        data = prospective()
        data['players'][NAMES[0]]['cohort'].update(eligibleFrozenForecasts=19, missingForecastsOrOpening=1)
        self.assertTrue(prospective_errors(data))

    def test_overall_accuracy_cannot_replace_cohort_accuracy(self):
        data = prospective()
        data['players'][NAMES[0]]['accuracy'] = 1
        data['players'][NAMES[0]]['cohort'].update(correct=15, accuracy=.75)
        self.assertTrue(prospective_errors(data))

    def test_stale_outcome_warning_prevents_promotion(self):
        data = prospective()
        data['warnings'] = ['Snapshot predates model freeze']
        self.assertTrue(prospective_errors(data))

    def test_stability_rejects_missing_protocol(self):
        self.assertTrue(validate_stability({}))

    def test_stability_rejects_missing_campaigns(self):
        self.assertTrue(validate_stability({'convergenceCriterion': {'metric': 'halfSplitWasserstein', 'threshold': 0.35}, 'forecasts': [{'name': NAMES[0], 'lv': 1}]}))

    def test_stability_rejects_divergent_campaigns(self):
        anchor = {'convergenceCriterion': {'metric': 'halfSplitWasserstein', 'threshold': 0.35},
                  'forecasts': [{'name': NAMES[0], 'lv': 1, 'campaignResults': [
                      {'wonOn': 1}, {'wonOn': 1}, {'wonOn': None}, {'wonOn': None}
                  ]}]}
        self.assertTrue(validate_stability(anchor))

    def test_stability_passes_converged_campaigns(self):
        anchor = {'convergenceCriterion': {'metric': 'halfSplitWasserstein', 'threshold': 0.35},
                  'forecasts': [{'name': NAMES[0], 'lv': 1, 'campaignResults': [
                      {'wonOn': 1}, {'wonOn': 2}, {'wonOn': 1}, {'wonOn': 2}
                  ]}]}
        self.assertEqual([], validate_stability(anchor))

    def test_forecast_all_campaigns_recompute(self):
        self.assertFalse(validate_campaigns(candidate()))

    def test_present_but_empty_distributions_do_not_pass(self):
        data = candidate()
        data['forecasts'][0]['campaignDistribution'] = {}
        self.assertTrue(validate_campaigns(data))

    def test_missing_individual_campaigns_do_not_pass(self):
        data = candidate()
        del data['forecasts'][0]['campaignResults']
        self.assertTrue(validate_campaigns(data))

    def test_hand_adjusted_point_forecast_fails(self):
        data = candidate()
        data['forecasts'][0]['predictedAttempt'] = 8
        self.assertTrue(validate_campaigns(data))

    def test_selected_seed_and_duplicate_forecasts_fail(self):
        data = candidate()
        data['forecasts'][0]['campaignResults'][1]['seed'] = 1
        self.assertTrue(validate_campaigns(data))
        data = candidate()
        data['forecasts'].append(copy.deepcopy(data['forecasts'][0]))
        self.assertTrue(validate_campaigns(data))

    def test_numerical_censoring_cannot_become_try8_or_noclear(self):
        data = candidate()
        result = data['forecasts'][0]['campaignResults'][0]
        result.update(wonOn=None, history=[{'status': 'unresolved'}])
        self.assertTrue(validate_campaigns(data))

    def test_retry_after_unresolved_or_success_cannot_pass(self):
        data = candidate()
        data['forecasts'][0]['campaignResults'][0].update(wonOn=2,
            history=[{'status': 'unresolved'}, {'status': 'cleared'}])
        self.assertTrue(validate_campaigns(data))

    def test_hash_values_are_checked_not_only_hash_keys(self):
        expected = required_sources(ROOT, [])
        bound = {p: digest((ROOT / p).read_bytes()) for p in expected}
        self.assertFalse(validate_sources(ROOT, {'quantitativeSourceHashes': bound}))
        bound['source/www/hard.js'] = '0' * 64
        self.assertTrue(validate_sources(ROOT, {'quantitativeSourceHashes': bound}))

    def test_dynamic_board_tables_and_replay_loader_are_bound(self):
        expected = required_sources(ROOT, [])
        self.assertIn('source/tools/sim/refit/mimic_games.js', expected)
        self.assertIn('source/tools/sim/refit/tables/levels-1.55.js', expected)
        self.assertIn('source/tools/sim/refit/tables/hard-1.55.js', expected)
        self.assertIn('source/tools/sim/refit/tables/early-1.55.js', expected)

    def test_hash_path_traversal_rejected(self):
        self.assertTrue(validate_sources(ROOT, {'quantitativeSourceHashes': {'../outside': '0' * 64}}))

    def test_unit_test_pass_cannot_close_unverified_requirement(self):
        rows = [{'id': 'one', 'gate': 'G0', 'checks': ['unit']},
                {'id': 'missing', 'gate': 'G0', 'checks': []}]
        evaluated, gates = rollup(rows, {'unit': {'status': 'PASS'}})
        self.assertEqual(evaluated[1]['status'], 'UNVERIFIED')
        self.assertFalse(gates['G0']['passed'])

    def test_parent_cannot_pass_failed_child_or_dependency(self):
        rows = [{'id': gate, 'gate': gate, 'checks': [gate]} for gate in GATE_DEPENDENCIES]
        checks = {gate: {'status': 'PASS'} for gate in GATE_DEPENDENCIES}
        checks['G2']['status'] = 'FAIL'
        _, gates = rollup(rows, checks)
        for gate in ('G2', 'G3', 'G4', 'G5', 'G6'):
            self.assertFalse(gates[gate]['passed'], gate)

    def test_all_pass_fixture_requires_all_rows_and_all_dependencies(self):
        rows = [{'id': gate, 'gate': gate, 'checks': [gate]} for gate in GATE_DEPENDENCIES]
        _, gates = rollup(rows, {gate: {'status': 'PASS'} for gate in GATE_DEPENDENCIES})
        self.assertTrue(all(g['passed'] for g in gates.values()))

    def test_unknown_check_or_missing_gate_cannot_silently_pass(self):
        _, gates = rollup([{'id': 'bad', 'gate': 'G0', 'checks': ['unimplemented']}], {})
        self.assertFalse(any(g['passed'] for g in gates.values()))

    def test_numbered_parent_cannot_complete_with_unverified_child(self):
        rows = [{'id': 'parent', 'gate': 'G0', 'children': ['child']},
                {'id': 'child', 'gate': 'G0', 'checks': []}]
        evaluated, gates = rollup(rows, {})
        self.assertEqual(evaluated[0]['status'], 'UNVERIFIED')
        self.assertFalse(gates['G0']['passed'])

    def test_unknown_gate_or_duplicate_requirement_is_rejected(self):
        with self.assertRaises(ValueError):
            rollup([{'id': 'one', 'gate': 'invented', 'checks': []}], {})
        with self.assertRaises(ValueError):
            rollup([{'id': 'one', 'gate': 'G0'}, {'id': 'one', 'gate': 'G0'}], {})

    def test_official_scoring_and_tie_break(self):
        self.assertTrue(scoring(8, 12))
        self.assertFalse(scoring(2, 3))
        self.assertTrue(scoring(3, 4))
        self.assertTrue(scoring(4, 6))
        self.assertEqual(point_forecast({'try1': .5, 'try2': .5}), 1)


if __name__ == '__main__':
    unittest.main()
