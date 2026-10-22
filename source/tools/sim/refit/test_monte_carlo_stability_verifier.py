import json, sys, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from independent_mc_metrics import compute_half_split_w1, precision_report

class MonteCarloStabilityVerifierTests(unittest.TestCase):
    def test_opposite_early_exact_outcomes_rejected(self):
        c = [{'wonOn': 1}] * 10 + [{'wonOn': 3}] * 10
        self.assertEqual(compute_half_split_w1(c), 2)
        self.assertFalse(precision_report(c, 20)['precisionSatisfied'])

    def test_invalid_outcomes_rejected(self):
        for bad in (999, -2, True, 1.5, float('nan')):
            with self.assertRaises(ValueError):
                compute_half_split_w1([{'wonOn': bad}] * 2)
        with self.assertRaises(ValueError):
            compute_half_split_w1([{}, {}])

    def test_censoring_is_not_tail(self):
        with self.assertRaises(ValueError):
            compute_half_split_w1([{'wonOn': None, 'status': 'unresolved'}] * 2)

    def test_tail_is_distinct_from_try8(self):
        self.assertEqual(compute_half_split_w1([{'wonOn': 8}] * 2 + [{'wonOn': None}] * 2), 1)

    def test_small_identical_halves_do_not_prove_precision(self):
        self.assertFalse(precision_report([{'wonOn': 1}] * 6, 6)['precisionSatisfied'])

    def test_adaptive_or_missing_samples_rejected(self):
        with self.assertRaises(ValueError):
            precision_report([{'wonOn': 1}] * 6, 100)

    def test_fixed_budget_sample_size_calculation(self):
        r = precision_report([{'wonOn': 1}] * 2, 2, epsilon=0.05, delta=0.05, family_size=96)
        self.assertEqual(r['requiredFixedCampaigns'], 2067)
        self.assertFalse(r['precisionSatisfied'])

    def test_v8_is_reported_not_promoted(self):
        p = Path(__file__).resolve().parents[4] / 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v8.jsonl'
        anchor = json.loads(p.read_bytes())
        self.assertEqual(len(anchor['forecasts']), 96)
        for fc in anchor['forecasts']:
            r = precision_report(fc['campaignResults'], len(fc['campaignResults']))
            self.assertFalse(r['precisionSatisfied'])
            self.assertFalse(r['protectedApproval'])

if __name__ == '__main__':
    unittest.main()
