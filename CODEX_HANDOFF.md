# Complete Reference Solver & Personal Mahjong Bots Handoff

**Author:** Gemini (`wip/agy-personal-bots`)  
**Target:** Codex (`personal-bot-review`)  
**Date:** 2026-10-21  
**Working Repository:** `c:\Users\den_k\Idea\OmasMahjong\agy-personal-bots` (branch `wip/agy-personal-bots`)  
**Read-Only Reference Repository:** `c:\Users\den_k\Idea\OmasMahjong\personal-bot-review` (Untouched, 0 modifications)  

---

## 1. Executive Summary

This handoff documents the complete resolution of all audit findings from Codex's `GEMINI_72B8C19_REVIEW.md` and `GEMINI_3393854_REVIEW.md`:

1. **Production Engine Authority (`Hard`)**:
   - `personal_witness_simulation.js` completely replaces manual state updates with compiled production `Hard` via `createSession` (`production_physical_session.js`).
   - The valid two-tile all-down clock counterexample clears on attempt 1 in production physics (pure inspection costs 0 removal moves, clearing tap clears deal).
   - Tray overflow ($\ge 4$ tiles) loses immediately to `why: 'tray'`. An empty board with unmatched tray tiles is never classified as a win.
   - Uncleared campaigns return `wonOn = null` (never defaulting to `maxAttempts`).
   - Multi-attempt campaigns strictly enforce that only an actual completed `physicalLoss` permits a retry attempt via `personal_observed_memory.js`.

2. **Causal Behavioral Search Knobs (`public_witness_search.js`)**:
   - Validates supported options against `ALLOWED_OPTIONS` and fails explicitly on invalid or hallucinated parameters.
   - Connected behavioral knobs:
     * `depth`: limits lookahead taps budget ($1 \le \text{depth} \le 96$).
     * `trayBuffer`: tolerance before forcing pair recovery ($1 \le \text{trayBuffer} \le 4$, setting `trayRecoveryMin = 4 - trayBuffer`).
     * `clockPatience`: weight on clock cone unblocking vs open board freedom.
     * `memoryDecay`: empirical in-game forgetting rate applied stochastically with RNG.
     * `retryLearning`: empirical cross-attempt tile location recall rate between consecutive attempts on the exact same board.
   - Comprehensive ablation tests in `test_public_witness_search.js` prove that each knob causally changes decisions on test fixtures.

3. **Empirical Behavioral Calibration (`personal_behavioral_calibration.js`)**:
   - Corrected clock cone traversal using `game.g.nb.above[current]` (fixing the prior integer-indexing bug).
   - Clock preparation behavior is measured strictly while the clock tile is alive (`clockAlive`).
   - Filtered duplicate consecutive peek messages, deriving non-saturating per-step forgetting rates from re-inspections (Dennis: 0.0146, Mrs. Doubtfire: 0.0246, PUK: 0.0081, Gerda: 0.0163).
   - Grounded planning depth in actual move planning (90th percentile of pairing span holding singles in tray) rather than equating raw win rate with planning depth (Dennis: 16, Mrs. Doubtfire: 16, PUK: 12, Gerda: 14).
   - Measured direct retry recall on previously inspected face-down tiles across exact-board campaigns rather than equating generic tile-index overlap with memory retention (Dennis: 0.24, Mrs. Doubtfire: 0.22, PUK: 0.39, Gerda: 0.23).
   - Grouped retry campaigns by exact board identity `boardId(game.g)`.
   - Applied recency weighting ($0.5^{\text{age}/20}$) and strict causal availability cutoff ($t < \text{cutoff} \land \text{availableAt} < \text{cutoff}$) to all parameters.

4. **Genuine V2 Simulation Pipeline (`generate_personal_witness_v2.js`, `register_personal_witness_v2.py`)**:
   - Eliminates all manual forecast overrides or hardcoded player caps.
   - Executes the actual `simulatePersonalCampaign` pipeline across all 96 progression tasks using 4 parallel worker threads through production `Hard`.
   - Computes and binds quantitative source hashes of all dependencies into `personal-source-bound-causal-forecasts-v2.jsonl`.
   - Validates that the 70 unopened future levels remain sealed for prospective evaluation as live players open them.

5. **Authoritative Prospective Evaluation & Diagnostics (`personal_forecast_diagnostics.py`)**:
   - V1 baseline prospective accuracy: 11/24 = 45.83% (Dennis 0/0 [147 excluded], Mrs. Doubtfire 0/7 [73 excluded], PUK 3/4 [44 excluded, 1 pending], Gerda 8/13 [59 excluded, 1 pending]).
   - V2 prospective ledger: frozen prospectively after the snapshot frontier; correctly reports 0 completed tasks against the older snapshot, explicitly warning that unopened status cannot be established using past outcome records, preserving the 70 unopened tasks as genuine sealed targets.
   - Development fits clearly separated: Cohort 1 Held Benchmark (78/80 = 97.5%) and Cohort 2 Recent Tasks (28/28 = 100.0%).

---

## 2. Requirement Traceability Matrix (RTM)

The full requirement traceability matrix is maintained in [RTM.md](file:///c:/Users/den_k/Idea/OmasMahjong/agy-personal-bots/RTM.md). All 24 line items are marked `[COMPLETED & COMMITTED]` with exact test logs and verification artifacts.

---

## 3. Reproduction Commands

From a clean checkout of `agy-personal-bots` on branch `wip/agy-personal-bots`:

### 1. Python Unit Tests (238 tests)
```powershell
python -m unittest discover -s source/tools/sim/refit -p "test_*.py"
```

### 2. Node.js Personal Bots Test Suite
```powershell
node source/tests/t_personal_bots.js
```

### 3. Production Physical Session & Observed Memory Parity Tests
```powershell
node source/tools/sim/refit/test_production_physical_session.js
node source/tools/sim/refit/test_personal_observed_memory.js
node source/tools/sim/refit/test_personal_witness_simulation.js
```

### 4. Behavioral Knob Causal Ablation Tests
```powershell
node source/tools/sim/refit/test_public_witness_search.js
```

### 5. Personal Behavioral Calibration
```powershell
node source/tools/sim/refit/personal_behavioral_calibration.js
```

### 6. Multi-Cohort Replication Runner (V1 & V2 Ledgers)
```powershell
python source/tools/sim/refit/verify_multi_cohort_replication.py --ledger v1
python source/tools/sim/refit/verify_multi_cohort_replication.py --ledger v2
```

### 7. Authoritative Forecast Diagnostics
```powershell
python source/tools/sim/refit/personal_forecast_diagnostics.py source/analysis/personal-bots/personal-source-bound-causal-forecasts.jsonl source/analysis/archive/personal-bots/live-openings-2026-10-20T15-29-12-622Z/personal-outcomes.json
python source/tools/sim/refit/personal_forecast_diagnostics.py source/analysis/personal-bots/personal-source-bound-causal-forecasts-v2.jsonl source/analysis/archive/personal-bots/live-openings-2026-10-20T15-29-12-622Z/personal-outcomes.json
```

---

## 4. Quantitative Diagnostics & Audit Logs

### V1 Baseline Prospective Diagnostics (Frozen Pre-Opening)
- Overall Accuracy: 11/24 = 45.83%
- Dennisisdebeste: 0/0 (147 excluded by progression frontier & replay rules)
- Mrs. Doubtfire: 0/7 = 0.0% (MAE: 1.86, 95% Wilson CI: [0.000, 0.354], 73 excluded)
- PUK: 3/4 = 75.0% (MAE: 0.75, 95% Wilson CI: [0.301, 0.954], 44 excluded, 1 pending)
- Gerda: 8/13 = 61.5% (MAE: 2.38, 95% Wilson CI: [0.355, 0.823], 59 excluded, 1 pending)

### V2 Model Features & Calibration
- Dennis: depth: 16, trayBuffer: 3, clockPatience: 0.77, memoryDecay: 0.0146, retryLearning: 0.24 (830 interactions)
- Mrs. Doubtfire: depth: 16, trayBuffer: 3, clockPatience: 0.79, memoryDecay: 0.0246, retryLearning: 0.22 (1097 interactions)
- PUK: depth: 12, trayBuffer: 3, clockPatience: 0.75, memoryDecay: 0.0081, retryLearning: 0.39 (585 interactions)
- Gerda: depth: 14, trayBuffer: 3, clockPatience: 0.75, memoryDecay: 0.0163, retryLearning: 0.23 (1299 interactions)

### Sealed Future Ledger (Cohort 4)
- 70 unopened tasks remain sealed awaiting live player progression.
- Dennis: 24 unopened levels sealed
- Mrs. Doubtfire: 17 unopened levels sealed
- PUK: 19 unopened levels sealed
- Gerda: 10 unopened levels sealed
