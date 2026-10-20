"""GPU Acceleration Module for Oma's Mahjong Solitaire

Leverages NVIDIA GeForce RTX 3070 (CUDA) and PyTorch for:
1. GPU-accelerated batched evaluation of the Causal 3-Bucket Physical-Factor attempt-count model.
2. Tensorized parallel Mahjong Solitaire Monte Carlo simulation on GPU (simulating thousands of parallel games in VRAM).
3. Graceful automatic fallback to CPU when CUDA is unavailable.
"""

import math
import os
import time
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import torch

from attempt_count_fit import NAMES, is_correct, own_mode
from personal_causal_factor_head import (
    FACTOR_NAMES,
    F_IDX,
    RAW_FEATURE_NAMES,
    RAW_IDX,
    choose_bucket3_action,
    feature_dict_of,
    feature_vector_of,
    is_severe_trap,
    predict_causal_3bucket,
    regime_zscore,
    _own_strictly_earlier,
)


def gpu_diagnostics() -> Dict[str, Any]:
    """Returns detailed diagnostics of the accessible CUDA device (e.g. RTX 3070)."""
    cuda_avail = torch.cuda.is_available()
    diag: Dict[str, Any] = {
        'cuda_available': cuda_avail,
        'torch_version': torch.__version__,
        'cuda_version': torch.version.cuda if cuda_avail else None,
    }
    if cuda_avail:
        device_idx = torch.cuda.current_device()
        props = torch.cuda.get_device_properties(device_idx)
        diag.update({
            'device_index': device_idx,
            'device_name': props.name,
            'compute_capability': (props.major, props.minor),
            'total_memory_bytes': props.total_memory,
            'total_memory_mb': round(props.total_memory / (1024 * 1024), 2),
            'allocated_memory_mb': round(torch.cuda.memory_allocated(device_idx) / (1024 * 1024), 2),
            'reserved_memory_mb': round(torch.cuda.memory_reserved(device_idx) / (1024 * 1024), 2),
            'multi_processor_count': props.multi_processor_count,
        })
    else:
        diag['device_name'] = 'CPU'
    return diag


def get_gpu_device(prefer_gpu: bool = True) -> torch.device:
    """Returns torch.device('cuda') if GPU is preferred and CUDA is available, else CPU."""
    if prefer_gpu and torch.cuda.is_available():
        return torch.device('cuda:0')
    return torch.device('cpu')


# -----------------------------------------------------------------------------
# 1. GPU Causal Factor Evaluator
# -----------------------------------------------------------------------------

def build_factor_weight_matrix(device: torch.device, dtype: torch.dtype = torch.float64) -> torch.Tensor:
    """Builds the 26x10 linear transformation matrix W mapping normalized features to causal factors.
    
    f_t = z_vec @ W
    Exact mathematical equivalent of z_to_factors in personal_causal_factor_head.py.
    """
    W = torch.zeros((len(RAW_FEATURE_NAMES), len(FACTOR_NAMES)), dtype=dtype, device=device)
    
    # 0: bot_surv = (sf14_w5 + sf14_w8 + np8_w8 + ab8_w5 + kz8_w5 + ce8_w5) / 6.0
    for k in ['sf14_w5', 'sf14_w8', 'np8_w8', 'ab8_w5', 'kz8_w5', 'ce8_w5']:
        W[RAW_IDX[k], F_IDX['bot_surv']] = 1.0 / 6.0
        
    # 1: sf14_surv = (sf14_w3 + sf14_w5 + sf14_w8) / 3.0 - 0.5 * s14_t1Left
    for k in ['sf14_w3', 'sf14_w5', 'sf14_w8']:
        W[RAW_IDX[k], F_IDX['sf14_surv']] = 1.0 / 3.0
    W[RAW_IDX['s14_t1Left'], F_IDX['sf14_surv']] = -0.5
    
    # 2: mem_surv = (kz8_w5 + ce8_w5 + np8_w8 + ab8_w5) / 4.0
    for k in ['kz8_w5', 'ce8_w5', 'np8_w8', 'ab8_w5']:
        W[RAW_IDX[k], F_IDX['mem_surv']] = 1.0 / 4.0
        
    # 3: base_solv = (avg + base_t1 + base_w2) / 3.0
    for k in ['avg', 'base_t1', 'base_w2']:
        W[RAW_IDX[k], F_IDX['base_solv']] = 1.0 / 3.0
        
    # 4: retry_jump = (np8_j2 + np8_j3 + kp8_j2 + ap8_j2) / 4.0
    for k in ['np8_j2', 'np8_j3', 'kp8_j2', 'ap8_j2']:
        W[RAW_IDX[k], F_IDX['retry_jump']] = 1.0 / 4.0
        
    # 5: open_trap = (openPairs + blockedFreeCount + takeableWithTakeableMate) / 3.0
    for k in ['openPairs', 'blockedFreeCount', 'takeableWithTakeableMate']:
        W[RAW_IDX[k], F_IDX['open_trap']] = 1.0 / 3.0
        
    # 6: shallow_large = (n - meanMateDepth) / 1.41421356
    W[RAW_IDX['n'], F_IDX['shallow_large']] = 1.0 / 1.41421356
    W[RAW_IDX['meanMateDepth'], F_IDX['shallow_large']] = -1.0 / 1.41421356
    
    # 7: buried_mate = (meanMateDepth - takeableWithVisMateFrac) / 1.41421356
    W[RAW_IDX['meanMateDepth'], F_IDX['buried_mate']] = 1.0 / 1.41421356
    W[RAW_IDX['takeableWithVisMateFrac'], F_IDX['buried_mate']] = -1.0 / 1.41421356
    
    # 8: clock_tight = -clockSlackRatio
    W[RAW_IDX['clockSlackRatio'], F_IDX['clock_tight']] = -1.0
    
    # 9: p8_dec = p8_t1Dec
    W[RAW_IDX['p8_t1Dec'], F_IDX['p8_dec']] = 1.0
    
    return W


class CausalFactorGPUEvaluator:
    """GPU-Accelerated evaluator for the Causal 3-Bucket Physical-Factor attempt count model."""

    def __init__(self, device: Optional[torch.device] = None):
        self.device = device or get_gpu_device()
        self.dtype = torch.float64
        self.W = build_factor_weight_matrix(self.device, self.dtype)

    def evaluate_factors_gpu(self, z_scores: torch.Tensor) -> torch.Tensor:
        """Matrix multiplication computing all 10 causal factors on GPU.
        
        Args:
            z_scores: (B, 26) tensor of normalized features.
        Returns:
            (B, 10) tensor of causal factor values.
        """
        if z_scores.device != self.device:
            z_scores = z_scores.to(self.device, dtype=self.dtype)
        return torch.matmul(z_scores, self.W)

    def evaluate_decision_head_gpu(
        self,
        factors: torch.Tensor,
        meta: Dict[str, torch.Tensor]
    ) -> torch.Tensor:
        """Fully vectorized GPU evaluation of the causal factor decision tree.
        
        Args:
            factors: (B, 10) tensor of causal factors on self.device.
            meta: Dict containing boolean and float condition tensors on self.device.
        Returns:
            (B,) int64 tensor containing predictions in {1, 2, 3, 5, 8}.
        """
        bot_surv = factors[:, F_IDX['bot_surv']]
        sf14_surv = factors[:, F_IDX['sf14_surv']]
        mem_surv = factors[:, F_IDX['mem_surv']]
        base_solv = factors[:, F_IDX['base_solv']]
        retry_jump = factors[:, F_IDX['retry_jump']]
        open_trap = factors[:, F_IDX['open_trap']]
        shallow_large = factors[:, F_IDX['shallow_large']]
        buried_mate = factors[:, F_IDX['buried_mate']]
        clock_tight = factors[:, F_IDX['clock_tight']]
        p8_dec = factors[:, F_IDX['p8_dec']]

        has_clock = meta['has_clock']
        len_same_clk = meta['len_same_clk']
        b3_action = meta['b3_action']
        is_mrs_doubtfire = meta['is_mrs_doubtfire']
        clock_slack_ratio = meta['clock_slack_ratio']
        p_ge3_rate = meta['p_ge3_rate']
        p2_rate = meta['p2_rate']
        len_clean_before = meta['len_clean_before']

        B = factors.shape[0]
        preds = torch.ones(B, dtype=torch.int64, device=factors.device)

        # Case 1: has_clock & len_same_clk < 3
        c1 = has_clock & (len_same_clk < 3)
        c1_8 = (base_solv <= -1.20) & (open_trap >= 1.80)
        preds = torch.where(c1, torch.where(c1_8, 8, 1), preds)

        # Case 2: has_clock & b3_action == 3 (and ~c1)
        c2 = has_clock & (b3_action == 3) & (~c1)
        c2_d1 = is_mrs_doubtfire & (clock_slack_ratio >= 0.55) & (sf14_surv >= 0.0)
        c2_d2 = is_mrs_doubtfire & (clock_tight >= 1.20) & (base_solv >= -0.70) & (sf14_surv >= 1.20)
        c2_d3 = is_mrs_doubtfire & (clock_tight > 0.0) & (buried_mate >= 1.00)
        
        cond_clk_tight_branch = (clock_tight > 0.0) & ((base_solv > -0.60) | (buried_mate >= 1.50) | (is_mrs_doubtfire & (sf14_surv < -1.00)))
        cond_clk_loose_branch = (sf14_surv < -1.30) & (base_solv <= -1.20) & (clock_tight < 0.0)
        
        c2_b3 = (
            (sf14_surv < -0.35)
            & (retry_jump < -0.40)
            & ((p8_dec > -1.20) | (open_trap > 1.00))
            & (base_solv < 1.00)
            & (cond_clk_tight_branch | cond_clk_loose_branch)
        ) | ((clock_tight >= 1.20) & (base_solv >= -0.70) & (sf14_surv >= 1.20))

        c2_2 = (
            ((base_solv <= -1.20) & (clock_tight < 0.20) & (buried_mate < 0.70))
            | (
                (open_trap >= 1.30)
                & (buried_mate < 0.0)
                & (shallow_large > -0.15)
                & ((clock_tight < 1.10) | (sf14_surv < 1.20))
            )
            | (
                (sf14_surv < -0.35)
                & (retry_jump < -0.40)
                & (buried_mate < 0.70)
                & (clock_tight > -1.00)
                & (base_solv < 1.00)
                & (p8_dec > -1.20)
            )
        )

        c2_pred = torch.where(c2_d1, 1,
                  torch.where(c2_d2 | c2_d3, 2,
                  torch.where(c2_b3, b3_action,
                  torch.where(c2_2, 2, 1))))
        preds = torch.where(c2, c2_pred, preds)

        # Case 3: has_clock & b3_action == 5 (and ~c1 & ~c2)
        c3 = has_clock & (b3_action == 5) & (~c1) & (~c2)
        c3_1 = (
            ((mem_surv >= 0.15) & (open_trap < 1.40) & ~((base_solv <= -1.20) & (retry_jump < -0.55)))
            | ((buried_mate >= 1.85) & (open_trap <= -0.60))
            | ((open_trap < -0.30) & (shallow_large < 0.0) & (p8_dec < 0.0) & (base_solv < 0.0))
        )
        c3_2a = ((open_trap >= 1.40) & (base_solv > 0.50) & (p8_dec > 1.50)) | ((base_solv <= -1.20) & (retry_jump < -0.55) & (mem_surv >= 0.15))
        c3_5 = (open_trap >= 1.40) | ((clock_tight >= 0.20) & ((open_trap > -0.30) | (shallow_large > 0.0) | (p8_dec > 0.0) | (base_solv > 0.0)))

        c3_pred = torch.where(c3_1, 1,
                  torch.where(c3_2a, 2,
                  torch.where(c3_5, b3_action, 2)))
        preds = torch.where(c3, c3_pred, preds)

        # Case 4: ~has_clock & not (p_ge3_rate >= 0.16 and (p2_rate >= 0.20 or len_clean_before < 20))
        cond_noisy_nonclock = (p_ge3_rate >= 0.16) & ((p2_rate >= 0.20) | (len_clean_before < 20))
        c4 = (~has_clock) & (~cond_noisy_nonclock)

        c4_sf_b3 = (sf14_surv < -2.00) & (retry_jump <= 0.0) & ((buried_mate > 1.00) | (open_trap >= 1.80))
        c4_sf_2 = (sf14_surv < -2.00) & (retry_jump > 0.0) & (sf14_surv < -2.50)
        c4_sf_1 = (sf14_surv < -2.00) & (~c4_sf_b3) & (~c4_sf_2)

        c4_other_2 = (sf14_surv >= -2.00) & (retry_jump >= 1.45) & (buried_mate >= 2.60)
        
        c4_pred = torch.where(c4_sf_2, 2,
                  torch.where(c4_sf_b3, b3_action,
                  torch.where(c4_sf_1, 1,
                  torch.where(c4_other_2, 2, 1))))
        preds = torch.where(c4, c4_pred, preds)

        # Case 5: Default (non-clock noisy)
        c5 = (~has_clock) & cond_noisy_nonclock
        c5_8 = (sf14_surv < -2.50) & (base_solv <= -1.20) & (open_trap >= 1.40)
        c5_2 = (
            ((shallow_large >= 1.40) & (shallow_large <= 2.10) & (open_trap < 1.20) & ((sf14_surv - mem_surv) < 1.40))
            | ((retry_jump >= 1.15) & (open_trap > 0.20) & (shallow_large < 1.40))
            | (p8_dec <= -1.50)
        )
        c5_b3 = (
            ((open_trap <= -1.00) & ((sf14_surv < -2.00) | ((mem_surv >= 0.95) & (buried_mate >= 0.30))))
            | ((shallow_large >= 0.85) & (shallow_large < 1.40) & ((base_solv < 0.0) | (open_trap <= -1.00)) & (p8_dec < 1.70))
            | (sf14_surv >= 1.40)
        )

        c5_pred = torch.where(c5_8, 8,
                  torch.where(c5_2, 2,
                  torch.where(c5_b3, b3_action, 1)))
        preds = torch.where(c5, c5_pred, preds)

        return preds

    def predict_single(self, before: List[Dict[str, Any]], target: Dict[str, Any]) -> int:
        """Evaluates a single target using the CPU reference logic (guaranteeing exact parity)."""
        return predict_causal_3bucket(before, target)

    def predict_batch(
        self,
        pairs: List[Tuple[List[Dict[str, Any]], Dict[str, Any]]],
        verify_parity: bool = False
    ) -> List[int]:
        """Evaluates a batch of (before, target) pairs accelerated on GPU.
        
        Args:
            pairs: List of (before_rows, target_row).
            verify_parity: If True, asserts exact equality with the CPU reference output.
        Returns:
            List of predicted attempt counts (integers in {1, 2, 3, 5, 8}).
        """
        if not pairs:
            return []

        predictions: List[int] = []
        needs_gpu_eval = []
        eval_indices = []

        for idx, (before, target) in enumerate(pairs):
            own_before = _own_strictly_earlier(before, target)
            if len(own_before) < 6:
                predictions.append(own_mode(own_before, target))
                continue

            d_t = feature_dict_of(target)
            has_recent_8plus = any(r['wonOn'] >= 6 for r in own_before[-40:])
            if is_severe_trap(d_t) and has_recent_8plus:
                predictions.append(8)
                continue

            t_name = target.get('name')
            if t_name == 'Gerda' and d_t.get('openPairs') == 0.0 and d_t.get('n', 72) >= 80:
                predictions.append(2)
                continue

            clean_before = [r for r in own_before if not is_severe_trap(feature_dict_of(r))]
            if len(clean_before) < 6:
                predictions.append(own_mode(own_before, target))
                continue

            # Target requires full factor evaluation:
            z_t = regime_zscore(clean_before, target, win_size=25)
            has_clock = d_t['hasClock'] == 1.0
            same_clk = [r for r in clean_before if feature_dict_of(r)['hasClock'] == d_t['hasClock']]
            b3_action = choose_bucket3_action(own_before, target)
            recent_clean = clean_before[-25:]
            p_ge3_rate = float(np.mean([r['wonOn'] >= 3 for r in recent_clean]))
            p2_rate = float(np.mean([r['wonOn'] == 2 for r in recent_clean]))

            needs_gpu_eval.append({
                'z_vec': z_t,
                'has_clock': has_clock,
                'len_same_clk': len(same_clk),
                'b3_action': b3_action,
                't_name': t_name,
                'clockSlackRatio': d_t.get('clockSlackRatio', 0.0),
                'p_ge3_rate': p_ge3_rate,
                'p2_rate': p2_rate,
                'len_clean_before': len(clean_before),
            })
            eval_indices.append(idx)
            predictions.append(0)  # placeholder

        if needs_gpu_eval:
            z_tensor = torch.tensor(
                np.array([item['z_vec'] for item in needs_gpu_eval]),
                dtype=self.dtype,
                device=self.device
            )
            # Parallel tensor matrix multiplication on GPU:
            factors_tensor = self.evaluate_factors_gpu(z_tensor)

            # Build vectorized metadata tensors on GPU:
            meta = {
                'has_clock': torch.tensor([item['has_clock'] for item in needs_gpu_eval], dtype=torch.bool, device=self.device),
                'len_same_clk': torch.tensor([item['len_same_clk'] for item in needs_gpu_eval], dtype=torch.int64, device=self.device),
                'b3_action': torch.tensor([item['b3_action'] for item in needs_gpu_eval], dtype=torch.int64, device=self.device),
                'is_mrs_doubtfire': torch.tensor([item['t_name'] == 'Mrs. Doubtfire' for item in needs_gpu_eval], dtype=torch.bool, device=self.device),
                'clock_slack_ratio': torch.tensor([item['clockSlackRatio'] for item in needs_gpu_eval], dtype=torch.float64, device=self.device),
                'p_ge3_rate': torch.tensor([item['p_ge3_rate'] for item in needs_gpu_eval], dtype=torch.float64, device=self.device),
                'p2_rate': torch.tensor([item['p2_rate'] for item in needs_gpu_eval], dtype=torch.float64, device=self.device),
                'len_clean_before': torch.tensor([item['len_clean_before'] for item in needs_gpu_eval], dtype=torch.int64, device=self.device),
            }

            # Fully vectorized GPU decision head:
            preds_gpu = self.evaluate_decision_head_gpu(factors_tensor, meta)
            preds_list = preds_gpu.cpu().tolist()

            for i, p_val in enumerate(preds_list):
                predictions[eval_indices[i]] = p_val

        if verify_parity:
            for idx, (before, target) in enumerate(pairs):
                cpu_pred = predict_causal_3bucket(before, target)
                assert predictions[idx] == cpu_pred, (
                    f"GPU/CPU parity mismatch at index {idx} ({target.get('name')}|{target.get('lv')}): "
                    f"GPU={predictions[idx]} vs CPU={cpu_pred}"
                )

        return predictions


# -----------------------------------------------------------------------------
# 2. Tensorized Parallel Mahjong Solitaire Monte Carlo Simulator on GPU
# -----------------------------------------------------------------------------

class MahjongGPUSimulator:
    """Simulates thousands of Mahjong Solitaire games concurrently in GPU VRAM (RTX 3070)."""

    def __init__(
        self,
        board: Dict[str, Any],
        device: Optional[torch.device] = None,
        max_tray_capacity: int = 4
    ):
        """Initializes the GPU simulator with the DAG representation of a board.
        
        Args:
            board: Dict containing 'tiles', 'nb' (above, left, right), 'faces', 'down', 'clock'.
            device: torch.device (defaults to CUDA if available).
            max_tray_capacity: Max slots in tray (standard is 4, 4th causes loss).
        """
        self.device = device or get_gpu_device()
        self.max_tray = max_tray_capacity
        self.n = len(board['tiles'])
        
        # Build binary dependency matrices (N, N)
        above = torch.zeros((self.n, self.n), dtype=torch.bool, device=self.device)
        left = torch.zeros((self.n, self.n), dtype=torch.bool, device=self.device)
        right = torch.zeros((self.n, self.n), dtype=torch.bool, device=self.device)
        
        nb = board.get('nb', {})
        for i in range(self.n):
            if 'above' in nb and i < len(nb['above']):
                for j in nb['above'][i]:
                    if j < self.n:
                        above[i, j] = True
            if 'left' in nb and i < len(nb['left']):
                for j in nb['left'][i]:
                    if j < self.n:
                        left[i, j] = True
            if 'right' in nb and i < len(nb['right']):
                for j in nb['right'][i]:
                    if j < self.n:
                        right[i, j] = True

        self.above_matrix = above
        self.left_matrix = left
        self.right_matrix = right

        # Faces tensor
        faces_list = [int(f) for f in board['faces']]
        self.faces = torch.tensor(faces_list, dtype=torch.int16, device=self.device)

        # Down mask
        down_mask = torch.zeros(self.n, dtype=torch.bool, device=self.device)
        if 'down' in board and board['down']:
            if isinstance(board['down'], (list, set, tuple)):
                for idx in board['down']:
                    if idx < self.n:
                        down_mask[idx] = True
            elif hasattr(board['down'], '__iter__'):
                for idx, val in enumerate(board['down']):
                    if idx < self.n and val:
                        down_mask[idx] = True
        self.is_down = down_mask

        # Clock settings
        clock = board.get('clock')
        if clock and isinstance(clock, dict):
            self.has_clock = True
            self.clock_i = int(clock['i'])
            self.clock_n = int(clock['n'])
        else:
            self.has_clock = False
            self.clock_i = -1
            self.clock_n = 999999

    def simulate_parallel(
        self,
        num_games: int = 2048,
        max_steps: int = 250,
        seed: Optional[int] = None,
        strategy: str = 'first'
    ) -> Dict[str, Any]:
        """Runs num_games parallel rollouts on GPU using vectorized tensor operations.
        
        Args:
            num_games: Number of parallel games to simulate in VRAM.
            max_steps: Maximum step horizon per game.
            seed: Optional random seed for reproducible rollouts.
            strategy: 'first' for deterministic greedy prioritization (test baseline),
                      'uniform' for stochastic Monte Carlo exploration.
        Returns:
            Dict containing win_rate, tray_loss_rate, clock_loss_rate,
            dead_end_rate, mean_moves, throughput (games_per_sec).
        """
        if seed is not None:
            torch.manual_seed(seed)

        is_stochastic = (strategy == 'uniform')
        B = num_games
        N = self.n
        t0 = time.time()

        # Batch state tensors on GPU
        alive = torch.ones((B, N), dtype=torch.bool, device=self.device)
        known = torch.full((B, N), -1, dtype=torch.int16, device=self.device)
        # Face-up tiles are immediately known:
        known[:, ~self.is_down] = self.faces[~self.is_down].unsqueeze(0).expand(B, -1)

        # Tray state: B x max_tray
        tray = torch.full((B, self.max_tray), -1, dtype=torch.int16, device=self.device)
        tray_count = torch.zeros(B, dtype=torch.int64, device=self.device)
        moves = torch.zeros(B, dtype=torch.int64, device=self.device)
        tiles_remaining = torch.full((B,), N, dtype=torch.int64, device=self.device)

        won = torch.zeros(B, dtype=torch.bool, device=self.device)
        lost_tray = torch.zeros(B, dtype=torch.bool, device=self.device)
        lost_clock = torch.zeros(B, dtype=torch.bool, device=self.device)
        lost_dead_end = torch.zeros(B, dtype=torch.bool, device=self.device)

        above_t = self.above_matrix.t().float()
        left_t = self.left_matrix.t().float()
        right_t = self.right_matrix.t().float()
        unique_faces = torch.unique(self.faces).tolist()

        for step in range(max_steps):
            active = ~(won | lost_tray | lost_clock | lost_dead_end)
            if not active.any():
                break

            noise = torch.rand((B, N), device=self.device) if is_stochastic else None

            # 1. Compute free tiles for all games in parallel via matrix multiplication
            alive_f = alive.float()
            blocked_above = torch.matmul(alive_f, above_t) > 0
            blocked_left = torch.matmul(alive_f, left_t) > 0
            blocked_right = torch.matmul(alive_f, right_t) > 0
            is_free = alive & (~blocked_above) & ((~blocked_left) | (~blocked_right))
            free_faces = torch.where(is_free & (known >= 0), known, torch.tensor(-1, device=self.device, dtype=torch.int16))

            moved = torch.zeros(B, dtype=torch.bool, device=self.device)

            # Phase 1: Vectorized board pair matching
            faces_order = unique_faces
            if is_stochastic and len(unique_faces) > 1:
                faces_order = [unique_faces[i] for i in torch.randperm(len(unique_faces)).tolist()]

            for f in faces_order:
                cand = (free_faces == f)
                counts = cand.sum(dim=1)
                has_pair = active & (~moved) & (counts >= 2)
                if has_pair.any():
                    if is_stochastic:
                        scores = torch.where(cand & has_pair.unsqueeze(1), noise, torch.tensor(-1e9, device=self.device))
                        _, top2 = torch.topk(scores, 2, dim=1)
                        mask2 = torch.zeros_like(alive)
                        mask2.scatter_(1, top2, True)
                        alive[has_pair.unsqueeze(1) & mask2] = False
                    else:
                        cand_pair = cand & has_pair.unsqueeze(1)
                        idx = torch.cumsum(cand_pair.int(), dim=1)
                        mask2 = cand_pair & (idx <= 2)
                        alive[mask2] = False
                    moved |= has_pair
                    moves[has_pair] += 2
                    tiles_remaining[has_pair] -= 2

            # Phase 2: Vectorized tray matching
            cur_free_faces = torch.where(alive & is_free & (known >= 0), known, torch.tensor(-1, device=self.device, dtype=torch.int16))
            for s in range(self.max_tray):
                slot_face = tray[:, s]
                has_slot = active & (~moved) & (slot_face >= 0)
                if has_slot.any():
                    cand_tray = (cur_free_faces == slot_face.unsqueeze(1)) & has_slot.unsqueeze(1)
                    has_match = cand_tray.any(dim=1)
                    if has_match.any():
                        if is_stochastic:
                            scores = torch.where(cand_tray & has_match.unsqueeze(1), noise, torch.tensor(-1e9, device=self.device))
                            match_tile = torch.argmax(scores, dim=1)
                        else:
                            match_tile = torch.argmax(cand_tray.int(), dim=1)
                        mask1 = torch.zeros_like(alive)
                        mask1.scatter_(1, match_tile.unsqueeze(1), True)
                        alive[has_match.unsqueeze(1) & mask1] = False
                        tray[has_match, s] = -1
                        tray_count[has_match] -= 1
                        moved |= has_match
                        moves[has_match] += 1
                        tiles_remaining[has_match] -= 2

            if moved.any():
                # Compact tray slots on GPU
                is_occupied = (tray >= 0).int()
                sorted_idx = torch.argsort(is_occupied, dim=1, descending=True, stable=True)
                tray = torch.gather(tray, 1, sorted_idx)

            # Phase 3: Vectorized safe peeking of face-down tiles
            down_free = alive & is_free & (known < 0) & active.unsqueeze(1) & (~moved).unsqueeze(1)
            has_down = down_free.any(dim=1)
            if has_down.any():
                if is_stochastic:
                    scores = torch.where(down_free, noise, torch.tensor(-1e9, device=self.device))
                    flip_tile = torch.argmax(scores, dim=1)
                else:
                    flip_tile = torch.argmax(down_free.int(), dim=1)
                mask_flip = torch.zeros_like(alive)
                mask_flip.scatter_(1, flip_tile.unsqueeze(1), True)
                known[has_down.unsqueeze(1) & mask_flip] = self.faces.unsqueeze(0).expand(B, -1)[has_down.unsqueeze(1) & mask_flip]
                moved |= has_down
                moves[has_down] += 1  # Flipping a face-down tile consumes 1 move

            # Phase 4: Taking a free tile into tray (if headroom permits)
            avail_free = alive & is_free & active.unsqueeze(1) & (~moved).unsqueeze(1)
            has_avail = avail_free.any(dim=1)
            has_room = has_avail & (tray_count < self.max_tray - 1)
            if has_room.any():
                if is_stochastic:
                    scores = torch.where(avail_free & has_room.unsqueeze(1), noise, torch.tensor(-1e9, device=self.device))
                    take_tile = torch.argmax(scores, dim=1)
                else:
                    take_tile = torch.argmax((avail_free & has_room.unsqueeze(1)).int(), dim=1)
                
                mask_take = torch.zeros_like(alive)
                mask_take.scatter_(1, take_tile.unsqueeze(1), True)
                alive[has_room.unsqueeze(1) & mask_take] = False
                taken_faces = self.faces[take_tile]

                empty_slots = (tray < 0).int()
                first_empty = torch.argmax(empty_slots, dim=1)
                tray[has_room, first_empty[has_room]] = taken_faces[has_room]
                tray_count[has_room] += 1
                moves[has_room] += 1
                moved |= has_room

            # Tray loss condition: tray has >= max_tray-1 tiles and no valid non-overflow move exists
            lost_tray_mask = active & (~moved) & has_avail & (tray_count >= self.max_tray - 1)
            lost_tray |= lost_tray_mask

            # Dead end condition: no free tiles remaining at all
            lost_dead_end |= active & (~moved) & (~has_avail)

            # Win condition
            won |= active & (tiles_remaining <= 0)

            # Clock timeout condition
            if self.has_clock:
                clock_lost = active & alive[:, self.clock_i] & (moves >= self.clock_n)
                lost_clock |= clock_lost

        if torch.cuda.is_available():
            torch.cuda.synchronize()

        elapsed = time.time() - t0
        wins = int(won.sum().item())
        tray_losses = int(lost_tray.sum().item())
        clock_losses = int(lost_clock.sum().item())
        dead_ends = int(lost_dead_end.sum().item())

        return {
            'num_games': B,
            'wins': wins,
            'win_rate': round(wins / B, 4),
            'tray_loss_rate': round(tray_losses / B, 4),
            'clock_loss_rate': round(clock_losses / B, 4),
            'dead_end_rate': round(dead_ends / B, 4),
            'mean_moves': round(float(moves.float().mean().item()), 2),
            'mean_tiles_remaining': round(float(tiles_remaining.float().mean().item()), 2),
            'elapsed_seconds': round(elapsed, 4),
            'games_per_second': round(B / max(elapsed, 1e-6), 1),
            'device': str(self.device),
            'strategy': strategy,
        }


if __name__ == '__main__':
    diag = gpu_diagnostics()
    print("================================================================================")
    print("                 OMA'S MAHJONG GPU ACCELERATION DIAGNOSTICS")
    print("================================================================================")
    print(f"CUDA Available      : {diag['cuda_available']}")
    print(f"Device Name         : {diag.get('device_name', 'N/A')}")
    if diag['cuda_available']:
        print(f"CUDA Version        : {diag['cuda_version']}")
        print(f"Compute Capability  : {diag['compute_capability']}")
        print(f"Total VRAM          : {diag['total_memory_mb']} MB")
        print(f"Allocated VRAM      : {diag['allocated_memory_mb']} MB")
        print(f"SM Processors       : {diag['multi_processor_count']}")
    print("================================================================================\n")
