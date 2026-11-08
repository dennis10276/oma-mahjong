# E7: re-dial or replace the kept 200-225 boards

Experiment E7 of `source/analysis/builder/process-design-synthesis.md` section 7. Written 2026-11-07. These are proposals for Dennis only. Nothing in the game, in source/www, in Firebase or in main was changed.

**Kill verdict: the E7 kill fires for 16 of the 18 boards.** The kill rule says a board with no spare that could ship at its slot, or one failing A2/B/C, goes to Dennis as "replace". Result: 1 keep (206, at spare 1), 1 re-dial (220, to spare 3), 16 replace. Even the two survivors are off their slot target by more than the tolerance, so they need a fresh ACCEPT-block rating before anyone ships them.

Sources: `e7-boards.jsonl` (one row per board, all numbers below), `e7-rework.json` (verdicts), script `source/tools/builder/loop/research/e7_rework.js` (run through heavy.js, about 20 min wall). Boards: `source/analysis/builder/data/qualified-200-225.jsonl` (18 boards, targets from that file).

## How each board was judged
- Dial curve spares 0-3 on the pinned fast family ruler (family-key-memory-v1-fast), CURVE block, 80 campaigns per spare. Shippable = the dial_curve.js rules (monotone, tighter neighbour, not censored, clock.n 19 or less, release-test spare 1-3).
- Planner S at spare 2 (planner-fast-v1). Floor 2.2 (skilled floor 2.5 minus margin 0.3, the run_pipeline default).
- Static gates A1-A9: the rows of `e5-static.jsonl` (same tool, same boards, run in E5). Gate set from E5's calibration: A3, A4, A6, A8, A9 decide; A1, A2, A5, A7 are report-only (A1/A2 cannot be judged on old-process boards, A5 and A7 were demoted by E5).
- Traces B1-B7 with the E5 calibrated thresholds (B2 min 0.20, B3 min 0.08, B4 max 10, B6 max 0.65), 40 campaigns, at each spare that could ship and A4 allows.
- Counterfactuals C1 at each such spare, C2/C3 once (planner face-up vs as is).
- Pick: of the spares passing everything, the one whose curve D is closest to the slot target. Tolerance max(1, 10% of target). More than 2.5 times the tolerance away means replace.
- Caveat: D here is the 80-campaign CURVE value (SE 0.7-0.8 tries at D 10), not the value of record. Any keep or re-dial needs an ACCEPT-block rating before it ships.

## Verdicts
| Lvl | Target | k | Stored spare | D at spare 0/1/2/3 | S | Verdict | Reason |
|---|---|---|---|---|---|---|---|
| 200 | 10 | 3 | 1 | 11.02 / 9.64 / 9.6 / 10.15 | 4.88 | replace | every shippable spare fails the trace or counterfactual gates (s1: B2+B6; s2: B1+B2+B6; s3: B1+B2+B6) (report-only flags: A1, A2, A7) |
| 201 | 10.08 | 9 | 1 | 9.5 / 10.05 / 6.46 / 5.72 | 5.3 | replace | fails static gate A6 (report-only flags: A1, A7) |
| 202 | 10.17 | 9 | 4 | 16.31 / 15.98 / 12.15 / 10.98 | 4.7 | replace | every shippable spare fails the trace or counterfactual gates (s3: B6) (report-only flags: A1, A2, A7) |
| 203 | 10.25 | 14 | 4 | 17.87 / 15.38 / 14.05 / 11.91 | 5.15 | replace | fails static gate A6 (report-only flags: A1, A2, A7) |
| 204 | 10.33 | 15 | 3 | 8.45 / 8.25 / 8.02 / 8.16 | 2.98 | replace | no spare is both curve-shippable ([3]) and allowed by A4 ([]) (report-only flags: A1, A2, A5, A7) |
| 205 | 10.42 | 11 | 1 | 8.55 / 2.44 / 2.25 / 1.64 | 2.08 | replace | planner S 2.08 is under the skilled floor 2.2 (report-only flags: A2, A7) |
| 206 | 10.5 | 7 | 1 | 8.9 / 9.1 / 7.9 / 8.08 | 2.2 | keep at spare 1 | stored spare passes the gates: D 9.1 at spare 1 vs target 10.5 (outside tolerance 1.05; closest available) (report-only flags: A1, A2, A7) |
| 207 | 10.58 | 32 | 1 | 11.95 / 10.59 / 6.15 / 6.28 | 2.83 | replace | the dial curve has no spare that could ship (tighterNeighbourUnmeasured, probeOnly, releaseTestSpare, clockOver19, cliffAtTighterNeighbour) (report-only flags: A1, A2, A5, A7) |
| 209 | 10.75 | 10 | 3 | 18.73 / 17.92 / 9.48 / 10.44 | 2.15 | replace | planner S 2.15 is under the skilled floor 2.2 (report-only flags: A1, A2, A7) |
| 211 | 10.92 | 21 | 2 | 18.62 / 18.23 / 11.2 / 10.69 | 3.33 | replace | the dial curve has no spare that could ship (tighterNeighbourUnmeasured, censored, probeOnly, releaseTestSpare, clockOver19, cliffAtTighterNeighbour) (report-only flags: A1, A7) |
| 212 | 11 | 5 | 3 | 10.92 / 11.42 / 10.16 / 10.61 | 3.42 | replace | every shippable spare fails the trace or counterfactual gates (s1: B6; s2: B1+B2+B6; s3: B1+B2+B6) (report-only flags: A1, A2, A7) |
| 213 | 11.08 | 15 | 1 | 5.46 / 4.39 / 4.5 / 3.59 | 2.02 | replace | planner S 2.02 is under the skilled floor 2.2 (report-only flags: A2, A7) |
| 218 | 11.5 | 17 | 3 | 20 / 20 / 13.08 / 11.47 | 6.45 | replace | the dial curve has no spare that could ship (tighterNeighbourUnmeasured, censored, probeOnly, releaseTestSpare, cliffAtTighterNeighbour, clockOver19) (report-only flags: A2, A7) |
| 220 | 11.67 | 14 | 2 | 18.84 / 18.72 / 11.42 / 13.01 | 4.47 | re-dial at spare 3 | stored spare is 2; D 13.01 at spare 3 vs target 11.67 (outside tolerance 1.17; closest available) (report-only flags: A1, A2, A7) |
| 222 | 11.83 | 9 | 5 | 19.12 / 19.13 / 14.63 / 16.54 | 2.7 | replace | fails static gate A6 (report-only flags: A1, A7) |
| 223 | 11.92 | 13 | 2 | 20 / 20 / 18.27 / 18.29 | 4.45 | replace | every shippable spare fails the trace or counterfactual gates (s2: B2+C1; s3: C1) (report-only flags: A1, A2, A7) |
| 224 | 12 | 20 | 2 | 12.89 / 13.07 / 10.49 / 10.72 | 5.75 | replace | the dial curve has no spare that could ship (tighterNeighbourUnmeasured, probeOnly, releaseTestSpare, clockOver19) (report-only flags: A1, A2, A5, A7) |
| 225 | 13 | 21 | 3 | 16.14 / 16.85 / 11.25 / 12.74 | 1.65 | replace | fails static gate A6 (report-only flags: A1, A2, A7) |

D at spare 0/1/2/3 and S are from `e7-boards.jsonl` (curve.points, planner.S). A "20" is the cap (censored).

## What the numbers say
- **Gates that killed boards.** A6 (a fork whose only win is not goal-directed under some deal) fails 201, 203, 222, 225. Trace or C1 gates fail every shippable spare on 200, 202, 212, 223. The planner is under the skilled floor on 205 (2.08), 209 (2.15), 213 (2.02). The dial curve or A4 leaves no shippable spare on 204, 207, 211, 218, 224. Counts: 4 + 4 + 3 + 5 = 16.
- **The synthesis's expectations.** "205 and 213 cannot be raised by spare": confirmed. 205 sits at D 8.55 at spare 0 and falls to 2.4 at spare 1; 213 sits at D 3.6-5.5 at all spares, against targets of 10.4 and 11.1. Both also fail C1 (reference bot 12.3 vs key-memory 2.25 on 205 at spare 2; 11.0 vs 4.4 on 213 at spare 1), so they are rated by forgetting keys. "223 may come down": no. It stays at D 18.3 at spares 2 and 3 (20 at 0 and 1) against 11.92, and fails C1. "200, 202 and 212 break the hidden-route rule": confirmed by B1 (bite 0 at spare 2-3) and B2 (0) on 200 and 212, and by B6 on 202.
- **Long boards.** 207 (k 32), 211 (k 21), 224 (k 20), 225 (k 21) need clock.n over 19 at every spare, which the A3/dial rules forbid (clockOver19). The ruler itself does show D 10-12.7 at spares 2-3 on 207, 211, 224, 225, so the problem is the clock-length cap, not difficulty. This is the same cap E5 raised as a separate decision for Dennis.
- **225 (Dennis: 5 stars, 4 tries).** Replace by the rules: A6 fails (E5 finding) and k 21 breaks the 19 cap. Its planner S is only 1.65 here; Dennis's own win overrides the planner on boards he played. If Dennis wants 225 kept as played, it is outside the rules and should be a conscious exception.
- **200 (Dennis: 3 stars, "shape not the most fun").** Replace; the board is easy to see through (bite 0 at spares 2-3), D 9.6-11.0 on target but for the wrong reason.
- **Survivors.** 206 keep at spare 1: traces and C1 pass at spare 1 only (spares 2 and 3 fail B2+B6), D 9.1 against 10.5 (1.4 under, tolerance 1.05); S 2.20 is exactly at the floor. 220 re-dial from 2 to 3: spare 2 is not shippable (spare 1 is 18.7, a cliff against 11.4), spare 3 passes B and C1 with D 13.0 against 11.67 (1.34 over, tolerance 1.17); clock.n would be 17.
- **C1 identical values.** On many boards the reference bot and key-memory bot give identical D to two decimals (for example 200: 9.64 and 9.64). Where a board's keys are never forgotten the two bots play the same, which is expected, but I did not check this board by board.
- **C2.** Passes on all boards except 201 (planner 5.3 as is, 19.9 face-up; already replaced by A6). C3 (report-only) is below 0.5 on several boards, i.e. face-up play is much easier; for example 200 asIs 4.88 vs faceUp 1.02. That means these boards' skilled difficulty comes largely from hidden information.

## Limits
- One 80-campaign CURVE block per spare, so D has SE 0.7-0.8 at D 10 and the 2.5 x tolerance rule is loose in the noisiest cases; no ACCEPT numbers were taken (this was a triage, not an acceptance).
- Static rows are E5's, built with the same tool and boards. A1/A2 fail on most of these boards by construction of the old process and were not used to decide.
- B gates ran with the E5 calibrated thresholds, which E5 itself called low-power (10 liked, 7 disliked boards, one rater) and B6 0.65 is fitted to the single board 225. If B6 is dropped to report-only, 202 would be judged on B6 alone and could come back as a re-dial to spare 3 (D 11.0 vs 10.17); I did not run that variant.
