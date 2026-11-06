# What makes a board hard: board descriptors vs the bots (2026-11-06)

Builder v2, phase 1 (SPEC.md section 3). For each of the 1,989 boards in `data/training-data.json` the board itself
was measured without any bot (`tools/builder/describe.js`): the alarm-clock frame, what has to go before what,
how full the tray gets on the way to the clock, the hidden (face-down) tiles, where the pressure sits, and where
the clock sits on the pile. Then each measure was compared with the family bot's rating (expected tries) and the
skilled bot's rating. Only simple things: medians, rank correlations ("rho": 0 = no link, 1 = perfect order,
negative = the opposite way; with ~450 boards anything under about 0.1 is noise, with ~1,250 under about 0.06)
and the single best cut-off for each measure. Every number: `descriptors-analysis.json`; per board:
`descriptors.jsonl`.

Two groups of boards behave very differently, so they are reported apart:

- **Historical boards** (1,461): real factory output. The factory tuned every one of them towards a target
  rating, so their measures trade off against each other (more face-down tiles, then a looser clock, and so on).
  That flattens every single link. Also: 202 of them were rated by an older family bot that rates much lower
  (median 5.3 tries against 11.1) and that supplies 34 of the 55 "easy" historical boards. The family numbers below
  use only the 1,259 boards of the current bot (the one that also rated all skilled boards).
- **Experiments** (528): built on purpose to vary one thing (calm pieces with and without a clock, clock frames,
  conditional singles and pairs). They have almost no face-down tiles, and only 5 of them are hard for the skilled
  bot, so they tell us about the family and nearly nothing about the skilled player.

"The way" below is the shortest way to take the clock (exact search, `lab/exact.js`). "3 waiting" counts the moves
on that way after which 3 tiles wait in the tray (one more single loses). A "luck moment" (roomProfile, as in
design_traps.js) is a take that uncovers an unseen face-down tile while 2 or more tiles wait, on the emptiest way
the beam search finds.

## 1. What makes a board hard for the family

**The clock way and the tray on it.** This is the family's main driver, clearly in the experiments, weakly in the
historical boards.

- Experiments: no clock means no difficulty (boards without a clock: family about 1.0 try; "has a clock" rho 0.74).
  With a clock, the number of moves with 3 waiting on the way: 0-1 -> family median 1.3 tries, 2 -> 2.5,
  3 -> 3.5, 4 or more -> 7.1 (rho 0.73). Cut-off "3 or more": 52 of the 54 hard boards (family >= 9) and only 31 of
  the 135 easy ones (<= 4). The length of the way says nearly the same (rho 0.66): 1-5 moves -> 1.5 tries,
  6-8 -> 2.2, 9-11 -> 7.1, 12+ -> 9.8. Tight moments with no relief in sight (2+ waiting, no tray match and no peek
  pair available) rho 0.57.
- Historical boards (current bot): same direction, much weaker. Singles parked on the way rho 0.20, moves with 3
  waiting 0.19, way share (moves / tiles) 0.19, way length 0.18. Within one factory batch these halve (0.07-0.11).
  In plain numbers: way of 1-6 moves -> family median 9.6, 58% of boards at 9+; 13-15 moves -> 12.4, 79%.
  3 waiting on the way 0 times -> 9.8 (60% at 9+); 6 or more times -> 12.2 (78%).
- Face-down tiles: boards with almost none are not easier for the family (65 boards with at most 10% face-down:
  median 11.6). Across the historical boards more face-down tiles even go with slightly *lower* family ratings
  (rho -0.19, within batches -0.09): that is the factory compensating, not the tiles making it easier. The 21
  "easy" current-bot boards are a special set with hardly any face-down tiles (median 4%), so the cut-offs on
  face-down measures in that comparison describe that set, not a rule.

## 2. What makes a board hard for the skilled player

**Hidden tiles you must dig into while the tray is already busy.** Nothing about the clock way matters here.

- Luck moments (historical, 464 boards with a skilled rating): 0 -> skilled median 1.13 tries, 9% of boards at
  2.5+; 1 -> 1.95, 28%; 2 -> 2.17, 38%; 3 or more -> 3.33, 53% (rho 0.33, within batches 0.27).
- Room (3 minus the most tiles waiting at a luck moment): room 2 or 3 -> 8-10% of boards at 2.5+; room 1 -> 35%.
- Face-down tiles taken on the stored way to the clock: 0 -> 10% at 2.5+; 5 or more -> 60% (rho 0.30, and 0.31
  within batches: the link that holds best inside one batch).
- The overall face-down share: rho 0.27 (within batches 0.16).
- The clock way: way length rho -0.03, moves with 3 waiting -0.07. The skilled bot plans the clock way and does
  not care how tight it is.

## 3. Where the two differ

| measure | family (rho) | skilled (rho) |
|---|---|---|
| moves with 3 waiting on the clock way | 0.19 (experiments 0.73) | -0.07 |
| clock way length | 0.18 (experiments 0.66) | -0.03 |
| luck moments | 0.05 | 0.33 |
| face-down tiles taken on the way to the clock | -0.03 | 0.30 |
| face-down share | -0.19 | 0.27 |

The family loses to the clock and the tray on the way to it; the skilled player loses only to luck (unseen tiles
uncovered with the tray already at 2). A board can be hard for one and easy for the other. To make a board harder
for skilled players without making it much harder for the family: put face-down tiles on the way where the tray
is at 2. To make it harder for the family only: a longer, tighter clock way with an open board (few hidden tiles).

## 4. The hard part of the gate: family 9-14, skilled 2.5+ or not

443 historical boards, 130 of them at skilled 2.5+. No single measure separates them well (best balanced accuracy
0.61, where 0.5 is a coin flip and 1.0 perfect):

- Room 2 or more at every luck moment: only 9 of those 100 boards reach skilled 2.5+. With room 1: 121 of 343
  (35%). So a luck moment at 2 waiting is close to *necessary* for a skilled-hard board, but far from enough.
- 2 or more luck moments: 86 of 222 boards (39%) reach 2.5+, against 44 of 221 (20%) with fewer.
- 3 or more face-down tiles taken on the way to the clock: 60 of 154 (39%) against 70 of 289 (24%).
- Nothing about the clock frame, the specials or the stage helps here (all below 0.6).

## 5. Measures that do (almost) nothing for either bot on the historical boards

- Pile size (tiles) and number of layers.
- The clock under a lock (family median 11.7 with, 10.9 without; rho 0.06) or frozen (10.4 vs 11.2); extra "must go first"
  rounds that ice and locks add (peel rounds); how deep the ice sits.
- Long calm stretches of the stored solution (calm run, calm share on historical boards).
- The clock's spare: spare 1, 2 and 3 give the same family median (11.1-11.4) and skilled median (1.6-2.1); only
  spare 4+ is a bit easier (10.4). In the experiments a smaller spare does help (rho -0.29).
- Where the clock sits (top layer, edge, distance from the centre): no link on historical boards.
- Two of Dennis's patterns cannot be tested here: "free cruising, then a crunch at the very end" never happens on
  a stored solution (0 of 1,989: no board has the tray at most 1 for the first 60% and 3 at the end), and no clock
  sits on a separate island (no board has a separate island by touching tiles).

## Limits

- All links are weak on the historical boards (best rho 0.19 for the family, 0.33 for the skilled bot). These
  measures explain a small part of the rating; most of it lies in the order of play the bots choose, which is what
  the decision traps (engine.js, not done yet: the `traps` field is empty) are meant to catch.
- Peek pairs: a turned-over face-down tile and its free twin go together without a tray slot, even with 3 waiting.
  describe.js counts them (as relief, apart from face-up pairs) and does not put the first tile of a peek pair in the
  tray. But the exact clock search (`lab/exact.js`) does not know this rule: its shortest way can be longer than the
  game's, so way length and spare can be slightly off where a peek pair helps (the shortest way contains a
  peek pair on 386 of 1,739 clocked boards). roomProfile (luck moments) does not know it either.
- The tray on the way follows one shortest way (and the stored solution); another shortest way can be calmer.
- Exact search budget 150,000 nodes / 1.5 s per board: 1 of 1,739 clocked boards unresolved (left out of the way
  measures). The whole run took 8 CPU-minutes (median 63 ms for the exact search).
- Experiments have only 5 skilled-hard boards: their skilled correlations (up to 0.4-0.6) rest on tiny
  differences (1.00 vs 1.05 tries) and should not be trusted.
- "Within one batch" numbers average the board groups (`group`) of 8+ boards; where few groups vary (picture
  rarity), they are left out here.
