# GPU Playout Probe & Builder Pre-Screen (`source/tools/gpu-probe`)

GPU kernels, drivers, and Node client for **Task G1** (playout feasibility probe) and **Task G2 Part B** (batch GPU proxy pre-screen for the level builder).

## Builder Usage Note: `proxyRate(designs)` (Task G2 Part B)

`proxyRate(designs, options)` scores hundreds of candidate designs in a single CUDA launch via a persistent warm Python/CuPy worker (`.venv/Scripts/python.exe prescreen_gpu.py --server`), returning an array of calibrated difficulty scores (`1..20`, ranking like `family` `expectedTries`).

```js
const { proxyRate, closeProxyWorker } = require('../gpu-probe/proxy_rate.js');

// 1. Score a batch of candidate designs (accepts raw designs or `{ design }` records)
const scores = await proxyRate(candidates); // -> number[] (predicted family tries, 1..20)

// 2. Pre-filter candidates before full CPU meter:
//    - Safe easy-floor cut (keeps ~95% of true family 10..13 boards, discards ~57% of <= 6 easy boards):
const notTooEasy = candidates.filter((_, i) => scores.details[i].bandDistance <= 7.42); // i.e. score >= 5.17

//    - Skilled-solvability screen (ranks skilled with Spearman rho = 0.74 on held-out):
const skilledSolvable = candidates.filter((_, i) => scores.details[i].expectedTries < 19.5);

//    - Or top-K% ranking cut around 11.5 (e.g. discard 70%, pass top 30% to full CPU meter):
const top30Pct = candidates
  .map((cand, i) => ({ cand, score: scores[i], dist: Math.abs(scores.details[i].expectedTries - 11.5) }))
  .sort((a, b) => a.dist - b.dist)
  .slice(0, Math.ceil(0.30 * candidates.length));

// Note: the worker is unref'd when idle so Node exits naturally without hanging;
// call `await closeProxyWorker()` only if you want to free VRAM early.
```

### Options
- `campaigns` (default `64`, max `256`): number of 20-try sequential campaigns per board on GPU.
- `seed` (default `4711`): deterministic RNG base seed.
- `detailed` (default `false`): when `true`, returns `Array<{ score, bandDistance, expectedTries, firstTryRate, clearRate, clockLossRate }>`. When `false`, those objects are still attached at `scores.details`, and timing is at `scores.timing`.
- `routeOpts` (default `{ nodes: 15000, ms: 30 }`): CPU `engine.js` `clockShortest` budget per board when packing the precomputed clock route.

## Files

### Task G2 Part B — Batch GPU Pre-Screen
- `proxy_rate.js` — Node API (`proxyRate`, `reloadProxyConfig`, `closeProxyWorker`) managing the persistent stdio GPU worker.
- `prescreen_kernels.cu` — Batch CUDA C++17 kernel (`prescreen_batch_kernel`): 1 thread block per board (`PackedScreenBoard` in `__shared__` SRAM), 1 thread per sequential 20-try campaign with cross-try face & objective memory, `clockShortest` route preference, role/key visibility gating, pair temptation, 1-step 4th-tile look-ahead, and Gumbel-max temperature noise.
- `prescreen_gpu.py` — CuPy NVRTC driver and persistent JSON-lines `--server`.
- `calibrated_params.json` — GPU-calibrated policy parameters and readout weights fit on the 75% training split.
- `export_prescreen_dataset.js` & `calibrate_prescreen.py` — Dataset packer and GPU Latin-Hypercube + coordinate-refinement calibration pipeline.
- `test_proxy_rate.js` — `node:test` suite for `proxyRate(designs)`.

### Task G1 — Playout Feasibility Probe
- `board_pack.js` — Packs designs (`<= 128` tiles) into 128-bit (`4 x uint32`) bitmasks (`packBoard` for G1; `packScreenBatch` with `clockShortest` & initial role visibility for G2).
- `kernels.cu`, `gpu_playout.py`, `cpu_playout.js`, `benchmark.js`, `test_gpu_probe.js` — G1 single-board playout kernels, verifiers, and throughput benchmark suite.

## Running Tests

From the repository root (`gemini-gpu-probe`):

```powershell
node --test source/tools/gpu-probe/test_gpu_probe.js source/tools/gpu-probe/test_proxy_rate.js
```
