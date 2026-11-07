# Task G1 Report — Can the GPU Play Our Games Faster?

**Date:** 2026-11-06  
**Branch:** `wip/gemini-gpu-probe`  
**Code:** `source/tools/gpu-probe/`  
**Raw Measurements:** `gemini-tasks/results/gpu-probe/measurements.json`

---

## Executive Summary & Recommendation

**Short answer:**
1. **For a simple playout bot: Yes — the RTX 3070 is 17x to 43x faster than all 20 CPU threads** once 100,000 games run on a warm GPU worker (`11.6M – 68.2M games/s` including board packing and memory copies, vs. `0.48M – 2.15M games/s` across all 20 CPU threads). Even at `1,000` games, a warm GPU worker is **1.8x to 16x faster** (`0.9M – 2.2M games/s`), though spawning a cold Python process per board (`622 ms` startup) erases the gain unless the GPU worker stays open.
2. **For the real `family` and `planner` rating bots: Do NOT port them to the GPU.** Porting the real bots is **not worth the effort or calibration risk** for four concrete reasons uncovered by this probe:
   - **Too few parallel games per board:** A board rating is not thousands of independent games. Each campaign plays up to **20 sequential tries** that pass memory of lost tries from try `k` to try `k+1`. Only the **80 to 160 campaigns** per board are independent — filling **less than 0.3% of the RTX 3070** unless hundreds of boards are batched together, whereas 20 boards already saturate 100% of the 20-thread CPU with zero GPU divergence.
   - **84%–85% of the `family` bot's CPU time is NOT the bot's brain:** Profiling the real bots on Dennis's PC revealed that `controller.decide()` takes only **13.8%–14.9%** of the `family` bot's runtime (`88–180 µs/move`). The other **84%–85%** goes into CPU harness overhead in `human_style_environment.js`: string-patching `hard.js` into a generator, `structuredClone` on every tap, recomputing 2D box-splitting visibility on every tap, and `verify()` **replaying every single attempt a second time** through `Hard.play`!
   - **Heavy branching in `planner` crushes GPU efficiency:** In the skilled `planner`, `decide()` takes **62%–85%** of runtime (`0.8–4.5 ms/move`) because `routeNext` runs a **width-300 beam search** up to 33 steps deep alongside depth-4 tray look-ahead. On a GPU, 32 threads in a warp move in lockstep; when one thread enters a 300-beam search, the other 31 wait, and 300 beam states per thread (~19 KB) spill out of registers/shared memory into slow VRAM, collapsing the `25x` simple-bot advantage down to roughly **`0.5x–2x` vs. 20 CPU threads**.
   - **Zero-drift rating risk (`meter.js`):** Every published and qualified level was judged by the exact JavaScript floating-point math, Gumbel noise (`Math.log(-Math.log(u))`), and sort tie-breaks in Node. Replicating that bit-for-bit in CUDA/WGSL is brittle (`3–5 weeks` of porting + re-calibration risk).

### Recommended Next Step
**Keep the rating bots on CPU in Node, and take the "free" 3x–5x CPU speedup instead:**
1. Add a **fast measurement mode** in `human_style_environment.js` + `human_board_visibility.js` that:
   - skips the second full `Hard.play` replay (`verify()`) and per-campaign disk SHA-256 check (`verifySource()`) during bulk rating (keeping them in unit tests or a 1% audit sample);
   - steps game state directly instead of stepping a patched generator that `structuredClone`s frames on every tap;
   - precomputes each tile's potential 2D occluder neighbours once per board instead of scanning all `N` tiles on every tap.
2. Because `controller.decide()`, the RNG stream, and the visible observations remain **100% unchanged**, ratings will match today's `expectedTries` **to the exact decimal with zero re-calibration** (verified on 100 boards before adding one `FAMILY_CACHE_MIGRATIONS` entry in `meter.js`), cutting `family` rating time by **~5x** in 1–2 days of safe JS work.
3. Reserve GPU playouts (`source/tools/gpu-probe/`) only if the builder ever wants a **million-playout Monte-Carlo pre-filter** (e.g., screening thousands of candidate face deals for solvability/luck in milliseconds before calling `meter.measure`).

---

## Step 1 — What Is Inside Dennis's PC

All checks and installs were isolated inside `C:\Users\den_k\Idea\OmasMahjong\gemini-gpu-probe\source\tools\gpu-probe\` (`.venv` and local `node_modules`).

| Component | Finding on This PC | Notes for Driving the GPU |
| :--- | :--- | :--- |
| **GPU** | **NVIDIA GeForce RTX 3070** | Ampere (Compute Capability 8.6), **46 SMs**, **5,888 CUDA cores**, **8 GB GDDR6 VRAM**, 48 KB shared memory/block |
| **NVIDIA Driver** | **610.88** (WDDM) | Exposes **CUDA 13.3** user-mode driver (`nvidia-smi` works cleanly) |
| **CPU** | **Intel Core i7-12700F** | 12 physical cores (8 Performance + 4 Efficient), **20 logical threads** |
| **System Compilers** | None installed globally | Neither CUDA Toolkit (`nvcc`) nor Visual Studio C++ (`cl.exe`) is installed system-wide |
| **Python + CuPy** | **Works out of the box** | Python 3.11.15 + `cupy-cuda12x 14.2.0` + `nvidia-cuda-nvrtc-cu12 12.9.86` compiles raw CUDA C++17 kernels in memory via NVRTC without `nvcc` or `cl.exe` |
| **Python Numba / PyTorch** | Not needed | `numba.cuda` requires full toolkit/driver path configuration; PyTorch (~2.5 GB) is unnecessary when CuPy compiles raw CUDA C++ directly |
| **Node.js WebGPU** | **Works via `webgpu@0.6.2`** | Node `v24.15.0` has no built-in `navigator.gpu`, **but** npm `webgpu@0.6.2` (Google Dawn native D3D12 bindings) binds directly to the RTX 3070 (`225 ms` one-time init, `0.182 ms` buffer + compute round-trip) |

---

## Step 2 & Step 3 — Playout Kernels (GPU & Multi-Core CPU) and Verification

### How the GPU and CPU Bots Work
- **Packed 128-bit board (`board_pack.js`, 8,528 bytes):** Every board up to 128 tiles is packed into `4 x uint32` bitmasks (`aboveMask`, `leftMask`, `rightMask`, `iceMask`, `downMask`, `lockMask`, `keyMask`, `iceH`, `faces`, `clock`). On the RTX 3070, the entire 8.5 KB board sits in fast per-SM `__shared__` memory (5 thread-blocks = 1,280 threads resident per SM), and each game's live state (`alive`, `tray` 64-bit face mask, `moves`, `clockAlive`, Mulberry32 RNG) stays in registers with zero heap or global VRAM traffic during play.
- **Two GPU kernels (`kernels.cu`):**
  - **`thread` mode (`playout_thread_kernel`):** 1 CUDA thread plays 1 independent game. Best when running 10k–100k+ games so all 46 SMs are packed with independent threads.
  - **`warp` mode (`playout_warp_kernel`):** 1 CUDA warp (32 lanes) cooperates on 1 game using `__ballot_sync` to test 32 tiles in parallel per pass, pulling games dynamically via `atomicAdd` work-stealing. Best at smaller game counts (e.g. `1k` games), where 1,000 threads alone would leave most of the GPU idle.
- **Multi-core CPU bot (`cpu_playout.js`):** Identical 128-bit bitmask logic in zero-allocation JavaScript, parallelized across all **20 logical threads** with Node `worker_threads` (`CpuWorkerPool`).
- **Rules covered:** Free tiles (no tile above, left OR right free), 3-slot waiting tray (4th unmatched tile loses immediately), ice (`h` adjacent ice-neighbours gone since start), locks + keys (locks open once both keys are gone), clock (`clock.i` must be taken at move index `< clock.n`), face-down tiles (free to turn over when takeable), and **peek pairs** (a takeable face-down tile + its takeable twin leave together in 1 action of 2 moves without using a tray slot, even when 3 tiles are already waiting in the tray; clock expiry is checked after the whole action).

### Verification Against `source/tools/builder/engine.js` (`E.step`)
Run via `node --test source/tools/gpu-probe/test_gpu_probe.js` (**100% pass**):
1. **8 fixed move sequences** stepped simultaneously through `E.step`, CPU `stepFixedAction`, and GPU `replay_fixed_kernel`, verifying exact state snapshots (`moves`, `trayLen`, `clockAlive`, `alive` mask, `tray` mask, and `takeable` mask) at every step:
   - Full authored winning solutions for the 76-, 84-, and 96-tile boards from `qualified-200-225.jsonl`.
   - Peek pair taken while `tray.length === 3` (`peek_pair_at_tray_3`).
   - Peek pair saving the clock tile on the second tile of the pair (`moves = 3 -> 5` with `clock.n = 4`).
   - Immediate loss on a 4th unmatched tray tile and on an expired clock.
   - A 104-tile board exercising the 4th 32-bit mask word (`tiles 96..103`) with ice, locks, keys, clock, and peek pairs together.
2. **600 full game traces** (`trace_games_kernel` on GPU vs. `playOneGame` on CPU) replayed move-by-move through `E.step`, `E.legal`, and `E.won` — **every single move and win/loss outcome matched 100%**.
3. **Why unaltered level-200+ boards win 0.00% for the simple bot:** Every board in `qualified-200-225.jsonl` is an authored level-200+ trap board with tight clock spare (`1..3` moves) and a deliberate free `temptingPair` off the clock route at move 0. Because the simple bot *always* takes a free pair before digging (`Priority 2`), its true win rate on those unaltered trap boards is `0.000%` (confirmed identically on both CPU and GPU). To test non-trivial win-rate agreement under real sampling noise, we verified **50,000 games** on an unaltered historical 76-tile clock board plus full-depth (`clock.n = tiles.length`) versions of the 76-, 84-, and 96-tile test boards where all rules (ice, locks, keys, face-down, peek pairs) play out to completion:

| Board (50,000 games each) | Tiles | CPU Wins (Seed A) | GPU `thread` (Seed A) | GPU `warp` (Seed A) | CPU Win Rate | GPU Indep. Seed Win Rate | Diff (`\|z\|` score) |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `hist_76t_unaltered` (clock + 38 down) | 76 | 217 | 217 | 217 | 0.434% | 0.448% | 0.014% (`z = 0.33`) |
| `qual_76t_fulldepth` (ice + locks + keys + peek) | 76 | 2,439 | 2,439 | 2,439 | 4.878% | 4.850% | 0.028% (`z = 0.21`) |
| `qual_84t_fulldepth` (ice + locks + keys + peek) | 84 | 377 | 377 | 377 | 0.754% | 0.794% | 0.040% (`z = 0.72`) |
| `qual_96t_fulldepth` (ice + 38 down + peek) | 96 | 2,639 | 2,639 | 2,639 | 5.278% | 5.366% | 0.088% (`z = 0.62`) |

---

## Step 4 — Throughput: Games per Second (GPU vs. CPU)

### Fixed Start-Up and Copy Costs
- **Cold GPU Python/CuPy subprocess spawn:** `621.8 ms` median when compiled kernels are cached on disk (`1,420.8 ms` on first-ever uncached NVRTC compile). *If you spawn a fresh Python process per board, startup completely dominates `1k` and `10k` runs. Keeping a persistent GPU worker (or using in-process Node `webgpu@0.6.2` Dawn, `225 ms` init) eliminates this.*
- **Cold CPU 20-worker pool spawn:** `64.6 ms` median to start 20 Node `worker_threads`.
- **Per-board pack + copy overhead (included in all "Warm" numbers below):**
  - GPU warm call = Python `pack_board` (`0.25–0.39 ms`) + PCIe H2D/D2H copy & launch (`0.13–0.32 ms`) + CUDA kernel execution.
  - CPU warm call = JS `packBoard` (`0.05–0.09 ms`) + `worker_threads` `postMessage` dispatch & gather across all 20 logical threads.

### Table 4A — Exact Unaltered `qualified-200-225.jsonl` Test Boards
*(Tight clock traps terminate games around moves 8–16; low warp divergence.)*

| Board | Games | CPU 1-Core (games/s) | CPU 20-Threads Warm (games/s) | CPU 20-Threads Cold (games/s) | GPU Warm Best¹ (games/s) | GPU Pure Kernel (games/s) | GPU Cold Subprocess² (games/s) | **Warm GPU vs. 20-Thread CPU** |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **76 tiles** (`ebe4a48640ad0101`, avg 12.1 moves) | **1k** | 206k | 513k (`1.95 ms`) | 12.3k | **2.20M** (`0.46 ms`, warp) | 13.56M | 1.6k | **4.3x** |
| | **10k** | 212k | 947k (`10.56 ms`) | 58.0k | **13.37M** (`0.75 ms`, thread) | 40.52M | 16.1k | **14.1x** |
| | **100k** | 219k | 1.58M (`63.39 ms`) | 337k | **68.15M** (`1.47 ms`, thread) | 119.81M | 160k | **43.2x** |
| **84 tiles** (`ec63a46d1a4e6eef`, avg 7.8 moves) | **1k** | 161k | 176k (`5.70 ms`) | 12.8k | **2.09M** (`0.48 ms`, warp) | 17.76M | 1.6k | **11.9x** |
| | **10k** | 298k | 1.35M (`7.43 ms`) | 71.6k | **14.23M** (`0.70 ms`, warp) | 45.21M | 16.1k | **10.6x** |
| | **100k** | 281k | 2.15M (`46.44 ms`) | 410k | **65.43M** (`1.53 ms`, thread) | 103.01M | 160k | **30.4x** |
| **96 tiles** (`97f6bf020e56366b`, avg 16.0 moves) | **1k** | 128k | 96k (`10.46 ms`) | 12.1k | **1.55M** (`0.64 ms`, warp) | 5.58M | 1.6k | **16.3x** (`12.1x` vs 1c) |
| | **10k** | 134k | 953k (`10.49 ms`) | 76.6k | **7.93M** (`1.26 ms`, thread) | 12.83M | 16.0k | **8.3x** |
| | **100k** | 134k | 1.24M (`80.86 ms`) | 392k | **28.50M** (`3.51 ms`, thread) | 38.75M | 160k | **23.0x** |

### Table 4B — Full-Depth Variants (`clock.n = tiles.length`)
*(Games run deep into the board — avg 19 to 52 moves, ~1%–5% reaching move 76/84/96 while losing threads drop out early — exposing real GPU tail divergence.)*

| Board (Full Depth) | Games | CPU 1-Core (games/s) | CPU 20-Threads Warm (games/s) | GPU `warp` Warm (games/s) | GPU `thread` Warm (games/s) | **Warm GPU Best vs. 20-Thread CPU** |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| **76 tiles** (avg 18.9 moves, 4.7% win) | **1k** | 125k | 84k (`11.85 ms`) | **1.14M** (`0.88 ms`) | 576k (`1.74 ms`) | **13.5x** (`9.2x` vs 1c) |
| | **10k** | 133k | 598k (`16.74 ms`) | **8.04M** (`1.24 ms`) | 5.06M (`1.98 ms`) | **13.5x** |
| | **100k** | 136k | 1.26M (`79.66 ms`) | 12.40M (`8.07 ms`) | **21.02M** (`4.76 ms`) | **16.7x** |
| **84 tiles** (avg 25.2 moves, 0.8% win) | **1k** | 102k | 731k (`1.37 ms`) | **1.35M** (`0.74 ms`) | 646k (`1.55 ms`) | **1.8x** |
| | **10k** | 102k | 847k (`11.81 ms`) | **7.10M** (`1.41 ms`) | 6.02M (`1.66 ms`) | **8.4x** |
| | **100k** | 102k | 986k (`101.44 ms`) | 7.92M (`12.63 ms`) | **24.67M** (`4.05 ms`) | **25.0x** |
| **96 tiles** (avg 52.0 moves, 5.4% win) | **1k** | 47k | 305k (`3.28 ms`) | **914k** (`1.09 ms`) | 413k (`2.42 ms`) | **3.0x** |
| | **10k** | 47k | 437k (`22.87 ms`) | 3.08M (`3.24 ms`) | **4.03M** (`2.48 ms`) | **9.2x** |
| | **100k** | 47k | 481k (`207.83 ms`) | 3.82M (`26.20 ms`) | **11.57M** (`8.64 ms`) | **24.0x** |

*¹ Both `warp` and `thread` modes include host board packing + H2D/D2H transfers. Notice the architectural crossover: at `1k` games, `warp` mode is ~2x faster than `thread` mode because 1,000 warps (`32,000` threads) fill all 46 SMs; at `100k` games, `thread` mode is 1.7x–3.6x faster because all SMs are already saturated with independent games.*  
*² Cold subprocess includes `621.8 ms` Python + CuPy cached startup (`1,420.8 ms` uncached).*

---

## Step 5 — Estimating the Real Family & Skilled Planner Bots

To avoid guessing, we profiled the **actual production `family` and `planner` bots** (`human_style_environment.js` + `human_factory_controller.js`) on Dennis's PC across the same 76-, 84-, and 96-tile boards (`measurements.json` -> `realBotProfile`):

### 1. Where the Real Bots Spend Time Today (Measured on Single CPU Core)

| Board | Bot Mode | ms / Campaign | Avg Tries / Campaign | Total µs / Move | `decide()` Only (µs / Move) | **`decide()` Share** | **Controller Memory Share** | **Environment + `verify()` + Visibility Share** |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **76t** | **`family`** | 235.9 ms | 6.25 | 1,243 µs | **180 µs** | **14.5%** | 0.8% | **84.5%** |
| **84t** | **`family`** | 258.6 ms | 8.50 | 589 µs | **88 µs** | **14.9%** | 1.0% | **83.9%** |
| **96t** | **`family`** | 275.3 ms | 11.25 | 1,085 µs | **149 µs** | **13.8%** | 0.6% | **85.4%** |
| **76t** | **`planner` (route)** | 501.5 ms | 3.25 | 1,882 µs | **1,233 µs** | **65.5%** | 1.1% | 33.3% |
| **84t** | **`planner` (route)** | 440.8 ms | 2.50 | 1,293 µs | **806 µs** | **62.4%** | 1.1% | 36.4% |
| **96t** | **`planner` (route)** | 635.1 ms | 5.00 | 3,212 µs | **2,410 µs** | **75.0%** | 0.6% | 24.3% |
| **96t** | **`planner` (plain)** | 1,053.3 ms | 5.00 | 5,360 µs | **4,543 µs** | **84.8%** | 0.4% | 14.8% |

**Surprise #1 (`family` bot):** Roughly **85% of the `family` bot's wall time is NOT `human_factory_controller.js`!** Inside `human_style_environment.js`:
- `production_physical_session.js` string-patches `physics/hard.js` into an ES generator and runs `structuredClone` on state frames on every single tap;
- `observeBoard` (`human_board_visibility.js`) runs dynamic 2D rectangle-splitting occlusion geometry across the board on every tap;
- Line 66 (`verify(...)`) **replays the entire attempt a second time** through `Hard.play` and `assert.deepEqual`s logs and traces, plus SHA-256 hashes `hard.js` from disk at the end of every campaign!

### 2. What Would Have to Move to the GPU — and What Cannot

| Subsystem | Can It Move to GPU? | What Moving It Entails & Why It Hurts GPU Speed |
| :--- | :--- | :--- |
| **20-try Campaign Loop & Imperfect Memory** (`human_style_measure.js`, `memory` map, `retryRetention=0.65`, `clockLosses`, `failedDigs`, `retryAccessMemory` 128-bit witnesses, `retryKeyIdentityMemory`) | **Must move inside the kernel**, **cannot parallelize tries** | Try `k+1` depends on whether try `k` won and what hidden faces/keys/failed digs were seen. Tries *must* run sequentially per thread/warp. Thus 1 board only exposes **80–160 parallel campaigns** (`2 x 2 x 20` or `2 x 2 x 40`), starving a 5,888-core GPU (**< 0.3% occupancy** for a single board!). |
| **2D Partial-Face Visibility** (`human_board_visibility.js` `tileVisibility`) | **Yes, with rewrite** | Splits tile `[-1, 1] x [-1, 1]` boxes into sub-rectangles cut by higher layers (`z' > z`) to check `visibleFraction >= 1/6`. Static potential occluders per tile can be precomputed, or approximated via an `8 x 8` 64-bit sub-pixel coverage mask per tile! *(Wait: any approximation changes edge cases -> rating drift; exact float box-splitting requires per-thread scratch arrays.)* |
| **Cone / Side-Chain / Escape Look-Ahead** (`attract`, `sideChain`, `computeTrayHorizon` depth 2–4, `canRelieve`, `suggestsNoEasyEscape`) | **Yes, with explicit stacks** | Recursive DFS and top-6 sorted branch-and-bound (`trayDepth = 2` for `family`, `4` for `planner`). Requires fixed-size explicit DFS stacks (~1–2 KB/game) in local/VRAM memory and stalls sibling threads in a warp whenever only some threads trigger deep look-ahead. |
| **Clock Route Beam Search** (`routeNext`: `routeBeam = 48` or `300`, up to ~33 steps) | **Hardest bottleneck** | `planner` expands `300` states x ~15 legal actions = up to `4,500` candidate states per step, deduplicating via state keys (`alive` + `tray`) and sorting top 300. `300` states x ~64 B = **~19 KB per game** — far too large for registers or 48 KB shared memory per block, forcing global VRAM reads/writes and hash tables! |
| **Session Generator + Double-Replay `verify()` + `meter.js` Disk Cache / `critique`** | **Cannot / Should not move** | String-patching `hard.js`, `assert.deepEqual` audit logs, SHA-256 source-tree hashing, and JSON file caching stay on the Node host. |

### 3. How Much Speed Is Left Once Real Branching & Campaign Limits Hit?
Let's trace the realistic math from our `24x` full-depth simple-bot GPU speedup vs. 20 CPU threads:
1. **Single-board rating (80–160 campaigns):** `160` threads uses at most 1–5 warps out of 46 SMs. A single board on GPU will be **slower (`0.1x–0.4x`)** than running 20 CPU worker threads across candidate boards. **A GPU port only makes sense if the builder batches 50–200+ candidate boards into one mega-launch (`8,000–32,000` concurrent campaigns).**
2. **Even with 100-board batching:**
   - **Warp divergence across sequential campaigns:** One campaign clears on try 1 (40 moves); another thread in the same warp fails 20 times (`20 x 35 = 700` moves) — a **5x–10x tail penalty** unless campaigns are broken up and re-queued between tries on host/device.
   - **Branch & memory spills inside `decide()`:** On `family`, once CPU harness waste (85%) is removed, a clean CPU already runs `family` ~**5.5x faster** than today (`~3.3s` single-core or **`~0.25s/board` throughput across 20 CPU threads**!). Against that cleaned-up 20-thread CPU, a batched GPU `family` kernel with DFS stacks and warp divergence would retain only **~2x–4x** net speedup.
   - On **`planner`**, the width-300 beam search spills to global VRAM (`~19 KB` state buffer per active thread/warp) and diverges heavily across moves, leaving only **~0.5x–2x** vs. 20 out-of-order CPU threads with large L2/L3 caches.

### 4. Porting Effort & Zero-Drift Re-Calibration Cost
- **Porting effort:** Translating ~1,400 lines of tightly coupled JavaScript (`human_factory_controller.js` + `human_board_visibility.js` + `public_retry_access_memory.js` + `public_key_identity_memory.js` + `public_clock_mate_budget.js` + `public_matched_picture.js`) into stackless, fixed-buffer CUDA C++ or Dawn WGSL — plus batching orchestration in `knob_rebuild.js` / `batch_evaluate.js` — is roughly **2.5 to 4 weeks** of intricate systems work.
- **Calibration / rating-drift trap:** `meter.js` computes a SHA-256 `sourceHash` over the bot's JS dependency tree and invalidates all cached ratings whenever anything changes. Even tiny IEEE-754 differences in `Math.log(-Math.log(u))` Gumbel noise or sort order when two candidate moves tie on score will cause a chaotic trajectory split on move 5, changing whether try 1 wins or loses, shifting `expectedTries`, and **forcing a full re-calibration and re-verification across live levels 85–225 and Dennis/Gerda recordings (+1–2 weeks)**.

---

## Step 6 — Clear Recommendation & Concrete Next Step

**Verdict: Not worth porting the rating bots (`family` / `planner`) to the GPU.**

Instead, execute this **high-return, zero-drift CPU optimization** as the next step:

1. **Fast-path `human_style_environment.js` on the CPU (1–2 days of work, ~5x `family` speedup, ZERO rating drift):**
   - Keep `human_factory_controller.js` (`decide()`, `observe()`, RNG, profiles) **100% untouched** so every move choice and every rating (`expectedTries`, `firstTryRate`) stays bit-for-bit identical to today.
   - Replace the per-tap patched generator + `structuredClone` session (`production_physical_session.js`) and the unconditional second replay (`verify()`) with a direct in-place physics stepper during `meter.measure` runs (retaining `verify()` in tests or a 1% random audit check).
   - Precompute static per-tile upper-layer candidate occluders once per `campaign()` in `human_board_visibility.js` instead of scanning all `N` tiles on every tap.
   - Prove 100.00% identical outputs across 100 boards + `test_factory.js`, then register the hash pair in `FAMILY_CACHE_MIGRATIONS` in `meter.js` so existing cached ratings remain valid too!
2. **Keep `source/tools/gpu-probe/` as an optional high-speed builder pre-screen:**
   - Whenever the level builder itself wants to test 10,000+ random playouts on candidate face deals in `1–3 ms` before invoking `meter.measure`, the verified RTX 3070 kernel (`12M–68M games/s`) is ready on branch `wip/gemini-gpu-probe`.
