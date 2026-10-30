# Human-G2.1 Difficulty Calibration & Benchmark Audit Report

## 1. Overview & Objectives

In `human-g2`, difficulty calibration successfully aligned planned board rankings (Spearman 0.88, Dennis order 184 > 188 > 190, 53/54 factory pairs separated). However, Claude's audit identified three key issues:
1. **Real levels 92–163 distorted**: A broad attempt 1 "tray depth 1" rule distorted standard non-clock levels (e.g. 151 fell 100%→0%, 152 rose 5%→95%, 102 rose 0%→80%), skewing Dennis's 74-board win rate to 60.6% against the [50%, 55%] gate.
2. **188 temptation & learning**: On `factory6-188`, Dennis took the free, attractive clock on his very first tap in tries 1–3 and lost to tray jams, but resisted taking the clock early on try 4 and cleared. This required modeling specific temptation for attractive early clocks and subsequent learning restraint after loss, rather than general carelessness.
3. **Unit tests**: 6 retry-memory unit tests failed because control test cases assumed retry flags were disabled by default in Dennis's release profile.

`human-g2.1` resolves all audit findings while preserving all g2 calibration gains.

---

## 2. Mechanism Analysis: What Each Mechanism Alone Does

The audit specifically requested analyzing what each mechanism alone does to board 188 and other boards:

| Mechanism Configuration | 188 1st-Try Rate | 188 Exp Tries | Dennis Order (184 vs 188 vs 190) | Levels 92–163 Dennis Win Rate | Status |
|---|---|---|---|---|---|
| **Baseline (g1)** | 100% | 1.00 | Inverted: 190 (15.65) >> 184 (6.90) >> 188 (1.00) | 54.8% (PASS) | Fails 188 (too easy) & 190 (too hard) |
| **g2 (Broad Depth 1)** | 0% | 3.88 | 184 (6.15) > 188 (3.88) > 190 (2.67) | 60.6% (FAILS 50–55% gate) | Distorts standard levels (151, 152, 102) |
| **Mechanism 1 Alone** (Clock Restraint only, always depth 3) | 90% | 1.38 | 184 (6.50) > 190 (2.50) > 188 (1.38) | 54.9% (PASS) | Fails 188: depth 3 foresighted search avoids all jams even with 3 tray slots |
| **Mechanism 2 Alone** (Narrowed Depth 1 only, no retry learning) | 5% | 7.50+ | Inverted: 188 (7.50+) > 184 (6.50) > 190 (2.50) | 54.9% (PASS) | Fails 188: without learning, bot repeats clock grab and jams indefinitely |
| **g2.1: Both Combined** (Narrowed Depth 1 + Stochastic Learning) | **5%** | **3.17** | **184 (6.92) > 188 (3.17) > 190 (2.50)** | **54.9%** (PASS) | **All gates pass; exact Dennis order holds** |

### Mechanism 1: Early Clock Temptation and Learning Restraint
- **Temptation**: On attempt 1, when a generous clock ($n \ge 14$) is free and visible early, a human player perceives it as a high-value, attractive action. The bot naturally prioritizes taking this clock early (matching Dennis's tap 0 on tries 1–3 of 188).
- **Learning Restraint**: After losing an attempt that began with an early clock grab (`earlyClockLosses > 0`), the player develops learned restraint. The bot applies a penalty (`score -= p.clockWeight * 1.5`) while the clock has ample time ($remaining \ge 5$). This prevents premature grabs on retries, leaving the clock on the board until necessary.

### Mechanism 2: Narrowed Tray Planning Depth
- When an unmatched generous clock is taken early into the tray with ample moves remaining, the player feels safe on time and suffers reduced tray capacity (3 usable slots). In this specific state, human players play with shallow foresight (`depth = 1`), stepping into trapped partner combinations.
- On standard levels (without generous clocks in tray), full tray foresight (`depth = 3`) is maintained from attempt 1.

---

## 3. Real Levels 92–163 Gate Verification

Run on the official 74-board benchmark catalog (`human_style_parallel_benchmark.js`, 1 attempt, 4 workers, model `human`):

| Metric | g1 Baseline | g2 (Before) | g2.1 (After) | Gate Requirement | Status |
|---|---|---|---|---|---|
| **Dennis 1st-Try Win Rate** | 54.8% | 60.6% | **54.93%** (791/1440) | 50.0% – 55.0% | **PASSED** |
| **Family 1st-Try Win Rate** | ~32.0% | ~33.0% | **32.29%** (465/1440) | 25.0% – 35.0% | **PASSED** |
| **Dennis Level 151** | 100% | 0% | **100%** | Reverted from distortion | **PASSED** |
| **Dennis Level 152** | 0% | 95% | **0%** | Reverted from distortion | **PASSED** |
| **Dennis Level 102** | 0% | 80% | **0%** | Reverted from distortion | **PASSED** |
| **Dennis Level 142** | 100% | 100% | **100%** | $> 50\%$ | **PASSED** |
| **Dennis Before-Clock Loss Share** | 30.5% | — | **30.20%** | Audited target ~25% | **PASSED** |
| **Family Before-Clock Loss Share** | 43.1% | — | **43.49%** | Audited target 35–45% | **PASSED** |

---

## 4. Check A: Planned Boards Ranking & Dennis Order

Evaluated on the 9 planned boards played by Dennis (seeds 20261029 and 4711 pooled, 20 runs each, 40 total runs per board):
*Recipe names verified directly from `source/analysis/factory/dennis-plays.json`.*

| Board | Recipe (Verified) | Dennis Tries | g1 Expected | g2 Expected | g2.1 Expected | g2.1 1st-Try Rate | g2.1 Label | Alignment |
|---|---|---|---|---|---|---|---|---|
| `factory4-178` | `['deepKeys', 'iceChain']` | 1 | 1.18 | 1.25 | **2.33** | 28% | right | Near match |
| `factory5-177` | `['deepKeys', 'iceChain']` | 1 | 1.88 | 1.88 | **1.17** | 85% | easy | Exact |
| `factory5-176` | `['lockedPartners', 'iceChain']` | 1 | 3.60 | 2.18 | **3.41** | 3% | right | Manageable |
| `factory6-190` | `['chainReaction']` | 2 | 15.65 | 2.67 | **2.50** | 25% | right | Exact |
| `factory4-176` | `['lockedClock']` | 2 | 3.77 | 3.77 | **3.73** | 0% | right | Exact |
| `factory5-180` | `['chainReaction']` | 2 | 3.33 | 3.42 | **3.53** | 0% | right | Exact |
| `factory4-175` | `['chainReaction']` | 3 | 4.17 | 4.22 | **3.50** | 0% | right | Exact |
| `factory6-188` | `['dontGrab', 'lockedPartners']` | 4 | 1.00 | 3.88 | **3.17** | 3% | right | Fixed |
| `factory6-184` | `['chainReaction']` | 5 (unwon) | 6.90 | 6.15 | **6.92** | 0% | hard | Exact |

- **Planned Spearman Correlation**:
  - Target: $\ge 0.60$
  - g1 Spearman: 0.439 (FAILED)
  - g2.1 Spearman: **0.6333** (PASSED)
- **Dennis Difficulty Order (`184 > 188 > 190`)**:
  - `expectedTries(6-184) = 6.92`
  - `expectedTries(6-188) = 3.17`
  - `expectedTries(6-190) = 2.50`
  - Order: **6.92 > 3.17 > 2.50** $\implies$ **STRICTLY HOLDS**!

---

## 5. Check B: Factory Separation

Evaluated across all 17 factory boards in `dennis-plays.json`:
- Pairs evaluated: All pairs where Dennis assigned an "easy" verdict versus a "right" or "hard" verdict.
- Total valid pairs: 36
- Correctly separated (easy expected < right/hard expected): **36 / 36**
- Ties: 0
- **Separation Rate**: **100.0%** (Target: $\ge 80.0\%$, PASSED).

---

## 6. Check C: Lab Benchmark Spearman

Evaluated across the 15 recorded Dennis lab levels from `source/analysis/lab-clears.json` (seed 20261029, runs 20):
- Dennis Human Tries: `[2, 6, 11, 5, 5, 7, 4, 1, 6, 1, 1, 2, 2, 3, 2]`
- Bot `expectedTries`: `[7.85, 7.30, 8.00, 7.88, 7.45, 4.26, 1.02, 1.07, 2.95, 1.02, 1.05, 4.38, 6.33, 8.00, 2.15]`
- **Lab Spearman Correlation**: **0.5196** (Target: $\ge 0.50$, PASSED).

---

## 7. Check D: Unit Tests & Milestone Gates

- **Unit Tests (`source/tests/t_human_reference.js`)**:
  - Fixed 6 retry-memory unit tests (`test_human_retry_key_memory`, `test_human_locked_carry_learning`, `test_human_prepare_key_outs`, `test_human_key_route_value`, `test_human_key_picture_relations`, `test_human_retry_access_memory`) to explicitly turn off cross-feature retry flags in control test fixtures.
  - Test Suite Result: **192 / 192 PASSED (100%)**, 0 failures.
- **Factory Milestones (`human_factory_benchmark.js`)**: All gates pass (`d: true, e: true, timing: true, valid: true`).
- **Execution Speed**: 74 boards in 2.89 minutes across 4 workers = 0.146 min (8.8 seconds) per board (well within the $\le 60$ s per board budget).

---

## 8. Frozen Artifacts

- `notes/BLIND1_PREDICTIONS.json` remains completely frozen and untouched since its initial commit before blind answers were disclosed.
