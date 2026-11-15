# Task 20 handoff — compact shapes and difficulty checks

Branch: `wip/codex-finish-ten`, worktree `codex-finish-ten`, based on Claude's `b220f2bb`. Live original: **1.69 / a99b338e**, re-fetched and checked on 2026-11-15. Nothing is released; main, Firebase, published files and `source/www/levels-hard.js` were not changed in this Task 20 worktree.

**40 of 45 ordinary slots now have certified compact proposals; the other five already fit. All seven that were open (251, 267, 278, 279, 288, 291, 298) have direct reshapes. 291 no longer needs a 290 swap.** The earlier 262←260 and 277←270 swaps are still experiments with different clock chains, especially 277. They must not be described as human difficulty matches.

Use `source/analysis/builder/finish-ten/proposed/pack.json` as the final proposal list. The earlier `footprint60/narrow-final/pack.json` and labs remain frozen; rerunning its old selector will not select these new boards. Every proposal here has an explicit source-tile map, fresh independent proof, measurements and a full actual-game win. Historical maps that were inferred rather than recorded are marked `baselineMapInferred`; do not present those inferred ordinary tile IDs as archival fact.

## Review labs and user input

- [Live original vs revised proposal](http://127.0.0.1:8276/): 40 pairs, sunflower, tap recordings, notes, verdicts and Show the way to the clock.
- [Editable placement lab](http://127.0.0.1:8277/): all 40 proposals; released boards are separately editable with their actual original tile counts. Check validates the edited pictures, not a regenerated older deal. Notes/edits live in `codex-tasks/results/finish-ten/placements`.
- [Frozen earlier 14 flagged draft comparisons](http://127.0.0.1:8275/): unchanged while the revised versions were developed. Its feedback stays separate from the new lab. Existing 8273/8274 were not replaced.

Dennis's three actual saved arrangements/notes are frozen in `user-input.json`. They guided 251 (remove unimportant supports and shift), 267 (trim and use inside), and 288 (use the middle). No generated measurements or QA notes are presented as Dennis's feedback. QA saves use a separate directory, and comparison POSTs were intercepted. New human feedback, if any, is in `source/build/finish-ten-revised-findings.json` / `-replays.json`; the earlier feedback is beside `finish-ten-comparison`.

## What moved in the seven

| level | tiles | tile px | shortest clock + spare | construction |
|---|---:|---:|---|---|
| 251 | 80 → 76 | 58.6 | 14 + 2 | Retain the full clock bar; stagger the lower wing by half a tile and move two ordinary endgame caps into the empty middle |
| 267 | 88 → 78 | 58.3 | 11 + 2 | Trim ordinary outer bases; rebuild the five supporting cells under the unchanged central trap; use the waist for two finish tiles |
| 278 | 80 → 80 | 58.3 | 13 + 2 | Keep the nested lower trap intact; align its full supporting row half a tile inward and move its spare ordinary base into the middle |
| 279 | 76 → 76 | 58.6 | 10 + 2 | Retain every upper trap piece and picture; half-align three support rows, put the free corner key in the empty crown and move the last ninth-row filler into the crown |
| 288 | 84 → 72 | 58.6 | 11 + 2 | Remove the ordinary bottom finish row; bring the right key roof inward as a supported half-offset stack and fill the middle low |
| 291 | 84 → 78 | 58.6 | 1 + 17 | Fold both ninth-row feet into the hollow waist, retain the left thaw-to-lock dependency, and half-align the full upper supporting rows; keep the frozen clock support below its visible badge edge |
| 298 | 84 → 80 | 58.6 | 10 + 2 | Translate the connected clock, melt route, key roof and its intended thaw neighbour together into the waist; retain both covers over the fourth key picture and trim four finish corners |

251 keeps the top clock bar and shifts the lower/right wing with its supports, with two finish tiles in the middle. 278 and 279 retain every original tile and picture in their raw certified shapes; later matching exchanges only ordinary finish pictures. 288 removes the ordinary bottom finish row and brings the right key roof inward. 298 translates the connected clock/thaw/key mechanism, including its intended thaw neighbour, into the waist. It also keeps the side blocking around the fourth key picture: simply moving its ordinary covers had made the wrong key recoverable. Restoring both roof coverage and side blocking restored that bait. 291 folds the bottom feet into the hollow middle, keeps the thaw-to-lock prerequisite, and moves the frozen clock support below the clock so its badge remains readable. No moved tile exceeds layer index 2 unless it was already higher.

## What difficulty evidence does and does not show

These are puzzle structure measurements, **not calibrated human win predictions**. No personal-player bots were run. Clock minima, spare, special prerequisites, each special's ablation effect and all authored wrong choices are freshly proved. Every available authored story proof is rerun with remapped IDs. Older boards without an authored context retain an explicitly narrower recovered special contract.

A large change in careless greedy clear rate by itself did not establish a human difficulty change. For example, the first 261, 263, 284 and 289 flags did not show the corresponding sustained-pressure drop on replicated checks. Fewer parked singles can simply mean a shorter finish. I normalized parks per ten remaining tiles, measured time with two or more waiting, and priced alternative single-tile choices. Natural opening offers are separately counted: visible free pairs, visible-twin singles, plus free keys/clock; hidden peek pairs are excluded. This helped fix the extra fatal offers that the first reshapes had introduced at 269 and 274.

The first 258 draft did show a sustained reduction in pressure, while 256, 259, 266, 286 and 299 showed increases. Their ordinary finishes were revised, with the special pictures and authored wrong choices fixed. Fresh checks also caught changes at 274 and 281, and opening-choice changes at 253, 257 and 282; these were revised too. The table below records residual differences rather than calling every board identical.

The matcher used seeds 3, 71 and 977. Final validation uses 121, 314159 and 2027, 24 proof-backed winning paths each, on both versions of every proposal (5,760 won paths). Those seeds were not used inside the optimizer; some intermediate validation flags informed which boards needed another pass. Unknown oracle results are never accepted as safe in this measurement and are excluded from fatal-choice fractions. All boards completed all 72 paths per version; 291 still has some unresolved alternative-choice probes, recorded in its JSON. These are a limitation on the choice estimate, not lost games or failed wins. The internal matching distance/threshold is a tuning aid, not a human-equality acceptance test.

**291 correction:** the old stored witness took its clock at move 16, but its true minimum is 1. The revised board also permits 1, with the same clock number 18. Comparing the original finish only after move 16 against the new finish after move 1 would falsely make the new board look much harder. Final pressure comparisons start at a shortest strict clock witness on each board. The full original and revised witnesses were both won in the real game.

## Per-slot measurements

Arrows are live original → final proposal. Opening is proved-safe first tiles / all legal first single tiles (unknowns are included in the denominator and noted). Waiting and 2+ are measured after the same shortest-clock policy. Park loss is the fraction of natural park alternatives proved fatal, not a player loss rate. Greedy is the careless finish procedure's clear share, not a human success prediction.

| slot/source | px | clock + spare | safe opening | mean waiting | decisions at 2+ | fatal park alternatives | careless clear | review |
|---|---:|---|---|---|---|---|---|---|
| 251 | 58.6 | 14+2 → 14+2 | 3/10 → 3/12 | 1.63 → 1.62 | 57.8% → 59.0% | 47.7% → 47.7% | 1.6% → 1.4% | No large replicated pressure/choice signal |
| 252 | 59.1 | 8+2 → 8+2 | 3/9 → 3/9 | 1.22 → 1.22 | 40.7% → 40.7% | 24.7% → 23.3% | 18.6% → 17.0% | No large replicated pressure/choice signal |
| 253 | 58.6 | 10+2 → 10+2 | 9/14 → 9/14 | 1.26 → 1.26 | 47.4% → 42.9% | 40.3% → 36.7% | 22.7% → 5.5% | No large replicated pressure/choice signal |
| 254 | 58.6 | 10+2 → 10+2 | 5/11 → 5/10 | 1.31 → 1.44 | 39.6% → 46.0% | 30.7% → 37.7% | 9.4% → 5.7% | No large replicated pressure/choice signal |
| 255 | 61.9 | 23+3 → 23+3 | 10/10 → 10/10 | 1.37 → 1.36 | 45.8% → 45.2% | 28.0% → 31.3% | 0.8% → 0.6% | No large replicated pressure/choice signal |
| 256 | 61.9 | 8+2 → 8+2 | 4/8 → 4/9 | 1.35 → 1.38 | 43.9% → 46.5% | 39.0% → 30.0% | 9.4% → 0.2% | No large replicated pressure/choice signal |
| 257 | 58.3 | 8+3 → 8+3 | 9/17 → 9/16 | 1.62 → 1.64 | 71.7% → 73.0% | 23.3% → 22.0% | 22.7% → 46.7% | No large replicated pressure/choice signal |
| 258 | 59.1 | 10+2 → 10+2 | 4/11 → 5/11 | 1.30 → 1.37 | 47.4% → 46.3% | 33.7% → 37.0% | 3.3% → 3.1% | No large replicated pressure/choice signal |
| 259 | 61.9 | 11+1 → 11+1 | 4/10 → 4/12 | 0.25 → 0.34 | 5.8% → 5.8% | 0.0% → 0.0% | 100.0% → 100.0% | No large replicated pressure/choice signal |
| 261 | 58.6 | 14+2 → 14+2 | 6/11 → 7/14 | 1.35 → 1.35 | 44.5% → 45.9% | 22.0% → 20.0% | 12.1% → 32.6% | Visible safe opening offers changed |
| 262 / 260 | 59.1 | 13+2 → 11+2 | 6/6 → 5/13 | 1.61 → 1.66 | 56.7% → 57.3% | 50.7% → 51.0% | 0.6% → 0.6% | Different source clock chain: hold slot fit; Visible safe opening offers changed |
| 263 | 61.9 | 13+2 → 13+2 | 8/11 → 8/13 | 1.53 → 1.44 | 49.4% → 46.0% | 35.7% → 35.7% | 6.6% → 9.4% | No large replicated pressure/choice signal |
| 264 | 59.1 | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | Already fits; original preserved. |
| 265 | 61.9 | 12+1 → 12+1 | 4/14 → 4/14 | 1.48 → 1.44 | 51.0% → 46.9% | 25.7% → 31.3% | 3.3% → 1.9% | No large replicated pressure/choice signal |
| 266 | 63.3 | 11+1 → 11+1 | 4/8 → 4/13 | 1.06 → 1.08 | 22.6% → 24.0% | 0.0% → 5.3% | 64.1% → 91.0% | No large replicated pressure/choice signal |
| 267 | 58.3 | 11+2 → 11+2 | 6/14 → 7/16 | 0.48 → 0.53 | 14.9% → 14.5% | 0.0% → 0.0% | 100.0% → 99.2% | No large replicated pressure/choice signal |
| 268 | 63.3 | 7+1 → 7+1 | 3/11 → 3/11 | 0.73 → 0.75 | 22.8% → 22.8% | 16.7% → 17.0% | 23.8% → 23.1% | No large replicated pressure/choice signal |
| 269 | 59.1 | 19+0 → 19+0 | 4/14 → 4/12 | 1.11 → 1.04 | 45.5% → 46.7% | 0.0% → 0.0% | 100.0% → 100.0% | No large replicated pressure/choice signal |
| 271 | 58.6 | 9+2 → 9+2 | 6/16 → 6/17 | 0.83 → 0.78 | 16.3% → 13.9% | 18.3% → 19.3% | 39.8% → 47.7% | No large replicated pressure/choice signal |
| 272 | 59.1 | 40+3 → 40+3 | 8/8 → 8/10 (1 unknown) | 1.59 → 1.63 | 56.2% → 56.8% | 27.0% → 33.7% | 6.5% → 2.1% | No large replicated pressure/choice signal |
| 273 | 59.1 | 24+4 → 24+4 | 2/3 → 2/3 | 1.27 → 1.27 | 44.6% → 44.6% | 32.3% → 32.3% | 0.6% → 0.6% | No large replicated pressure/choice signal |
| 274 | 58.6 | 9+1 → 9+1 | 3/12 → 3/14 | 1.19 → 1.13 | 49.2% → 50.1% | 4.7% → 9.0% | 94.3% → 77.5% | No large replicated pressure/choice signal |
| 275 | 63.3 | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | Already fits; original preserved. |
| 276 | 58.3 | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | Already fits; original preserved. |
| 277 / 270 | 58.3 | 23+1 → 10+2 | 3/8 → 6/16 | 2.06 → 2.12 | 87.9% → 86.6% | 51.7% → 71.3% | 9.4% → 0.0% | Different source clock chain: hold slot fit; More fatal park alternatives; Visible safe opening offers changed |
| 278 | 58.3 | 13+2 → 13+2 | 7/14 → 8/18 | 0.55 → 0.43 | 17.3% → 9.2% | 7.7% → 9.0% | 85.9% → 51.2% | No large replicated pressure/choice signal |
| 279 | 58.6 | 10+2 → 10+2 | 14/24 → 18/26 | 0.95 → 1.05 | 37.5% → 42.6% | 22.3% → 23.3% | 59.4% → 50.6% | No large replicated pressure/choice signal |
| 281 | 58.6 | 12+2 → 12+2 | 6/12 → 6/15 | 0.97 → 0.89 | 26.9% → 29.2% | 8.7% → 16.0% | 18.9% → 43.2% | No large replicated pressure/choice signal |
| 282 | 63.3 | 5+2 → 5+2 | 9/15 → 9/15 | 0.69 → 0.58 | 19.3% → 13.4% | 27.0% → 13.7% | 35.0% → 57.8% | No large replicated pressure/choice signal |
| 283 | 59.1 | 21+3 → 21+3 | 8/9 → 8/9 | 1.52 → 1.52 | 53.3% → 53.3% | 20.7% → 20.7% | 26.8% → 26.8% | No large replicated pressure/choice signal |
| 284 | 58.6 | 9+2 → 9+2 | 4/12 → 4/14 | 0.74 → 0.55 | 19.1% → 16.0% | 5.3% → 4.7% | 27.3% → 65.6% | No large replicated pressure/choice signal |
| 285 | 59.1 | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | Already fits; original preserved. |
| 286 | 59.1 | 11+2 → 11+2 | 4/10 → 4/14 | 0.61 → 0.59 | 16.1% → 16.3% | 13.3% → 4.3% | 76.6% → 53.9% | No large replicated pressure/choice signal |
| 287 | 61.9 | 16+1 → 16+1 | 5/13 → 5/15 | 1.46 → 1.34 | 50.6% → 44.5% | 30.7% → 25.7% | 6.8% → 6.8% | No large replicated pressure/choice signal |
| 288 | 58.6 | 11+2 → 11+2 | 6/18 → 5/17 | 0.59 → 0.60 | 20.9% → 20.4% | 19.3% → 15.7% | 73.2% → 43.5% | No large replicated pressure/choice signal |
| 289 | 59.1 | 5+1 → 5+1 | 1/7 → 1/7 | 1.70 → 1.85 | 62.3% → 66.2% | 28.7% → 39.3% | 0.4% → 0.0% | No large replicated pressure/choice signal |
| 291 | 58.6 | 1+17 → 1+17 | 11/12 (1 unknown) → 12/14 | 1.65 → 1.62 | 56.2% → 55.7% | 51.3% → 53.3% | 2.1% → 0.0% | Shortest-clock comparison; unresolved alternative probes retained |
| 292 | 61.9 | 10+1 → 10+1 | 3/13 → 3/15 | 0.79 → 0.78 | 24.9% → 23.8% | 80.7% → 78.0% | 15.2% → 1.8% | No large replicated pressure/choice signal |
| 293 | 59.1 | 11+1 → 11+1 | 6/18 → 6/20 | 1.24 → 1.19 | 45.1% → 41.9% | 34.3% → 25.3% | 13.9% → 19.9% | No large replicated pressure/choice signal |
| 294 | 63.3 | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | Already fits; original preserved. |
| 295 | 58.6 | 7+1 → 7+1 | 3/12 → 3/13 | 0.94 → 1.02 | 31.8% → 34.5% | 46.3% → 47.0% | 26.6% → 25.4% | No large replicated pressure/choice signal |
| 296 | 59.1 | 14+3 → 14+3 | 7/7 → 11/11 | 1.58 → 1.51 | 55.1% → 48.0% | 34.0% → 31.7% | 1.8% → 1.9% | No large replicated pressure/choice signal |
| 297 | 58.6 | 15+1 → 15+1 | 4/14 → 4/15 | 1.35 → 1.36 | 48.7% → 48.1% | 30.0% → 28.3% | 7.2% → 18.8% | No large replicated pressure/choice signal |
| 298 | 58.6 | 10+2 → 10+2 | 7/19 → 7/19 | 0.87 → 0.87 | 27.7% → 26.7% | 23.7% → 15.3% | 37.9% → 52.1% | No large replicated pressure/choice signal |
| 299 | 58.6 | 12+2 → 12+2 | 5/11 → 5/10 | 1.08 → 1.07 | 30.8% → 32.1% | 55.0% → 56.0% | 0.8% → 1.0% | No large replicated pressure/choice signal |

## Swaps and what still resists

No ordinary level remains without a compact geometry. **Matching human difficulty is not established**, especially for the two inherited swaps. 262's replacement keeps source 260's 11-move clock rather than live 262's 13; 277's replacement keeps source 270's 10 rather than live 277's 23. Matching their tails cannot restore those chains. Their cards are marked, and both originals are playable in the lab. Do not silently release/reorder them based on the finish score.

- 262←260: closest original slots under the explicitly uncalibrated structural ranking are 293 (distance 2.33), 258 (distance 3.19), 254 (distance 3.41). The present slot has distance 4.76. This is a review shortlist, not a recommendation to displace those levels automatically.
- 277←270: closest original slots under the explicitly uncalibrated structural ranking are 258 (distance 2.86), 254 (distance 3.10), 253 (distance 3.13). The present slot has distance 27.41. This is a review shortlist, not a recommendation to displace those levels automatically.

A fresh direct search of original 262 and 277 is archived under `direct-slot`. The useful constructions shortened 262's clock from 13 to 8–9 and 277's from 23 to 15–21, or left the clock proof unresolved; none was accepted as equivalent. That is bounded evidence, not a proof that direct reshaping is impossible.

Source 290 has a separate proved 88-tile compact variant in `candidates/level-290.json` (complete bottom key/partner row transplanted into the crown). It is not used now that 291 fits directly. The bounded 280/300 attempts did not preserve the full contract; those swaps are unnecessary because 289 and 296 already fit directly. Keep them as unused experiments.

## Proof and editor repairs

The independent audit found issues that the older final-pack checker did not cover. Free initial face-down tiles at 253/258 were moved under cover by exchanging ordinary tile identities/positions while preserving their visible arrangement and pictures. 261 and 286 had been peeled below their authored 72-tile floor (286 also exceeded its face-down share limit); ordinary finish pairs were restored low, then their pressure retuned. 277's narrowed source-270 shape clashed with older live layouts; its connected lower finish wing was shifted half a tile and fully reproved. These proof eligibility fixes are not claims about human difficulty.

Two verifier fixes mattered. `peel_drop` had passed an old card's unremapped tile ID into the new special-dependency check, falsely rejecting sound deletions. It now remaps the card's original-clock role. The mixed-story proof can now receive a larger node budget without changing its predicates or defaults; 279's lookalike pair was unresolved at the old per-call budget, and proves the same +3 cost at the larger budget (spare remains 2). Unknown never counts as acceptance. Special comparison now compares named fields, so JSON property order cannot falsely fail a saved editor arrangement.

The Task 20 editor supports different released/proposal tile counts, separate erased workspaces, drag/undo, disk notes, stale-check invalidation and the exact matched pictures. Returning from a normal un-erased arrangement now records its played tile map too, so Back to placement shows the board as left in play. QA uses its own data directory; the existing user labs and saves were not restarted or rewritten.

## Validation and reproduction

- `proposed/browser.json`: 80 original/revised full-game wins, all 40 editor layouts, actual edited pictures checked, editable released version, drag/undo, separate erasures, disk note reload, editor full win, sunflower, 392×730 and desktop. QA feedback intercepted.
- `validation/level-N.json`: independent full contract and final replicated pressure results. `measurements/<hash>.json`: clock/opening/greedy data. `proposed/opening-offers.json`: visible offers. `baseline-proofs` and `completer-attempts` are investigations, not final acceptance.
- `test_finish_ten.js`: role-value remapping, differing released tile counts, unknown-is-not-safe, every final stored strict win and footprint.

From this worktree, set `MECH=1` and `NARROW_TRAP=core`; run heavy work through `node source/tools/builder/loop/heavy.js --cores N -- node ...`. The main scripts are `finish_ten_reshape.js`, `finish_ten_match.js --pack source/analysis/builder/finish-ten/proposed/pack.json --levels ...`, `finish_ten_assemble.js`, `finish_ten_measure.js --pack ...`, `finish_ten_validate.js`, `finish_ten_offers.js`, `finish_ten_labs.js`, and `finish_ten_report.js`. Do not rerun generators over a lab once Dennis has begun reviewing its frozen boards; generate a new revision directory/port instead. Lab building currently reuses the already frozen offline renderer assets from the local comparison build (initially copied read-only from Claude's try-lab-14).

Serve the comparison with `node source/tools/builder/bank/lab_server.js source/build/finish-ten-revised 8276`. Serve placements with `node source/tools/builder/bank/narrow_placement_server.js 8277 ../codex-tasks/results/finish-ten/placements source/build/finish-ten-placement`. Claude remains the lead for merging, choosing slot fit and any release.

## Release candidate requested after Task 20

Dennis asked whether the refitted levels can be released. A separate candidate is prepared on `wip/codex-refit-release` in `../codex-refit-release`, directly from live `a99b338e`. It contains **38 direct refits**, with live 262 and 277 retained. The five ordinary boards that already fit, every tenth level, all levels outside the selected 38, the table length and existing metadata are unchanged. No main merge, release version bump, deployment or Firebase write has occurred.

`manifest.json` lists the exact 38 and packed board hashes. `scope-check.json` independently compares the candidate against the actual live git table, including all untouched rows and metadata. Use this release artifact, rather than copying the wider builder branch's whole level table: that branch also has unrelated future boards that are not part of this release.

The release branch adds per-board save revisions (`boardVersions`) to `Hard.designVersion`. Changed boards and repetitions of those boards use revision 10. Unchanged designed boards retain 9, and earlier generations remain unchanged. An unfinished old layout on a changed level restarts; progress, completed stars and historical recordings are retained. The existing designed-level test now expects the appropriate per-board revision, and two focused tests cover scope, decoding, repetitions and saved-game behavior.

The candidate's actual game—not only the older lab renderer—has won all 38 at 392×730. Every tile pitch measured at least **58.566 CSS px**; details are in `browser.json` and `phone-291.png`. All 38 survive the game's pack/unpack and strict solution checks.

The full offline release suite passed **172/172 tests in 394 seconds** on the isolated release candidate. `checks.json` and `full-tests.log` record the result. The 38-board candidate is ready for publication review. No deployment is authorized by the task file; this is a concrete reviewable release candidate.
