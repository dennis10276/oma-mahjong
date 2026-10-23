# Level variety: a new pile shape per level, same difficulty curve (2026-10-18, quicker method 2026-10-21)

Status: **in progress, unpublished** (branch `wip/level-variety`). Dennis: "More variety. But the
difficulty should stay the same as is. Don't publish yet and make sure Codex can finish your work."

## Latest decisions (2026-10-23) — read first

- **No towers** (tiles straight on top of each other): "they introduce luck too much". The boards made
  with `variety2.js` (`analysis/variety2*.json`) all have towers (about half the tiles, columns up to 7
  high) and are NOT to be used. `piles.js` must be called with `stack: 0`; check that no tile lies
  straight on another.
- **No smaller tiles** (54 px stays; 48 px on every 10th level).
- Without towers at 54 px, 86 tiles fill most of the screen, so piles share many spots. Agreed: each new
  level shares **at most 75% of its tile spots** with any played level (70-157) and with the 10 levels
  around it; its **pairs** always in new spots, and **the specials too** (ice, lock and keys, face-down
  tiles, the clock, gold: not on the same spots as on a level with a similar pile).
- **Some levels smaller** (about 70 tiles instead of about 86), made as hard with "a smart combination of
  freeze, lock/key, face down and clock".
- Mrs. Doubtfire per level and per 10 levels as below (same or harder; at most 5 points harder);
  Dennisisdebeste may be harder.
- **Real levels 158-269: harder, like the lab's hard versions** (Dennis, 2026-10-23: "lab version
  harder", "we need more consistency in how hard a level is", "don't be afraid to make it too hard").
  Tray pressure from digging (the clock deeper, the keys deeper, ice on the tiles you dig through,
  partners locked), never tiles on their own twins; the clock number = the moves the quickest way to it
  needs plus a small spare, never a smaller number. The test players misjudge these boards both ways
  (lab: chain of ice "0%" took Dennis 11 tries, locked clock "16%" took 6, deep keys "2%" took 2), so
  they are refitted on Dennis's lab taps (collection `taps` in the lab page's database) before levels
  are measured with them. At most 3 lab tests per round.
- **Level lab first** (Dennis: "a small test env for you to put your level ideas in so I can play and
  judge them on cleverness of combining the different specials"): `tools/lab/ideas.js` makes ideas
  (one way of combining the specials each, on a new towerless pile, difficulty nudged towards a level near
  200), `tools/lab/build_lab.js <dir>` builds the real game plus the lab (`tools/lab/lab.js`) with the
  family database, self-update and news switched off; `lab.html` in that folder is the page for a
  claude.ai artifact. Dennis rates each idea 1-5 for cleverness with a note; the ratings are in the
  artifact's database (collection `ratings`, one document per idea). Use them to choose which ways of
  combining specials the real levels get, then make the levels (a `variety3` along the lines of
  `variety2.js`, with the rules above).

## Why

Dennis noticed level 154 felt like one he had played. Of the designed levels 106-269, 122 of 164
have a pile that is at least 90% the same (tile spots, also mirrored) as an earlier level; 14 are
exactly the same (e.g. 113 = 157 = 181 = 233 = 237 = 253). Cause: the designer (`www/hard.js` make)
builds up to 24 random piles per level and keeps the one with the fewest free tiles at the start,
which keeps choosing the same few compact shapes; the 1.53 remake kept the positions and only swapped
pictures, and the 1.54 reorder kept whole boards.

## What changes

- Levels **157-269** (nobody has reached them: Dennisisdebeste is at 156 on 2026-10-18) get a new
  board each. 70-156 stay exactly as they are (people have played them). Past 269 the game repeats
  150-269 mirrored with other pictures (unchanged code), so the new boards come round there too.
- **Shape**: `tools/sim/variety/piles.js`, a copy of `Layouts.buildPiles` with the game's 17 shapes
  plus 14 new ones (ring, star, wave, steps, twins, arrow, moon, plus, xshape, tshape, ushape,
  chevron, kite, castle), all mirror-symmetric. The game's own shape list is NOT changed (it also
  builds levels 1-50 and 52 live on every phone). A shape only shows with a smaller base and a taller
  pile (more layers and towers): with 80-96 tiles that must stay at least 54 px (48 on every 10th
  level) on a phone, a wide flat base is a block whatever its shape.
- **Different from every other level**: at most 60% of the tile spots and 65% of the outline the same
  as any level that stays (70-157; today the most alike other level shares about 94% / 97%). Among
  the new boards the same within `NEAR_LV` levels (10 if it can be done). Further apart a pile may look
  alike (Dennis, 2026-10-22: tiles stay at least 54 px, and at that size only about 25 piles can be
  this different from each other; 51 px would allow about 120), but then **its pairs must be in new
  spots**: at most 10% of the tiles with the same picture on the same spot, and at most 10% of the
  pairs on the same two spots (`PICS`, also mirrored).
- **Same difficulty**: the frozen calibrated observer (`tools/sim/honest`, commit 316f3b1) plays the
  board as both personal players (Dennisisdebeste, Mrs. Doubtfire), first try / within 2 / within 4
  with memory, exactly the 1.54 reorder measure. Target per level: `analysis/reorder-92.json`
  `moves[lv].primary` (the board at that level now). Accepted (2026-10-22, see "Tolerance" below) when both
  players are within first ±0.08, within 2 ±0.10, within 4 ±0.08 and ease ±0.05 in an independent
  1200-game measurement with other seeds (55001 + level × 101), and per 10 levels the averages stay
  within 0.02. (The first method used ±0.05 / 0.06 / 0.05 / 0.03.)
- How a board is made: the game's designer (`Hard.makeNow(level, 1.6, 1, salt, { tiles })`, new
  option `opt.tiles`) puts pictures, face-down tiles, gold, ice, locks and the clock on the new pile
  exactly as it does for any level (same counts for that level). Then tuning towards the target:
  swap two pictures, clock ±1 move (spare 1-4), move / add / remove a face-down tile (±4); each
  change must keep the stored way through valid (`Hard.validSolution`: ice, locks, tray, clock) and
  no face-down tile free at the start. Fresh games every 9 steps so it does not tune to one sample.
- Saves: the table gets `designVersions: [[70, 7], [92, 8], [157, 9]]` and `hard.js designVersion`
  reads it, so only a half-played game on a changed level starts fresh.

## The quicker method (2026-10-21, `tools/sim/variety/variety2.js`) — use this one

Dennis: "The last ones ran very slow. Find a quicker and still good way" and "the curve of the
difficulty should stay about the same". The first method (`variety.js` below) tuned every level to
its exact target and took up to an hour per level (12 done, 7 failed in 2 hours). Dennisisdebeste
reached 157 meanwhile, so the remake now starts at **158** (157 keeps its board).

Like the 1.54 reorder: make boards, measure them, put each where its difficulty fits.

```
node source/tools/sim/variety/variety2.js cands 2 158 269   # ~1 min per level per worker, resumable
node source/tools/sim/variety/variety2.js assign 158
node source/tools/sim/variety/variety2.js tune 2            # only levels without a close candidate
node source/tools/sim/variety/variety2.js validate 2        # 1200 games, other seeds
node source/tools/sim/variety/variety2.js report            # the curve per 10 levels, old/new
node source/tools/sim/variety/variety2.js apply 158         # www/levels-hard.js + analysis/variety.json
```

1. `cands`: per level up to 5 boards, each on another new shape (unlike levels 70-157), the game's
   designer on a quick setting (`RULES.hard` rounds/deals/steps 4); a quick look (120 games), then the
   ones near any target of a level within 2 measured with 300 games. `analysis/variety2-cands.json`.
2. `assign` (2026-10-22): like the 1.54 reorder, a board may go to **any** level from 158 of the same
   kind (big boards every 10th level), wherever its difficulty fits. The best overall assignment
   (Hungarian method): as many levels as possible within the tolerance, then the smallest total
   distance. Look-alike rules between the new boards: see "Different from every other level" above,
   and no shape twice within 5 levels. Levels that passed `validate` keep their board; candidates measured by
   `validate` use that sharper number (`analysis/variety2-checked.json`). Greedy level-by-level
   picking (the first version) used only 12 of the ~80 possible close fits.
   `more [workers] [per] [from] [to] [rounds]` adds boards on random outlines (`piles.js` 'blob<seed>':
   2-4 rectangles, ovals and slanted bands, mirror-symmetric), because the 31 named shapes give too few
   piles that differ enough from each other.
3. `tune`: at most 16 short steps (swap pictures, clock, face-down tiles), only where no candidate
   was within the tolerance.
4. `validate`: 1200 games (seed 55001 + level x 101); passes within the tolerance below (per level,
   both players). Then `assign` again (missed levels get another board), `validate`, and so on.
5. `report` shows the curve per 10 levels (first try and ease, old against new, "OFF THE CURVE"
   when a band average moved more than 0.02).
6. `balance` (then `tune`, `validate`): a band of 10 levels off the curve gets its passed level that
   pulls most the wrong way tuned again towards a shifted aim; if that fails, the passed board stays.
7. `apply`: levels that passed get the new board, the others keep theirs. Before a release, re-run
   `apply` with the first level nobody has reached yet.

Tolerance (Dennis: "the curve of the difficulty should stay about the same"): per level both
players within first try ±0.08, within 2 ±0.10, within 4 ±0.08, ease ±0.05 (the reorder already
puts neighbouring levels 0.05 ease apart; ±0.05 first try was below the noise of the measurements
and made the work slow), and per 10 levels the average first try and ease of each player not easier than before
(Dennis, 2026-10-22: "It shouldn't be easier really"; 0.005 allowed for measurement noise) and at
most 0.02 harder (for Dennisisdebeste any amount harder: "If a board fits but it's too hard for
Dennis on the curve just let it fit", 2026-10-22; his harder side counts half when choosing). When choosing and tuning, a board that is easier than its target counts double.
Mrs. Doubtfire (Dennis, 2026-10-22): "Everything should be harder or the same for Mrs Doubtfire",
"5 points harder is too much", and per 10 levels "1 level in it can never be more than 2 points easier,
1 one point easier, rest should be same or harder". So per level (first try and ease) at most 5 points
harder and 2 easier; per block of 10 one level up to 2 points easier, one up to 1, the rest at most 0.5
(the same in whole points). `assign` prefers fits that are the same or harder for her; `balance` tunes
the levels over their allowance harder. `tests/t_variety.js` checks both.

## The first method (`variety.js`, slow; kept for reference)

## How to run / resume (any agent)

```
node source/tools/sim/variety/variety.js plan 157 269   # once (done); writes analysis/variety-plan.json
node source/tools/sim/variety/variety.js build 2        # resumable: skips levels that are done
node source/tools/sim/variety/variety.js status
node source/tools/sim/variety/variety.js build 2 160,170   # only some levels (e.g. failed ones)
node source/tools/sim/variety/variety.js apply          # when all are done: writes www/levels-hard.js
```

- `analysis/levels-before-variety.js` is the table before this change (input; never edit).
- `analysis/variety-progress.json`: one entry per level (board, shape, measurements, log), written
  after each level. Stop any time (Ctrl+C); the next `build` continues.
- A level that fails ("difficulty not matched" or "no new pile fits"): look at its `log`, then retry
  it alone (more piles: raise `piles.length >= 3` in `buildLevel`, or more tuning steps `it < 36`).
- Speed here: ~3 s per 300-game measurement of both players; a level takes ~5-15 minutes.
- After `apply`: run the tests (`node source/tests/run.js`), look at a few boards in the game, and
  only release when Dennis says so. The dashboard predictions (`dash/predict.json`) for 157+ are for
  the old boards: make new ones for the new version (AGENTS.md, "Predictions on the dashboard").
