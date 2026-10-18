# Level variety: a new pile shape per level, same difficulty (2026-10-18)

Status: **in progress, unpublished** (branch `wip/level-variety`). Dennis: "More variety. But the
difficulty should stay the same as is. Don't publish yet and make sure Codex can finish your work."

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
  as any other designed level (today the most alike other level shares about 94% / 97%).
- **Same difficulty**: the frozen calibrated observer (`tools/sim/honest`, commit 316f3b1) plays the
  board as both personal players (Dennisisdebeste, Mrs. Doubtfire), first try / within 2 / within 4
  with memory, exactly the 1.54 reorder measure. Target per level: `analysis/reorder-92.json`
  `moves[lv].primary` (the board at that level now). Accepted when both players are within
  first ±0.05, within 2 ±0.06, within 4 ±0.05 in a 300-game search measurement AND within
  first ±0.05, within 2 ±0.06, within 4 ±0.05 and ease ±0.03 in an independent 1200-game
  measurement with other seeds (55001 + level × 101).
- How a board is made: the game's designer (`Hard.makeNow(level, 1.6, 1, salt, { tiles })`, new
  option `opt.tiles`) puts pictures, face-down tiles, gold, ice, locks and the clock on the new pile
  exactly as it does for any level (same counts for that level). Then tuning towards the target:
  swap two pictures, clock ±1 move (spare 1-4), move / add / remove a face-down tile (±4); each
  change must keep the stored way through valid (`Hard.validSolution`: ice, locks, tray, clock) and
  no face-down tile free at the start. Fresh games every 9 steps so it does not tune to one sample.
- Saves: the table gets `designVersions: [[70, 7], [92, 8], [157, 9]]` and `hard.js designVersion`
  reads it, so only a half-played game on a changed level starts fresh.

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
