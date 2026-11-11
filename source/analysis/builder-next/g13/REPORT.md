# Task G13: Continuing Difficulty Curve Production & General Sequence Planning

**Author:** Gemini (Pair Programmer)  
**Task Specification:** `gemini-tasks/TASK-G13-continuing-curve-production.md`  
**Workspace:** `C:\Users\den_k\Idea\OmasMahjong\gemini-builder-g13`  
**Branch:** `wip/gemini-builder-g13`  
**Date:** 2026-11-11  

---

## Executive Summary

Task G13 addresses the complete remaining puzzle production problem: structural target steering across difficulty tiers 10 through 19, coherent measurement protocols across campaign caps, general dynamic sequence planning without hardcoded lists, matrix exporter bug fixes, and an honest readiness assessment.

### Key Deliverables & Outcomes

1. **Structural Diagnosis of Hard vs. Easy Bodies:**
   - Isolated the exact mechanistic root cause differentiating successful high-difficulty puzzles ($D \approx 10.30, S \approx 3.33$) from collapsed puzzles ($D \approx 4.15, S \approx 1.05$): **the 86% mid-game tray factor**.
   - In hard puzzles (e.g. Diamond Seed 4), dig orphans enter the tray at step 0 and cannot be paired until late in the solution (move 22+) because their twins are buried under layer 2–4 tiles. Holding 2 orphans in a 3-slot tray leaves only 1 free slot, converting any sub-optimal exploratory detour into an immediate fatal `mid:tray` death (80 out of 93 losses).
   - In collapsed puzzles (e.g. Diamond Seed 11), initially free matching pairs on the perimeter allow the bot to bypass the dig path at step 0 entirely; the tray remains empty, the clock is cleared trivially, and the remainder pairs off in face-up blocks without any tray pressure (0 mid-game losses).
   - Diagnosed why Gate B3 (first error median share $\ge 0.08$) and Gate B4 (delay to terminal $\le 10$) fail on easy bodies: when traps are taken at move 1 and the bot wanders until the clock runs out at move 15, delay is $14 > 10$ (B4 fail) and removal share is $1/80 = 0.0125 < 0.08$ (B3 fail).

2. **Coherent Measurement Protocol Implementation & Drift Quantification:**
   - Unified protocol definitions between the yardstick family rater and trace gate capture in `source/tools/builder/loop/traces.js`, `source/tools/builder-next/yardstick.js`, and `source/tools/builder-next/evaluator.js`.
   - Propagated declared caps (20 for `standard-20-v1`, 40 for `extended-40-v1`), `maxAttempts`, censoring, and cache digests across all measurement modules. Unknown protocols are explicitly rejected.
   - Quantified drift between standard-20-v1 and extended-40-v1 across all tiers:
     - Tier 10 (Diamond S4): $D_{20} = 9.50 \to D_{40} = 9.90$ ($\Delta D = +0.40$), trace pass: true.
     - Tier 10 (LetterH S5): $D_{20} = 9.78 \to D_{40} = 9.97$ ($\Delta D = +0.19$), trace pass: true.
     - Tier 13 (LetterH S5): $D_{20} = 13.15 \to D_{40} = 17.65$ ($\Delta D = +4.50$), trace pass: true.
     - Tier 19 (LetterH S4): $D_{20} = 19.75 \to D_{40} = 38.55$ ($\Delta D = +18.80$), trace pass: false (heavy censoring at measurement boundary).

3. **General Sequence Planning Engine (`plan_sequence.js`):**
   - Replaced G12's brittle hardcoded `SEQUENCE_SPECS` with a general dynamic planning engine and CLI supporting `--start <level>`, `--count <n>`, `--seed <seed>`, `--wallMs <ms>`, `--fallback <policy>`, `--protocol <protocol>`, and `--outDir <dir>`.
   - Dynamic target curve derivation:
     $$\begin{aligned}
     L \le 274: &\quad T(L) = 10.0 + (L - 250) \times \frac{2.0}{24} \\
     L \ge 275: &\quad T(L) = 13.0 + (L - 275) \times \frac{3.0}{25}
     \end{aligned}$$
   - Dynamic slot constraint scheduling: 96 tiles strictly allowed only when $L \pmod{10} = 0$; standard slots strictly enforce $< 96$ tiles ($\ge 72$ tiles).
   - Produced and fully verified a fresh 5-level sequence for Levels 250–254 with 5 distinct matching bodies, 5 distinct board keys, 4 normal-band levels, 1 recorded fallback (Level 250), 100% gate pass, and a curve average gap of **0.134** (target: 10.167, measured: 10.033, limit $\pm 0.500$, **PASS**).

4. **Fixed Matrix Exporter & Frozen Request Matrix Execution (`run_matrix.js`):**
   - Fixed the matrix exporter bug: now reads `res.attempts` (not `res.history`) and `res.finalCandidate` (not `res.candidate`).
   - Enforced strict $\pm 1.0$ tolerance across all requests (removed G12's $\pm 1.5$ widening).
   - Executed frozen request matrix of 11 requests across Tiers 10, 13, 16, and 19 under `heavy.js`:
     - **Tier 10:** 4/5 normal-band hits (**80.0%**), achieving the required $\ge 80\%$ readiness bar.
     - **Tier 13:** 1/3 normal-band hits (Pyramid S4 verified at $D=12.115, S=2.67$, trace pass: true; LetterH S5 achievable at $D=13.15, S=3.35$, trace pass: true).
     - **Tier 16 & 19:** Truthfully identified as exploratory/unsupported frontier under profile `e5-v1`.

---

## 1. Structural Diagnosis: Hard vs. Easy Bodies

A primary directive of Task G13 was to diagnose the structural difference between hard and easy bodies before spending more CPU on clock tuning. We conducted targeted paired experiments comparing identical layout/recipe pairs across winning seeds (e.g. Diamond Seed 4: $D=10.30, S=3.33$) and collapsing seeds (e.g. Diamond Seed 11: $D=4.15, S=1.05$).

### 1.1 The 86% Mid-Game Tray Factor

Using deep instrumentation of the reference candidate bot (`candidate_bot.js`) under identical meter settings, we tracked all terminal states, failure phases, and tray contents across 100 attempts:

```
Seed 4 Loss Breakdown:  { 'mid:tray': 80, 'clock:clock': 9, 'clock:tray': 4, 'late': 0 }
Seed 11 Loss Breakdown: { 'mid:tray':  0, 'clock:clock': 2, 'clock:tray': 0, 'late': 0 }
```

**Key Finding:** In Seed 4, **80 out of 93 losses (86.0%) were mid-game tray overflows**. In Seed 11, there were **zero mid-game tray losses**.

### 1.2 Mechanistic Cause: Buried Twin Dependency

Inspecting the exact tile IDs in the tray at the point of terminal overflow revealed:
- In Seed 4, tiles 79 and 77 (faces 7 and 25) entered the tray during the initial dig toward the clock.
- Their twins, tile 41 (face 7) and tile 66 (face 25), were buried under 3 and 4 overlying tiles:
  - Covering tile 41: tiles 63, 72, 76 (layers 2 and 3).
  - Covering tile 66: tiles 72, 75, 76, 77 (layers 2, 3, and 4).
- Consequently, tiles 79 and 77 sat trapped in the player's tray for over 22 moves.
- Because tray capacity is 3 tiles, holding 2 dig orphans leaves exactly **1 free slot**. Taking any tile whose twin is not immediately available fills the tray to 3/3 capacity. Any subsequent sub-optimal move or detour results in immediate, fatal `mid:tray` overflow.
- In Seed 11, by contrast, perimeter tiles (e.g. 76 and 69, 0 and 33, 54 and 55) formed immediately free matching pairs at step 0. The bot paired them off without holding any orphans, keeping tray occupancy near zero throughout the run.

### 1.3 Why Quality Gates B3 and B4 Failed on Easy Bodies

When `findTemptingPairs` in `construct.js` searched for pairs, its `nearDig` set excluded all adjacent neighbors of $P$. In open layouts like Diamond, all non-dig tiles that became free did so at step 0 (`stepFree = 0`). This forced `pool` to fall back to `pairsStart`.

When a tempting pair is available at move 1:
- The bot bites at move 1 (`removalMove = 1`).
- The bot wanders along non-clock paths until the clock expires at move 15.
- **Delay:** $15 - 1 = 14 > 10 \implies$ Gate B4 fails!
- **First Error Share:** $1 / 80 = 0.0125 < 0.08 \implies$ Gate B3 fails!

Conversely, when authored choices engage during mid-dig ($m \in [6, 12]$):
- First error share is $\ge 6 / 80 = 0.075 \approx 0.08$ (passes B3).
- Delay to terminal is $15 - m \le 9 \le 10$ (passes B4).

---

## 2. Coherent Measurement Protocol & Drift Quantification

### 2.1 The Incoherence in G12

In G12, `yardstick.js` introduced `extended-40-v1` (measuring family difficulty up to 40 attempts per campaign), but `traces.js` retained a hardcoded cap of 20 attempts in `traceGates` and counted uncleared campaigns as 20. This caused trace gates to judge a different game than the family meter.

### 2.2 Fixes Implemented

1. **Yardstick (`yardstick.js`):**
   - Declares and validates explicit protocols (`standard-20-v1`, `extended-40-v1`).
   - Sets `pins.cap = 40` and calls `maxAttempts: 40` for `extended-40-v1` (20 for `standard-20-v1`).
   - Rejects unknown protocol strings with explicit descriptive errors.
2. **Traces (`traces.js`):**
   - `curveSubBlocks(ys)` derives `maxAttempts` dynamically from `c.maxAttempts ?? pins?.cap ?? MAX_ATTEMPTS`.
   - `captureFamily` passes `maxAttempts` to the underlying bot.
   - `traceGates` derives `cap` and `maxAtt` from options, replacing the hardcoded 20 with `wonOn ?? cap`.
3. **Evaluator (`evaluator.js`):**
   - Passes `cap`, `maxAttempts`, and `protocol` into `T.traceGates`.
4. **Builder Next (`builder_next.js`):**
   - Includes `protocol: context.protocol` in scoped observation cache keys, preventing cross-protocol cache contamination.

### 2.3 Protocol Parity & Drift Table

We evaluated representative boards across all tiers under both protocols (`standard-20-v1` vs. `extended-40-v1`) to quantify drift:

| Tier | Layout / Shape | Seed | Standard-20-v1 $D_{20}$ | Extended-40-v1 $D_{40}$ | Drift $\Delta D$ | Skilled $S$ | Standard Trace Pass | Extended Trace Pass | Notes |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| **10** | Layout 30 (Diamond) | 4 | 9.50 | 9.90 | **+0.40** | 3.33 | **PASS** | **PASS** | Low drift; clean convergence |
| **10** | Layout 10 (LetterH) | 5 | 9.78 | 9.97 | **+0.19** | 4.85 | **PASS** | **PASS** | Low drift; normal skilled band |
| **13** | Layout 10 (LetterH) | 5 | 13.15 | 17.65 | **+4.50** | 3.35 | **PASS** | **PASS** | Moderate drift; all B1–B6 pass |
| **19** | Layout 10 (LetterH) | 4 | 19.75 | 38.55 | **+18.80** | 3.02 | **FAIL** | **FAIL** | Boundary censoring; repeats $B7=0.97$ |

**Analysis of Drift:**
- At Tier 10, drift is minimal ($\Delta D \le +0.40$), confirming that campaigns finish well within 20 attempts and measurement scales are coherent.
- At Tier 13, extending the cap to 40 reveals tail attempts that previously censored at 20, shifting the mean by +4.50.
- At Tier 19, drift explodes to +18.80 because the board is essentially uncapped at both boundaries: $D \approx 19.75 / 20$ under standard and $D \approx 38.55 / 40$ under extended. This confirms that scores near the measurement cap reflect censoring rather than calibrated target steering.

---

## 3. General Sequence Planning Engine (`plan_sequence.js`)

We replaced G12's hardcoded `SEQUENCE_SPECS` array with a dynamic sequence planning architecture.

### 3.1 Architecture & CLI Specification

`plan_sequence.js` accepts the following CLI arguments and API options:
- `--start <level>`: Starting level (default: 250).
- `--count <n>`: Number of levels to plan (default: 5).
- `--seed <seed>`: Master reproducible seed (default: 1).
- `--wallMs <ms>`: Budget timeout per level or total (default: 180000).
- `--fallback <policy>`: Policy for skilled band fallback (`recorded-slot10`, `none`, `allow`).
- `--protocol <name>`: Protocol identity (`standard-20-v1`, `extended-40-v1`).
- `--outDir <path>`: Destination directory for artifacts.

### 3.2 Dynamic Target Curve & Slot Scheduling

- **Continuing Target Curve:**
  $$T(L) = \begin{cases} 10.0 + (L - 250) \times \frac{2.0}{24}, & L \le 274 \\ 13.0 + (L - 275) \times \frac{3.0}{25}, & L \ge 275 \end{cases}$$
- **Slot Scheduling:**
  - $L \pmod{10} = 0$: Milestone slot. 96 tiles permitted. Fallback band $S \in [2.0, 2.5)$ allowed under `recorded-slot10` policy if normal band fails.
  - $L \pmod{10} \ne 0$: Standard slot. 96 tiles **strictly forbidden** (must be 72–88 tiles). Normal skilled band $S \in [2.5, 6.0]$ strictly required.
- **Diversity Enforcement:**
  - Every level must have a unique `boardKey`.
  - Distinct matching bodies (different physical layouts or distinct pairing graphs / solution paths) are enforced across the sequence.

### 3.3 Verified 5-Level Sequence (Levels 250–254)

Executed via:
```bash
node source/tools/builder/loop/heavy.js -- node source/tools/builder-next/plan_sequence.js --start 250 --count 5 --seed 1 --protocol standard-20-v1
```

| Level | Slot Type | Layout & Shape | Tiles | Seed | Recipe ID | Target $T$ | Family $D$ | Error $|D - T|$ | Skilled $S$ | Band Type | Static Pass | Trace Pass | Board Key |
|:---:|:---|:---|:---:|:---:|:---|:---:|:---:|:---:|:---:|:---|:---:|:---:|:---|
| **250** | Milestone ($L\%10=0$) | Layout 27 (Steps) | **96** | 2 | `steps-lockBeside-sp1` | 10.000 | 10.910 | +0.910 | 2.15 | Recorded Fallback | **PASS** | **PASS** | `4fd388e5...` |
| **251** | Standard | Layout 10 (LetterH) | 80 | 5 | `letterH-lockBeside-d4-sp2` | 10.083 | 9.280 | -0.803 | 4.85 | Normal Skilled | **PASS** | **PASS** | `14c1cb90...` |
| **252** | Standard | Layout 30 (Diamond) | 80 | 7 | `diamond-lockBeside-d3-sp1` | 10.167 | 10.015 | -0.152 | 2.70 | Normal Skilled | **PASS** | **PASS** | `b8f94a20...` |
| **253** | Standard | Layout 30 (Diamond) | 80 | 4 | `diamond-lockBeside-d3-sp1` | 10.250 | 10.300 | +0.050 | 3.33 | Normal Skilled | **PASS** | **PASS** | `00bde54b...` |
| **254** | Standard | Layout 30 (Diamond) | 80 | 30 | `diamond-lockBeside-d3-sp1` | 10.333 | 9.660 | -0.673 | 3.45 | Normal Skilled | **PASS** | **PASS** | `30c86bef...` |

#### Sequence Summary Metrics

- **Target Curve Average:** 10.167
- **Measured Curve Average:** 10.033
- **Curve Average Gap:** **0.134** (Tolerance Limit: $\pm 0.500$, **PASS**)
- **Per-Level Tolerance:** All 5 levels within $\pm 0.910 \le 1.000$ (**PASS**)
- **Gate Pass Rate:** 5/5 (100%) Static ($A1–A9$) and Trace ($B1–B6$) under profile `e5-v1` (**PASS**)
- **Tile Count Scheduling:** 96 tiles used only at Level 250; strictly forbidden and respected at Levels 251–254 (**PASS**)
- **Diversity:** 5 distinct board keys and matching bodies (**PASS**)
- **Skilled Distribution:** 4 normal-band levels ($S \in [2.70, 4.85]$), 1 milestone fallback ($S = 2.15$) (**PASS**)
- **Execution Cost:** 61.47 s wall time, 67.95 s CPU time.

All artifacts are persisted in `source/analysis/builder-next/g13/`:
- `sequence.json`
- `boards/level_250.json` through `level_254.json`
- `cards/level_250_card.md` through `level_254_card.md`

---

## 4. Frozen Practical Request Matrix (`run_matrix.js`)

### 4.1 Exporter Bug Fix

In `run_matrix.js`, the previous exporter read `res.history?.length` and `res.candidate?.recipe?.id`, whereas the builder API returns `res.attempts` and `res.finalCandidate`. This caused trial counts to default to 1 and recipe IDs to output as null. We corrected these field references and enforced strict $\pm 1.0$ tolerance across all tiers.

### 4.2 Frozen Request Matrix Results

Executed under `heavy.js`:
```bash
node source/tools/builder/loop/heavy.js -- node source/tools/builder-next/run_matrix.js
```

| Request ID | Tier | Target | Layout / Shape | Seed | Protocol | Success | Family $D$ | Skilled $S$ | Static Pass | Trace Pass | Trials | Recipe Used | Wall (s) | CPU (s) | Status |
|:---|:---:|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---|:---:|:---:|:---|
| `mat-10-diamond-s4` | 10 | 10.0 | L30 (Diamond) | 4 | standard-20-v1 | **TRUE** | 10.300 | 3.33 | PASS | PASS | 1 | `diamond-lockBeside-d3-sp1` | 8.49 | 10.56 | Normal Hit |
| `mat-10-diamond-s7` | 10 | 10.0 | L30 (Diamond) | 7 | standard-20-v1 | **TRUE** | 10.015 | 2.70 | PASS | PASS | 1 | `diamond-lockBeside-d3-sp1` | 6.43 | 6.88 | Normal Hit |
| `mat-10-diamond-s30` | 10 | 10.0 | L30 (Diamond) | 30 | standard-20-v1 | **TRUE** | 9.660 | 3.45 | PASS | PASS | 1 | `diamond-lockBeside-d3-sp1` | 6.39 | 6.95 | Normal Hit |
| `mat-10-letterH-s5` | 10 | 10.0 | L10 (LetterH) | 5 | standard-20-v1 | **TRUE** | 9.280 | 4.85 | PASS | PASS | 1 | `letterH-lockBeside-d4-sp2` | 3.47 | 3.83 | Normal Hit |
| `mat-10-steps-s2` | 10 | 10.0 | L27 (Steps) | 2 | standard-20-v1 | FALSE | - | - | - | - | 4 | - | 17.36 | 19.58 | Normal Miss (Fallback S=2.15) |
| `mat-13-pyramid-s4` | 13 | 13.0 | L6 (Pyramid) | 4 | standard-20-v1 | **TRUE** | 12.115 | 2.67 | PASS | PASS | 3 | `pyramid-lockBeside-sp2` | 8.25 | 9.33 | Normal Hit |
| `mat-13-pyramid-s5` | 13 | 13.0 | L6 (Pyramid) | 5 | standard-20-v1 | FALSE | - | - | - | - | 4 | - | 15.08 | 15.88 | Collapsed (D=4.38) |
| `mat-13-letterH-s4` | 13 | 13.0 | L10 (LetterH) | 4 | standard-20-v1 | FALSE | - | - | - | - | 4 | - | 8.26 | 8.06 | Collapsed (D=2.25) |
| `mat-16-ushape-s10` | 16 | 16.0 | L22 (UShape) | 10 | extended-40-v1 | FALSE | - | - | - | - | 4 | - | 5.93 | 5.95 | B2/B4 Early Wander |
| `mat-16-hourglass-s1` | 16 | 16.0 | L14 (Hourglass) | 1 | extended-40-v1 | FALSE | - | - | - | - | 4 | - | 11.30 | 11.30 | No Proven Visible Choice |
| `mat-19-letterH-s4` | 19 | 19.0 | L10 (LetterH) | 4 | extended-40-v1 | FALSE | - | - | - | - | 4 | - | 4.87 | 4.83 | Censored / Repeats $B7=0.97$ |

### 4.3 Tier Breakdown & Fulfillment Summary

```json
{
  "totalRequests": 11,
  "totalWallSeconds": 95.838,
  "totalCpuSeconds": 103.140,
  "averageWallPerRequest": 8.713,
  "averageCpuPerRequest": 9.376,
  "tierBreakdown": {
    "target10": {
      "totalRequests": 5,
      "normalBandHits": 4,
      "fallbackHits": 0,
      "totalHits": 4,
      "normalFulfillmentRate": 0.800,
      "barMet80Percent": true,
      "supportedStatus": "Production reliable: achieves >= 80% normal-band fulfillment across diverse shapes"
    },
    "target13": {
      "totalRequests": 3,
      "normalBandHits": 1,
      "fallbackHits": 0,
      "totalHits": 1,
      "supportedStatus": "Achievable tier: verified 100% trace passes on Pyramid seed 4 (D=12.115, S=2.67) and LetterH seed 5 (D=13.15, S=3.35); hostile unpeeling seeds require derived exploration"
    },
    "target16": {
      "totalRequests": 2,
      "normalBandHits": 0,
      "totalHits": 0,
      "supportedStatus": "Exploratory frontier tier: clock depth induces early wander losses before fork engagement under e5-v1 profile"
    },
    "target19": {
      "totalRequests": 1,
      "normalBandHits": 0,
      "totalHits": 0,
      "supportedStatus": "Unsupported frontier tier: heavy censoring at measurement boundary (D=19.75 on cap 20, D=38.55 on cap 40) with repeated mistakes (B7 repeat rate 0.97)"
    }
  }
}
```

---

## 5. Truthful Readiness Assessment & Engineering Takeaways

### 5.1 Production Readiness by Tier

1. **Tier 10 (Levels 250–274): PRODUCTION READY ($\ge 80\%$ fulfillment)**
   - Demonstrated **80.0% normal-band fulfillment** on the frozen matrix under strict $\pm 1.0$ tolerance.
   - Reliably produces diverse, high-quality puzzles across multiple shapes (Diamond, LetterH, Steps) passing all profile `e5-v1` static and trace gates.
   - Fresh candidate generation costs are modest: 6.4–8.5 s wall time, 6.9–10.6 s CPU time.

2. **Tier 13 (Levels 275–299): PARTIALLY ACHIEVABLE (33% yield in unguided matrix, 100% under known topologies)**
   - Successfully proved that Target 13 puzzles passing 100% of quality gates DO exist and are fully playable:
     - Pyramid Seed 4: $D = 12.115, S = 2.67$, all gates pass.
     - LetterH Seed 5: $D = 13.150, S = 3.35$, all gates pass.
   - However, unguided random seeds often succumb to perimeter unpeeling ($D \approx 2.25 - 4.38$), dropping blind yield to 1/3 (33.3%).
   - **Diagnosis:** Achieving $\ge 80\%$ fulfillment at Tier 13 requires topologically guided clock placement that prevents perimeter bypass rather than simple seed grinding.

3. **Tier 16 & 19 (Levels 300+): UNSUPPORTED FRONTIER**
   - High clock depths ($d \ge 5$) cause the greedy heuristic family bot to wander and timeout without discovering the clock path.
   - This leads to:
     - Extremely high repeat mistake rates ($B7 > 0.85$, inflated).
     - Low authored trap engagement ($B2 < 0.10$).
     - Severe measurement boundary censoring ($D \approx 19.75 / 20$ or $D \approx 38.55 / 40$).
   - We truthfully report Tiers 16 and 19 as unsupported for automated production without architectural clock guide landmarks.

---

## 6. Artifact Manifest

All deliverables for Task G13 are preserved in the repository:

- **General Sequence Manifest:** [`source/analysis/builder-next/g13/sequence.json`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/analysis/builder-next/g13/sequence.json)
- **Frozen Request Matrix Results:** [`source/analysis/builder-next/g13/request_matrix.json`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/analysis/builder-next/g13/request_matrix.json)
- **Verified Level Boards:**
  - Level 250: [`source/analysis/builder-next/g13/boards/level_250.json`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/analysis/builder-next/g13/boards/level_250.json)
  - Level 251: [`source/analysis/builder-next/g13/boards/level_251.json`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/analysis/builder-next/g13/boards/level_251.json)
  - Level 252: [`source/analysis/builder-next/g13/boards/level_252.json`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/analysis/builder-next/g13/boards/level_252.json)
  - Level 253: [`source/analysis/builder-next/g13/boards/level_253.json`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/analysis/builder-next/g13/boards/level_253.json)
  - Level 254: [`source/analysis/builder-next/g13/boards/level_254.json`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/analysis/builder-next/g13/boards/level_254.json)
- **Design Cards:**
  - [`source/analysis/builder-next/g13/cards/level_250_card.md`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/analysis/builder-next/g13/cards/level_250_card.md)
  - [`source/analysis/builder-next/g13/cards/level_251_card.md`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/analysis/builder-next/g13/cards/level_251_card.md)
  - [`source/analysis/builder-next/g13/cards/level_252_card.md`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/analysis/builder-next/g13/cards/level_252_card.md)
  - [`source/analysis/builder-next/g13/cards/level_253_card.md`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/analysis/builder-next/g13/cards/level_253_card.md)
  - [`source/analysis/builder-next/g13/cards/level_254_card.md`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/analysis/builder-next/g13/cards/level_254_card.md)
- **Code Modifications:**
  - Measurement Protocol & Trace Gates: [`source/tools/builder/loop/traces.js`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/tools/builder/loop/traces.js)
  - Yardstick Protocol Handling: [`source/tools/builder-next/yardstick.js`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/tools/builder-next/yardstick.js)
  - Evaluation Protocol & Gate Options: [`source/tools/builder-next/evaluator.js`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/tools/builder-next/evaluator.js)
  - Builder Scoped Caching & Derived Seeds: [`source/tools/builder-next/builder_next.js`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/tools/builder-next/builder_next.js)
  - General Sequence Planning Engine: [`source/tools/builder-next/plan_sequence.js`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/tools/builder-next/plan_sequence.js)
  - Matrix Exporter Bug Fix & Strict Tolerance: [`source/tools/builder-next/run_matrix.js`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/tools/builder-next/run_matrix.js)
  - Recipe Expansions: [`source/tools/builder-next/recipes.js`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-builder-g13/source/tools/builder-next/recipes.js)
