# E5: gate calibration on labelled boards

Experiment E5 of `source/analysis/builder/process-design-synthesis.md` (section 7). Written 2026-11-07.

**Kill verdict: the E5 kill fires (two of its three triggers). The thresholds must be re-specified before production. A proposal is in `source/analysis/builder/library/gates-calibrated.json`.**
- "More than 70% of liked boards fail": yes. At the shipped thresholds all 10 liked boards fail the static gates and 9 of 10 fail the trace gates.
- "225 fails": yes. 225 (4 tries, 5 stars) fails static gates A1, A2, A3, A4, A6, A7 and trace gates B2 and B6.
- "Late-squeeze boards pass": no. None of the 3 late-squeeze boards passes (B5 alone catches 2 of the 3).
- "B2 becomes report-only if it does not score higher on liked boards": B2 does score higher (median 0.25 liked, 0.08 disliked), so B2 stays a gate, with a lower threshold.

Sources: `e5-gate-calibration.json` (per-board rows and group tables), `e5-static.jsonl`, `e5-traces.jsonl`, `e5-auc.json`, `e5-calibrated-rescore.json`, all made on 2026-11-07. Scripts are in `source/tools/builder/loop/research/`: `e5_gate_calibration.js` (the two engine runs, each through heavy.js: static about 2 min, traces about 6 min for 46 boards), `e5_analyze.js`, `e5_auc.js`, `e5_calibrated.js`.

## 1 Boards (46) and labels
- 24 Dennis-played boards with tiles from `source/analysis/factory/dennis-plays.json` (factory, blind, release163). Stars, verdict and labels (lateSqueeze etc.) from that file and `dennis-notes-labels.json`. The 17 lab boards have stars but no tiles in the file and cannot be run.
- 200, 217, 225: Dennis's round-2 verdicts are quoted in `history-map-2026-11-07.json` (200: 3 stars, 5 tries; 217: 4 stars, 2 tries; 225: 5 stars, 4 tries). 200 and 225 are the boards in `data/qualified-200-225.jsonl`. **217 is the one in `knobs-v1/closest-assignment.jsonl`; it may not be byte-identical to the board Dennis played** (no 217 is in the qualified file).
- The other 16 qualified boards (no stars).
- 9001-9003: the three why-hard-v1 study boards (`reference/examples.json`, designs from `knobs-v1/boards.json`). Dennis never rated them.
- Groups: liked = 4-5 stars (10 boards: factory2-175, factory4-175, factory4-176, factory6-188, blind1-187, blind1-194, blind1-185, release163-175, 225, 217); disliked = 1-2 stars (7: factory1-175, 1-184, 1-189, 2-192, 3-176, 6-184, release163-185); mid = 3 stars (6); unrated (23).
- Boards ran as played (their own clock.n), 40 family campaigns each with the pinned fast ruler on the CURVE seeds. Forks for B1/B2 come from engine.classify on the witness (no authored traps on these boards). A2 excluded as agreed.

## 2 Static gates
Passes, liked of 10 / disliked of 7 / all 46 (from the json group tables and rows):
| Gate | liked | disliked | all | reading |
|---|---|---|---|---|
| A1 | 1 | 0 | 7 | old-process boards; not judgeable |
| A3 | 2 | 6 | 25 | clock legality (old spares, peek pairs) |
| A4 | 4 | 7 | 33 | see below |
| A5 | 4 | 6 | 32 | liked fail more than disliked |
| A6 | 9 | 7 | 41 | no discrimination, no harm |
| A7 | 0 | 2 | 3 | see below |
| A8 | 10 | 7 | 46 | flag only |
| all of A1-A7, A9 | 0 | 0 | 0 | |

- A4: the test itself (per-spare ok) passes 9 of 10 liked and 7 of 7 disliked boards (`e5-auc.json` A4logicOnly). It fails 6 liked boards in the shipped form because `okSpares` is empty when k + spare > 19. 17 of the 46 boards have k > 16 (`kLarge`). That is the clock-length cap, not a hidden single order.
- A5 (priced detour): fails 6 of 10 liked boards. These boards were not built for it, so E5 cannot calibrate it.
- A6: 225 is the one liked failure (one fork, move [29,47] at move 10, where the only winning moves are not goal-directed under some deal).

### A7 in its three sub-checks
| Sub-check | liked pass (of 10) | disliked pass (of 7) | all 46 | AUC, liked score higher |
|---|---|---|---|---|
| unrelieved = 0 | 1 | 4 | 17 | 0.74 (liked have more unrelieved moments) |
| tightBlind <= 1 | 1 | 4 | 16 | 0.79 (liked have more tight blind moments) |
| winnable in all 4 deals (the real one plus 3 re-deals) | 1 | 2 | 8 | 0.61 (liked lose more re-deals) |
| all three | 0 | 2 | 3 | |
Medians: liked boards have 2 unrelieved luck moments and 3 tight blind moments, disliked boards 0 and 0. Every sub-check rejects liked boards more often than disliked ones. The one A7 case that matches a complaint is factory6-184 ("digging without seeing" = guessing): u=3, tb=4, 3 of 4 deals lost. But factory4-176 (4 stars, "fun") has u=2, tb=3, 3 of 4 lost, and A7 cannot tell them apart. Decision: report-only, all three numbers logged.

## 3 Trace gates (40 campaigns, as-played spare)
Group medians of the measured values (liked / disliked): D 8.9 / 2.6; B1 bite 0.99 / 0.05; B2 0.25 / 0.08; B3 0.18 / 0.18; B4 delay 3 / 1.25; B5 0.001 / 0.013; B6 0.36 / 0.70; B7 0.35 / 0.05. AUC for liked scoring higher: B1 0.81, B2 0.69, B3 0.43, B4 0.66, B5 0.25 (lower is better, matches the design), B6 0.32 (lower is better, matches), B7 0.80 (wrong way, so report-only).
Caution: most disliked boards are "too easy" (D 1-7), so B1 and D largely measure easiness. Six of the seven disliked boards have only 1 to 62 lost tries.

At the shipped thresholds (pass/fail/undecided, liked): B1 9/1/0; B2 3/7/0; B3 6/4/0; B4 8/2/0; B5 10/0/0; B6 5/5/0. Only 1 board of 46 passes all six: 217 (4 stars).
Sweeps (`e5-auc.json`): B2 >= 0.5 passes 3 liked and 0 disliked, >= 0.2 passes 6 and 1, >= 0.1 passes 6 and 3. B4 <= 6 passes 8 liked and 5 disliked, <= 10 passes 10 and 6.

### Late squeeze (Dennis label on 3 boards)
| board | B5 value | B5 | other failures |
|---|---|---|---|
| factory1-184 | 0.17 | fails | B1, B2, B6 |
| release163-185 | 0.49 | fails | B1, B2, B4 (delay 12), B6 |
| factory6-184 | 0.00 | passes | B2, B4 (delay 8), B3 (first error median 0.06) |
B5 catches 2 of 3. factory6-184's complaint is about the end of the board, but the bot has no late tray losses on it. The family bot does not reproduce this one; other gates reject it.

## 4 Decisions per gate (confidence in `gates-calibrated.json`)
- Keep: A1, A2, A3, A4, A6, A8, A9, B1 (0.15), B5 (0.10).
- Report-only: A5 (low confidence; the data does not test it), A7 and its three sub-checks (medium confidence; it points the wrong way), B7 (as designed).
- Change: B2 min 0.5 to 0.20, B3 min 0.15 to 0.08, B4 max 6 to 10, B6 max 0.40 to 0.65 (all low confidence). B6 at 0.65 admits 225 and is fitted to that single board, so fall back to report-only if E6 shows it letting bad boards through.
- Re-scored with those values (`e5-calibrated-rescore.json`): trace gates pass 5 of 10 liked, 0 of 7 disliked, 1 of 6 mid, 3 of 23 unrated. Static (A4 test plus A6) passes 9 of 10 liked and 7 of 7 disliked. Together 4 liked, 0 disliked. 225 passes the calibrated trace gates but still fails A6, which stays a real finding to look at. The 3 late-squeeze boards still fail.
- 50% of liked boards still fail: under the 70% kill line but not a clean pass. Low power: 10 liked, 7 disliked, one rater, boards from older processes with different clocks. Re-check the thresholds on fresh builds in E6.

## 5 Code changes
- `static_gates.js`: A7 reads `o.thresholds.A7 = { unrelieved: 0, tightBlind: 1, lostDeals: 0 }` (defaults unchanged).
- `traces.js`: `opts.thresholds` overrides `THRESHOLDS` key by key through `mergeThresholds`; traceGates uses a local `TH` (defaults unchanged).
- `node --test` on test_static_gates.js and test_traces.js: 19 of 19 pass after the change.

## 6 Not done
- 17 lab boards have no tiles; 9001-9003 are unrated; the 217 board identity is uncertain.
- B gates ran as played, no spare sweep.
- No new tests for the options (existing tests cover defaults).
