# Chain traps on the curve — TASK 12

Measured 2026-11-13 on `wip/codex-rate-traps`, based on local `wip/cc-builder-loop` commit `6d6934aa`. **Neither S nor D40 distinguishes Dennis's liked chain puzzles from his two-star puzzles.** The skilled bot solves all six almost immediately; the family bot mostly repeats known losing choices until the cap. The unchanged placement fills **0/40** levels. Nothing here rejects a board or changes the game, bots, pins or gate thresholds.

## Measurements

Every number below is measured; curve locations are arithmetic translations, **not recommended placements**. S uses 80 campaigns per style, taking the better pooled style (the existing cap 20). D uses 160 campaigns, cap 40. Seeds and `extended-40-v1` exactly match `generate.js`/`measure.js`. Stability is the minimum +1/+2 D40 divided by the base D40, on the 40-campaign screen seed. B1–B7 use the same 80 CURVE campaigns, cap 40, and `e5-v1` trace options as the generator, without its early filters.

B6 is the share of terminal losses after taking the clock. B2 is the share of proved first errors matching the **default engine/witness forks**, not necessarily the authored bait. B7 counts repeated losing moves from the same state on lost tries 6–40; its field name `lossesTries6to20` is a legacy name. Shares are fractions.

| Board | Chain / layout / tiles | Dennis stars / tries | D40 (SE) | S | Stability | Post-clock B6 | Repeat B7 | Trap errors B2 | Where terminal loss occurs | Curve level |
|---|---|---|---|---|---|---|---|---|---|---|
| 281 | keyOnClock / L7 / 80 | 2 / 1 | 39.78 (0.22) | 1.13 | 0.84 | 0 | 0.958 | 0 | mostly before clock | 756.7 (beyond requested range) |
| 286 | wrongMelt / L0 / 80 | unrated | 39.76 (0.24) | 1.08 | 0.61 | 0.385 | 0.923 | 0.001 | mostly before clock | 756.4 (beyond requested range) |
| 287 | wrongMelt / L3 / 80 | unrated | 36.41 (0.83) | 1.05 | 0.13 | 0.393 | 0.809 | 0.037 | mostly before clock | 706.15 (beyond requested range) |
| 291 | clock<ice; thaw<lock; keyA<cover:ice / L46 / 74 | 5 / 3 | 39.77 (0.23) | 1.02 | 1 | 0.952 | 0.923 | 0.008 | mostly after clock | 756.55 (beyond requested range) |
| 292 | clock<lock; clock<cover:ice; coverThaw<ice; keyA<cover:ice / L12 / 88 | 4 / 2 | 35.44 (0.8) | 1.08 | 0.16 | 0.001 | 0.712 | 0.057 | mostly before clock | 691.6 (beyond requested range) |
| 293 | clock<cover:ice; coverThaw<lock / L9 / 76 | 4 / 1 | 40 (0) | 1.02 | 1 | 0 | 0.941 | 0.005 | mostly before clock | 760 (beyond requested range) |
| 294 | clock<lock; keyA<cover:ice / L1 / 76 | 2 / 1 | 39.76 (0.24) | 1.08 | 0.98 | 0 | 0.957 | 0.977 | mostly before clock | 756.4 (beyond requested range) |
| 295 | clock<lock; clock<cover:ice / L6 / 84 | 2 / 1 | 40 (0) | 1.02 | 1 | 0 | 0.966 | 0.994 | mostly before clock | 760 (beyond requested range) |
| 296 | clock<ice; thaw<lock / L8 / 84 | 2 / 2 | 35.88 (0.72) | 1.04 | 0.97 | 0.002 | 0.947 | 0.027 | mostly before clock | 698.2 (beyond requested range) |
| examples--keyOnClock-15 | keyOnClock / L15 / 80 | unrated | 4.54 (0.16) | 1.08 | 0.86 | 0.045 | 0.552 | 0.08 | mostly before clock | 228.1 (below 5) |
| examples2--guardedKey-1 | guardedKey / L1 / 76 | unrated | 39.83 (0.17) | 1.13 | 0.8 | 0 | 0.875 | 0.077 | mostly before clock | 757.45 (beyond requested range) |
| examples2--keyOnClock-6 | keyOnClock / L6 / 84 | unrated | 40 (0) | 1.15 | 1 | 0 | 0.968 | 0 | mostly before clock | 760 (beyond requested range) |
| examples2--keyOnClock-8 | keyOnClock / L8 / 84 | unrated | 40 (0) | 1.06 | 1 | 0 | 0.968 | 0.008 | mostly before clock | 760 (beyond requested range) |
| examples2--lockedMelt-36 | lockedMelt / L36 / 76 | unrated | 39.68 (0.21) | 1.02 | 1 | 0 | 0.965 | 0.005 | mostly before clock | 755.2 (beyond requested range) |
| examples2--wrongMelt-20 | wrongMelt / L20 / 84 | unrated | 15.51 (1.46) | 1.15 | 0.98 | 0.502 | 0.874 | 0.042 | mostly after clock | 392.65 (beyond requested range) |


The inverse curve is `L = 250 + 15 × (D40 − 6)`; ±1 try means ±15 levels around that central location, subject to tile size. Levels 250–289 target 6–8.6 tries; their union of tolerance bands is 5–9.6. One board is below 5, and all fourteen others are above this segment's reach. No board has 96 tiles for the four big slots. A cap-40 ruler reaches its measurement ceiling at the arithmetic location 760; it cannot resolve true expected tries beyond that. **D40=40, SE=0 means every campaign hit the cap, not that true difficulty is known exactly.**

Additional measured detail for the six chain boards:

| Board | D20 / median / censored % | D40 with +1 / +2 clock moves | Skilled first wins /80 | Proved harmful authored bait: S /80; family /160 |
|---|---|---|---|---|
| 291 | 19.89 / 40 / 99.375% | 39.23 / 40 | 78 | 0; 2 |
| 292 | 18.86 / 40 / 77.5% | 36.5 / 5.88 | 75 | 0; 18 |
| 293 | 20 / 40 / 100% | 39.83 / 39.83 | 78 | 0; 155 |
| 294 | 19.88 / 40 / 99.375% | 39.2 / 40 | 74 | 0; 145 |
| 295 | 20 / 40 / 100% | 40 / 40 | 78 | 0; 155 |
| 296 | 19.22 / 40 / 76.25% | 34.55 / 35.13 | 77 | 0; 1 |

The stability base for 292 was 37.53 on the screen seed: +2 moves drops it to 5.88, ratio 0.16. This is a clock cliff, not stable family difficulty.

## Do the bots see the trap?

**Measured agreement:** over the six chain boards, Spearman correlation with stars is S −0.32, D40 +0.05; with Dennis's tries it is S +0.02, D40 −0.50. These six observations are descriptive, not a calibration. Board 291 (five stars, three human tries) and 294 (two stars, one try) have indistinguishable D40: 39.77±0.23 versus 39.76±0.24 SE. Boards 293 and 295 both have S=1.02 and D40=40, despite four versus two stars. Dennis also won both first try: enjoyment and tries are different targets.

**The skilled bot does not register 291's human trap difficulty.** Its S is 1.02 against Dennis's three tries. It consistently plans through the trap: 77/80 first attempts use the same pre-clock sequence `71,69,73,67,68,72,0,61,57,63`. It thaws cover 72 before taking free key 0, then takes its partner 61. On 292 it mostly avoids the authored wrong-neighbour tiles entirely; on 293 it avoids them in all 80 first attempts. Across all six boards there are zero proved harmful authored-bait choices by S, and zero wins after such a choice. **Inference:** this is systematic search/planning, not lucky recovery: the selected controllers use route/beam and tray lookahead, and their opening paths repeat across seeds. Exact causal attribution to a particular search term would require an ablation, which was not performed.

**The family bot sees some baits, but its rating mainly measures failure to learn.** All six have B7=0.712–0.966; every counted repeated mistake is a remembered choice. On 293, 294 and 295 it takes a harmful authored bait from a still-winnable state on 155, 145 and 155 of 160 first attempts. On 291 and 296 those counts are only 2 and 1: most first errors are other early off-route choices. On 292, only 18 first attempts first become lost at the authored bait; others have already made a different losing choice. A later bait-tile tap from an already-lost state is not counted as its cause.

Default B2 misses many authored single-tile baits: `defaultForks` lists pair/match/twin/peek-pair temptations along the witness. Thus 293's B2=0.005 **does not mean the authored trap was avoided**. The supplementary state-specific capture above is the relevant check. On 291, 95.2% of losses end after taking the clock, but all proved first errors precede it: this is delayed damage from the opening, not evidence of a difficult second act. Its median first error is only 2.7% through the board. On 292–296 nearly all terminal losses are before the clock. Full error kinds, loss kinds and examples are in each card.

## Placement and exact exceptions

The requested unchanged run fills **0/40**, with zero constraint violations because all slots remain holes. Every board is below S=1.75, every B7 exceeds 0.3, and none has a size/curve-compatible slot. Eleven also fail the measured late-loss minimum of 0.25; seven conflict with the existing ledger. `summary.json` lists each board's independent blockers and exact ledger reasons.

To use the three liked puzzles **as-is in small slots within 250–289**, these rules would have to be overruled:

| Puzzle | Required exceptions |
|---|---|
| 291 | S minimum (1.02); B7 maximum (0.923); curve tolerance (D40 39.77); recent-layout ledger: layout 46 overlaps lab 263/layout 14 by 78.4%, and lab 271/layout 23 by 77.0%. B6=0.952 passes the placement minimum. |
| 292 | S minimum (1.08); B7 maximum (0.712); curve tolerance (35.44); late-loss minimum (0.001); recent-layout ledger: layout 12 already used in lab 254. |
| 293 | S minimum (1.02); B7 maximum (0.941); curve tolerance (40); late-loss minimum (0). No conflict with the ledger currently loaded by `place.js`. |

No skilled maximum, matching-body uniqueness or small-slot size exception is needed for these three. Placing all three in lab order adds no mutual ledger conflict. At their original numbered levels 291–293 the targets would be 8.733, 8.8 and 8.867, so the same curve problem remains. Five-level smoothing cannot be assessed with all holes; the four 96-tile slots also need other boards.

Placement does **not** re-run stability or the generator's B1–B6 admission gates. Separately, 292 fails the generator's stability minimum 0.55; all three fail B2/B3, and 291 fails the calibrated `e5-v1` trace B6 maximum 0.65 (distinct from placement's B6 minimum). Those are additional bank-admission issues, not extra rules secretly applied by this placement run. The existing ledger loads ten entries from labs 2/3; it omits labs 4/5. Its lack of a conflict is not proof that replaying a lab board would satisfy Dennis's broader no-reuse preference. No exceptions were applied.

## One number worth testing

**Proposal, supported only on this sample:** report the first-try *avoidance of engine/witness bait*, `1 − B1.bites/B1.firstTries`, alongside S and D. It is **16.25%, 2.5%, 10%** on 291–293 versus **0%, 0%, 0%** on 294–296; rank correlation with stars is +0.984. It separates the liked boards here, whereas tries do not. Lower B7 also happens to separate them, but its narrow 0.941/0.947 boundary is especially fragile.

This is a post-hoc diagnostic, not a proposed gate threshold or a validated fun score. B1 matches listed witness-bait tiles across states and can count a later harmless tap; it is not the state-specific authored-bait measure above. With only two avoiding campaigns on 292, independent seeds and more human-rated boards are needed before trusting the separation. No bot was changed.

## Coverage, limits and reproduction

Measured all 15 design JSONs present in `examples`/`examples2`, including the three named lab-4 files and all six lab-5 chains. Their input snapshots are in `inputs/`. The six lab-5 designs and lab-4 281/286/287 match the served lab boards by board hash; all 15 stored solutions replay legally to a complete win. Lab-4 286/287 have no completed play or stars and are marked unrated. `keyOnClock-15.json` is layout 15, not the layout-31 board rated at 282, so its rating was not transferred. The source card calls 293's chain length 2; the exact dependency description is retained rather than relabelled to match the prose summary.

All 15 final cards are `bank-puzzle-v1` under `source/analysis/builder/bank/traps/`, with raw campaign tries, both skilled styles, D20/D40/median/censoring/SE, full stability samples, B1–B7, fingerprints, loss/error kinds and examples. Supplementary first-try captures on the FULL seeds reproduce every campaign's capped tries exactly. Across the main traces: 42,120 attempts, 41,937 losses, all with proved first errors; zero unknown chosen moves, physics mismatches or recoveries. Validation passed for every card.

What could not be measured: uncapped expected tries on heavily censored boards; a causal search ablation; generalisation of the proposed diagnostic. `examples3` existed but contained only `_index.json` and no board designs at the final snapshot. No bot measurement was omitted. No real-player data or Firebase was accessed.

The initial one-job scheduler waited without running campaigns. After Dennis's “Cpu now new locks” update, this checkout adopted the supplied shared scheduler (upstream `395a7ec5`: 12 cores, 80% load ceiling). All active jobs stayed under 15 minutes via a 14-minute watchdog; at most six cores were reserved for this task concurrently. The exact successful commands, plus the corrected capture attempt, are in `COMMANDS.md`. Outputs: `summary.json`, `placement.json`/`.md`, `validation-output.json`, input/identity/witness evidence, and the bank cards. A copy of this report is `source/analysis/builder/process-v2/traps-on-the-curve.md`.
