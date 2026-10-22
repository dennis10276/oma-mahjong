"""Unit tests for raw telemetry reconciliation, replay channel parsing, and candidate chronology."""
import json
from pathlib import Path
import unittest

from reconcile_raw_telemetry import (
    parse_replay_channel,
    audit_candidate_chronology,
    reconcile_derived_against_raw,
    PIDS
)

ROOT = Path(__file__).resolve().parents[4]


class ReconcileRawTelemetryTests(unittest.TestCase):
    def test_parse_replay_channel_from_player_json(self):
        replay_path = ROOT / 'source/analysis/archive/replays/replays/pmuy78xu6tsths9.json'
        if not replay_path.is_file():
            self.skipTest('Replay file not found in test environment')

        attempts = parse_replay_channel(replay_path)
        self.assertGreater(len(attempts), 0, 'Must reconstruct attempts from player replay file')

        # Check fields of reconstructed attempt
        first = attempts[0]
        self.assertIn('aid', first)
        self.assertEqual(first['name'], 'Dennisisdebeste')
        self.assertIn('lv', first)
        self.assertIn('boardKey', first)
        self.assertIn('attempt', first)
        self.assertIn(first['outcome'], ('won', 'lost', 'incomplete'))
        self.assertIsInstance(first['assisted'], bool)
        self.assertIsInstance(first['eventCount'], int)

    def test_candidate_chronology_proves_zero_post_freeze_games_for_v2_to_v8(self):
        res = audit_candidate_chronology(ROOT)
        self.assertIn('maxTelemetryTimestamp', res)
        max_t = res['maxTelemetryTimestamp']
        self.assertGreater(max_t, 1792000000000)

        candidates = {c['ledger']: c for c in res['candidates']}

        # v1 was frozen before latest telemetry
        v1 = candidates['personal-source-bound-causal-forecasts.jsonl']
        self.assertTrue(v1['freezePredatesLatestTelemetry'])
        self.assertEqual(v1['postFreezeCompletedGamesInLocalData'], 24)
        self.assertFalse(v1['prospectiveAccuracySatisfied'])

        # v2 through v8 were frozen after latest telemetry
        for v in range(2, 9):
            ledger_name = f'personal-source-bound-causal-forecasts-v{v}.jsonl'
            self.assertIn(ledger_name, candidates)
            c = candidates[ledger_name]
            self.assertFalse(c['freezePredatesLatestTelemetry'], f'{ledger_name} freeze must post-date telemetry')
            self.assertEqual(c['postFreezeCompletedGamesInLocalData'], 0, f'{ledger_name} must have 0 post-freeze games')
            self.assertFalse(c['prospectiveAccuracySatisfied'])

    def test_reconcile_derived_outcomes_against_raw_plays(self):
        live_dir = ROOT / 'source/analysis/archive/personal-bots/live-openings-2026-10-20T15-29-12-622Z'
        outcomes_file = live_dir / 'personal-outcomes.json'
        plays_file = live_dir / 'plays.json'

        if not outcomes_file.is_file() or not plays_file.is_file():
            self.skipTest('Live opening snapshot files not found')

        res = reconcile_derived_against_raw(outcomes_file, plays_file)
        self.assertGreater(res['totalDerivedEpisodes'], 0)
        self.assertGreater(res['reconciledWithRawPlays'], 0)
        self.assertGreaterEqual(res['reconciliationRate'], 0.5)


if __name__ == '__main__':
    unittest.main()
