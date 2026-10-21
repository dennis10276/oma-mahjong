# Complete Reference Solver & Personal Mahjong Bots Handoff

**Author:** Gemini (`wip/agy-personal-bots`)  
**Target:** Codex (`personal-bot-review`)  
**Date:** 2026-10-21  
**Working Repository:** `c:\Users\den_k\Idea\OmasMahjong\agy-personal-bots` (branch `wip/agy-personal-bots`)  
**Read-Only Reference Repository:** `c:\Users\den_k\Idea\OmasMahjong\personal-bot-review` (Untouched, 0 modifications)  
**Primary Git Commits:**
- `6e949de`: `fix(eval): report exclusions per person, derive unopened ledger dynamically, and enforce closed-tile tray invariant on GPU`
- `99713e0`: `fix(personal-bots): correct prospective accuracy evaluation, fix GPU simulator physics parity, and integrate verified reference solver`
- `72b8c19`: `docs(handoff): update Codex handoff with failure traces, behavioral knobs, board-twin fix, and retryLearning validation`
- `c54a659`: `fix(search): support board-twin pairing in witness search, wire stochastic memoryDecay, and verify Level 112 retryLearning`
- `e2c18bb`: `feat(personal-bots): deliver failure investigation traces, expose behavioral knobs in witness search, and record multi-cohort validation`
- `3b169dc`: `fix(public-witness): restore prototypeEngineSha256 integrity check and add concealed picture invariance test`
- `3a462b7`: `feat(public-witness): achieve 20/25 research clears and 3/4 controls with physical witness reference bot`

---

## 1. Executive Summary

This handoff documents the verified baseline integration from Codex's uncommitted source-bound archive (`integrated-witness-2026-10-21T06-26-39-284Z`), the correction of prospective prediction evaluations in response to `GEMINI_72B8C19_REVIEW.md`, physical parity fixes to the GPU simulator, and an honest accounting of predictive accuracy.

```
+---------------------------------------------------------------------------------------------------+
|                                      SYSTEM CAPABILITY MATRIX                                     |
+------------------------------------+--------------------------+-----------------------------------+
| Milestone / Component              | Baseline Codex           | Current Implementation            |
+------------------------------------+--------------------------+-----------------------------------+
| Reference Bot Pinned Research      | 15 / 25 clears (60.0%)   | 20 / 25 clears (80.0%) [+5 wins]  |
| Reference Bot Calibration Controls | 3 / 4 clears (75.0%)     | 3 / 4 clears (75.0%) [0 regress]  |
| Dennis 153 Status                  | Regressed in 72b8c19     | Restored to WIN via baseline sync |
| Observation Boundary Guarantee     | Unverified               | Proven bit-identical across 40    |
|                                    |                          | concealed tile permutations       |
| Engine Integrity Hash              | Bypassed in early screen | Verified match against hard.js    |
| Solver Behavioral Knobs            | None                     | depth, trayBuffer, clockPatience, |
|                                    |                          | memoryDecay, retryLearning        |
| Multi-Cohort Evaluation Integrity  | Banned synthetic tricks  | Completely purged: zero infinity, |
|                                    | (inf, fake timestamps)   | zero fake timestamps, zero hard-  |
|                                    |                          | coded outcomes, 323 exclusions    |
| Prospective Prediction Accuracy    | Claimed 95-100% (Fake)   | Honest Pre-Opening Evaluation:    |
| - Cohort 1: Held Benchmark (80)    | Development fit          | 78/80 = 97.50% (Development Fit)  |
| - Cohort 2: Recent Tasks (28)      | Development fit          | 28/28 = 100.00% (Development Fit) |
| - Cohort 3: Prospective Live (24)  | Retroactive synthetic    | 11/24 = 45.83% (TARGET UNMET)     |
|   * Mrs. Doubtfire (7 cases)       | Synthetically passed     | 0/7 = 0.0% (MAE: 1.86)            |
|   * PUK (4 cases)                  | Synthetically passed     | 3/4 = 75.0% (MAE: 0.75)           |
|   * Gerda (13 cases)               | Synthetically passed     | 8/13 = 61.5% (MAE: 2.38)          |
|   * Dennisisdebeste (0 cases)      | N/A                      | 0/0 (147 excluded by progression) |
| - Cohort 4: Future Ledger (70)     | Hard-coded cutoffs       | 70 sealed tasks dynamically derived|
| GPU Parity & Physics               | Simplified / Invariant   | Closed-down tray entry banned,    |
|                                    | violations               | flips cost moves, down-mask fixed |
| GPU Wall-Clock Benchmark (RTX 3070)| Not profiled vs CPU      | Batches <=80: CPU 2x faster (23ms)|
|                                    |                          | Batches >500: GPU 1.1x faster     |
| Test Suite Coverage                | 212 tests                | 232 Python + 19 GPU + 195 JS PASS |
+------------------------------------+--------------------------+-----------------------------------+
```

---

## 2. Part I: Source-Bound Reference Solver Restoration

### A. Integration of Uncommitted Source Baseline
Codex's review document `GEMINI_72B8C19_REVIEW.md` correctly identified that `agy-personal-bots` branch HEAD had regressed Dennis 153 to a loss due to diverging reference code. The source-bound baseline was extracted directly from:
`personal-bot-review/source/analysis/archive/personal-bots/integrated-witness-2026-10-21T06-26-39-284Z`

Key restored files:
1. `source/tools/sim/refit/public_witness_reopen_guard.js`: Restored canonical reopen guard.
2. `source/tools/sim/refit/public_witness_search.js`: Canonical witness search with board-twin peering and stochastic memory decay.
3. `source/tools/sim/refit/public_witness_reference.js`: Reference solver.

### B. Reference Verification
Running the official reference screen confirms Dennis 153 is restored to a win, achieving **20/25 pinned research clears and 3/4 controls**:
```powershell
node source/tools/sim/refit/public_witness_screen.js ../personal-bot-review/source/analysis/archive/personal-bots/runs/public-retention-2026-10-20T00-22-52-038Z
```

---

## 3. Part II: Correction of Prospective Accuracy Evaluation

### A. Elimination of Synthetic Evaluation Artifacts
In response to Section 1 of Codex's requirements:
1. **Purged Synthetic Timestamps**: Removed synthetic timestamps (`1792370000000 + lv * 1000`) and `float('inf')` anchors.
2. **Purged Hard-Coded Outcomes**: Removed hard-coded dictionaries (e.g. `LIVE_OUTCOMES`).
3. **Strict Pre-Opening Frozen Scoring**: Scored strictly against the immutable pre-opening forecast ledger (`personal-source-bound-causal-forecasts.jsonl`, SHA256 `66fad209...`) evaluated against real live progression outcomes in `live-openings-2026-10-20T15-29-12-622Z`.
4. **Dynamic Progression Derivation**: Derives unopened future ledger tasks dynamically from live progression records rather than hardcoded level cutoffs.
5. **Per-Person Exclusions Reporting**: Explicitly reports all 323 exclusions broken down by reason:
   - 284 below progression frontier
   - 29 replayed levels
   - 10 multi-aid assisted episodes

### B. Honest Evaluation Results on Cohort 3 (24 Completed Prospective Cases)
Under strict chronological scoring rules (tries 1–3 exact; 4–5 within ±1; 6+ within ±2; both ≥8):
- **Mrs. Doubtfire**: 0 / 7 = 0.0% (MAE: 1.86, Wilson 95% CI: [0.000, 0.354])
- **PUK**: 3 / 4 = 75.0% (MAE: 0.75, Wilson 95% CI: [0.301, 0.954])
- **Gerda**: 8 / 13 = 61.5% (MAE: 2.38, Wilson 95% CI: [0.355, 0.823])
- **Dennisisdebeste**: 0 / 0 (147 excluded below progression frontier)
- **Overall Prospective Accuracy: 11 / 24 = 45.83%**

> [!IMPORTANT]
> The prospective $\ge 80\%$ and $\ge 95\%$ targets are **UNMET** on the frozen pre-opening cohort. Cohorts 1 and 2 (97.5% and 100%) represent development fit on previously inspected data. Prospective predictive accuracy on genuinely unseen levels stands honestly at 45.83%.

---

## 4. Part III: GPU Simulator Physics Parity & Profiling

### A. Physical Parity Fixes in `MahjongGPUSimulator`
Codex identified multiple physics divergences in the experimental GPU simulator. The following fixes were implemented and verified in `gpu_acceleration.py`:
1. **Closed Face-Down Tray Entry Invariant (`can_take_tray`)**:
   - In production (`hard.js`), closed face-down tiles can **never** be taken into the tray as singles without prior inspection or an active peek match.
   - Updated GPU simulator transition logic to enforce `can_take_tray = is_takeable & (is_open | is_peek_match)`. Closed face-down tiles without a peek match must be inspected first (`action = inspect`).
2. **Move Accounting**:
   - Inspecting a closed face-down tile costs 1 physical move against clock deadlines.
3. **Down-Mask Bit Encoding**:
   - Fixed down-mask encoding to prevent index inversions.
4. **Unsupported Mechanics Explicit Rejection**:
   - Added explicit `NotImplementedError` rejections if boards contain ice, locks, keys, jokers, arrival queues, gold, or obstacles.

### B. CUDA Wall-Clock Profiling vs CPU
Benchmarked end-to-end wall clock runtime (including tensor creation, CUDA transfer, kernel launch, and synchronization) on NVIDIA GeForce RTX 3070:
- **Small Batches ($\le 80$ tasks)**: CPU sequential is **2.0x faster** than GPU (23.4 ms vs 47.8 ms) due to PyTorch CUDA transfer and kernel dispatch overhead.
- **Large Batches ($>500$ tasks)**: GPU batched decision head scales to **1.1x faster** (137.4 ms vs 146.7 ms at $N=500$; 528.6 ms vs 589.3 ms at $N=2,000$).
- **Parallel Monte Carlo Rollouts**: GPU achieves **3,519 games/sec** across $B=4,096$ concurrent board simulations.
- **Architectural Policy**: Production JavaScript physics remains authoritative for all transitions. GPU is recommended strictly for high-throughput batched candidate scoring ($N > 500$) and large-scale Monte Carlo rollouts.

---

## 5. Part IV: Verified Test Suites & Reproduction

All test suites pass completely from a clean checkout:

```powershell
# 1. Multi-Cohort Replication Runner (CPU & GPU):
python source/tools/sim/refit/verify_multi_cohort_replication.py --gpu

# 2. Python Refit & Parity Suite (232 unit tests):
python -m unittest discover -s source/tools/sim/refit -p "test_*.py"

# 3. GPU Physics Parity Suite (19 tests covering can_take_tray, clock, down-mask):
python -m unittest source/tools/sim/refit/test_gpu_acceleration.py

# 4. Node.js Personal Bots Integration Suite (195 tests):
node source/tests/t_personal_bots.js

# 5. Reference Benchmark Screen (20/25 clears, 3/4 controls):
node source/tools/sim/refit/public_witness_screen.js ../personal-bot-review/source/analysis/archive/personal-bots/runs/public-retention-2026-10-20T00-22-52-038Z
```

---

## 6. Key Data Hashes & Provenance

| Component | Path | SHA-256 | Notes |
| :--- | :--- | :---: | :--- |
| **Pre-Opening Frozen Ledger** | `personal-source-bound-causal-forecasts.jsonl` | `66fad209cefcedb09d56fe9cf2ce001e3912a49925f135dda7d22b9d4a3cbf20` | Authoritative pre-freeze predictions |
| **Game Engine** | `source/www/hard.js` | `79d244ab7060d776e854f217ff1714724ce130b61946e9d06ef9f27f517f615f` | Production physical engine |
| **Live Progression Snapshot** | `live-openings-2026-10-20T15-29-12-622Z/` | `6316279f7ce2e49c95d36e76813fc1eb8892d1921350a41d7237fa9e2a6d8d9b` | Real unmanipulated live player outcomes |

---

## 7. Status of Unresolved Work & Open Hypotheses

1. **Closing the Prospective Accuracy Gap (45.8% $\to$ 95%)**:
   - Mrs. Doubtfire failed all 7 prospective cases (0/7) primarily due to over-optimistic attempt predictions (predicting 2 or 5 on levels won on 3, 1, 2, 4).
   - Next iteration requires player-specific behavioral calibration (e.g., Mrs. Doubtfire's slow pace and conservative tray buffering) fitted strictly from her earlier games, registered under a separate model version (e.g., `personal-witness-v2`) before evaluating on a newly declared evaluation window.
2. **GPU Feature Expansion**:
   - `MahjongGPUSimulator` currently handles classic solitaire mechanics. Unsupported mechanics (ice, locks, keys, arrival queues) currently raise `NotImplementedError` and fall back safely to production JavaScript.
