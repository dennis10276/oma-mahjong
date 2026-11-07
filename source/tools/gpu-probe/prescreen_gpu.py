#!/usr/bin/env python3
"""
GPU batch proxy rater for Oma's Mahjong Level Builder (Task G2 Part B).

Supports:
  1. Direct Python API (`GpuPrescreenEngine`) for high-throughput GPU calibration on
     device-resident board arrays (`evaluate_device_boards`).
  2. Persistent JSON-lines stdio worker (`python prescreen_gpu.py --server`) invoked
     by `proxyRate(designs)` in `source/tools/gpu-probe/proxy_rate.js`.
"""

import argparse
import base64
import json
import sys
import time
import warnings
from pathlib import Path

warnings.filterwarnings("ignore", message="CUDA path could not be detected.*")

import numpy as np
import cupy as cp

MAX_TILES = 128
WORDS = 4
MAX_ROUTE_KEYS = 4
SCREEN_BOARD_BYTES = 8944

PACKED_SCREEN_BOARD_DTYPE = np.dtype([
    ("n", "<i4"),
    ("clockI", "<i4"),
    ("clockN", "<i4"),
    ("hasLocks", "<i4"),
    ("routeLen", "<i4"),
    ("clockShortestK", "<i4"),
    ("numKeys", "<i4"),
    ("keyIdxPacked", "<i4"),
    ("aboveMask", "<u4", (MAX_TILES * WORDS,)),
    ("leftMask", "<u4", (MAX_TILES * WORDS,)),
    ("rightMask", "<u4", (MAX_TILES * WORDS,)),
    ("iceMask", "<u4", (MAX_TILES * WORDS,)),
    ("downMask", "<u4", (WORDS,)),
    ("lockMask", "<u4", (WORDS,)),
    ("keyMask", "<u4", (WORDS,)),
    ("initAlive", "<u4", (WORDS,)),
    ("routeMask", "<u4", (WORDS,)),
    ("toClockMask", "<u4", (WORDS,)),
    ("initRoleVisMask", "<u4", (WORDS,)),
    ("initExposedMask", "<u4", (WORDS,)),
    ("clockConeMask", "<u4", (WORDS,)),
    ("keyConeMask", "<u4", (MAX_ROUTE_KEYS * WORDS,)),
    ("iceH", "u1", (MAX_TILES,)),
    ("faces", "u1", (MAX_TILES,)),
    ("routeOrder", "u1", (MAX_TILES,)),
    ("openScore", "u1", (MAX_TILES,)),
], align=False)

assert PACKED_SCREEN_BOARD_DTYPE.itemsize == SCREEN_BOARD_BYTES, (
    f"Expected {SCREEN_BOARD_BYTES} bytes, got {PACKED_SCREEN_BOARD_DTYPE.itemsize}"
)

PARAM_NAMES = [
    "w_match",
    "key_retention",
    "w_route",
    "w_route_order",
    "w_to_clock",
    "w_hidden_route",
    "w_urgency",
    "w_pair",
    "w_out",
    "w_open",
    "w_peek",
    "w_peek_patience",
    "w_lookahead_dead",
    "w_lookahead_risky",
    "temperature",
    "retention",
]

DEFAULT_PARAMS_DICT = {
    "w_match": 34.0,
    "key_retention": 0.08,
    "w_route": 24.0,
    "w_route_order": 0.30,
    "w_to_clock": 4.0,
    "w_hidden_route": 0.06,
    "w_urgency": 6.0,
    "w_pair": 14.0,
    "w_out": 12.0,
    "w_open": 3.5,
    "w_peek": 10.0,
    "w_peek_patience": 2.5,
    "w_lookahead_dead": 22.0,
    "w_lookahead_risky": 8.0,
    "temperature": 1.8,
    "retention": 0.65,
}


def load_calibrated_config() -> dict:
    cfg_path = Path(__file__).with_name("calibrated_params.json")
    if cfg_path.exists():
        try:
            cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
            if set(cfg.get("params", {}).keys()) == set(PARAM_NAMES):
                return cfg
        except Exception:
            pass
    return {
        "params": dict(DEFAULT_PARAMS_DICT),
        "readout": {
            "xp": [1.0, 20.0],
            "yp": [1.0, 20.0],
            "bandCenter": 11.5,
        },
        "defaultCampaigns": 64,
        "maxTries": 20,
    }


def params_to_array(params_in=None, fallback_dict=None) -> np.ndarray:
    base = dict(fallback_dict or DEFAULT_PARAMS_DICT)
    if isinstance(params_in, dict):
        base.update(params_in)
        arr = np.array([float(base[k]) for k in PARAM_NAMES], dtype=np.float32)
    elif params_in is not None:
        arr = np.asarray(params_in, dtype=np.float32)
        if arr.shape != (len(PARAM_NAMES),):
            raise ValueError(f"Expected {len(PARAM_NAMES)} params, got {arr.shape}")
    else:
        arr = np.array([float(base[k]) for k in PARAM_NAMES], dtype=np.float32)
    return arr


def apply_readout(
    exp_tries: np.ndarray,
    first_rate: np.ndarray,
    clear_rate: np.ndarray,
    clock_loss_rate: np.ndarray,
    readout: dict,
) -> tuple[np.ndarray, np.ndarray]:
    if "xp" in readout and "yp" in readout:
        xp = np.asarray(readout["xp"], dtype=np.float64)
        yp = np.asarray(readout["yp"], dtype=np.float64)
        raw = np.interp(exp_tries.astype(np.float64), xp, yp)
    else:
        raw = exp_tries.astype(np.float64)
    scores = np.clip(raw, 1.0, 20.0).astype(np.float32)
    band_center = float(readout.get("bandCenter", 11.5))
    band_dist = np.abs(scores - band_center).astype(np.float32)
    return scores, band_dist


class GpuPrescreenEngine:
    def __init__(self):
        t0 = time.perf_counter()
        kernel_path = Path(__file__).with_name("prescreen_kernels.cu")
        src = kernel_path.read_text(encoding="utf-8")
        self.module = cp.RawModule(code=src, options=("--std=c++17",))
        self.kernel = self.module.get_function("prescreen_batch_kernel")
        props = cp.cuda.runtime.getDeviceProperties(0)
        self.device_name = props["name"].decode("utf-8")
        self.sm_count = int(props["multiProcessorCount"])
        self.config = load_calibrated_config()
        self.d_params = cp.zeros(len(PARAM_NAMES), dtype=cp.float32)
        cp.cuda.Stream.null.synchronize()
        self.init_ms = (time.perf_counter() - t0) * 1000.0

    @staticmethod
    def _block_size_for(campaigns: int) -> int:
        if campaigns <= 32:
            return 32
        if campaigns <= 64:
            return 64
        if campaigns <= 128:
            return 128
        if campaigns <= 256:
            return 256
        raise ValueError(f"campaignsPerBoard={campaigns} exceeds max 256")

    def evaluate_device_boards(
        self,
        d_boards_u8: cp.ndarray,
        num_boards: int,
        params_arr: np.ndarray,
        campaigns: int = 64,
        max_tries: int = 20,
        seed: int = 4711,
        out_buffers: tuple | None = None,
    ) -> tuple[cp.ndarray, cp.ndarray, cp.ndarray, cp.ndarray, float]:
        if num_boards <= 0:
            empty = cp.zeros(0, dtype=cp.float32)
            return empty, empty, empty, empty, 0.0

        self.d_params.set(np.asarray(params_arr, dtype=np.float32))
        if out_buffers is None:
            d_exp = cp.empty(num_boards, dtype=cp.float32)
            d_first = cp.empty(num_boards, dtype=cp.float32)
            d_clear = cp.empty(num_boards, dtype=cp.float32)
            d_clock = cp.empty(num_boards, dtype=cp.float32)
        else:
            d_exp, d_first, d_clear, d_clock = out_buffers

        block_size = self._block_size_for(campaigns)
        ev_start = cp.cuda.Event()
        ev_end = cp.cuda.Event()
        ev_start.record()
        self.kernel(
            (num_boards,),
            (block_size,),
            (
                d_boards_u8,
                self.d_params,
                np.uint32(num_boards),
                np.uint32(campaigns),
                np.uint32(max_tries),
                np.uint32(seed),
                d_exp,
                d_first,
                d_clear,
                d_clock,
            ),
        )
        ev_end.record()
        ev_end.synchronize()
        kernel_ms = float(cp.cuda.get_elapsed_time(ev_start, ev_end))
        return d_exp, d_first, d_clear, d_clock, kernel_ms

    def evaluate_packed_bytes(
        self,
        raw_bytes: bytes | np.ndarray,
        num_boards: int,
        params=None,
        campaigns: int | None = None,
        max_tries: int | None = None,
        seed: int = 4711,
    ) -> dict:
        t0 = time.perf_counter()
        if num_boards == 0:
            return {
                "scores": [],
                "bandDistance": [],
                "expectedTries": [],
                "firstTryRate": [],
                "clearRate": [],
                "clockLossRate": [],
                "kernelMs": 0.0,
                "totalGpuMs": 0.0,
            }

        expected_len = num_boards * SCREEN_BOARD_BYTES
        h_u8 = np.frombuffer(raw_bytes, dtype=np.uint8)
        if h_u8.size != expected_len:
            raise ValueError(f"Expected {expected_len} bytes for {num_boards} boards, got {h_u8.size}")

        camps = int(campaigns or self.config.get("defaultCampaigns", 64))
        tries = int(max_tries or self.config.get("maxTries", 20))
        p_arr = params_to_array(params, self.config.get("params"))

        d_boards = cp.asarray(h_u8)
        d_exp, d_first, d_clear, d_clock, kernel_ms = self.evaluate_device_boards(
            d_boards, num_boards, p_arr, campaigns=camps, max_tries=tries, seed=seed
        )
        exp_np = d_exp.get()
        first_np = d_first.get()
        clear_np = d_clear.get()
        clock_np = d_clock.get()

        readout = self.config.get("readout", {})
        scores_np, band_dist_np = apply_readout(exp_np, first_np, clear_np, clock_np, readout)
        total_ms = (time.perf_counter() - t0) * 1000.0

        return {
            "scores": [round(float(x), 4) for x in scores_np],
            "bandDistance": [round(float(x), 4) for x in band_dist_np],
            "expectedTries": [round(float(x), 4) for x in exp_np],
            "firstTryRate": [round(float(x), 4) for x in first_np],
            "clearRate": [round(float(x), 4) for x in clear_np],
            "clockLossRate": [round(float(x), 4) for x in clock_np],
            "kernelMs": round(kernel_ms, 3),
            "totalGpuMs": round(total_ms, 3),
        }


def run_stdio_server():
    engine = GpuPrescreenEngine()
    ready_msg = {
        "ready": True,
        "device": engine.device_name,
        "smCount": engine.sm_count,
        "initMs": round(engine.init_ms, 2),
    }
    sys.stdout.write(json.dumps(ready_msg) + "\n")
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            cmd = req.get("cmd", "rate")
            if cmd == "shutdown":
                sys.stdout.write(json.dumps({"id": req_id, "ok": True}) + "\n")
                sys.stdout.flush()
                break
            if cmd == "reload":
                engine.config = load_calibrated_config()
                sys.stdout.write(json.dumps({"id": req_id, "ok": True}) + "\n")
                sys.stdout.flush()
                continue

            num_boards = int(req["numBoards"])
            if "binPath" in req and req["binPath"]:
                raw_bytes = Path(req["binPath"]).read_bytes()
            else:
                raw_bytes = base64.b64decode(req["boardsB64"])

            res = engine.evaluate_packed_bytes(
                raw_bytes=raw_bytes,
                num_boards=num_boards,
                params=req.get("params"),
                campaigns=req.get("campaigns"),
                max_tries=req.get("maxTries"),
                seed=int(req.get("seed", 4711)),
            )
            res["id"] = req_id
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()
        except Exception as exc:
            err_msg = {"id": req_id, "error": str(exc)}
            sys.stdout.write(json.dumps(err_msg) + "\n")
            sys.stdout.flush()


def main():
    parser = argparse.ArgumentParser(description="GPU Batch Proxy Prescreen")
    parser.add_argument("--server", action="store_true", help="Run persistent JSON-lines stdio server")
    parser.add_argument("--smoke", action="store_true", help="Compile kernel and print device info")
    args = parser.parse_args()

    if args.server:
        run_stdio_server()
    else:
        engine = GpuPrescreenEngine()
        print(json.dumps({
            "device": engine.device_name,
            "smCount": engine.sm_count,
            "initMs": round(engine.init_ms, 2),
        }, indent=2))


if __name__ == "__main__":
    main()
