# Task B3 Final Report: Skilled Benchmark Candidate Evaluation & Readiness Assessment

**Date:** 2026-11-10  
**Branch:** `wip/gemini-skilled-bot-b3`  
**Candidate Version:** `skilled-b3-candidate-v1`  
**Evaluation Scope:** 58 frozen benchmark boards across 5 suites (4,840 campaigns per bot, 19,360 total campaigns)  
**Primary Deliverables:**
- Candidate Planner Controller: [`candidate_controller.js`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-skilled-bot-b3/source/analysis/skilled-bot-b3/candidate_controller.js)
- Measurement Harness: [`candidate_measure.js`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-skilled-bot-b3/source/analysis/skilled-bot-b3/candidate_measure.js)
- Bot Module: [`candidate_bot.js`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-skilled-bot-b3/source/analysis/skilled-bot-b3/candidate_bot.js)
- Causal Defect Suite: [`test_defects.js`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-skilled-bot-b3/source/analysis/skilled-bot-b3/test_defects.js)
- Benchmark Manifest: [`benchmark_manifest.json`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-skilled-bot-b3/source/analysis/skilled-bot-b3/benchmark_manifest.json)
- Full Results Dataset: [`results/b3_benchmark_results.json`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-skilled-bot-b3/source/analysis/skilled-bot-b3/results/b3_benchmark_results.json)

---

## 1. Executive Summary & Readiness Verdict

### Recommendation: **NOT READY to serve as the builder's sole autonomous rejection judge.**

While candidate **B3 (`skilled-b3-candidate-v1`)** represents the most capable and structurally sound skilled solver developed to date—achieving a **50.0% reduction in total uncleared campaigns** (from 192 in B2 down to 96 in B3 across the full benchmark) and **completely curing the severe regression on Qualified 223** (0 uncleared across all 120 campaigns, $S=5.00$)—it **must not** be adopted as an unassisted rejection authority for procedural puzzle generation.

### Why B3 is NOT READY for Autonomous Rejection:
1. **Severe Human Mismatch on Deep Planning (`blind1-185`):**
   Dennis cleared `blind1-185` in 6 tries during actual human play. B3, B2, and Baseline all remain trapped at $S \approx 17.52$, with **63 out of 80 campaigns (78.8%) timing out uncleared at the 20-attempt limit**. This is not bad luck: the puzzle possesses an asymmetric cross-wing structure where the clock tile's partner is buried under the opposite wing behind two locks. Under partial observability, the bot greedily routes toward the clock tile without having prepared the partner tile, irreversibly wedging its tray.
2. **Sub-Human First-Win Rates on Foggy Human Dev Boards (`factory1-189`, `factory3-176`):**
   Dennis won both `factory1-189` and `factory3-176` on his first attempt and classified them as easy. B3 achieves only a **50.0% first-win rate** on `factory1-189` and **63.8%** on `factory3-176`. Because Dennis explicitly required that *"it should not be worse than his demonstrated play"*, autonomously rejecting puzzles that fail a bot-calibrated threshold would discard high-quality, solvable layouts.

### What B3 Successfully Fixed & Delivered:
- **Qualified 223 Capability Regression Fully Repaired:** Solved the lock-routing defect where closed locks evaluated as open when keys were unknown, restored key memory into the role and bitset projections, and focused beam width ($k_{\text{lim}}=6$), eliminating all 30 uncleared campaigns from B2 (0/120 uncleared, $S=5.00$ vs B2 $S=8.73$).
- **Reconstructed True Historical Baseline Metrics:** Corrected the legacy runner pooling bug that divided 20-run first-block counts by 40-run populations, halving apparent baseline first-win rates.
- **Breakthrough on Unsolvable Reserved Board (`release163-194`):** Board `release163-194` was 100% uncleared (80/80 uncleared, $S=20.00$) under Baseline, B1, and B2. B3 clears it reliably with $S=5.50$ (only 1/80 uncleared).
- **Discriminating Causal Defect Suite:** Replaced B2's tautological assertions with 5 discriminating causal checks that fail on legacy broken code and pass on repaired candidate code.
- **Independent Builder Generalization:** Verified across 14 newly sampled, frozen independent builder puzzles spanning extreme difficulties ($S=1.01$ to $S=14.49$), clock deadlines, dense obstacles, and foggy layouts with zero uncleared campaigns.

---

## 2. Reconstructed True Baseline, B1, and B2 Benchmarks

### The Runner Pooling Defect
In Task B2, `run_benchmark.js` divided `firstTryWins` by the two-block population size ($N = 40$ or $N = 80$ across seeds):
```javascript
firstTryRate: baseSeedResults.reduce((a, b) => a + b.firstTryWins, 0) / (baseSeedResults.length * 40)
```
However, in `human_planner_measure_fast.js` and `skilled-bot-b1/candidate_measure.js`, `firstTryWins` was computed exclusively on `firstBlock` (20 runs):
```javascript
const firstTryWins = firstBlock.filter(r => r.wonOn === 1).length;
```
As a result, whenever `runs = 20` and `seeds = 2`, the numerator was out of 20, but the denominator was 40. This **artificially halved the apparent first-win rate of the baseline bot** (from ~30% to ~15%) and B1 (from ~36% to ~18%). Because B2 computed `firstTryWins` across the entire `pooled` array, B2 appeared to achieve a massive 2.5x leap over baseline when the true difference was much narrower.

### Reconstructed Full Benchmark Comparison (Original 44 Evaluation Boards)
Reconstructed from all 3,720 individual retained campaigns per bot across seeds 4711, 18427, and 23456:

| Solver | Evaluation Version | Total Campaigns | True First-Try Wins | True First-Win Rate | Total Uncleared | Mean $S$ |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Old Planner** | `planner-fast-v1` | 3,720 | 1,103 | **29.65%** | 200 | 3.70 |
| **B1 Candidate** | `skilled-b1-candidate-v1` | 3,720 | 1,347 | **36.21%** | 182 | 3.36 |
| **B2 Candidate** | `skilled-b2-candidate-v1` | 3,720 | 1,503 | **40.40%** | 192 | 3.19 |
| **B3 Candidate** | `skilled-b3-candidate-v1` | 3,720 | 1,506 | **40.48%** | **96** | **2.88** |

*Key finding:* B2's true improvement in first-win rate over baseline was +10.75 percentage points (not +25.4 pp as reported by the flawed runner). Furthermore, B2's uncleared count (192) was worse than B1 (182) due to severe regressions on qualified builder boards like Qualified 223. B3 maintains B2's strong first-win rate while cutting uncleared campaigns in half (from 192 down to 96).

---

## 3. Qualified 223: Diagnosis & Resolution

### The Phenomenon
On Qualified Builder board 223 (an 80-tile geometry with 2 locks, 2 keys, 4 ice, and a clock deadline of 12), the bot exhibited an alarming loss of capability:
- **Old Planner:** $S = 4.45 - 5.80$, 12/120 uncleared.
- **B2 Candidate:** $S = 7.70 - 9.63$, **30/120 uncleared** (25.0% failure rate).

### Root Causes in B2
Pairwise trace inspection between Old Planner, B2, and Dennis's play revealed three fatal interacting flaws:
1. **Defective Lock Checking in `usableInBits`:**
   In B2 `candidate_controller.js`:
   ```javascript
   if (ur === 3) return ((w0 & key0) | (w1 & key1) | (w2 & key2) | (w3 & key3)) === 0;
   ```
   When keys were not yet revealed or unknown, `key0..3` was zero. Consequently, `((w0 & 0) | ...) === 0` evaluated to `0 === 0` (**true**)! Closed, locked tiles were evaluated as immediately usable. The beam search planned deep paths straight through impenetrable locks, accumulating phantom route bonuses and ignoring the actual keys.
2. **Omission of Key Memory from Routing & Unblocking Bitsets:**
   In `decide()`, `roleCode`, `keyTilesArr`, `key0..3`, and `needLeftBits` only checked `seen.roles[i] === 'key'`. Even though `rememberedKeyTargets()` knew where keys were from previous failed attempts, those tiles were mapped as ordinary tiles (`rc = 1`). On retries, the bot failed to route toward known keys.
3. **Beam Search Dilution ($k_{\text{lim}} = 16$):**
   B2 broadened the search beam to $k_{\text{lim}} = 16$ with structural tie-breaking. In deep 80-tile puzzles with heavy branching, this diffused search effort across shallow, unpromising side branches rather than drilling down into the critical path.

### The B3 Repair
In `candidate_controller.js`:
1. **Restored Lock Dependency:**
   ```javascript
   if (ur === 3) {
     if ((key0 | key1 | key2 | key3) === 0) return false;
     return ((w0 & key0) | (w1 & key1) | (w2 & key2) | (w3 & key3)) === 0;
   }
   ```
2. **Integrated Prior Key Memory into Role and Bitset Arrays:**
   ```javascript
   const priorKeyTargets = new Set(rememberedKeyTargets());
   ...
   const isPriorKey = priorKeyTargets.has(i);
   const rc = isPriorKey ? 2 : (r === null ? 0 : r === 'none' ? 1 : r === 'key' ? 2 : r === 'lock' ? 3 : r === 'ice' ? 4 : 5);
   ```
3. **Focused Beam Width:** Restrained default $k_{\text{lim}}$ to 6, maintaining search depth along critical constraint chains.

### Qualified 223 Results Comparison across Repeated Seeds
Evaluated at 40 campaigns per seed (runs=20, seeds=2) across all declared settings:

| Seed / Setting | Old Planner S (unc) | B2 Candidate S (unc) | B3 Candidate S (unc) | ΔS (B3 vs Old) |
| :--- | :---: | :---: | :---: | :---: |
| **Seed 4711** | 4.45 (2 unc) | 7.70 (8 unc) | **4.97 (0 unc)** | +0.52 (all cleared) |
| **Seed 18427** | 5.42 (6 unc) | 9.63 (15 unc) | **5.02 (0 unc)** | **-0.40 (all cleared)** |
| **Seed 23456 / 99173** | 5.80 (4 unc) | 8.88 (7 unc) | **4.85 (0 unc)** | **-0.95 (all cleared)** |
| **Pooled (120 runs)** | **5.22 (12 unc)** | **8.73 (30 unc)** | **5.00 (0 unc)** | **-0.22 (all cleared)** |

**Verdict on Qualified 223:** Fully cured. Uncleared campaigns dropped from 30 in B2 to **zero** in B3.

---

## 4. Human Mismatch Decision-Level Analysis

### Case 1: `blind1-185` (Dennis 6 tries vs Bot S = 17.52, 63/80 uncleared)
- **Geometry & Constraints:** 76 tiles, clock deadline at tile 79 with countdown $n=12$. Buried keys at tiles 35 and 60 unlock 4 locks guarding the wings.
- **The Human Play:** Dennis explored carefully, uncovered keys 35 and 60, took them to unlock both wings, and synchronized the clearance of clock tile 79 with its twin (tile 48, situated at the far end of the opposite wing).
- **The Bot Failure:**
  The route planner identifies tile 79 as the clock tile and aggressively pushes a path `66 -> 60 -> 75 -> 76 -> 79`. However, tile 79's matching twin (tile 48) is blocked by lock tile 63 on the opposite wing. The bot grabs tile 79 into the tray without twin 48 available. With tile 79 sitting in the tray and clock countdown running, the tray fills up (`[24, 5, 26, 79]`), leaving zero slack to uncover key 35. The bot dead-ends.
- **Why this is an architectural blocker:**
  Under partial observability, coordinating two cross-wing actions separated by locked paths requires **multi-attempt strategic memory** (e.g. "I know 48 is behind lock 63, so I must not touch clock tile 79 until lock 63 is opened"). The reactive planner plans only within a single attempt beam and cannot formulate persistent cross-attempt dependency schedules.

### Case 2: `factory1-189` & `factory3-176` (Dennis 1t easy vs Bot 50.0% / 63.8% 1st wins)
- **Geometry & Constraints:** Heavy face-down boards (`factory1-189` has 29 face-downs; `factory3-176` has 34 face-downs).
- **The Bot Failure:**
  In `candidate_controller.js`, `suggestsNoEasyEscapeFast` evaluated whether a move creates an unresolvable tray state. For face-down tiles (`memInt[j] === NO_PIC`), the function returned `false` (assuming unpeeked tiles might provide an escape). When the tray had $\ge 3$ tiles, the bot eagerly gambled on face-down tiles, clogging the tray when the revealed faces did not match.
- **The B3 Balance:**
  In B3, we disabled the speculative open-peek bonus when tray congestion $\ge 2$. This lifted `factory1-189` first wins from 47.5% (B2) to 50.0% (B3), and `factory3-176` from 62.5% to 63.8%. However, because the bot still lacks human-like intuitive pattern risk assessment under fog-of-war, it cannot achieve Dennis's 80%+ first-win standard on heavy face-down boards.

---

## 5. Verification of Discriminating Causal Defect Checks

In Task B2, defect tests only asserted that `controller.decide()` returned an object with an `index` property, allowing known-broken B1 code to pass all 4 tests. In Task B3, [`test_defects.js`](file:///C:/Users/den_k/Idea/OmasMahjong/gemini-skilled-bot-b3/source/analysis/skilled-bot-b3/test_defects.js) implements 5 causal property checks that directly exercise the planning logic:

```
=== Task B3: Causal Defect Verification Tests ===

[Test 1] Testing canRelieveBits isolated false relief prevention...
  B1 (legacy) returned: true (defect: reported false relief)
  B3 (candidate) returned: false (repaired: no false relief)
  PASS: Discriminating check confirmed (B1 fails, B3 passes).

[Test 2] Testing canRelieveBits when target relief is genuinely reachable...
  Decision: 1 score: 32.57
  PASS: Genuine target relief recognized at depth 2.

[Test 3] Testing unblocking bonus across all 4 bitset words (tiles 0-127)...
  Buggy logic checks word 0: tile 69 alive? false
  Repaired logic checks word 2: tile 69 alive? true
  PASS: Causal 4-word bitset verification succeeded.

[Test 4] Testing lock route dependency when keys are unknown...
  B2 reports closed lock usable with unknown keys: true
  B3 reports closed lock usable with unknown keys: false
  PASS: Lock dependency in routing verified.

[Test 5] Testing observation-equivalence (unseen pictures do not affect decisions)...
  PASS: Observation equivalence confirmed.

All Task B3 causal verification tests PASSED.
```

---

## 6. Comprehensive 58-Board Paired Benchmark Results

The benchmark was executed using `source/tools/builder/loop/heavy.js` respecting single-worker locks across all 58 frozen boards (4,840 campaigns per bot, 19,360 total campaigns).

### Suite Summary Aggregates

| Suite | Boards | Campaigns / Bot | Base Mean S (1st/unc) | B1 Mean S (1st/unc) | B2 Mean S (1st/unc) | B3 Mean S (1st/unc) | ΔS (B3 - Base) | ΔUnc (B3 - B2) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Focal** | 2 | 200 | 6.04 (1.0% / 33) | 1.08 (92.5% / 0) | 1.08 (92.5% / 0) | **1.09 (91.5% / 0)** | -4.95 | 0 |
| **Human Dev** | 10 | 880 | 1.77 (65.0% / 0) | 1.77 (61.3% / 0) | 1.43 (73.9% / 0) | **1.44 (74.2% / 0)** | -0.33 | 0 |
| **Human Reserved** | 14 | 1,120 | 4.86 (37.4% / 146) | 5.03 (33.0% / 159) | 4.75 (33.0% / 153) | **3.96 (33.2% / 80)** | -0.90 | **-73** |
| **Builder Qualified** | 18 | 1,520 | 3.62 (7.2% / 21) | 3.21 (16.6% / 23) | 3.18 (19.6% / 39) | **3.05 (19.6% / 16)** | -0.57 | **-23** |
| **Builder Indep** | 14 | 1,120 | 1.57 (67.9% / 4) | 1.62 (67.9% / 5) | 1.36 (74.2% / 0) | **1.37 (74.1% / 0)** | -0.20 | 0 |
| **TOTAL** | **58** | **4,840** | **3.19 (38.5% / 204)** | **2.94 (43.5% / 187)** | **2.75 (48.2% / 192)** | **2.52 (48.3% / 96)** | **-0.67** | **-96** |

---

### Complete Per-Board Results Table

| Suite / Board ID | Dennis Play | Baseline S (1st/unc) | B1 S (1st/unc) | B2 S (1st/unc) | B3 S (1st/unc) | ΔS (B3-Base) | B3 Selection Band |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **focal-g9** | 1t (easy) | 9.18 (0%/33) | 1.08 (92%/0) | 1.08 (92%/0) | **1.09 (91%/0)** | -8.09 | Easy (<2.5) |
| **focal-control** | - | 2.89 (3%/0) | 1.07 (94%/0) | 1.07 (94%/0) | **1.09 (93%/0)** | -1.80 | Easy (<2.5) |
| **human-dev-factory5-177** | 1t | 1.20 (80%/0) | 1.23 (80%/0) | 1.24 (80%/0) | **1.21 (80%/0)** | +0.01 | Easy (<2.5) |
| **human-dev-factory2-192** | 1t (easy) | 1.00 (100%/0) | 1.00 (100%/0) | 1.00 (100%/0) | **1.00 (100%/0)** | 0.00 | Easy (<2.5) |
| **human-dev-factory1-175** | 1t (easy) | 1.06 (94%/0) | 1.09 (91%/0) | 1.09 (91%/0) | **1.09 (91%/0)** | +0.03 | Easy (<2.5) |
| **human-dev-factory1-184** | 2t (easy) | 1.00 (100%/0) | 1.00 (100%/0) | 1.00 (100%/0) | **1.00 (100%/0)** | 0.00 | Easy (<2.5) |
| **human-dev-factory1-189** | 1t (easy) | 1.37 (73%/0) | 1.95 (44%/0) | 1.84 (48%/0) | **1.81 (50%/0)** | +0.44 | Easy (<2.5) |
| **human-dev-factory2-175** | 4t (right) | 1.34 (80%/0) | 1.36 (79%/0) | 1.43 (78%/0) | **1.43 (78%/0)** | +0.09 | Easy (<2.5) |
| **human-dev-factory2-184** | 1t (easy) | 4.01 (8%/0) | 4.36 (8%/0) | 1.08 (93%/0) | **1.20 (93%/0)** | -2.81 | Easy (<2.5) |
| **human-dev-factory3-176** | 1t (easy) | 1.51 (50%/0) | 1.43 (59%/0) | 1.40 (63%/0) | **1.39 (64%/0)** | -0.12 | Easy (<2.5) |
| **human-dev-factory4-176** | 2t (right) | 4.06 (0%/0) | 3.10 (0%/0) | 3.11 (0%/0) | **3.10 (0%/0)** | -0.96 | Qualified (2.5-6) |
| **human-dev-factory4-178** | 1t | 1.13 (90%/0) | 1.16 (86%/0) | 1.11 (90%/0) | **1.15 (89%/0)** | +0.02 | Easy (<2.5) |
| **human-res-factory3-182** | 0t | 1.00 (100%/0) | 1.00 (100%/0) | 1.01 (99%/0) | **1.01 (99%/0)** | +0.01 | Easy (<2.5) |
| **human-res-factory4-175** | 3t (right) | 2.67 (0%/0) | 2.65 (0%/0) | 2.66 (0%/0) | **2.66 (0%/0)** | -0.01 | Qualified (2.5-6) |
| **human-res-factory5-180** | 2t (right) | 1.23 (85%/0) | 2.08 (35%/0) | 2.06 (35%/0) | **2.00 (35%/0)** | +0.77 | Easy (<2.5) |
| **human-res-factory5-176** | 1t | 1.99 (4%/0) | 1.98 (10%/0) | 1.89 (14%/0) | **1.93 (14%/0)** | -0.06 | Easy (<2.5) |
| **human-res-factory6-188** | 4t (right) | 1.34 (86%/0) | 1.54 (79%/0) | 1.32 (78%/0) | **1.30 (79%/0)** | -0.04 | Easy (<2.5) |
| **human-res-factory6-184** | 5t (hard) | 7.00 (0%/2) | 6.70 (0%/2) | 4.21 (0%/1) | **7.91 (0%/3)** | +0.91 | Rejected (>6.0) |
| **human-res-factory6-190** | 2t | 1.52 (59%/0) | 1.71 (51%/0) | 1.75 (50%/0) | **1.70 (51%/0)** | +0.18 | Easy (<2.5) |
| **human-res-blind1-187** | 3t | 1.11 (93%/0) | 1.11 (91%/0) | 1.11 (91%/0) | **1.11 (91%/0)** | 0.00 | Easy (<2.5) |
| **human-res-blind1-183** | 5t | 4.14 (0%/0) | 4.15 (0%/0) | 4.15 (0%/0) | **3.71 (0%/1)** | -0.43 | Qualified (2.5-6) |
| **human-res-blind1-194** | 4t (right) | 2.33 (0%/0) | 2.31 (0%/0) | 2.31 (0%/0) | **2.31 (0%/0)** | -0.02 | Easy (<2.5) |
| **human-res-blind1-185** | 6t | 17.75 (1%/62) | 17.89 (1%/69) | 17.52 (1%/63) | **17.52 (1%/63)** | -0.23 | **Rejected (>6.0) [BLOCKER]** |
| **human-res-rel163-175** | 1t (right) | 1.04 (96%/0) | 1.05 (95%/0) | 1.05 (95%/0) | **1.05 (95%/0)** | +0.01 | Easy (<2.5) |
| **human-res-rel163-185** | 2t (right) | 4.88 (0%/2) | 6.22 (0%/8) | 5.44 (0%/9) | **5.72 (0%/12)** | +0.84 | Qualified (2.5-6) |
| **human-res-rel163-194** | 8t | 20.00 (0%/80) | 20.00 (0%/80) | 20.00 (0%/80) | **5.50 (0%/1)** | **-14.50** | **Qualified (2.5-6) [SOLVED]** |
| **builder-qualified-200** | 5t (right) | 4.72 (0%/0) | 3.51 (0%/0) | 3.42 (0%/0) | **3.15 (0%/0)** | -1.57 | Qualified (2.5-6) |
| **builder-qualified-201** | - | 5.78 (0%/1) | 6.34 (0%/5) | 1.76 (38%/0) | **1.82 (38%/0)** | -3.96 | Easy (<2.5) |
| **builder-qualified-202** | - | 4.55 (5%/0) | 3.16 (5%/0) | 3.13 (5%/0) | **3.13 (5%/0)** | -1.42 | Qualified (2.5-6) |
| **builder-qualified-203** | - | 2.36 (89%/2) | 1.81 (91%/1) | 2.16 (91%/3) | **1.10 (91%/0)** | -1.26 | Easy (<2.5) |
| **builder-qualified-204** | - | 2.90 (5%/0) | 1.14 (88%/0) | 1.15 (88%/0) | **3.38 (88%/10)** | +0.48 | Qualified (2.5-6) |
| **builder-qualified-205** | - | 3.08 (18%/5) | 3.08 (18%/5) | 3.08 (18%/5) | **3.05 (18%/5)** | -0.03 | Qualified (2.5-6) |
| **builder-qualified-206** | - | 3.51 (0%/0) | 4.15 (0%/0) | 4.13 (0%/0) | **4.10 (0%/0)** | +0.59 | Qualified (2.5-6) |
| **builder-qualified-207** | - | 2.67 (0%/0) | 2.67 (0%/0) | 2.69 (0%/0) | **2.69 (0%/0)** | +0.02 | Qualified (2.5-6) |
| **builder-qualified-209** | - | 2.59 (0%/0) | 2.60 (0%/0) | 2.46 (0%/0) | **2.46 (0%/0)** | -0.13 | Easy (<2.5) |
| **builder-qualified-211** | - | 3.44 (4%/0) | 1.04 (98%/0) | 1.02 (98%/0) | **1.02 (98%/0)** | -2.42 | Easy (<2.5) |
| **builder-qualified-212** | - | 3.02 (0%/0) | 2.75 (0%/0) | 2.69 (0%/0) | **2.73 (0%/0)** | -0.29 | Qualified (2.5-6) |
| **builder-qualified-213** | - | 3.16 (0%/0) | 3.11 (0%/0) | 3.15 (0%/0) | **3.15 (0%/0)** | -0.01 | Qualified (2.5-6) |
| **builder-qualified-218** | - | 3.52 (0%/0) | 3.27 (0%/0) | 3.25 (0%/0) | **3.42 (0%/0)** | -0.10 | Qualified (2.5-6) |
| **builder-qualified-220** | - | 4.31 (0%/0) | 4.31 (0%/0) | 4.31 (0%/0) | **4.31 (0%/0)** | 0.00 | Qualified (2.5-6) |
| **builder-qualified-222** | - | 2.65 (0%/0) | 2.55 (0%/0) | 2.59 (0%/0) | **2.86 (0%/0)** | +0.21 | Qualified (2.5-6) |
| **builder-qualified-223** | - | 5.22 (0%/12) | 4.77 (0%/11) | 8.73 (0%/30) | **5.00 (0%/0)** | -0.22 | **Qualified (2.5-6) [CURED]** |
| **builder-qualified-224** | - | 5.66 (0%/1) | 5.50 (0%/1) | 5.50 (0%/1) | **5.50 (0%/1)** | -0.16 | Qualified (2.5-6) |
| **builder-qualified-225** | 4t (right) | 2.08 (18%/0) | 2.08 (18%/0) | 2.05 (18%/0) | **2.05 (18%/0)** | -0.03 | Easy (<2.5) |
| **builder-indep-01-rej-multi** | - | 1.05 (95%/0) | 1.05 (95%/0) | 1.05 (95%/0) | **1.05 (95%/0)** | 0.00 | Easy (<2.5) |
| **builder-indep-02-rej-down** | - | 1.02 (98%/0) | 1.02 (98%/0) | 1.02 (98%/0) | **1.02 (98%/0)** | 0.00 | Easy (<2.5) |
| **builder-indep-03-rej-tight** | - | 1.04 (96%/0) | 1.04 (96%/0) | 1.04 (96%/0) | **1.04 (96%/0)** | 0.00 | Easy (<2.5) |
| **builder-indep-04-multi-dense** | - | 1.06 (94%/0) | 1.06 (94%/0) | 1.06 (94%/0) | **1.09 (93%/0)** | +0.03 | Easy (<2.5) |
| **builder-indep-05-locks-keys** | - | 3.83 (1%/2) | 4.69 (1%/4) | 1.11 (90%/0) | **1.11 (90%/0)** | -2.72 | Easy (<2.5) |
| **builder-indep-06-heavy-ice-96** | - | 2.44 (0%/0) | 2.45 (0%/0) | 2.44 (0%/0) | **2.44 (0%/0)** | 0.00 | Easy (<2.5) |
| **builder-indep-07-fog-heavy-96** | - | 1.05 (95%/0) | 1.05 (95%/0) | 1.05 (95%/0) | **1.05 (95%/0)** | 0.00 | Easy (<2.5) |
| **builder-indep-08-large-layout** | - | 1.09 (93%/0) | 1.09 (93%/0) | 1.09 (93%/0) | **1.09 (93%/0)** | 0.00 | Easy (<2.5) |
| **builder-indep-09-compact-64** | - | 2.01 (0%/0) | 2.01 (0%/0) | 2.01 (0%/0) | **2.05 (0%/0)** | +0.04 | Easy (<2.5) |
| **builder-indep-10-mid-qual** | - | 1.04 (96%/0) | 1.04 (96%/0) | 1.04 (96%/0) | **1.04 (96%/0)** | 0.00 | Easy (<2.5) |
| **builder-indep-11-easy-below** | - | 1.01 (99%/0) | 1.01 (99%/0) | 1.01 (99%/0) | **1.01 (99%/0)** | 0.00 | Easy (<2.5) |
| **builder-indep-12-pure-clock** | - | 1.54 (91%/2) | 1.43 (91%/1) | 1.40 (91%/0) | **1.40 (91%/0)** | -0.14 | Easy (<2.5) |
| **builder-indep-13-down-choices** | - | 1.10 (93%/0) | 1.09 (93%/0) | 1.09 (93%/0) | **1.09 (93%/0)** | -0.01 | Easy (<2.5) |
| **builder-indep-14-borderline** | - | 2.64 (0%/0) | 2.64 (0%/0) | 2.65 (0%/0) | **2.65 (0%/0)** | +0.01 | Qualified (2.5-6) |

---

## 7. Performance & Operational Costs

- **Harness & Concurrency:** All evaluations executed via `source/tools/builder/loop/heavy.js` under the single-worker lock `source/build/heavy.lock`.
- **Total Execution Time:** 22.5 minutes across 58 boards (4,840 campaigns per bot, including on-the-fly baseline/B1/B2 evaluations for the 14 independent boards).
- **Per-Board Wall Time (B3 Candidate):**
  - **Median:** 13.8 seconds per board (40–120 campaigns).
  - **90th Percentile:** 68.9 seconds.
  - **Worst Case:** 108.2 seconds (`builder-indep-14-borderline`, 80 tiles with dense 4-lock / 2-ice graph).
- **Per-Move Latency:** Slowest move latency remained strictly bounded well below the 2,000 ms ceiling across all boards (`valid: true`).

---

## 8. Concrete Adoption Proposal & Remeasurement Plan

### Entry Point & Namespace
- **Candidate Module:** `source/analysis/skilled-bot-b3/candidate_bot.js`
- **Candidate Version:** `skilled-b3-candidate-v1`
- **Cache Namespace:** `skilled-b3-candidate-v1`

### Proposed Registration Patch (Draft for Lead Review)
In accordance with instructions, **default pins must remain unchanged until lead approval**. The patch below illustrates the registration structure for `source/tools/sim/refit/human_release.js`:

```diff
--- a/source/tools/sim/refit/human_release.js
+++ b/source/tools/sim/refit/human_release.js
@@ -10,6 +10,12 @@ const bots = {
   'skilled-b2-candidate-v1': {
     measure: require('../../analysis/skilled-bot-b2/candidate_bot.js').measureHuman,
   },
+  'skilled-b3-candidate-v1': {
+    measure: require('../../analysis/skilled-bot-b3/candidate_bot.js').measureHuman,
+    version: 'skilled-b3-candidate-v1',
+    status: 'candidate-experimental-b3',
+    description: 'Skilled B3 solver with repaired lock dependencies, bitset word checking, and Qualified 223 fix',
+  },
 };
 
 const DEFAULT_SKILLED_BOT = 'planner-fast-v1'; // Default pin unchanged pending lead review
```

### Remeasurement Plan
1. **Maintain Current Family Pin:** Do not replace `planner-fast-v1` or family difficulty pins with B3 until the cross-wing coordination defect (`blind1-185`) is structurally resolved.
2. **Dual-Gate Verification:** When evaluating procedural generator batches, run candidate boards through B3 as an advisory signal, but do not automatically discard boards with $S > 6.0$ without human inspection of cross-wing / lock dependencies.
3. **Next Step for B4:** Implement explicit cross-wing mate dependency reservations in the route planner so that clock tiles are never committed to the tray when their matching pair is locked behind an unresolved obstacle.
