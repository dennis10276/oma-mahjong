# Level factory (levels 175+), Claude, 2026-10-28

Branch `wip/level-factory` (from main 1.62). Nothing here is in the game until Dennis approves a batch.

## Decisions (Dennis, 2026-10-28)
- New levels from 175. Tiles at least 52 px, no towers, shapes from his catalogue picks (all 42).
- Difficulty: first try about 50% for him, slowly harder; losses mostly early (cheap retries).
- He only plays the first, the middle and the hardest level of each batch and says whether the
  difficulty is right. The factory has to be trustworthy for the rest.

## Why this measure (research 2026-10-28)
- Dennis's tries per level (92-163) look like pure chance at about 53% first try; Mrs. Doubtfire's
  and his do not correlate (-0.12). Per-level tries cannot be matched; the curve can.
- The calibrated test players in `tools/sim/honest` (the model that ordered 92-269) are right on
  average (Dennis player 45% predicted vs 53% real first tries; Mrs. Doubtfire 36% vs 35%) but not
  per level (AUC about 0.5). The factory uses them for the curve, not as a per-level promise.
- 57% of human losses happen before the clock is taken (132, 135, 142, 144), 39% mid-game (91), 4%
  late. The game's designer already puts an early clock (route base 5-14, 1-2 spare moves).
- Codex's strong human-information bot (`wip/personal-bots`, `measure()`) clears almost every real
  level; it is the "there is a way out a person can find" check, not a difficulty measure.

## Steps
1. `tools/factory/piles_for.js <from> <to> <out>`: a pile per level; no shape (or variation) twice
   within 10 levels; at most 75% of tile spots shared with any played level (70-164) or level within 10.
2. `tools/factory/design.js <piles> <out.jsonl> <measure.js> [levels]`: the game's designer
   (`Hard.makeNow` with the pile; `opt.tiles` is offline only) deals 8 versions; the Dennis test
   player rates them; the closest is tuned by picture swaps (the known way through stays valid) to
   0.42 first try at 175 sliding to 0.36 at 270 (+-0.05); the strong bot must clear it within 3 tries
   in each of 3 runs. Resumable; about 2-3 minutes per level.
3. `tools/factory/to_lab.js <batch.json>` then `tools/lab/build_lab.js <dir>`: the first, middle and
   hardest level in the lab page "Level Factory" (ratings collection: verdict easy/right/hard, stars, note).

## Batch 175-194 (`batch-175.json`)
20 levels, 72-96 tiles, 52-54 px. Dennis test player first try 0.36-0.46 (aim 0.41-0.42); Mrs.
Doubtfire player within 4 tries 0.34-0.85; strong bot 1-3 tries everywhere. For Dennis: 175 (first),
184 (middle), 189 (hardest).

## Next
- Read Dennis's verdicts; shift the aim if "too easy/too hard".
- Swap in Codex's human-like bot (when ready) for the difficulty measure.
- Shipping later needs a `designVersions` entry in levels-hard.js so only changed levels restart saves.

## Batch 1 verdict (Dennis, 2026-10-29): all three "too easy" (won 175 and 189 first try, 184 on the 2nd)
The calibrated test players misjudge him (their 36-46% first try was a walk-over). His rule: tune to
Codex's bot; a level it clears on the first try is too easy.

## Batch 2: tuned to Codex's bot (`tools/factory/design_bot.js`, `batch-175-bot.json`)
Same piles. 12-20 designer deals per pile; the bot plays salt 1, kept only if it needs 2+ tries, then
salts 2 and 3: every run clears within 6 tries, at most one run wins first try, average at least the
aim (2.0 at 175 rising to 3.0 at 270). The test players' rating does not predict the bot at all
(deals at 3% and 99% for the test player both came out at 2 bot tries). Result: 15 levels at 2-2.3
tries, 183 at 3, 188 4-5, 191 2-6, 192 5. For Dennis: 175, 184, 192 (lab ids 2175, 2184, 2192).

## Batch 2 verdict (Dennis, 2026-10-29): 175 "right" (4 tries, 4 stars), 184 "easy" (1st try), 192 "way too easy" (1st try)
"The bot is struggling for no reason." Compared with his taps (`dennis-plays.json`):
- 192 (bot 5/5/5, Dennis 1): the clock (12 moves) has nothing on top but is blocked on both sides; the
  way to it digs along a row (10 moves). Dennis went straight there; the bot spent its moves elsewhere
  and ran out of time 10 times, until it remembered the board. Same pattern where the bot lost to the
  clock in this batch: 180, 188, 194 (side-blocked, routes of 9-11 moves). Short side routes are fine.
- 184 (bot 2/2/2, Dennis 1) and 175: the bot reached the clock at once but lost with a full tray at
  34-44 tiles left on its first try, waiting on unseen twins; Dennis kept the tray under control.
- 175 is the other way round: Dennis lost three times on the opening (clock 6, four tiles on top, one
  spare move) before he saw the order; the bot found it at once.
So the bot is weak where Dennis is strong (long sideways clock routes, mid-game tray) and strong where
he is weak (short exact clock puzzles). Its tries are not a difficulty measure yet.
