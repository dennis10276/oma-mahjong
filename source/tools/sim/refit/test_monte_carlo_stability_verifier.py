"""Independent Python unittest verifying half-split Wasserstein Monte Carlo convergence across all 96 forecasts."""
import json
from pathlib import Path
import unittest

NAMES = ('Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda')
ROOT = Path(__file__).resolve().parents[4]
ANALYSIS_DIR = ROOT / 'source/analysis/personal-bots'


def compute_half_split_w1(campaign_results):
    """Computes exact half-split L1 Wasserstein distance across Mahjong attempt bins."""
    if not isinstance(campaign_results, list) or len(campaign_results) < 2:
        raise ValueError('At least 2 campaigns required for half-split stability')
    half = len(campaign_results) // 2
    h1 = campaign_results[:half]
    h2 = campaign_results[half:]

    d1 = {f'try{a}': 0.0 for a in range(1, 9)}
    d1['noClear'] = 0.0
    d2 = {f'try{a}': 0.0 for a in range(1, 9)}
    d2['noClear'] = 0.0

    for c in h1:
        w = c.get('wonOn')
        if w is None:
            d1['noClear'] += 1.0 / len(h1)
        elif isinstance(w, int) and 1 <= w <= 8:
            d1[f'try{w}'] += 1.0 / len(h1)

    for c in h2:
        w = c.get('wonOn')
        if w is None:
            d2['noClear'] += 1.0 / len(h2)
        elif isinstance(w, int) and 1 <= w <= 8:
            d2[f'try{w}'] += 1.0 / len(h2)

    cdf1, cdf2, w1 = 0.0, 0.0, 0.0
    for a in range(1, 8):
        cdf1 += d1[f'try{a}']
        cdf2 += d2[f'try{a}']
        w1 += abs(cdf1 - cdf2)
    return round(w1, 4)


def load_candidate_ledger():
    """Finds the active candidate ledger (v8 if present, otherwise v7)."""
    for v in ('v8', 'v7'):
        path = ANALYSIS_DIR / f'personal-source-bound-causal-forecasts-{v}.jsonl'
        if path.is_file():
            lines = [json.loads(line) for line in path.read_text(encoding='utf-8-sig').splitlines() if line.strip()]
            if lines:
                return lines[0], path
    raise FileNotFoundError('No candidate ledger found (v7 or v8)')


class MonteCarloStabilityVerifierTests(unittest.TestCase):
    def test_half_split_wasserstein_convergence(self):
        anchor, path = load_candidate_ledger()
        forecasts = anchor.get('forecasts', [])
        self.assertEqual(len(forecasts), 96, f'{path.name}: Expected 96 forecasts, found {len(forecasts)}')

        per_player_counts = {name: 0 for name in NAMES}
        w1_values = []

        for fc in forecasts:
            name = fc.get('name')
            lv = fc.get('lv')
            self.assertIn(name, NAMES, f'Unknown player {name}')
            per_player_counts[name] += 1

            campaigns = fc.get('campaignResults')
            self.assertIsInstance(campaigns, list)
            self.assertGreaterEqual(len(campaigns), 4, f'{name} L{lv}: Expected >= 4 campaigns')

            recomputed_w1 = compute_half_split_w1(campaigns)
            w1_values.append(recomputed_w1)

            # Assert individual forecast stability is within metric tolerance band (<= 2.5)
            self.assertLessEqual(
                recomputed_w1, 2.5,
                f'{name} L{lv}: Half-split Wasserstein distance {recomputed_w1} exceeds 2.5 attempts'
            )

            # Check that reported mcStabilityDelta matches recomputed within floating precision
            reported_delta = fc.get('mcStabilityDelta')
            if reported_delta is not None:
                self.assertAlmostEqual(reported_delta, recomputed_w1, places=3)

        for name in NAMES:
            self.assertEqual(per_player_counts[name], 24, f'{name} must have exactly 24 forecasts')

        max_w1 = max(w1_values)
        mean_w1 = sum(w1_values) / len(w1_values)

        self.assertLessEqual(max_w1, 2.5, f'Maximum W1 {max_w1} exceeds 2.5')
        self.assertLessEqual(mean_w1, 1.0, f'Mean W1 {mean_w1} exceeds 1.0')

    def test_synthetic_unstable_distribution_rejection(self):
        """Verifies that an artificial divergence between halves is correctly flagged."""
        unstable_campaigns = [
            {'wonOn': 1, 'seed': 1, 'history': [{'status': 'cleared'}]},
            {'wonOn': 1, 'seed': 2, 'history': [{'status': 'cleared'}]},
            {'wonOn': 8, 'seed': 3, 'history': [{'status': 'cleared'}]},
            {'wonOn': 8, 'seed': 4, 'history': [{'status': 'cleared'}]}
        ]
        w1 = compute_half_split_w1(unstable_campaigns)
        # Attempt 1 vs Attempt 8 has discrepancy = 7 attempts
        self.assertGreater(w1, 2.5, 'Unstable campaign distribution must have W1 > 2.5')


if __name__ == '__main__':
    unittest.main()
