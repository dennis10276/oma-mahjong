#!/usr/bin/env python3
"""
Task G2 Part B — GPU calibration and held-out evaluation for the builder pre-screen.

Loads the packed 2,134-board dataset (`source/build/prescreen-dataset.bin` + `.json`),
optimizes proxy policy parameters strictly on the 75% training split on the RTX 3070,
fits a strictly-monotone full-range `[1, 20]` calibration and optimal 90%-recall band
interval `[L, U]` on the 75% training split ONLY, saves `calibrated_params.json`, and
evaluates once on the 25% held-out test split.
"""

import argparse
import json
import time
from pathlib import Path

import numpy as np
import cupy as cp

from prescreen_gpu import (
    PARAM_NAMES,
    SCREEN_BOARD_BYTES,
    GpuPrescreenEngine,
    apply_readout,
    params_to_array,
)


def rankdata_avg(a: np.ndarray) -> np.ndarray:
    a = np.asarray(a, dtype=np.float64)
    order = np.argsort(a, kind="mergesort")
    s = a[order]
    diff = np.concatenate(([True], s[1:] != s[:-1], [True]))
    idx = np.flatnonzero(diff)
    ranks = np.empty_like(a, dtype=np.float64)
    for k in range(len(idx) - 1):
        lo, hi = idx[k], idx[k + 1]
        ranks[order[lo:hi]] = 0.5 * (lo + hi - 1) + 1.0
    return ranks


def spearman_rho(x: np.ndarray, y: np.ndarray) -> float:
    if len(x) < 3:
        return 0.0
    rx = rankdata_avg(x)
    ry = rankdata_avg(y)
    rx -= np.mean(rx)
    ry -= np.mean(ry)
    denom = float(np.sqrt(np.sum(rx * rx) * np.sum(ry * ry)))
    return float(np.sum(rx * ry) / denom) if denom > 1e-12 else 0.0


def pearson_r(x: np.ndarray, y: np.ndarray) -> float:
    if len(x) < 3:
        return 0.0
    dx = np.asarray(x, dtype=np.float64) - np.mean(x)
    dy = np.asarray(y, dtype=np.float64) - np.mean(y)
    denom = float(np.sqrt(np.sum(dx * dx) * np.sum(dy * dy)))
    return float(np.sum(dx * dy) / denom) if denom > 1e-12 else 0.0


def roc_auc_exact(y_true_bool: np.ndarray, y_score: np.ndarray) -> float:
    y = np.asarray(y_true_bool, dtype=bool)
    n_pos = int(np.sum(y))
    n_neg = int(len(y) - n_pos)
    if n_pos == 0 or n_neg == 0:
        return 0.5
    ranks = rankdata_avg(y_score)
    u = float(np.sum(ranks[y])) - n_pos * (n_pos + 1) * 0.5
    return u / (n_pos * n_neg)


def pava_isotonic(x: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    order = np.argsort(x, kind="mergesort")
    xs = np.asarray(x[order], dtype=np.float64)
    ys = np.asarray(y[order], dtype=np.float64)

    ux, inv = np.unique(xs, return_inverse=True)
    wy = np.bincount(inv, weights=ys)
    wc = np.bincount(inv).astype(np.float64)

    blocks = []
    for k in range(len(ux)):
        blocks.append([wy[k], wc[k], k, k])
        while len(blocks) >= 2 and (blocks[-2][0] / blocks[-2][1]) > (blocks[-1][0] / blocks[-1][1]):
            b2 = blocks.pop()
            b1 = blocks.pop()
            blocks.append([b1[0] + b2[0], b1[1] + b2[1], b1[2], b2[3]])

    fitted_u = np.empty(len(ux), dtype=np.float64)
    for swy, sw, lo, hi in blocks:
        fitted_u[lo : hi + 1] = swy / sw
    return ux, fitted_u


def fit_monotone_readout(exp_tr: np.ndarray, y_tr: np.ndarray) -> dict:
    """
    Fits a strictly increasing full-range [1, 20] monotone map on the 75% train split ONLY,
    preserving 100% of Spearman rank order while keeping 1.0 -> ~1.0 and 20.0 -> ~20.0 so
    capped hard boards are never compressed into the middle 10..13 band.
    """
    ux, uy = pava_isotonic(exp_tr, y_tr)
    xp = np.linspace(1.0, 20.0, 39)
    yp_iso = np.interp(xp, ux, uy)
    in_band = (y_tr >= 10.0) & (y_tr <= 13.0)
    clearly_out = (y_tr <= 6.0) | (y_tr >= 18.0)

    med_in = float(np.clip(np.median(exp_tr[in_band]), 2.5, 17.5)) if np.any(in_band) else 10.5
    y_anchor = np.where(
        xp <= med_in,
        1.0 + 10.5 * (xp - 1.0) / max(1e-3, med_in - 1.0),
        11.5 + 8.5 * (xp - med_in) / max(1e-3, 20.0 - med_in),
    )
    yp = np.clip(0.75 * y_anchor + 0.25 * yp_iso, 1.0, 20.0)
    yp[0] = 1.0
    yp[-1] = 20.0
    for k in range(1, len(yp)):
        if yp[k] <= yp[k - 1] + 1e-3:
            yp[k] = min(20.0, yp[k - 1] + 1e-3)

    preds = np.interp(exp_tr.astype(np.float64), xp, yp)

    # Search over 90%-in-band-recall intervals [L, U] on TRAIN split ONLY to maximize clearly-out discard!
    in_preds = np.sort(preds[in_band])
    n_in = len(in_preds)
    best_center = 11.5
    best_tau = 6.0
    best_out_discard = -1.0

    if n_in >= 10 and np.any(clearly_out):
        span = int(np.ceil(0.90 * n_in))
        for start_i in range(0, n_in - span + 1):
            end_i = start_i + span - 1
            lo_v = float(in_preds[start_i]) - 1e-4
            hi_v = float(in_preds[end_i]) + 1e-4
            c = 0.5 * (lo_v + hi_v)
            tau = 0.5 * (hi_v - lo_v)
            kept_out = np.abs(preds[clearly_out] - c) <= tau
            out_disc = float(1.0 - np.mean(kept_out))
            if out_disc > best_out_discard:
                best_out_discard = out_disc
                best_center = c
                best_tau = tau

    return {
        "xp": [round(float(v), 4) for v in xp],
        "yp": [round(float(v), 4) for v in yp],
        "bandCenter": round(best_center, 4),
        "tau90Train": round(best_tau, 4),
        "trainOutDiscardAt90": round(best_out_discard, 4),
    }


# Physically grounded bounds (hidden/frozen keys are invisible: w_hidden_route <= 0.08, key_retention <= 0.15)
PARAM_BOUNDS = {
    "w_match":           (28.0, 75.0),
    "key_retention":     (0.0, 0.15),
    "w_route":           (3.0, 26.0),
    "w_route_order":     (0.0, 0.90),
    "w_to_clock":        (0.0, 12.0),
    "w_hidden_route":    (0.0, 0.08),
    "w_urgency":         (0.0, 1.80),
    "w_pair":            (4.0, 26.0),
    "w_out":             (4.0, 32.0),
    "w_open":            (0.5, 10.0),
    "w_peek":            (4.0, 22.0),
    "w_peek_patience":   (0.5, 6.0),
    "w_lookahead_dead":  (28.0, 110.0),
    "w_lookahead_risky": (4.0, 30.0),
    "temperature":       (0.6, 3.6),
    "retention":         (0.30, 0.92),
}

SEED_ANCHOR = {
    "w_match": 50.0,
    "key_retention": 0.02,
    "w_route": 9.0,
    "w_route_order": 0.40,
    "w_to_clock": 4.0,
    "w_hidden_route": 0.02,
    "w_urgency": 0.80,
    "w_pair": 14.0,
    "w_out": 14.0,
    "w_open": 4.0,
    "w_peek": 11.0,
    "w_peek_patience": 3.0,
    "w_lookahead_dead": 55.0,
    "w_lookahead_risky": 12.0,
    "temperature": 2.2,
    "retention": 0.60,
}


def sample_lhs_params(rng: np.random.Generator, n_samples: int) -> np.ndarray:
    d = len(PARAM_NAMES)
    grid = np.zeros((n_samples, d), dtype=np.float32)
    for j, name in enumerate(PARAM_NAMES):
        lo, hi = PARAM_BOUNDS[name]
        perm = rng.permutation(n_samples)
        u = (perm + rng.random(n_samples)) / n_samples
        grid[:, j] = lo + u * (hi - lo)
    return grid


def compute_split_metrics(
    scores: np.ndarray,
    band_dist: np.ndarray,
    family_y: np.ndarray,
    skilled_mask: np.ndarray,
    skilled_y: np.ndarray,
    tau90_from_train: float,
) -> dict:
    n_total = len(family_y)
    rho_family = spearman_rho(scores, family_y)
    r_family = pearson_r(scores, family_y)
    mae_family = float(np.mean(np.abs(scores - family_y)))

    n_skilled = int(np.sum(skilled_mask))
    rho_skilled = spearman_rho(scores[skilled_mask], skilled_y[skilled_mask]) if n_skilled >= 3 else None
    r_skilled = pearson_r(scores[skilled_mask], skilled_y[skilled_mask]) if n_skilled >= 3 else None

    in_band = (family_y >= 10.0) & (family_y <= 13.0)
    out_easy = family_y <= 6.0
    out_hard = family_y >= 18.0
    clearly_out = out_easy | out_hard

    n_in = int(np.sum(in_band))
    n_out = int(np.sum(clearly_out))
    n_out_easy = int(np.sum(out_easy))
    n_out_hard = int(np.sum(out_hard))

    sep_mask = in_band | clearly_out
    band_roc_auc = roc_auc_exact(in_band[sep_mask], -band_dist[sep_mask]) if (n_in > 0 and n_out > 0) else None
    easy_vs_band_auc = roc_auc_exact(in_band[in_band | out_easy], scores[in_band | out_easy]) if (n_in > 0 and n_out_easy > 0) else None
    hard_vs_band_auc = roc_auc_exact(out_hard[in_band | out_hard], scores[in_band | out_hard]) if (n_in > 0 and n_out_hard > 0) else None

    # Cut 1: throw away 70% of ALL candidates (keep top 30% with smallest bandDistance)
    keep_count_30 = max(1, int(round(0.30 * n_total)))
    order_by_band = np.argsort(band_dist, kind="mergesort")
    kept_30_mask = np.zeros(n_total, dtype=bool)
    kept_30_mask[order_by_band[:keep_count_30]] = True

    inband_kept_at_70_discard = float(np.mean(kept_30_mask[in_band])) if n_in > 0 else None
    clearly_out_discarded_at_70_discard = float(1.0 - np.mean(kept_30_mask[clearly_out])) if n_out > 0 else None
    precision_inband_before = float(n_in / n_total) if n_total > 0 else 0.0
    precision_inband_after_70_discard = float(np.sum(kept_30_mask & in_band) / keep_count_30)

    # Cut 2: Bar check — keep >= 90% of in-band boards; how many clearly-out boards are discarded?
    keep_train_tau = band_dist <= tau90_from_train
    train_tau_inband_keep = float(np.mean(keep_train_tau[in_band])) if n_in > 0 else None
    train_tau_out_discard = float(1.0 - np.mean(keep_train_tau[clearly_out])) if n_out > 0 else None
    train_tau_overall_discard = float(1.0 - np.mean(keep_train_tau))

    if n_in > 0 and n_out > 0:
        # Best contiguous 90% in-band interval on this split AND symmetric around bandCenter
        sorted_in_dists = np.sort(band_dist[in_band])
        idx_90 = min(n_in - 1, int(np.ceil(0.90 * n_in)) - 1)
        tau_exact_90 = float(sorted_in_dists[idx_90])
        keep_90 = band_dist <= tau_exact_90
        exact90_inband_keep = float(np.mean(keep_90[in_band]))
        exact90_out_discard = float(1.0 - np.mean(keep_90[clearly_out]))
        exact90_easy_discard = float(1.0 - np.mean(keep_90[out_easy])) if n_out_easy > 0 else None
        exact90_hard_discard = float(1.0 - np.mean(keep_90[out_hard])) if n_out_hard > 0 else None
        exact90_overall_discard = float(1.0 - np.mean(keep_90))
        meets_bar = bool(exact90_inband_keep >= 0.90 and exact90_out_discard >= 0.50)

        # Also check oracle best contiguous 90% interval [L, U] on scores directly (upper bound for any monotone score cut)
        in_sc = np.sort(scores[in_band])
        span = int(np.ceil(0.90 * n_in))
        best_oracle_out_disc = 0.0
        for si in range(0, n_in - span + 1):
            lo_s, hi_s = in_sc[si], in_sc[si + span - 1]
            disc = float(1.0 - np.mean((scores[clearly_out] >= lo_s) & (scores[clearly_out] <= hi_s)))
            if disc > best_oracle_out_disc:
                best_oracle_out_disc = disc
    else:
        tau_exact_90 = None
        exact90_inband_keep = None
        exact90_out_discard = None
        exact90_easy_discard = None
        exact90_hard_discard = None
        exact90_overall_discard = None
        best_oracle_out_disc = None
        meets_bar = False

    return {
        "nBoards": n_total,
        "nSkilled": n_skilled,
        "nInBand_10_13": n_in,
        "nClearlyOut": n_out,
        "nClearlyOutEasy_le6": n_out_easy,
        "nClearlyOutHard_ge18": n_out_hard,
        "spearmanFamily": round(rho_family, 4),
        "pearsonFamily": round(r_family, 4),
        "maeFamily": round(mae_family, 3),
        "spearmanSkilled": round(rho_skilled, 4) if rho_skilled is not None else None,
        "pearsonSkilled": round(r_skilled, 4) if r_skilled is not None else None,
        "bandSeparation": {
            "inBandVsClearlyOutRocAuc": round(band_roc_auc, 4) if band_roc_auc is not None else None,
            "inBandVsEasyLe6RocAuc": round(easy_vs_band_auc, 4) if easy_vs_band_auc is not None else None,
            "hardGe18VsInBandRocAuc": round(hard_vs_band_auc, 4) if hard_vs_band_auc is not None else None,
        },
        "discard70PercentCut": {
            "candidatesDiscardedShare": round(1.0 - keep_count_30 / n_total, 4),
            "inBandKeptShare": round(inband_kept_at_70_discard, 4) if inband_kept_at_70_discard is not None else None,
            "clearlyOutDiscardedShare": round(clearly_out_discarded_at_70_discard, 4) if clearly_out_discarded_at_70_discard is not None else None,
            "inBandBaseRate": round(precision_inband_before, 4),
            "inBandPrecisionAfterCut": round(precision_inband_after_70_discard, 4),
            "enrichmentFactor": round(precision_inband_after_70_discard / precision_inband_before, 2) if precision_inband_before > 0 else None,
        },
        "barCheckAt90PercentInBandKeep": {
            "exact90Threshold": round(tau_exact_90, 4) if tau_exact_90 is not None else None,
            "inBandKeptShare": round(exact90_inband_keep, 4) if exact90_inband_keep is not None else None,
            "clearlyOutDiscardedShare": round(exact90_out_discard, 4) if exact90_out_discard is not None else None,
            "bestContiguousIntervalOutDiscard": round(best_oracle_out_disc, 4) if best_oracle_out_disc is not None else None,
            "easyLe6DiscardedShare": round(exact90_easy_discard, 4) if exact90_easy_discard is not None else None,
            "hardGe18DiscardedShare": round(exact90_hard_discard, 4) if exact90_hard_discard is not None else None,
            "overallCandidatesDiscardedShare": round(exact90_overall_discard, 4) if exact90_overall_discard is not None else None,
            "meetsBar_90Keep_50OutDiscard": meets_bar,
            "usingTrainThreshold": {
                "tauTrain": round(tau90_from_train, 4),
                "inBandKeptShare": round(train_tau_inband_keep, 4) if train_tau_inband_keep is not None else None,
                "clearlyOutDiscardedShare": round(train_tau_out_discard, 4) if train_tau_out_discard is not None else None,
                "overallCandidatesDiscardedShare": round(train_tau_overall_discard, 4),
            },
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Calibrate GPU proxy rater on 75% train, report on 25% held-out")
    parser.add_argument("--samples", type=int, default=360, help="Number of LHS random parameter vectors in Stage 1")
    parser.add_argument("--refine-steps", type=int, default=140, help="Coordinate/local refinement evaluations in Stage 2")
    parser.add_argument("--out-json", type=str, default="", help="Path to write full calibration report JSON")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    bin_path = repo_root / "build" / "prescreen-dataset.bin"
    meta_path = repo_root / "build" / "prescreen-dataset.json"

    raw_bytes = bin_path.read_bytes()
    meta_doc = json.loads(meta_path.read_text(encoding="utf-8"))
    boards = meta_doc["boards"]
    total_boards = len(boards)
    assert len(raw_bytes) == total_boards * SCREEN_BOARD_BYTES

    all_u8 = np.frombuffer(raw_bytes, dtype=np.uint8).reshape(total_boards, SCREEN_BOARD_BYTES)
    splits = np.array([b["split"] for b in boards])
    sources = np.array([b["source"] for b in boards])
    family_all = np.array([float(b["familyExp"]) for b in boards], dtype=np.float64)
    skilled_mask_all = np.array([b["skilledExp"] is not None for b in boards], dtype=bool)
    skilled_all = np.array([float(b["skilledExp"] or 0.0) for b in boards], dtype=np.float64)

    train_idx = np.flatnonzero(splits == "train")
    test_idx = np.flatnonzero(splits == "test")

    y_tr = family_all[train_idx]
    src_tr = sources[train_idx]
    knobs_tr_mask = src_tr == "knobs-v1"
    td_tr_mask = src_tr == "training-data"
    in_band_tr = (y_tr >= 10.0) & (y_tr <= 13.0)
    out_easy_tr = y_tr <= 6.0
    out_hard_tr = y_tr >= 18.0
    out_tr = out_easy_tr | out_hard_tr
    sep_tr = in_band_tr | out_tr

    engine = GpuPrescreenEngine()
    print(f"GPU ready: {engine.device_name} ({engine.sm_count} SMs). Train={len(train_idx)}, Test={len(test_idx)}")

    d_train = cp.asarray(np.ascontiguousarray(all_u8[train_idx]).reshape(-1))
    d_test = cp.asarray(np.ascontiguousarray(all_u8[test_idx]).reshape(-1))
    n_tr = len(train_idx)
    n_te = len(test_idx)

    tr_bufs = (
        cp.empty(n_tr, dtype=cp.float32),
        cp.empty(n_tr, dtype=cp.float32),
        cp.empty(n_tr, dtype=cp.float32),
        cp.empty(n_tr, dtype=cp.float32),
    )

    def eval_train_objective(p_vec: np.ndarray, campaigns: int = 48, seed: int = 4711) -> tuple[float, dict]:
        d_exp, d_first, d_clear, d_clock, k_ms = engine.evaluate_device_boards(
            d_train, n_tr, p_vec, campaigns=campaigns, max_tries=20, seed=seed, out_buffers=tr_bufs
        )
        exp_np = d_exp.get()
        first_np = d_first.get()
        clear_np = d_clear.get()
        clock_np = d_clock.get()

        rho_all = spearman_rho(exp_np, y_tr)
        rho_knobs = spearman_rho(exp_np[knobs_tr_mask], y_tr[knobs_tr_mask])
        rho_td = spearman_rho(exp_np[td_tr_mask], y_tr[td_tr_mask])

        easy_auc = roc_auc_exact(in_band_tr[in_band_tr | out_easy_tr], exp_np[in_band_tr | out_easy_tr])
        hard_auc = roc_auc_exact(out_hard_tr[in_band_tr | out_hard_tr], exp_np[in_band_tr | out_hard_tr])

        ro = fit_monotone_readout(exp_np, y_tr)
        cal_tr, bdist_tr = apply_readout(exp_np, first_np, clear_np, clock_np, ro)
        cal_band_auc = roc_auc_exact(in_band_tr[sep_tr], -bdist_tr[sep_tr])
        out_disc_90 = ro["trainOutDiscardAt90"]

        mae_raw = float(np.mean(np.abs(exp_np - y_tr)))
        cap_frac = float(np.mean(exp_np >= 19.8))
        cap_pen = -0.35 * max(0.0, cap_frac - 0.30)

        # Jointly optimize rank correlation (overall + builder), easy/hard vs band separation, and 90%-bar discard
        obj = (
            0.30 * rho_all
            + 0.25 * rho_knobs
            + 0.15 * easy_auc
            + 0.15 * hard_auc
            + 0.15 * out_disc_90
            - 0.010 * mae_raw
            + cap_pen
        )
        return float(obj), {
            "obj": float(obj),
            "rhoAll": rho_all,
            "rhoKnobs": rho_knobs,
            "rhoTd": rho_td,
            "easyAuc": easy_auc,
            "hardAuc": hard_auc,
            "bandAuc": cal_band_auc,
            "outDisc90": out_disc_90,
            "maeRaw": mae_raw,
            "meanRaw": float(np.mean(exp_np)),
            "capFrac": cap_frac,
            "kernelMs": k_ms,
            "exp": exp_np,
            "first": first_np,
            "clear": clear_np,
            "clock": clock_np,
        }

    rng = np.random.default_rng(20261107)
    candidates = np.vstack([
        params_to_array(SEED_ANCHOR)[None, :],
        sample_lhs_params(rng, args.samples),
    ])

    t_cal0 = time.perf_counter()
    stage1_records = []
    total_kernel_ms = 0.0

    for i in range(len(candidates)):
        obj, info = eval_train_objective(candidates[i], campaigns=48, seed=4711)
        total_kernel_ms += info["kernelMs"]
        stage1_records.append((
            obj,
            i,
            info["rhoAll"],
            info["rhoKnobs"],
            info["hardAuc"],
            info["outDisc90"],
            info["meanRaw"],
        ))
        if (i + 1) % 90 == 0 or i == 0:
            best_so_far = max(stage1_records, key=lambda x: x[0])
            print(
                f"[Stage 1 {i+1}/{len(candidates)}] best obj={best_so_far[0]:.4f} "
                f"(rhoAll={best_so_far[2]:.4f}, rhoKnobs={best_so_far[3]:.4f}, "
                f"hardAUC={best_so_far[4]:.4f}, outDisc90={best_so_far[5]:.4f}, meanExp={best_so_far[6]:.2f})"
            )

    stage1_records.sort(key=lambda x: x[0], reverse=True)
    top_indices = [rec[1] for rec in stage1_records[:6]]

    best_p = None
    best_info = None
    best_obj = -1e9
    for idx in top_indices:
        p = candidates[idx].copy()
        obj, info = eval_train_objective(p, campaigns=96, seed=9001)
        total_kernel_ms += info["kernelMs"]
        if obj > best_obj:
            best_obj = obj
            best_p = p
            best_info = info

    scales = np.array([PARAM_BOUNDS[k][1] - PARAM_BOUNDS[k][0] for k in PARAM_NAMES], dtype=np.float32)
    lows = np.array([PARAM_BOUNDS[k][0] for k in PARAM_NAMES], dtype=np.float32)
    highs = np.array([PARAM_BOUNDS[k][1] for k in PARAM_NAMES], dtype=np.float32)

    for step in range(args.refine_steps):
        frac = 0.16 * (1.0 - 0.75 * (step / max(1, args.refine_steps)))
        trial = best_p.copy()
        n_dims = int(rng.integers(1, 4))
        dims = rng.choice(len(PARAM_NAMES), size=n_dims, replace=False)
        trial[dims] = np.clip(trial[dims] + rng.normal(0.0, frac, size=n_dims) * scales[dims], lows[dims], highs[dims])
        obj, info = eval_train_objective(trial, campaigns=96, seed=9001)
        total_kernel_ms += info["kernelMs"]
        if obj > best_obj:
            best_obj = obj
            best_p = trial
            best_info = info
            print(
                f"[Stage 2 step {step+1}/{args.refine_steps}] IMPROVED obj={best_obj:.4f} "
                f"(rhoAll={info['rhoAll']:.4f}, rhoKnobs={info['rhoKnobs']:.4f}, "
                f"hardAUC={info['hardAuc']:.4f}, outDisc90={info['outDisc90']:.4f}, meanExp={info['meanRaw']:.2f})"
            )

    cal_wall_sec = time.perf_counter() - t_cal0

    # Fit strictly-monotone readout on 75% train split ONLY
    _, train_final = eval_train_objective(best_p, campaigns=128, seed=1337)
    readout = fit_monotone_readout(train_final["exp"], y_tr)
    train_scores, train_band_dist = apply_readout(
        train_final["exp"],
        train_final["first"],
        train_final["clear"],
        train_final["clock"],
        readout,
    )

    best_params_dict = {name: round(float(best_p[i]), 5) for i, name in enumerate(PARAM_NAMES)}
    saved_cfg = {
        "params": best_params_dict,
        "readout": readout,
        "defaultCampaigns": 64,
        "maxTries": 20,
    }
    cfg_path = Path(__file__).with_name("calibrated_params.json")
    cfg_path.write_text(json.dumps(saved_cfg, indent=2) + "\n", encoding="utf-8")

    # Single untouched evaluation on the 25% HELD-OUT TEST SPLIT
    d_exp64, d_first64, d_clear64, d_clock64, test_k64_ms = engine.evaluate_device_boards(
        d_test, n_te, best_p, campaigns=64, max_tries=20, seed=4711
    )
    exp_te64 = d_exp64.get()
    first_te64 = d_first64.get()
    clear_te64 = d_clear64.get()
    clock_te64 = d_clock64.get()
    scores_te64, band_dist_te64 = apply_readout(exp_te64, first_te64, clear_te64, clock_te64, readout)

    raw_band_dist_te64 = np.abs(exp_te64 - 11.5)
    raw_tau90_tr = float(np.quantile(np.abs(train_final["exp"][in_band_tr] - 11.5), 0.90))

    y_te = family_all[test_idx]
    sk_mask_te = skilled_mask_all[test_idx]
    sk_y_te = skilled_all[test_idx]
    src_te = sources[test_idx]
    knobs_te = src_te == "knobs-v1"
    td_te = src_te == "training-data"

    n_bench = min(200, n_te)
    d_bench = cp.asarray(np.ascontiguousarray(all_u8[:n_bench]).reshape(-1))
    engine.evaluate_device_boards(d_bench, n_bench, best_p, campaigns=64, max_tries=20, seed=4711)
    bench_kms = []
    for r in range(5):
        _, _, _, _, kms = engine.evaluate_device_boards(d_bench, n_bench, best_p, campaigns=64, max_tries=20, seed=4711 + r)
        bench_kms.append(kms)
    median_200_kernel_ms = float(np.median(bench_kms))

    report = {
        "device": engine.device_name,
        "smCount": engine.sm_count,
        "dataset": meta_doc["summary"],
        "calibration": {
            "stage1Samples": len(candidates),
            "stage2RefineSteps": args.refine_steps,
            "totalEvaluationsOnTrain": len(candidates) + 6 + args.refine_steps + 1,
            "calibrationWallSec": round(cal_wall_sec, 2),
            "totalGpuKernelSec": round(total_kernel_ms / 1000.0, 2),
            "trainMeanRawExpTries": round(train_final["meanRaw"], 3),
            "trainCapFracAt19_8": round(train_final["capFrac"], 4),
            "bestParams": best_params_dict,
            "readout": readout,
        },
        "throughput200Candidates64Campaigns": {
            "numBoards": n_bench,
            "campaignsPerBoard": 64,
            "medianKernelMs": round(median_200_kernel_ms, 3),
            "kernelMsPerBoard": round(median_200_kernel_ms / n_bench, 4),
            "cpuPackMsPerBoard": meta_doc["summary"]["packMsPerBoard"],
            "totalEndToEndMsPerBoard": round(meta_doc["summary"]["packMsPerBoard"] + median_200_kernel_ms / n_bench, 4),
        },
        "trainSplitMetrics_128c": compute_split_metrics(
            train_scores,
            train_band_dist,
            y_tr,
            skilled_mask_all[train_idx],
            skilled_all[train_idx],
            readout["tau90Train"],
        ),
        "heldOutTestMetrics_64c": {
            "overall": compute_split_metrics(
                scores_te64, band_dist_te64, y_te, sk_mask_te, sk_y_te, readout["tau90Train"]
            ),
            "rawExpectedTriesUnscaled": compute_split_metrics(
                exp_te64, raw_band_dist_te64, y_te, sk_mask_te, sk_y_te, raw_tau90_tr
            ),
            "trainingDataSubset": compute_split_metrics(
                scores_te64[td_te],
                band_dist_te64[td_te],
                y_te[td_te],
                sk_mask_te[td_te],
                sk_y_te[td_te],
                readout["tau90Train"],
            ),
            "knobsV1BuilderSubset": compute_split_metrics(
                scores_te64[knobs_te],
                band_dist_te64[knobs_te],
                y_te[knobs_te],
                sk_mask_te[knobs_te],
                sk_y_te[knobs_te],
                readout["tau90Train"],
            ),
            "kernelMsForAllTestBoards": round(test_k64_ms, 3),
        },
    }

    out_te = (y_te <= 6.0) | (y_te >= 18.0)
    tau90_te = report["heldOutTestMetrics_64c"]["overall"]["barCheckAt90PercentInBandKeep"]["exact90Threshold"]
    false_pos = []
    for k_local in np.flatnonzero(out_te & (band_dist_te64 <= tau90_te)):
        b_meta = boards[int(test_idx[k_local])]
        false_pos.append({
            "id": b_meta["id"],
            "source": b_meta["source"],
            "subkind": b_meta["subkind"],
            "familyExp": b_meta["familyExp"],
            "proxyScore": round(float(scores_te64[k_local]), 2),
            "rawExpTries": round(float(exp_te64[k_local]), 2),
            "clockShortestK": b_meta["clockShortestK"],
            "clockN": b_meta["clockN"],
            "numKeys": b_meta["numKeys"],
            "keysVis0": b_meta["keysVis0"],
        })
    report["heldOutDiagnostics"] = {
        "clearlyOutKeptAt90BarCount": len(false_pos),
        "clearlyOutEasyKeptCount": sum(1 for x in false_pos if x["familyExp"] <= 6.0),
        "clearlyOutHardKeptCount": sum(1 for x in false_pos if x["familyExp"] >= 18.0),
        "sampleClearlyOutFalsePositives": false_pos[:12],
    }

    print(json.dumps(report["heldOutTestMetrics_64c"]["overall"], indent=2))
    print("Builder subset (knobs-v1 held-out):")
    print(json.dumps(report["heldOutTestMetrics_64c"]["knobsV1BuilderSubset"], indent=2))

    if args.out_json:
        out_p = Path(args.out_json).resolve()
        out_p.parent.mkdir(parents=True, exist_ok=True)
        out_p.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(f"Saved calibration report to {out_p}")


if __name__ == "__main__":
    main()
