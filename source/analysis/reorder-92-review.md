# Level 92+ reorder — review before publication

Status: **unpublished**. Branch: `wip/reorder-levels-92`. Levels 1–91 and the live website are unchanged.

Follow-up: publication was authorized on 2026-10-16. Release preparation is recorded in
`release-1.54.md`; this review describes the original unpublished implementation.

## What changed

All 178 boards from 92–269 occur exactly once in the new order. Their pictures, geometry, face-down tiles, specials, clocks, complete solutions and legacy rating fields are preserved. Large boards stay at every tenth level; levels beyond 269 repeat the same final range as before.

The order uses the calibrated honest observer at `316f3b1`, with equal weight for Dennisisdebeste and Mrs. Doubtfire. Each person contributes 50% first-try success, 25% success within two tries, and 25% within four. Five-point ease bands avoid pretending that tiny differences are exact. Within a size/band group, deterministic swaps reduce the sum of both people's difficulty jumps, with extra weight on harder jumps over eight points. Only primary samples drive that smoothing; original order breaks exact ties. Large and regular boards are ordered separately.

Each board/persona was measured with 1,200 four-attempt chains for ordering and 600 additional chains with another seed for validation (644,400 chains including the level-91 reference). Validation simulations were not used to choose the order. This checks simulation stability; it is not validation on new human attempts.

## Independent validation

Combined ease variation between successive levels, including the fixed level-91 boundary: **18.8094 → 4.134**. Easier jumps over ten percentage points: **42 → 1**. Harder jumps over ten points: **37 → 0**.

| Personal score | Variation before → after | Harder jumps over ten points before → after |
|---|---|---|
| Dennisisdebeste | 15.5371 → 4.9062 | 32 → 1 |
| Mrs. Doubtfire | 24.5792 → 6.4417 | 48 → 4 |

Expected success: first attempt / within two / within four, averaged over each band. These are model estimates, not real win rates.

| New levels | Dennisisdebeste | Mrs. Doubtfire |
|---|---|---|
| 92–99 | 74% / 95% / 100% | 52% / 75% / 93% |
| 100–119 | 48% / 81% / 98% | 36% / 59% / 82% |
| 120–149 | 41% / 75% / 96% | 29% / 49% / 74% |
| 150–179 | 36% / 67% / 92% | 22% / 40% / 63% |
| 180–209 | 34% / 65% / 92% | 17% / 31% / 52% |
| 210–239 | 32% / 60% / 87% | 14% / 27% / 47% |
| 240–269 | 26% / 51% / 79% | 9% / 18% / 33% |

## First twelve placements

| New level | Former level | Large board |
|---|---|---|
| 92 | 97 | no |
| 93 | 104 | no |
| 94 | 96 | no |
| 95 | 93 | no |
| 96 | 105 | no |
| 97 | 122 | no |
| 98 | 103 | no |
| 99 | 99 | no |
| 100 | 100 | yes |
| 101 | 116 | no |
| 102 | 216 | no |
| 103 | 261 | no |

## Remaining difficult boards

Reordering does not make the existing hardest boards easier. The lowest predicted within-four success rates for Mrs. Doubtfire are:

| New level | Former level | Mrs. Doubtfire within four | Dennis within four |
|---|---|---|---|
| 269 | 179 | 8% | 75% |
| 263 | 238 | 18% | 75% |
| 244 | 237 | 19% | 94% |
| 262 | 209 | 22% | 83% |
| 243 | 184 | 25% | 76% |
| 261 | 268 | 26% | 82% |
| 248 | 201 | 27% | 88% |
| 246 | 232 | 29% | 86% |

The fixed level 91 remains difficult. New 92 intentionally starts the reordered progression with an easier board. The two fitted people can disagree on difficulty, and separate large-board slots introduce local rises and falls. Small remaining differences should not be interpreted as precise human rankings.

## Compatibility and release

Unchanged levels through 91 keep generation-7 saves and recordings. The reordered range uses generation 8, so an old saved board cannot resume under a different level number. Existing stars, player progress, telemetry and recordings are not rewritten. Legacy packed chances retain their original model labels after moving.

Current 1.53 dashboard predictions and published files remain unchanged. A separate `reorder-92-predictions.json` draft covers all four people for the new numbering. Before a later release, bind that draft to the actual release version (refresh fits if needed), distinguish old-client predictions by app version, and publish only after Dennis asks. No database writes or publication occurred.

See `reorder-92-plan.md`, `reorder-92.json`, `reorder-92-measurements.json`, and `reorder-92-mapping.csv` for the plan, source mapping, measurements and machine-readable checks.

## Verification

- Full offline suite: **125/125 passed**, 321 seconds. All database interactions used test fixtures.
- After making input fingerprints portable between Windows and Linux: **3/3 reorder checks passed** again.
- Reapplying the permutation reproduces the identical source table; all 179 measurement records are reused without new simulations.
- Published `play/`, `dash/`, root download files and current `source/site/dash/predict.json` match main.
- No release version, APK build, push, deployment, player reset or Firebase write was made.
