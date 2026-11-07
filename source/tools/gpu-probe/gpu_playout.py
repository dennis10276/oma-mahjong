#!/usr/bin/env python3
"""
GPU playout driver for Oma's Mahjong (Task G1).
Drives raw CUDA C++ kernels (`kernels.cu`) via CuPy NVRTC on NVIDIA RTX 3070.
Supports:
  - `thread` mode (1 CUDA thread per game)
  - `warp` mode   (1 CUDA warp = 32 lanes per game with __ballot_sync & work-stealing)
  - `trace` mode  (exports full move sequences per game for E.step verification)
  - `replay` mode (steps fixed move sequences and exports snapshots for E.step verification)
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

t_process_start = time.perf_counter()

import warnings
warnings.filterwarnings("ignore", message="CUDA path could not be detected.*")

import numpy as np
import cupy as cp

MAX_TILES = 128
WORDS = 4

PACKED_BOARD_DTYPE = np.dtype([
    ("n", "<i4"),
    ("clockI", "<i4"),
    ("clockN", "<i4"),
    ("hasLocks", "<i4"),
    ("aboveMask", "<u4", (MAX_TILES * WORDS,)),
    ("leftMask", "<u4", (MAX_TILES * WORDS,)),
    ("rightMask", "<u4", (MAX_TILES * WORDS,)),
    ("iceMask", "<u4", (MAX_TILES * WORDS,)),
    ("downMask", "<u4", (WORDS,)),
    ("lockMask", "<u4", (WORDS,)),
    ("keyMask", "<u4", (WORDS,)),
    ("initAlive", "<u4", (WORDS,)),
    ("iceH", "u1", (MAX_TILES,)),
    ("faces", "u1", (MAX_TILES,)),
], align=False)

assert PACKED_BOARD_DTYPE.itemsize == 8528, f"Unexpected PackedBoard size: {PACKED_BOARD_DTYPE.itemsize}"


def _adj_to_masks(adj_bool: np.ndarray, n: int) -> np.ndarray:
    """Converts an (n, n) boolean adjacency matrix into (MAX_TILES * WORDS,) uint32 bitmasks."""
    out = np.zeros((MAX_TILES, WORDS), dtype=np.uint32)
    padded = np.zeros((n, MAX_TILES), dtype=np.uint8)
    padded[:, :n] = adj_bool.astype(np.uint8)
    # Pack 32 bits per word in little-endian bit order
    reshaped = padded.reshape(n, WORDS, 32)
    shifts = np.arange(32, dtype=np.uint32)
    out[:n, :] = np.sum(reshaped.astype(np.uint32) << shifts[None, None, :], axis=2, dtype=np.uint32)
    return out.reshape(-1)


def _indices_to_mask4(indices, n: int) -> np.ndarray:
    m = np.zeros(WORDS, dtype=np.uint32)
    for idx in indices:
        i = int(idx)
        if 0 <= i < n:
            m[i >> 5] |= np.uint32(1 << (i & 31))
    return m


def pack_board(design: dict) -> np.ndarray:
    """Packs a board design dict into a single-element PACKED_BOARD_DTYPE numpy array (8528 bytes)."""
    tiles = design["tiles"]
    n = len(tiles)
    if n <= 0 or n > MAX_TILES:
        raise ValueError(f"pack_board: n={n} out of range 1..{MAX_TILES}")

    if isinstance(tiles[0], dict):
        coords = np.array([[t["x"], t["y"], t["z"]] for t in tiles], dtype=np.int32)
    else:
        coords = np.asarray(tiles, dtype=np.int32)

    xs = coords[:, 0]
    ys = coords[:, 1]
    zs = coords[:, 2]

    dx = np.abs(xs[:, None] - xs[None, :])
    dy = np.abs(ys[:, None] - ys[None, :])
    dz = np.abs(zs[:, None] - zs[None, :])
    not_self = ~np.eye(n, dtype=bool)

    above_adj = not_self & (dy < 2) & (zs[None, :] > zs[:, None]) & (dx < 2)
    same_row = not_self & (dy < 2) & (zs[None, :] == zs[:, None])
    left_adj = same_row & (xs[None, :] == xs[:, None] - 2)
    right_adj = same_row & (xs[None, :] == xs[:, None] + 2)

    ice_same_z = (dz == 0) & (dx <= 2) & (dy <= 2) & ((dx < 2) | (dy < 2))
    ice_adj_z = (dz == 1) & (dx < 2) & (dy < 2)
    ice_adj = not_self & (ice_same_z | ice_adj_z)

    buf = np.zeros(1, dtype=PACKED_BOARD_DTYPE)
    rec = buf[0]
    rec["n"] = n

    clock = design.get("clock")
    if clock and isinstance(clock.get("i"), int) and 0 <= clock["i"] < n:
        rec["clockI"] = int(clock["i"])
        rec["clockN"] = int(clock["n"])
    else:
        rec["clockI"] = -1
        rec["clockN"] = 0

    obst = design.get("obst") or {}
    keys = obst.get("keys") or []
    locks = obst.get("locks") or []
    has_locks = 1 if (len(keys) > 0 and len(locks) > 0) else 0
    rec["hasLocks"] = has_locks

    rec["aboveMask"] = _adj_to_masks(above_adj, n)
    rec["leftMask"] = _adj_to_masks(left_adj, n)
    rec["rightMask"] = _adj_to_masks(right_adj, n)
    rec["iceMask"] = _adj_to_masks(ice_adj, n)

    rec["downMask"] = _indices_to_mask4(design.get("down") or [], n)
    if has_locks:
        rec["lockMask"] = _indices_to_mask4(locks, n)
        rec["keyMask"] = _indices_to_mask4(keys, n)

    rec["initAlive"] = _indices_to_mask4(range(n), n)

    ice_dict = obst.get("ice") or {}
    for k_str, h_val in ice_dict.items():
        idx = int(k_str)
        if 0 <= idx < n and int(h_val) > 0:
            rec["iceH"][idx] = int(h_val)

    faces_arr = np.asarray(design["faces"], dtype=np.uint8)
    rec["faces"][:n] = faces_arr

    return buf


class GpuPlayoutEngine:
    def __init__(self):
        t0 = time.perf_counter()
        kernel_path = Path(__file__).with_name("kernels.cu")
        src = kernel_path.read_text(encoding="utf-8")
        self.module = cp.RawModule(code=src, options=("--std=c++17",))
        self.k_thread = self.module.get_function("playout_thread_kernel")
        self.k_warp = self.module.get_function("playout_warp_kernel")
        self.k_trace = self.module.get_function("trace_games_kernel")
        self.k_replay = self.module.get_function("replay_fixed_kernel")
        # Force compilation & device context initialization now
        props = cp.cuda.runtime.getDeviceProperties(0)
        self.sm_count = int(props["multiProcessorCount"])
        self.device_name = props["name"].decode("utf-8")
        # Preallocate small reusable device counters
        self.d_board = cp.empty(PACKED_BOARD_DTYPE.itemsize, dtype=cp.uint8)
        self.d_wins = cp.zeros(1, dtype=cp.uint32)
        self.d_moves = cp.zeros(1, dtype=cp.uint64)
        self.d_next = cp.zeros(1, dtype=cp.uint32)
        cp.cuda.Stream.null.synchronize()
        self.init_ms = (time.perf_counter() - t0) * 1000.0

    def run_playouts(self, design: dict, num_games: int, base_seed: int = 42, mode: str = "warp") -> dict:
        t_total_start = time.perf_counter()

        # 1. Host pack + H2D copy
        t_pack_start = time.perf_counter()
        h_board = pack_board(design).view(np.uint8)
        t_pack_end = time.perf_counter()

        self.d_board.set(h_board)
        self.d_wins.fill(0)
        self.d_moves.fill(0)

        ev_start = cp.cuda.Event()
        ev_end = cp.cuda.Event()

        block_size = 256
        if mode == "thread":
            max_blocks = self.sm_count * 5
            grid_size = min(max_blocks, (num_games + block_size - 1) // block_size)
            grid_size = max(1, grid_size)
            ev_start.record()
            self.k_thread(
                (grid_size,),
                (block_size,),
                (self.d_board, np.uint32(num_games), np.uint32(base_seed), self.d_wins, self.d_moves),
            )
            ev_end.record()
        elif mode == "warp":
            self.d_next.fill(0)
            warps_per_block = block_size // 32  # 8 warps per block
            needed_blocks = (num_games + warps_per_block - 1) // warps_per_block
            # 5 blocks/SM * 46 SMs = 230 persistent blocks (1,840 concurrent warps = 58,880 threads)
            max_blocks = self.sm_count * 5
            grid_size = max(1, min(max_blocks, needed_blocks))
            ev_start.record()
            self.k_warp(
                (grid_size,),
                (block_size,),
                (self.d_board, np.uint32(num_games), np.uint32(base_seed), self.d_next, self.d_wins, self.d_moves),
            )
            ev_end.record()
        else:
            raise ValueError(f"Unknown mode: {mode}")

        # Synchronize and copy results D2H
        wins = int(self.d_wins.get()[0])
        total_moves = int(self.d_moves.get()[0])
        ev_end.synchronize()

        total_ms = (time.perf_counter() - t_total_start) * 1000.0
        pack_ms = (t_pack_end - t_pack_start) * 1000.0
        kernel_ms = float(cp.cuda.get_elapsed_time(ev_start, ev_end))
        copy_and_launch_ms = max(0.0, total_ms - pack_ms - kernel_ms)

        return {
            "mode": mode,
            "wins": wins,
            "numGames": num_games,
            "winRate": wins / num_games,
            "totalMoves": total_moves,
            "avgMoves": total_moves / num_games,
            "packMs": pack_ms,
            "copyAndLaunchMs": copy_and_launch_ms,
            "kernelMs": kernel_ms,
            "totalWarmMs": total_ms,
            "warmGamesPerSec": (num_games / total_ms) * 1000.0,
            "kernelGamesPerSec": (num_games / kernel_ms) * 1000.0 if kernel_ms > 0 else 0.0,
        }

    def trace_games(self, design: dict, num_games: int, base_seed: int = 42) -> list:
        h_board = pack_board(design).view(np.uint8)
        self.d_board.set(h_board)
        d_traces = cp.full((num_games, MAX_TILES), -1, dtype=cp.int32)
        d_lens = cp.zeros(num_games, dtype=cp.int32)
        d_outcomes = cp.zeros(num_games, dtype=cp.int32)
        block_size = 128
        grid_size = (num_games + block_size - 1) // block_size
        self.k_trace(
            (grid_size,),
            (block_size,),
            (self.d_board, np.uint32(num_games), np.uint32(base_seed), d_traces, d_lens, d_outcomes),
        )
        cp.cuda.Stream.null.synchronize()
        h_traces = d_traces.get()
        h_lens = d_lens.get()
        h_outcomes = d_outcomes.get()
        results = []
        for gid in range(num_games):
            ln = int(h_lens[gid])
            codes = [int(x) for x in h_traces[gid, :ln]]
            results.append({"gid": gid, "win": int(h_outcomes[gid]), "codes": codes})
        return results

    def replay_fixed(self, design: dict, action_codes: list) -> list:
        h_board = pack_board(design).view(np.uint8)
        self.d_board.set(h_board)
        num_steps = len(action_codes)
        h_acts = np.asarray(action_codes, dtype=np.int32)
        d_acts = cp.asarray(h_acts) if num_steps > 0 else cp.zeros(1, dtype=cp.int32)
        d_snaps = cp.zeros((num_steps + 1, 14), dtype=cp.uint32)
        self.k_replay((1,), (1,), (self.d_board, d_acts, np.int32(num_steps), d_snaps))
        cp.cuda.Stream.null.synchronize()
        snaps = d_snaps.get()
        out = []
        for s in range(num_steps + 1):
            row = [int(x) for x in snaps[s]]
            out.append({
                "status": row[0],
                "moves": row[1],
                "trayLen": row[2],
                "clockAlive": row[3],
                "alive": row[4:8],
                "trayMask": row[8:10],
                "takeable": row[10:14],
            })
        return out


def main():
    parser = argparse.ArgumentParser(description="GPU Mahjong Playout Probe")
    parser.add_argument("--cmd", choices=["run", "verify", "bench"], default="run")
    parser.add_argument("--input-json", type=str, help="Path to JSON input payload or JSONL file")
    parser.add_argument("--board-idx", type=int, default=0)
    parser.add_argument("--games", type=int, default=10000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--mode", choices=["warp", "thread", "both"], default="warp")
    args = parser.parse_args()

    eng = GpuPlayoutEngine()
    cold_startup_ms = (time.perf_counter() - t_process_start) * 1000.0

    if args.cmd == "run":
        lines = Path(args.input_json).read_text(encoding="utf-8").strip().splitlines()
        obj = json.loads(lines[args.board_idx])
        design = obj.get("design", obj)
        modes = ["thread", "warp"] if args.mode == "both" else [args.mode]
        results = {}
        for m in modes:
            r = eng.run_playouts(design, args.games, args.seed, mode=m)
            r["coldProcessTotalMs"] = cold_startup_ms + r["totalWarmMs"]
            r["coldGamesPerSec"] = (args.games / r["coldProcessTotalMs"]) * 1000.0
            results[m] = r
        print(json.dumps({
            "device": eng.device_name,
            "smCount": eng.sm_count,
            "coldStartupMs": cold_startup_ms,
            "engineInitMs": eng.init_ms,
            "results": results,
        }, indent=2))

    elif args.cmd == "verify":
        payload = json.loads(Path(args.input_json).read_text(encoding="utf-8"))
        out = {"device": eng.device_name, "fixedReplays": [], "traceChecks": [], "winRateChecks": []}

        for item in payload.get("fixedReplays", []):
            snaps = eng.replay_fixed(item["design"], item["codes"])
            out["fixedReplays"].append({"name": item["name"], "snapshots": snaps})

        for item in payload.get("traceChecks", []):
            traces = eng.trace_games(item["design"], item["numGames"], item["seed"])
            r_thread = eng.run_playouts(item["design"], item["numGames"], item["seed"], mode="thread")
            r_warp = eng.run_playouts(item["design"], item["numGames"], item["seed"], mode="warp")
            out["traceChecks"].append({
                "name": item["name"],
                "traces": traces,
                "thread": r_thread,
                "warp": r_warp,
            })

        for item in payload.get("winRateChecks", []):
            r_thread = eng.run_playouts(item["design"], item["numGames"], item["seed"], mode="thread")
            r_warp = eng.run_playouts(item["design"], item["numGames"], item["seed"], mode="warp")
            r_indep = eng.run_playouts(item["design"], item["numGames"], item["indepSeed"], mode="warp")
            out["winRateChecks"].append({
                "name": item["name"],
                "thread": r_thread,
                "warp": r_warp,
                "indepWarp": r_indep,
            })

        print(json.dumps(out))

    elif args.cmd == "bench":
        payload = json.loads(Path(args.input_json).read_text(encoding="utf-8"))
        repeats = payload.get("repeats", 5)
        bench_out = {
            "device": eng.device_name,
            "smCount": eng.sm_count,
            "coldStartupMs": cold_startup_ms,
            "engineInitMs": eng.init_ms,
            "runs": [],
        }
        # Warm up both kernels once so JIT/caches are warm for steady-state measurements
        if payload["cases"]:
            w_design = payload["cases"][0]["design"]
            eng.run_playouts(w_design, 1000, 1, mode="thread")
            eng.run_playouts(w_design, 1000, 1, mode="warp")

        for case in payload["cases"]:
            design = case["design"]
            for num_games in case["counts"]:
                for mode in ["warp", "thread"]:
                    trials = []
                    for rep in range(repeats):
                        r = eng.run_playouts(design, num_games, 42 + rep * 1000, mode=mode)
                        trials.append(r)
                    warm_times = sorted(x["totalWarmMs"] for x in trials)
                    kern_times = sorted(x["kernelMs"] for x in trials)
                    pack_times = sorted(x["packMs"] for x in trials)
                    copy_times = sorted(x["copyAndLaunchMs"] for x in trials)
                    med_idx = len(trials) // 2
                    med_warm_ms = warm_times[med_idx]
                    med_kern_ms = kern_times[med_idx]
                    med_cold_total_ms = cold_startup_ms + med_warm_ms
                    bench_out["runs"].append({
                        "label": case["label"],
                        "id": case["id"],
                        "tiles": len(design["tiles"]),
                        "numGames": num_games,
                        "mode": mode,
                        "wins": trials[0]["wins"],
                        "winRate": trials[0]["winRate"],
                        "avgMoves": trials[0]["avgMoves"],
                        "medianPackMs": pack_times[med_idx],
                        "medianCopyAndLaunchMs": copy_times[med_idx],
                        "medianKernelMs": med_kern_ms,
                        "medianWarmTotalMs": med_warm_ms,
                        "coldTotalMs": med_cold_total_ms,
                        "warmGamesPerSec": (num_games / med_warm_ms) * 1000.0,
                        "coldGamesPerSec": (num_games / med_cold_total_ms) * 1000.0,
                        "kernelGamesPerSec": (num_games / med_kern_ms) * 1000.0,
                    })
        print(json.dumps(bench_out, indent=2))


if __name__ == "__main__":
    main()
