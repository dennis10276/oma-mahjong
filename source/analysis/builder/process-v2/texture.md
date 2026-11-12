# Texture measures and smarter picture placement (2026-11-12)

Tools: `source/tools/builder/bank/texture.js` (measures, no bots), `smarten.js` (optional funnel stage, `generate.js --smart`),
`smart_compare.js`, `paired_screen.js`, `rank_texture.js`, `test_smarten.js`. All numbers below are single runs; n is tiny
(5 lab boards, 23 labelled e5 boards, 115 banked), so read them as hints, not as findings.

## 1. Measures (all along the stored solution, strict rules; before = up to the clock tap, after = after it)

| measure | definition |
|---|---|
| obvious (`obvA`, `obvB`) | share of solution pairs where both tiles are face-up and free in the same step in which the first becomes free, no third copy of the picture is free then, and the tray has room (<= 2 waiting) |
| simul (`simA`) | same, but ignoring competing copies and face-down state |
| adjacent / consecutive (`adjA`, `consA`) | twins touch or stack (abs dx <= 2, abs dy <= 2) / second twin taken within 2 steps of the first |
| real choices (`chA` = hard + cost) | steps with >= 2 sensible moves (match a waiting picture, take a visible free pair, the stored move) that are NOT equivalent: hard = one provably loses (E.winnable lose); cost = all win with the normal tray, but only some still win when the tray holds at most 2 waiting tiles (the others eat tray room). Proof depth: complete search from the position after the move, budget 5000 engine nodes / 20000 nodes for the 2-slot solver (smarten uses 1000 / 800); exhausted budget counts as `unknown`, never as a loss |
| wrong (`wrongA`) | steps where ANY non-fatal legal move (also opening an unrelated tile) provably loses. Broad; mostly measures tray pressure |
| planning (`trayMaxA`, `trayMeanA`, `tray2A`, `waitA`) | waiting tiles per step: max, mean, share of steps with 2+ waiting, longest wait in steps |
| luck | `down` face-down share; `gambleA` steps with 2+ waiting, no safe progress (no visible match, no visible pair) and the stored move taps a face-down tile; `blindA` 2+ waiting and no face-up tile free; `hidTurnsA` taps of face-down tiles; `hidPairs` pairs with both tiles face-down |
| repeats | `rep` pictures with 4 copies, `repOv` their two pairs overlap in time, `rep4` all four copies free in one step, `repCh` choice steps whose options carry the same picture (costly wrong pairing) |

Finding about the definitions: with perfect information the hard choices after the clock are almost always 0 (the board is
rich in forgiving moves); 262 has 1 cost choice after the clock. The "puzzle at the end" Dennis felt is not a perfect-information
choice; it is tray pressure plus hidden tiles. No single measure captured it.

## 2. Lab boards (Dennis)

| lab | stars | down | obvB | obvA | adjA | consA | chA | wrongA | tray2A | waitA | gambleA | hidPairs | rep/repOv |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 262 | 4 | .20 | .20 | .09 | .30 | .91 | 1 | 1 | .20 | 13 | 1 | 5 | 2/2 |
| 264 | 3 | .50 | 0 | .14 | .28 | .92 | 1 | 14 | .41 | 33 | 6 | 11 | 2/1 |
| 261 | 2 | .50 | 0 | .06 | .53 | .91 | 1 | 1 | .05 | 15 | 1 | 10 | 4/0 |
| 263 | 1 | .20 | .17 | .03 | .50 | .41 | 1 | 13 | .32 | 16 | 0 | 5 | 4/1 |
| 254 | ~2 | .21 | 0 | 0 | .38 | .93 | 4 | 15 | .42 | 41 | 3 | 0 | 8/4 |

What matches his words: 261 "too luck based, can't plan": face-down 0.50, 10 hidden pairs, 39 hidden taps, tray2 0.05
(nothing to plan against). 264 has the same luck numbers but more tray pressure (0.41) and he gave 3 stars. 254 "a lot of
the same pairs": 8 repeated pictures, the most of all five. 263 "pairs too obvious": the only measure that singles it out is
the structure (adjacent twins 0.50 together with the lowest consecutive share .41, i.e. twins sit next to each other on the board but are
not played next to each other), not the strict obvious share (0.03). The strict obvious pair share (obvA) does NOT separate
263 from 262; it is low everywhere (0 to 0.14). Honest verdict: the five boards do not separate on any single measure
except the luck ones (261, 264) and the repeats (254).

## 3. e5 labelled boards (older builders; liked = 4-5 stars n=10, 3 stars n=6, disliked = 1-2 stars n=7)

| measure | liked | 3 | disliked |
|---|---|---|---|
| down | .35 | .36 | .39 |
| obvB (pre-clock) | .06 | .18 | .31 |
| obvA | .03 | .06 | .05 |
| adjA | .40 | .30 | .32 |
| chA | 0.6 | 2.3 | 0.7 |
| wrongA | 14.5 | 21.7 | 21.1 |
| blindA | 0.6 | 0.8 | 2.4 |
| gambleA | 12 | 17 | 16 |
| hidTurnsA | 24 | 29 | 30 |
| tray2A | .59 | .66 | .60 |

Direction is consistent with Dennis's words for: obvious pairs BEFORE the clock (0.06 vs 0.31: the disliked boards give the
first act away), blind-only moments (0.6 vs 2.4), gambles (12 vs 16), hidden taps (24 vs 30), face-down share (.35 vs .39).
Not separating: real choices after the clock, tray pressure, repeats, adjacent twins (liked boards even have more). Treat the
first group as candidate measures, none as a gate.

## 4. Smart vs control (generate.js --focus --small, 8 workers, 15 min each, same machine, run one after the other)

`--smart` seed0 500 versus control seed0 520. The specs differ (different seeds, and --smart draws maxDown from 0..0.3), so counts are
comparable per candidate, not per board.

| | smart | control |
|---|---|---|
| candidates | 295 | 403 |
| constructed | 185 | 250 |
| passed static gates | 166 | 217 |
| passed D screen (D>=4.5 and ratio) | 35 | 47 |
| full measure | 29 | 38 |
| banked | 3 | 7 |
| D screen share >= 4.5 | 0.21 | 0.22 |
| D screen mean / median | 5.05 / 2.45 | 6.11 / 2.78 |
| full measure: mean / median D40 | 14.2 / 9.1 | 18.7 / 10.5 |
| full measure: D 5-10 | 11 of 29 (38%) | 15 of 38 (39%) |
| skilled S > 1.75 | 12 of 29 (41%) | 17 of 38 (45%) |
| S in 1.75-6 | 8 | 14 |
| S > 6 | 4 | 3 |
| cpu per candidate | 11.2 s | 8.7 s |

Smarten costs about 5 s of cpu per board that passes the static gates (that is more than the whole D screen of most boards,
which die at D < 4.5 after 1-8 s), so the same 15 minutes bought 27% fewer candidates. The shares that reach D >= 4.5, D 5-10 and
S > 1.75 are the same within noise (n = 29 / 38).

Texture inside the smart run (mean over 166 boards that passed the static gates; smarten changed 117 of them):
obvious after .11 -> .09, simul .14 -> .13, adjacent .45 -> .41, consecutive .78 -> .70, real choices after 1.7 -> 3.0,
2+ waiting share .27 -> .44, repeated pictures overlapping 1.2 -> 1.4, gamble steps 0.39 -> 0.62 (worse: more tray pressure
means more forced face-down taps), face-down share .14 -> .14 (maxDown <= 0.3 in the specs, so the turn-up rarely fires).

Paired check (`paired_screen.js`): the 117 changed boards rebuilt WITHOUT smarten and put through the same D screen (family
bot, 40 campaigns, seed 90002): mean D40 4.29 -> 4.67, median 2.20 -> 2.42, D>=4.5: 21 -> 25 boards, D>=7: 14 -> 17;
17 boards got harder (by more than 0.5), 10 easier, 90 unchanged. Correlation of D change with the J gain: 0.05.
Conclusion: smarter placement moves the texture numbers clearly (choices, tray pressure, fewer adjacent/consecutive pairs) and family D
only slightly (+0.4 on a screen mean of 4, within noise: a sign test on 17 vs 10 gives p about 0.25). It did not make boards unsolvable
for the family or skilled bots (S > 6 in 4 of 29 vs 3 of 38 boards; I did not see failures of the measures, but only the funnel stage counts were checked). It does not by itself produce harder or
better-liked boards; the funnel still decides by measured D and S.

## 5. Banked puzzles that best match 262 (115 banked in total, 6 pass every filter)

Filters: face-down <= 0.30, late-loss share B6 in 0.3-0.6, D40 5-10, skilled S 1.75-6, B7 <= 0.3. Ranking score: real choices after the
clock (cap 4) minus obvious, simultaneous and adjacent pairs, plus tray pressure, minus gamble steps (weights in `rank_texture.js`).
Fewer than 8 qualify, so the list has 6. Only 1 of the 10 boards newly banked by the two runs (daf285e5) qualifies.

| # | boardKey (8) | shape/tiles/story | D40 | S | B6 | B7 | down | obvA | adjA | chA | tray2A | gambleA |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 5623afed | hourglass 76 deepClock | 5.86 | 1.86 | .49 | 0 | .11 | .09 | .17 | 9 | .56 | 1 |
| 2 | 02257721 | diamond 80 deepClock | 5.92 | 1.89 | .57 | .02 | .10 | .08 | .16 | 1 | .48 | 1 |
| 3 | f2cb553e (lab 263, Dennis 1 star) | hourglass 80 lockBeside | 5.84 | 5.10 | .46 | .05 | .20 | .03 | .50 | 1 | .32 | 0 |
| 4 | daf285e5 (smart run) | moon 74 deepClock | 5.03 | 3.46 | .56 | .03 | .30 | .12 | .41 | 2 | .62 | 5 |
| 5 | 62088c71 | hourglass 96 keysFarSide | 6.28 | 2.88 | .43 | .02 | .10 | .16 | .54 | 2 | .17 | 0 |
| 6 | eadb34f1 (lab 262, Dennis 4 stars) | twins 76 lockBeside | 7.64 | 2.41 | .47 | .13 | .20 | .09 | .30 | 1 | .20 | 1 |

Caution: the list contains both the 4-star board (262) and the 1-star board (263), so the filters plus these texture numbers do not
reproduce Dennis's taste; the first two are candidates worth putting in front of him, not recommendations. 263 is excluded in
practice (known: skilled S 5.1 is wrong, it was won first try). Full table: `source/build/bank/texture-rank.json`, all texture rows:
`source/build/bank/texture-banked.json`.

## 6. What did not work / open

- Whole-pair relabelling cannot change which tiles are twins, so it cannot reduce obvious pairs; `smarten` therefore also re-pairs
  (swap of one tile of two late pairs, replay-checked). 30-40% of proposals break the stored solution.
- The trap fork signature changes for some edits even when all trap tiles are untouched (caught by a forkSig check on every candidate that improves the objective).
- The perfect-information "hard choice" is ~0 after the clock on every board; cost choices (2-slot test) are sparse.
- The climb is bounded by cpu time (5 s), so results depend on machine speed and are not bit-reproducible; given the same
  proposals the acceptance is deterministic (seed from the spec's buildSeed).
- Smart specs rarely have more than 0.30 face-down, so the turn-up edit almost never ran in the funnel (it does on older boards: 261 and 264 went 0.5 -> 0.3 / 0.29 in the CLI test, gamble steps 6 -> 0 on 264).
