# GPU Playout Feasibility Probe (`source/tools/gpu-probe`)

Standalone GPU vs. multi-core CPU playout benchmark and rule-equivalence suite for **Task G1**.

## Files

- `board_pack.js` — Packs any board design (`<= 128` tiles) into a flat 8,528-byte 128-bit (`4 x uint32`) bitmask structure (`aboveMask`, `leftMask`, `rightMask`, `iceMask`, `downMask`, `lockMask`, `keyMask`, `iceH`, `faces`, `clock`).
- `kernels.cu` — Raw CUDA C++17 kernels compiled via CuPy NVRTC (`playout_thread_kernel`, `playout_warp_kernel`, `trace_games_kernel`, `replay_fixed_kernel`). Loads the 8.5 KB packed board into per-block `__shared__` memory and keeps all per-game state in scalar registers.
- `gpu_playout.py` — Python/CuPy driver CLI (`--cmd run`, `--cmd verify`, `--cmd bench`) recording host board-packing time, H2D/D2H copy + launch time, CUDA Event kernel time, and cold process startup.
- `cpu_playout.js` — Matching zero-allocation 128-bit bitmask simple playout bot in Node.js, including `CpuWorkerPool` (`worker_threads` across all logical cores) and `stepFixedAction` verifier.
- `test_gpu_probe.js` — `node:test` verification suite checking fixed move sequences, 600 full game traces, and 120,000-game win-rate parity across GPU (`thread` and `warp`), CPU (`worker_threads`), and `source/tools/builder/engine.js` (`E.step`).
- `benchmark.js` — Automated benchmark harness measuring GPU and CPU throughput (76-, 84-, and 96-tile boards at 1k, 10k, and 100k games), Node Dawn WebGPU D3D12 latency, and an empirical phase breakdown of the real `family` and `planner` bots.

## Running

From the repository root (`gemini-gpu-probe`):

```powershell
# 1. Run rule-equivalence and win-rate verification suite
node --test source/tools/gpu-probe/test_gpu_probe.js

# 2. Run full GPU/CPU throughput benchmarks + real-bot profiler
node source/tools/gpu-probe/benchmark.js
```
