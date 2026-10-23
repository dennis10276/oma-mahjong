# Personal Player Bots: Work Done and Next Steps

**Repository**: `c:\Users\den_k\Idea\OmasMahjong\agy-personal-bots`  
**Branch**: `wip/agy-personal-bots`  
**Date**: October 23, 2026  
**Status**: Block 1 Locked & Active on Live Card · Model v10 Pipeline Ready · Multi-Tier Testing Green  

---

## 1. Goal & Evaluation Contract

The objective is to build faithful personal player simulators for **Dennisisdebeste**, **Mrs. Doubtfire**, **PUK**, and **Gerda** that predict each person's successful attempt on upcoming levels with prospective accuracy.

### The Required Pipeline
```
Earlier human actions (Firebase plays/ & replays/)
       │
       ▼
Calibrated personal playing policy & inter-attempt memory
       │
       ▼
Personal bot physically plays real board sessions (Hard.coverOf, 4-slot tray)
       │
       ▼
Multi-campaign simulations produce attempt-to-clear distribution P(try 1) ... P(try 8+)
       │
       ▼
Point prediction p ∈ {1..8} maximizing expected Voorspeltest score
       │
       ▼
Prospective lock in Firebase RTDB before player first opens level
       │
       ▼
Real human play evaluated on the live Voorspeltest card
```

### The Only Score That Counts
The official **"Voorspeltest"** card hosted at [https://dennis10276.github.io/oma-mahjong/dash/](https://dennis10276.github.io/oma-mahjong/dash/):
- **Scoring Tolerances**:
  - Exact match for 1–3 tries
  - $\pm 1$ for 4–5 tries
  - $\pm 2$ for 6–7 tries
  - Both $\ge 8$ tries
- **Validity Conditions**:
  - Locked before the player's first opening event (`Te laat: 0`).
  - Recorded from an approved, verified player device in normal session (`Niet gev: 0`).
  - Unbroken 20-level cohorts per person with no skipped levels (`Overgeslagen: 0`).
- **Milestone 1**: Beat the "Always 1 try" baseline for every player.
- **Done Target**: At least 16 out of 20 locked levels correct per person.

---

## 2. Work Done

### A. Historical Baseline & Exploratory Scoring
- Extracted and scored historical candidates (v2–v8) against the "Always 1" baseline on games already completed in `plays/`.
- Identified that earlier candidate models suffered from low accuracy on difficult boards due to two root causes:
  1. Over-predicting $p=8$ due to simulated deadlocks.
  2. Mathematical distortion in the point forecast derivation.

### B. Block 1 Prospective Locking (Model v9)
- Before any player opened their upcoming cohort, simulated and locked 80 levels across all 4 players in Firebase RTDB at `forecasts/<pid>/<level>.json`:
  - **Dennisisdebeste** (`pmuy78xu6tsths9`): Levels 158–177 (20 levels)
  - **Mrs. Doubtfire** (`pmv16kj3jr35750`): Levels 127–146 (20 levels)
  - **PUK** (`pmv2gaa0g00eq3q`): Levels 59–78 (20 levels)
  - **Gerda** (`pmv6yhzz3x9oxs8`): Levels 110–129 (20 levels)
- Confirmed on the live card: 0 late forecasts, 0 unverified devices, 0 skipped levels.

### C. Game Engine & Physics Parity
- **Production Face-Up Perception**: Aligned tile visibility in `personal_witness_simulation.js` with `Hard.coverOf` from `source/www/hard.js`. Only same-$(x, y)$ vertical towers conceal face-up tiles. Eliminating over-strict stepped concealment allowed the bot to solve Level 127 on Attempt 1 in 72 moves, matching Dennis's empirical replay.
- **Tray Buffer Threshold**: Calibrated `trayBuffer = 2` (`trayRecoveryMin = 2`), preventing the bot from postponing pair clearing until 3 tiles and eliminating a 92% tray-overflow choke rate.
- **Clock Mode Recovery Fix**: Removed a bug in `public_witness_search.js` where `(!clocked || !position.alive[game.clock.i])` had completely disabled tray recovery while the clock tile was ticking, causing false losses when trays reached 3 tiles during clock countdowns.

### D. Mathematical Point Forecast Objective Function Fix
- Discovered an optimization bug in `derivePointForecast`: standard numeric tolerance $|p - \text{actual}| \le 2$ was erroneously awarding `noClear` probability mass ($\ge 8$ attempts) to predictions $p=6$ and $p=7$.
- Corrected to strict Voorspeltest rules:
  $$\text{score} += (\text{dist.noClear} \parallel 0) \times (p \ge 8 \;?\; 1 : 0)$$
  This ensures that failure mass exclusively supports $p=8$, eliminating spurious $p=6$ and $p=7$ forecasts.

### E. Telemetry Calibration & Persona Tuning
- Corrected telemetry action parsing in `personal_behavioral_calibration.js` to credit `weightedDirectMatches` on face-down flips (`tap < 0`), restoring empirical human retry retention rates:
  - Dennis: 0.956
  - Mrs. Doubtfire: 0.872
  - PUK: 0.899
  - Gerda: 0.824
- Updated calibrated persona parameters in `source/analysis/personal-bots/personal-behavioral-fit.json`.

### F. Multi-Tier Testing Pyramid & Verification Suites
Built and verified an exhaustive automated test pyramid on `wip/agy-personal-bots`:
1. **Core Unit Suite** (`source/tests/t_personal_bots.js`): 290/290 assertions pass (100%).
2. **Multi-Tier E2E Suite** (`source/tests/t_e2e_personal_bots.js`): 82/82 tests pass across 4 tiers (engine parity, persona bounds, cross-feature interactions, and real-world cohort simulations).
3. **Tier 5 White-Box Adversarial Hardening** (`source/tests/t_tier5_adversarial_hardening.js`): 55/55 tests pass across 6 groups (G1 Engine to G6 Integration).
4. **Point Forecast Regression** (`test_derive_point_forecast.js`): 6/6 tests pass (100%).

### G. Model v10 Pipeline Architecture
- Created `source/tools/sim/refit/generate_personal_witness_v10.js` with:
  - Multi-threaded worker pool for fast campaign simulation.
  - Source closure integrity hashing (49 tracked files).
  - Explicit Block 2 frontiers: Dennis 178, Mrs. Doubtfire 147, PUK 79, Gerda 130.
  - CLI runner for direct execution.
- Built dynamic multi-threaded held-out evaluator `source/tools/sim/refit/evaluate_heldout.js`.

---

## 3. Current Live Status (October 23, 2026)

Live status from [https://dennis10276.github.io/oma-mahjong/dash/](https://dennis10276.github.io/oma-mahjong/dash/):

| Speler | Model | Reeks | Voorspelling | Altijd 1 | Bezig | Wachten | Te laat | Niet gev | Overgeslagen |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dennisisdebeste** | `v9` | 0 van 20 | – | – | 0 | 20 | 0 | 0 | 0 |
| **Gerda** | `v9` | 3 van 20 | 0 van 2 | 0 van 2 | 1 | 17 | 0 | 0 | 0 |
| **Mrs. Doubtfire** | `v9` | 0 van 20 | – | – | 0 | 20 | 0 | 0 | 0 |
| **PUK** | `v9` | 0 van 20 | – | – | 0 | 20 | 0 | 0 | 0 |

### Player Observations:
- **Gerda (`pmv6yhzz3x9oxs8`)**:
  - **Level 110**: Cleared on attempt 18 (`winAt: 18`). Both Model `v9` ($p=1$) and "Always 1" ($p=1$) scored 0.
  - **Level 111**: Cleared on attempt 12 (`winAt: 12`). Both Model `v9` ($p=6$) and "Always 1" ($p=1$) scored 0.
  - **Level 112**: Currently in-flight on attempt 4 (`Bezig: 1`). Model `v9` predicted **$p = 8$** (vs. baseline "Always 1" $p = 1$). If Gerda clears on $\ge 8$ attempts, Model `v9` scores 1 while "Always 1" scores 0.
- **Dennisisdebeste (`pmuy78xu6tsths9`)**:
  - Opened the app at 13:25 local time, re-inspected Level 110 (played 3 attempts), and returned to home.
  - Has not yet opened Level 158; all 20 Block 1 levels (158–177) remain waiting.
- **Mrs. Doubtfire (`pmv16kj3jr35750`)**:
  - Frontier is Level 126; Levels 127–146 waiting.
- **PUK (`pmv2gaa0g00eq3q`)**:
  - Frontier is Level 58; Levels 59–78 waiting.

---

## 4. Next Steps

1. **Live Card Polling & In-Flight Tracking**:
   - Continue regular polling of Firebase RTDB and the live dashboard via `check_live_card.js`.
   - Track Gerda's resolution on Level 112 (testing the $p=8$ forecast vs. $p=1$ baseline).
   - Detect when Dennis, Mrs. Doubtfire, and PUK start their Block 1 games.

2. **Block 2 Prospective Locking (Model v10)**:
   - Monitor the progress of each player as they approach the 20-level mark of Block 1:
     - Dennis: L177 $\rightarrow$ L178
     - Mrs. Doubtfire: L146 $\rightarrow$ L147
     - PUK: L78 $\rightarrow$ L79
     - Gerda: L129 $\rightarrow$ L130
   - Execute `generate_personal_witness_v10.js` to pre-generate and lock the 80 Block 2 predictions in Firebase RTDB before any player opens those levels.

3. **Behavioral Telemetry Diagnostics**:
   - For every completed level in Block 1, compare the simulated attempt distribution with the player's actual attempts and tap sequences.
   - Refine inter-attempt tie-breaking jitter and memory decay parameters where discrepancies arise, feeding improvements into future model versions.

4. **Goal Completion**:
   - Continue until the official live card confirms that at least one model version achieves at least 16 out of 20 correct predictions for **each** player.
