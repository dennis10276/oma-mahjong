# What makes a board hard: board descriptors vs the bots (2026-11-06)

Builder v2, phase 1 (SPEC.md section 3). For each of the 1,989 boards in `data/training-data.json` the board itself
was measured without any bot (`tools/builder/describe.js`): the alarm-clock frame, what has to go before what,
how full the tray gets on the way to the clock, the hidden (face-down) tiles, where the pressure sits, and where
the clock sits on the pile. Then each measure was compared with the family bot's rating (expected tries) and the
skilled bot's rating. Only simple things: medians, rank correlations ("rho": 0 = no link, 1 = perfect order,
negative = the opposite way; with ~450 boards anything under about 0.1 is noise, with ~1,250 under about 0.06)
and the single best cut-off for each measure. Every number: `descriptors-analysis.json`; per board:
`descriptors.jsonl`. Sections 1-5 are the first run (before engine.js; kept as `descriptors-v1*.json*`); section 6
adds the engine's decision traps and the clock way under the game's own rules (peek pairs), on the same boards.

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

## 6. With the engine: decision traps and the game's own clock way

engine.js (helper A) now proves things on a board. Two new groups of measures:

- **Decision traps** on the stored way up to the clock: at every step the engine checks each move the player could
  make instead and proves whether the level can still be won after it. A *decision point* is a step with at least
  one losing move. A *deep* losing move is one where the player can still make 1 or more moves before the loss is
  forced (not just a 4th tile or a late clock at once). A *tempting* one looks good: a pair, a single whose twin is
  in sight, a tray match, the clock, or a peek pair. *Depth*: how many moves you can still make after it (the engine
  stops counting at 12).
- **The game's clock way**: the fewest moves to take the clock when peek pairs are allowed (k_game, spare_game), and
  the tray on that way (a peek pair takes no slot).

**Decision traps and the family.** They mostly repeat the clock way. The number of decision points goes with the
way length (rho 0.70-0.76 on historical boards, 0.92 in the experiments), so on their own they look as good as the
way: historical rho 0.20 with the family (within batches 0.14); 0-4 decision points -> family median 8.4 (45% of
boards at 9+), 13 or more -> 12.3 (78%). Experiments: 0-2 points -> 1.2 tries, 3-5 -> 2.0, 6-8 -> 8.7, 9+ -> 6.5
(rho 0.70, about the same as "3 waiting", 0.73). Once the way length is held fixed (comparing boards with a way of
1-6, 7-10, 11-14 and 15+ moves separately), what is left for the family is small: decision points 0.14, deep losing
moves 0.07, tempting deep moves 0.07. Tempting traps that lose later: boards with none -> family median 11.0, with
3 or more -> 11.4. For the family, the traps add little that the way does not already say.

**Decision traps and the skilled player.** Here they add something new, but it is still modest.

- On their own they look weak (decision points rho 0.11, deep losing moves 0.16), because longer ways make the
  skilled bot's life slightly *easier*. Holding the way length fixed, they show up: decision points 0.28, deep
  losing moves 0.20, single-winning-move steps 0.20 (all with the skilled rating, 459 boards).
- Deep losing moves are almost unrelated to luck moments (rho 0.03), so this is a second, separate source of
  skilled difficulty next to hidden tiles (luck moments, held the same way: 0.39).
- Example, ways of 11-14 moves: losing moves on the way 0-60 -> 1 of 21 boards (5%) at skilled 2.5+;
  61-100 -> 14%; 101-140 -> 52% (26 of 50); 141+ -> 45% (5 of 11).
- Tempting traps that lose later: on 518 of 1,255 historical boards. Skilled 2.5+ on 23% of boards without one,
  37-38% with one or more. Of the kinds, "a single whose twin is in sight" goes with skilled difficulty (rho 0.15),
  the clock itself slightly the other way (-0.13).
- Depth says little: the deepest losing move is usually at the cap (12 on 638 of 1,259 boards), and the median
  depth has no link (rho 0.01 family, -0.02 skilled). Where a board has tempting deep moves, shallower ones (a loss
  within about 4 moves) go slightly more with skilled 2.5+ (rho -0.22), on few boards.

**The gate (family 9-14, skilled 2.5+ or not).** A tempting trap that loses later: 69 of 186 boards (37%) reach
skilled 2.5+, against 61 of 257 (24%) without one. That is about as good as "3 or more face-down tiles on the
way" (39% vs 24%) and a bit weaker than luck moments (39% vs 20%). The best single cut-off is still a luck measure
(balanced accuracy 0.61); no trap measure beats it.

**The peek-aware clock way does not change the earlier findings.**

- The peek pair shortens the fewest moves to the clock on 223 of 1,739 clocked boards: by 1 move on 111, 2 on 95,
  3 on 15, 8 on 2. So on about 1 board in 8 the clock is looser in the game than the factory's strict check said
  (spare_game above spare on 252 boards).
- The links are the same: game way length with the family rho 0.19 (strict 0.19), with the skilled bot -0.05
  (strict -0.04); moves with 3 waiting on the game way 0.17 (strict 0.20); experiments 0.71 (strict 0.73). The
  experiments have almost no face-down tiles, so there the two ways are nearly identical.
- The game's shortest way often runs fuller: it may sit at 3 waiting and go on with a peek pair. It has more moves
  at 3 waiting than the strict way on 463 boards and fewer on 171.
- Boards where the peek pair saves 2 or more moves are harder for both bots (family median 12.5, 85% at 9+;
  skilled 50% at 2.5+, 18 of 36). These are boards with many face-down tiles, so this is most likely the
  hidden-tile effect of section 2 again, not the peek pair itself.

## Limits

- All links are weak on the historical boards (best rho 0.19 for the family, 0.33 for the skilled bot; with the
  traps, 0.28 for the skilled bot once the way length is held fixed). These measures explain a small part of the
  rating.
- Peek pairs: a turned-over face-down tile and its free twin go together without a tray slot, even with 3 waiting.
  describe.js counts them (as relief, apart from face-up pairs) and does not put the first tile of a peek pair in the
  tray. The strict fields (frame.k, spare, tray.exactWay) come from `lab/exact.js`, which does not know the rule;
  the game's fields (frame.kGame, spareGame, tray.gameWay) and the traps come from engine.js, which does (section
  6). roomProfile (luck moments) does not know it.
- Decision traps follow the stored way, not every way, and the engine knows every picture (a player does not).
  Budget per move: 10,000 nodes / 30 ms, depth search 3,000 nodes. 1,164 move verdicts on 393 boards ran out of
  budget ("unknown"): they are not counted as losing, so losing counts are a little low. The game's clock way was
  unresolved on 22 boards and unsure on 4 (where its finish check ran out, it came out 1 move longer than the strict
  way).
- The second run shared the machine with other helpers: about 12 minutes on 2 workers (25 CPU-minutes summed over
  boards; traps median 118 ms, game way 34 ms per board). Under that load the strict search's 1.5 s ran out on 59
  boards; the strict search is the same in both runs (identical k on all 1,680 boards both resolved), so for 58 of
  them the strict fields come from the first run (done in the analysis, `strictFilledFromV1`).
- The tray on the way follows one shortest way (and the stored solution); another shortest way can be calmer.
- Exact search budget 150,000 nodes / 1.5 s per board: 1 of 1,739 clocked boards unresolved (left out of the way
  measures). The first run took 8 CPU-minutes (median 63 ms for the exact search).
- Experiments have only 5 skilled-hard boards: their skilled correlations (up to 0.4-0.6) rest on tiny
  differences (1.00 vs 1.05 tries) and should not be trusted.
- "Within one batch" numbers average the board groups (`group`) of 8+ boards; where few groups vary (picture
  rarity), they are left out here.
