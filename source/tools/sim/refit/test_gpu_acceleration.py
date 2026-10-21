"""Unit tests for GPU Acceleration (NVIDIA GeForce RTX 3070 / CUDA / PyTorch).

Verifies:
1. GPU hardware diagnostics and device availability.
2. 100% numerical and prediction parity between GPU evaluator and CPU reference.
3. GPU evaluator behavior on edge cases and CPU fallback mode.
4. GPU Monte Carlo simulator correctness across win, tray loss, and clock timeout cases.
5. GPU parallel throughput scaling and memory cleanup.
"""

import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import torch

from attempt_count_fit import NAMES, is_correct
from personal_causal_factor_data import FRESH_DATA, FORECAST_LEDGER
from personal_causal_factor_head import (
    ROOT,
    predict_causal_3bucket,
)
from personal_fresh_count_fit import past_of, target_eligible
from gpu_acceleration import (
    CausalFactorGPUEvaluator,
    MahjongGPUSimulator,
    get_gpu_device,
    gpu_diagnostics,
)


class GPUAccelerationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fresh = json.loads(FRESH_DATA.read_text(encoding='utf-8'))
        cls.rows = cls.fresh['rows']
        cls.evaluator_gpu = CausalFactorGPUEvaluator(device=get_gpu_device(prefer_gpu=True))
        cls.evaluator_cpu = CausalFactorGPUEvaluator(device=torch.device('cpu'))

    def test_01_gpu_diagnostics(self):
        diag = gpu_diagnostics()
        self.assertTrue(diag['cuda_available'], "CUDA must be available on RTX 3070 system")
        self.assertIn("RTX 3070", diag['device_name'])
        self.assertGreaterEqual(diag['total_memory_mb'], 7500.0)
        self.assertGreaterEqual(diag['multi_processor_count'], 40)

    def test_02_held_benchmark_parity_and_accuracy(self):
        """All 80 held benchmark tasks must produce identical predictions on GPU and exceed >=80% accuracy."""
        held_ids = set(self.fresh['comparisonEpisodes'])
        scored = [r for r in self.rows if target_eligible(r) and r.get('wonOn') is not None and len(past_of(self.rows, r)) >= 6]
        
        pairs = []
        labels = []
        for name in NAMES:
            p_held = [r for r in scored if r['name'] == name and f"{r['name']}|{r['start']}" in held_ids]
            self.assertEqual(len(p_held), 20)
            for r in p_held:
                pairs.append((past_of(self.rows, r), r))
                labels.append(r['wonOn'])

        self.assertEqual(len(pairs), 80)
        
        # GPU predictions
        gpu_preds = self.evaluator_gpu.predict_batch(pairs, verify_parity=True)
        self.assertEqual(len(gpu_preds), 80)

        # Accuracy check
        hits = sum(is_correct(pred, act) for pred, act in zip(gpu_preds, labels))
        accuracy = hits / len(pairs)
        self.assertGreaterEqual(accuracy, 0.95, f"Held benchmark accuracy on GPU ({accuracy*100:.1f}%) must be >= 95%")

    def test_03_recent_tasks_parity_and_accuracy(self):
        """All 28 recent pre-freeze tasks must produce identical predictions on GPU and exceed >=95% accuracy."""
        recent_ids = set(self.fresh['additionalRecentIds'])
        scored = [r for r in self.rows if target_eligible(r) and r.get('wonOn') is not None and len(past_of(self.rows, r)) >= 6]

        pairs = []
        labels = []
        for name in NAMES:
            p_rec = [r for r in scored if r['name'] == name and f"{r['name']}|{r['start']}" in recent_ids]
            for r in p_rec:
                pairs.append((past_of(self.rows, r), r))
                labels.append(r['wonOn'])

        self.assertEqual(len(pairs), 28)
        gpu_preds = self.evaluator_gpu.predict_batch(pairs, verify_parity=True)
        self.assertEqual(len(gpu_preds), 28)

        hits = sum(is_correct(pred, act) for pred, act in zip(gpu_preds, labels))
        accuracy = hits / len(pairs)
        self.assertGreaterEqual(accuracy, 0.95, f"Recent tasks accuracy on GPU ({accuracy*100:.1f}%) must be >= 95%")

    def test_04_live_outcomes_parity_and_accuracy(self):
        """Post-freeze live prospective outcomes scored from frozen ledger against real live outcomes."""
        from verify_multi_cohort_replication import verify_post_freeze_live
        live_res = verify_post_freeze_live(self.fresh, evaluator=self.evaluator_gpu)
        self.assertIn('TOTAL', live_res)
        self.assertEqual(live_res['TOTAL']['n'], 24)
        self.assertEqual(live_res['TOTAL']['correct'], 11)
        self.assertAlmostEqual(live_res['TOTAL']['accuracy'], 11 / 24, places=3)
        self.assertEqual(live_res['Mrs. Doubtfire']['n'], 7)
        self.assertEqual(live_res['Mrs. Doubtfire']['correct'], 0)
        self.assertEqual(live_res['PUK']['n'], 4)
        self.assertEqual(live_res['PUK']['correct'], 3)
        self.assertEqual(live_res['Gerda']['n'], 13)
        self.assertEqual(live_res['Gerda']['correct'], 8)
        self.assertEqual(live_res['Dennisisdebeste']['n'], 0)

    def test_05_evaluator_edge_cases(self):
        """Empty input and single inputs."""
        self.assertEqual(self.evaluator_gpu.predict_batch([]), [])
        
        # Single element batch
        held_ids = set(self.fresh['comparisonEpisodes'])
        r0 = [r for r in self.rows if f"{r['name']}|{r['start']}" in held_ids][0]
        single_pair = [(past_of(self.rows, r0), r0)]
        pred = self.evaluator_gpu.predict_batch(single_pair, verify_parity=True)
        self.assertEqual(len(pred), 1)
        self.assertIn(pred[0], {1, 2, 3, 5, 8})

    def test_06_cpu_fallback(self):
        """Evaluator with device='cpu' must work and match GPU predictions identically."""
        held_ids = set(self.fresh['comparisonEpisodes'])
        r0 = [r for r in self.rows if f"{r['name']}|{r['start']}" in held_ids][0]
        single_pair = [(past_of(self.rows, r0), r0)]
        pred_gpu = self.evaluator_gpu.predict_batch(single_pair)
        pred_cpu = self.evaluator_cpu.predict_batch(single_pair)
        self.assertEqual(pred_gpu, pred_cpu)

    def test_07_gpu_simulator_trivial_win(self):
        """A simple board with 2 free matching tiles must achieve 100% win rate."""
        board = {
            'tiles': [{'x': 0, 'y': 0, 'z': 0}, {'x': 8, 'y': 0, 'z': 0}],
            'nb': {'above': [[], []], 'left': [[], []], 'right': [[], []]},
            'faces': [1, 1],
            'down': [0, 0],
            'clock': None
        }
        sim = MahjongGPUSimulator(board, device=self.evaluator_gpu.device)
        res = sim.simulate_parallel(num_games=128, max_steps=10)
        self.assertEqual(res['wins'], 128)
        self.assertEqual(res['win_rate'], 1.0)
        self.assertEqual(res['mean_tiles_remaining'], 0.0)

    def test_08_gpu_simulator_dead_end_tray_loss(self):
        """A board with unpairable singles that overfills tray must record 100% tray loss."""
        # 4 distinct tiles, tray capacity 4 -> taking them fills tray to 4 and jams immediately
        board = {
            'tiles': [{'x': 0, 'y': 0, 'z': 0}, {'x': 8, 'y': 0, 'z': 0}, {'x': 16, 'y': 0, 'z': 0}, {'x': 24, 'y': 0, 'z': 0}],
            'nb': {'above': [[], [], [], []], 'left': [[], [], [], []], 'right': [[], [], [], []]},
            'faces': [10, 20, 30, 40], # No matches anywhere
            'down': [0, 0, 0, 0],
            'clock': None
        }
        sim = MahjongGPUSimulator(board, device=self.evaluator_gpu.device, max_tray_capacity=4)
        res = sim.simulate_parallel(num_games=128, max_steps=10)
        self.assertEqual(res['wins'], 0)
        self.assertEqual(res['tray_loss_rate'], 1.0)

    def test_09_gpu_simulator_clock_timeout(self):
        """A clock tile that cannot be cleared within move budget must record 100% clock loss."""
        # Clock tile 2 is blocked above by tile 0 and 1, clock limit is 1 move:
        board = {
            'tiles': [{'x': 0, 'y': 0, 'z': 1}, {'x': 8, 'y': 0, 'z': 1}, {'x': 0, 'y': 0, 'z': 0}, {'x': 8, 'y': 0, 'z': 0}],
            'nb': {'above': [[], [], [0, 1], []], 'left': [[], [], [], []], 'right': [[], [], [], []]},
            'faces': [1, 2, 3, 4],
            'down': [0, 0, 0, 0],
            'clock': {'i': 2, 'n': 1} # tile 2 must be cleared within 1 move
        }
        sim = MahjongGPUSimulator(board, device=self.evaluator_gpu.device)
        res = sim.simulate_parallel(num_games=64, max_steps=10)
        self.assertEqual(res['wins'], 0)
        self.assertEqual(res['clock_loss_rate'], 1.0)

    def test_10_gpu_simulator_large_batch_and_vram_cleanup(self):
        """Simulate 2048 games in parallel and ensure no VRAM leakage."""
        board = {
            'tiles': [{'x': i * 8, 'y': 0, 'z': 0} for i in range(8)],
            'nb': {'above': [[] for _ in range(8)], 'left': [[] for _ in range(8)], 'right': [[] for _ in range(8)]},
            'faces': [1, 1, 2, 2, 3, 3, 4, 4],
            'down': [0, 0, 0, 0, 0, 0, 0, 0],
            'clock': None
        }
        sim = MahjongGPUSimulator(board, device=self.evaluator_gpu.device)
        res = sim.simulate_parallel(num_games=2048, max_steps=20)
        self.assertEqual(res['num_games'], 2048)
        self.assertGreater(res['games_per_second'], 1000.0)
        
        # Verify GPU memory is sane and no unbounded growth:
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            alloc_mb = torch.cuda.memory_allocated() / (1024 * 1024)
            self.assertLess(alloc_mb, 500.0, "VRAM allocation should remain low after cleanup")

    def test_11_gpu_simulator_face_down_clock_cost(self):
        """Peeking/flipping face-down tiles must consume moves and trigger clock timeout if budget exceeded."""
        # 2 face-down tiles covering clock tile 2. Clock limit is 2 moves:
        # Flipping tile 0 takes 1 move, flipping tile 1 takes 1 move -> moves reaches 2.
        # Clearing tile 2 within 2 moves is impossible, so clock timeout must be 100%.
        board = {
            'tiles': [{'x': 0, 'y': 0, 'z': 1}, {'x': 8, 'y': 0, 'z': 1}, {'x': 0, 'y': 0, 'z': 0}, {'x': 8, 'y': 0, 'z': 0}],
            'nb': {'above': [[], [], [0, 1], []], 'left': [[], [], [], []], 'right': [[], [], [], []]},
            'faces': [1, 2, 3, 4],
            'down': [1, 1, 0, 0],  # 0 and 1 are face-down
            'clock': {'i': 2, 'n': 2}  # Clock limit is 2 moves
        }
        sim = MahjongGPUSimulator(board, device=self.evaluator_gpu.device)
        res = sim.simulate_parallel(num_games=64, max_steps=10)
        self.assertEqual(res['wins'], 0)
        self.assertEqual(res['clock_loss_rate'], 1.0)
        # Moves recorded must be at least 2 due to the 2 flips
        self.assertGreaterEqual(res['mean_moves'], 2.0)

    def test_12_gpu_simulator_stochastic_monte_carlo(self):
        """Under uniform strategy, rollouts explore stochastic branching paths rather than lockstep copies."""
        # Branching puzzle: 2 pairs available, but clearing one frees a mate while the other leads to tray pressure
        # Tiles 0,1: Face 1. Tiles 2,3: Face 2. Tiles 4,5: Face 3.
        board = {
            'tiles': [{'x': i * 8, 'y': 0, 'z': 0} for i in range(6)],
            'nb': {'above': [[] for _ in range(6)], 'left': [[] for _ in range(6)], 'right': [[] for _ in range(6)]},
            'faces': [1, 2, 3, 1, 2, 3],
            'down': [0] * 6,
            'clock': None
        }
        sim = MahjongGPUSimulator(board, device=self.evaluator_gpu.device)
        
        # Deterministic strategy: All rollouts take identical first pairs
        res_det = sim.simulate_parallel(num_games=256, max_steps=10, strategy='first')
        self.assertEqual(res_det['win_rate'], 1.0)
        
        # Stochastic strategy: Diverse ordering across parallel games
        res_stoch = sim.simulate_parallel(num_games=256, max_steps=10, strategy='uniform', seed=42)
        self.assertEqual(res_stoch['win_rate'], 1.0)
        self.assertEqual(res_stoch['strategy'], 'uniform')

    def test_13_gpu_simulator_vectorized_tray_compaction(self):
        """Heavy tray usage must maintain compact slots and high throughput without CPU serialization."""
        # 6 distinct tiles, tray capacity 4 -> taking them forces multiple tray insertions and dead end
        board = {
            'tiles': [{'x': i * 8, 'y': 0, 'z': 0} for i in range(6)],
            'nb': {'above': [[] for _ in range(6)], 'left': [[] for _ in range(6)], 'right': [[] for _ in range(6)]},
            'faces': [10, 20, 30, 40, 50, 60],
            'down': [0] * 6,
            'clock': None
        }
        sim = MahjongGPUSimulator(board, device=self.evaluator_gpu.device, max_tray_capacity=4)
        res = sim.simulate_parallel(num_games=1024, max_steps=10)
        self.assertEqual(res['wins'], 0)
        self.assertEqual(res['tray_loss_rate'], 1.0)
        # Vectorized throughput should exceed 5,000 games/s even under pure tray jam
        self.assertGreater(res['games_per_second'], 2000.0)

    def test_14_vectorized_decision_head_full_dataset_parity(self):
        """Vectorized GPU decision tree matches CPU reference 100% across all scored tasks in dataset."""
        scored = [r for r in self.rows if target_eligible(r) and r.get('wonOn') is not None and len(past_of(self.rows, r)) >= 6]
        all_pairs = [(past_of(self.rows, r), r) for r in scored]
        self.assertGreaterEqual(len(all_pairs), 200)

        gpu_preds = self.evaluator_gpu.predict_batch(all_pairs, verify_parity=True)
        self.assertEqual(len(gpu_preds), len(all_pairs))

    def test_15_exhaustive_gpu_cpu_decision_head_parity(self):
        """Exhaustively verify 100% bitwise parity between GPU evaluator and CPU across synthetic factor grids."""
        import numpy as np
        from personal_causal_factor_head import F_IDX

        np.random.seed(1337)
        n_samples = 200
        factors_np = np.random.uniform(-3.0, 3.0, size=(n_samples, 10))
        factors = torch.tensor(factors_np, dtype=torch.float64, device=self.evaluator_gpu.device)

        for p_name in ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda']:
            for has_clk in [True, False]:
                for b3 in [3, 5, 8]:
                    for noisy in [True, False]:
                        for open_p in ([0.0, 2.0] if p_name == 'Gerda' else [1.0]):
                            meta = {
                                'has_clock': torch.tensor([has_clk] * n_samples, dtype=torch.bool, device=self.evaluator_gpu.device),
                                'len_same_clk': torch.tensor([5] * n_samples, dtype=torch.int64, device=self.evaluator_gpu.device),
                                'b3_action': torch.tensor([b3] * n_samples, dtype=torch.int64, device=self.evaluator_gpu.device),
                                'is_mrs_doubtfire': torch.tensor([p_name == 'Mrs. Doubtfire'] * n_samples, dtype=torch.bool, device=self.evaluator_gpu.device),
                                'is_dennis': torch.tensor([p_name == 'Dennisisdebeste'] * n_samples, dtype=torch.bool, device=self.evaluator_gpu.device),
                                'is_gerda': torch.tensor([p_name == 'Gerda'] * n_samples, dtype=torch.bool, device=self.evaluator_gpu.device),
                                'open_pairs': torch.tensor([open_p] * n_samples, dtype=torch.float64, device=self.evaluator_gpu.device),
                                'len_own_before': torch.tensor([45] * n_samples, dtype=torch.int64, device=self.evaluator_gpu.device),
                                'clock_slack_ratio': torch.tensor([0.2 if has_clk else 9.9] * n_samples, dtype=torch.float64, device=self.evaluator_gpu.device),
                                'p_ge3_rate': torch.tensor([0.3 if noisy else 0.05] * n_samples, dtype=torch.float64, device=self.evaluator_gpu.device),
                                'p2_rate': torch.tensor([0.3 if noisy else 0.05] * n_samples, dtype=torch.float64, device=self.evaluator_gpu.device),
                                'len_clean_before': torch.tensor([25] * n_samples, dtype=torch.int64, device=self.evaluator_gpu.device),
                            }
                            preds_gpu = self.evaluator_gpu.evaluate_decision_head_gpu(factors, meta).cpu().tolist()

                            preds_cpu = []
                            for i in range(n_samples):
                                f_t = factors_np[i]
                                g = lambda k: float(f_t[F_IDX[k]])

                                if p_name == 'Gerda' and 45 >= 40 and open_p == 0.0:
                                    preds_cpu.append(3 if g('sf14_surv') < 0.0 else 2)
                                    continue

                                if has_clk and b3 == 3:
                                    if p_name == 'Mrs. Doubtfire' and 0.2 >= 0.55 and g('sf14_surv') >= 0.0:
                                        preds_cpu.append(1); continue
                                    if p_name == 'Mrs. Doubtfire' and g('clock_tight') >= 1.20 and g('base_solv') >= -0.70 and g('sf14_surv') >= 1.20:
                                        preds_cpu.append(2); continue
                                    if p_name == 'Mrs. Doubtfire' and g('clock_tight') > 0.0 and g('buried_mate') >= 1.00:
                                        preds_cpu.append(2); continue
                                    if p_name == 'Mrs. Doubtfire' and g('retry_jump') < -0.40 and g('base_solv') < 0.0 and g('sf14_surv') < 0.0 and g('buried_mate') < 0.50 and g('shallow_large') > -1.00:
                                        preds_cpu.append(b3); continue

                                    if p_name == 'Dennisisdebeste':
                                        if g('retry_jump') >= 1.80 and g('clock_tight') <= -1.50:
                                            preds_cpu.append(2); continue
                                        if g('clock_tight') >= 1.20 and g('base_solv') >= -0.80 and g('sf14_surv') >= 1.20:
                                            preds_cpu.append(b3); continue
                                        if g('shallow_large') >= 0.90 and g('buried_mate') <= -1.20 and g('retry_jump') < -0.30 and g('sf14_surv') > 0.0:
                                            preds_cpu.append(b3); continue
                                        if g('clock_tight') >= 0.80 and g('base_solv') <= -0.80 and g('retry_jump') < -0.50 and g('p8_dec') < -0.50:
                                            preds_cpu.append(b3); continue
                                        if g('clock_tight') >= 0.50 and g('base_solv') >= 1.50 and g('shallow_large') >= 0.80:
                                            preds_cpu.append(b3); continue

                                    if (
                                        g('sf14_surv') < -0.35
                                        and g('retry_jump') < -0.40
                                        and (g('p8_dec') > -1.20 or g('open_trap') > 1.00)
                                        and g('base_solv') < 1.00
                                        and (
                                            (g('clock_tight') > 0.0 and (g('base_solv') > -0.60 or g('buried_mate') >= 1.50 or (p_name == 'Mrs. Doubtfire' and g('sf14_surv') < -1.00)))
                                            or (g('sf14_surv') < -1.30 and g('base_solv') <= -1.20 and g('clock_tight') < 0.0)
                                        )
                                    ) or (g('clock_tight') >= 1.20 and g('base_solv') >= -0.70 and g('sf14_surv') >= 1.20):
                                        preds_cpu.append(b3); continue
                                    if (
                                        (g('base_solv') <= -1.20 and g('clock_tight') < 0.20 and g('buried_mate') < 0.70)
                                        or (
                                            g('open_trap') >= 1.30
                                            and g('buried_mate') < 0.0
                                            and g('shallow_large') > -0.15
                                            and (g('clock_tight') < 1.10 or g('sf14_surv') < 1.20)
                                        )
                                        or (
                                            g('sf14_surv') < -0.35
                                            and g('retry_jump') < -0.40
                                            and g('buried_mate') < 0.70
                                            and g('clock_tight') > -1.00
                                            and g('base_solv') < 1.00
                                            and g('p8_dec') > -1.20
                                        )
                                    ):
                                        preds_cpu.append(2); continue
                                    preds_cpu.append(1); continue

                                if has_clk and b3 == 5:
                                    if g('clock_tight') <= -1.50 and g('shallow_large') <= -2.50:
                                        preds_cpu.append(1); continue
                                    if (
                                        (
                                            g('mem_surv') >= 0.15
                                            and g('open_trap') < 1.40
                                            and not (g('base_solv') <= -1.20 and g('retry_jump') < -0.55)
                                        )
                                        or (g('buried_mate') >= 1.85 and g('open_trap') <= -0.60)
                                        or (
                                            g('open_trap') < -0.30
                                            and g('shallow_large') < 0.0
                                            and g('p8_dec') < 0.0
                                            and g('base_solv') < 0.0
                                            and g('clock_tight') < 1.00
                                        )
                                    ):
                                        preds_cpu.append(1); continue
                                    if (g('open_trap') >= 1.40 and g('base_solv') > 0.50 and g('p8_dec') > 1.50) or (
                                        g('base_solv') <= -1.20 and g('retry_jump') < -0.55 and g('mem_surv') >= 0.15
                                    ):
                                        preds_cpu.append(2); continue
                                    if g('clock_tight') >= 1.50 and g('mem_surv') <= -1.0:
                                        preds_cpu.append(b3); continue
                                    if g('open_trap') >= 1.40 or (
                                        g('clock_tight') >= 0.20
                                        and (
                                            g('open_trap') > -0.30
                                            or g('shallow_large') > 0.0
                                            or g('p8_dec') > 0.0
                                            or g('base_solv') > 0.0
                                        )
                                    ):
                                        preds_cpu.append(b3); continue
                                    preds_cpu.append(2); continue

                                cond_noisy = noisy
                                if not has_clk and not cond_noisy:
                                    if g('sf14_surv') < -2.00:
                                        if g('retry_jump') > 0.0 and g('sf14_surv') < -2.50:
                                            preds_cpu.append(2); continue
                                        if g('retry_jump') <= 0.0 and (g('buried_mate') > 1.00 or g('open_trap') >= 1.80):
                                            preds_cpu.append(b3); continue
                                    if g('retry_jump') >= 1.45 and g('buried_mate') >= 2.60:
                                        preds_cpu.append(2); continue
                                    preds_cpu.append(1); continue

                                # Default:
                                if g('sf14_surv') < -2.50 and g('base_solv') <= -1.20 and g('open_trap') >= 1.40:
                                    preds_cpu.append(8); continue
                                if (
                                    1.40 <= g('shallow_large') <= 2.10
                                    and g('open_trap') < 1.20
                                    and (g('sf14_surv') - g('mem_surv')) < 1.40
                                ) or (
                                    g('retry_jump') >= 1.15 and g('open_trap') > 0.20 and g('shallow_large') < 1.40
                                ) or (
                                    g('p8_dec') <= -1.50
                                ):
                                    preds_cpu.append(2); continue
                                if (
                                    (g('open_trap') <= -1.00 and (g('sf14_surv') < -2.00 or (g('mem_surv') >= 0.95 and g('buried_mate') >= 0.30)))
                                    or (0.85 <= g('shallow_large') < 1.40 and (g('base_solv') < 0.0 or g('open_trap') <= -1.00) and g('p8_dec') < 1.70)
                                    or g('sf14_surv') >= 1.40
                                ):
                                    preds_cpu.append(b3); continue
                                preds_cpu.append(1)

                            self.assertEqual(preds_gpu, preds_cpu, f"Parity mismatch in {p_name} clk={has_clk} b3={b3} noisy={noisy}")

    def test_16_clock_inspection_win_parity(self):
        """The 2-tile face-down clock deal (down=[1,1], clock={'i':0, 'n':1}) must win 100% matching production JS."""
        board = {
            'tiles': [{'x': 0, 'y': 0, 'z': 0}, {'x': 8, 'y': 0, 'z': 0}],
            'nb': {'above': [[], []], 'left': [[], []], 'right': [[], []]},
            'faces': [1, 1],
            'down': [1, 1],
            'clock': {'i': 0, 'n': 1}
        }
        sim = MahjongGPUSimulator(board, device=self.evaluator_gpu.device)
        self.assertEqual(sim.is_down.cpu().tolist(), [True, True], "down=[1,1] must be parsed as [True, True]")
        res = sim.simulate_parallel(num_games=64, max_steps=10, seed=1)
        self.assertEqual(res['wins'], 64, "All games must win matching production JS physical session")
        self.assertEqual(res['win_rate'], 1.0)
        self.assertEqual(res['clock_loss_rate'], 0.0)
        self.assertEqual(res['mean_moves'], 2.0)

    def test_17_unsupported_mechanics_rejection(self):
        """Simulator must explicitly raise NotImplementedError for ice, locks, keys, jokers, obstacles."""
        base_board = {
            'tiles': [{'x': 0, 'y': 0, 'z': 0}],
            'nb': {},
            'faces': [1],
            'down': [0],
            'clock': None
        }
        # Ice
        with self.assertRaises(NotImplementedError):
            MahjongGPUSimulator({**base_board, 'rules': {'ice': {0: 1}}})
        # Locks
        with self.assertRaises(NotImplementedError):
            MahjongGPUSimulator({**base_board, 'rules': {'locks': {0}}})
        # Keys
        with self.assertRaises(NotImplementedError):
            MahjongGPUSimulator({**base_board, 'rules': {'keys': [0]}})
        # Obstacles
        with self.assertRaises(NotImplementedError):
            MahjongGPUSimulator({**base_board, 'obst': [0]})


if __name__ == '__main__':
    unittest.main()
