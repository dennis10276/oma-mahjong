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

## Batch 3: tuned to the human-like bot (`tools/factory/design_human.js`, `batch-175-human.json`)
Codex's human-v0 (measureHuman 'dennis', from Gemini's controller with Codex's fixes) passes
Dennis's factory games. Up to 32 designer deals per pile; human-v0 rates each (a 10-game look, then
2 seeds x 20 games: games within one seed vary 0.2-0.45 on the same deal, so one seed is not enough);
kept near the aim (50% first try at 175 -> 40% at 270, +-0.10), late losses under 25%; final 3 x 20
games; the frozen strong bot must clear within 6 in each of 3 runs. Deals are bimodal for human-v0
(most at 0% or 100%), so about 1 in 6 is in band; picture swaps rarely help.
14 of 20 levels done (human 38-62% first try); 185, 191, 192 found no deal in band (new piles
needed), 181, 190, 194 still running. For Dennis: 176, 182, 193 (175 is the same board as batch 2's,
which he already called "right").

## Batch 3 verdict (Dennis, 2026-10-29): 176 "way too easy" (1 star, won first try in under 2 minutes)
"The strong bot needing 1/1/1 tries is a bad sign. I shouldn't be able to make it without thinking.
Don't focus on deals but really plan the levels."

## Batch 4: planned levels (`tools/factory/plan.js`, `batch-175-planned.jsonl`)
Each level is built around the lab puzzles Dennis rated 4-5 stars (tools/lab/ideas.js, now usable as a
module): chainReaction, iceChain, lockedPartners, deepKeys, lockedClock, dontGrab, trayJuggleLocked,
alone or as key puzzle + clock puzzle. The clock is the exact shortest way plus 2 spare moves. Kept
only if the strong bot fails its first try in at least 2 of 3 runs (no 1/1/1) and clears every run
within 6. Pilot: 175 chainReaction (bot 2/2/2), 176 lockedClock (3/2/2), 178 deepKeys + iceChain
(2/2/1). lockedPartners + iceChain came out with no way out within 6 (too tight); lockedClock alone
is often 1/1/1.

## Batch 5: the "too tight" ones too (Dennis 2026-10-29: "let them through so I can test those; maybe
that's what we want, new ideas the bot hasn't learned yet"). `TIGHT=1 plan.js` keeps a level the strong
bot cannot clear within 4 tries (still winnable: the stored way through passes every rule). In the lab:
176 lockedPartners + iceChain (bot 2/2/2), 177 deepKeys + iceChain (tight; human-v0 wins 95% first
try, so the strong bot may just have a blind spot there), 180 chainReaction (tight; human-v0 5%).

## Batches 4-5 verdicts (Dennis, 2026-10-30)
175 chainReaction (bot 2/2/2): 5 stars "very fun", right. 176 lockedClock (3/2/2): 4 stars, right.
178 deepKeys + iceChain: "a bit easy, feels like the clock has more than 2 spare moves". 5176
lockedPartners + iceChain: "a bit too easy but about right, fun original". 5177 (tight): "seems easy,
idk why the strong bot struggled; original, so a good level, just place it better on difficulty". 5180
chainReaction (tight): "hard but manageable", right. Summary: the levels the strong bot could not
clear are not that hard; the 2/3-try ones are the hardest so far.

## Gemini's g1 (wip/gemini-human-bot 2f6b903): adopted as the factory's difficulty meter (pending Codex audit)
measureHuman now returns expectedTries and easy/right/hard (2 seeds x 20 games) and turns on retry
memory for 'dennis'. On all 14 factory boards Dennis played (Claude's check, other seed): his 8 easy
boards 1.0-2.0, his 3 right/hardest 3.7-4.8; misses: factory2-175 (Dennis 4, g1 2.0) and factory5-176
(Dennis 1, g1 3.4). `planned-candidates.json`: all planned candidates with g1. Most of the newest
planned levels (1 spare move on ice chains, iceLockClock) come out at 10-24 expected tries (very hard
or a g1 blind spot). Calibration round for Dennis: 188 (g1 1.0), 184 (6.9), 190 (15.7).
Next: plan.js with g1 in the loop (fast, ~20 s) picking each slot's target, the strong bot only as
the way-out check.

## Batch 6 verdicts (Dennis, 2026-10-30): g1's order was upside down on planned levels
- 188 dontGrab + lockedPartners (g1 1.0 "easy"; strong bot could not clear): 4 tries, right, 4 stars.
  "Hard to see but fun. I like easy looking shapes with hard problems." Lost once late (17 left), twice early.
- 184 chainReaction (g1 6.9; strong 2/2/3): 5 tries, not won, hard, 2 stars. "Digging without seeing
  exactly where is not very engaging. The ending is annoying to finish. The clock can have an extra move.
  When you tap a locked tile, even when buried, I want the keys to shake."
- 190 chainReaction (g1 15.7; strong 3/3/3): 2 tries. "Hard but nowhere near 15 tries. 184 and 188 harder."
Dennis: 184 > 188 > 190; g1: 190 > 184 > 188. Codex will not audit g1. Next: a new goal for Gemini (g2)
and a blind test (`blind-1.json`, lab ids 7183/7185/7187/7194): Dennis plays them, his results stay out
of git until g2's predictions are committed.

## Gemini's g2 (wip/gemini-human-bot 4568bb2), Claude's audit 2026-10-30
- Reproduced with another seed (4711, 2 x 20 is its default): planned boards Spearman 0.88 (Gemini 0.90),
  Dennis's order 184 (7.1) > 188 (3.7) > 190 (2.6) holds, easy below right/hard in 53 of 54 pairs.
  `g2-audit-seed4711.jsonl`. Blind predictions (committed before Dennis played): 187 3.0, 194 6.7,
  183 6.1, 185 7.9 (my seed: 3.3, 6.2, 6.4, 7.8).
- Not reported by Gemini: real levels 92-163 (74 boards, Codex catalog trial21, seed 20261028, 1 attempt):
  Dennis first try 60.6% (gate 50-55%; g1 54.8% on the same run), family 30.8% (g1 34.0%). Per level it
  swings a lot (151: 100% -> 0%, 152: 5% -> 95%): the first-try "tray depth 1" rule is broad.
- Unit tests: 6 retry-memory tests fail in g2 and already in g1 (g1's profile switch broke their
  controls); g1's "180/180" was wrong too. lab tests not run here (lab-clears.json not staged).
- 188: Dennis's real mistake was taking the clock on tap 1 (tries 1-3), not a deep tray plan; g2 gets
  the right number through a different mechanism (first-try tray depth 1).
Use: g2 orders the next factory batch (planned levels); the blind test decides whether it stays.

## Gemini's g2.1 (wip/gemini-human-bot 1e22fc0), Claude's audit 2026-10-30: adopted as the factory meter
- Real levels 92-163 (same run as above): Dennis 54.9% first try (gate 50-55; g2 60.6), family 32.3%;
  levels 151/152/102 back to g1's values. Family risk-minus-control loss gap 0.05 (g1 0.115, gate 0.10):
  the family setting is not used by the factory.
- Unit tests (t_human_reference): 192/192 with the six retry tests fixed (controls turn their flags off).
- Planned boards, seed 4711: Spearman 0.69 (g2 0.88), order 184 (6.5) > 188 (3.1) > 190 (2.5) holds,
  easy below right/hard in 51 of 54 pairs. `g21-audit-seed4711.jsonl`.
- New in g2.1: a generous clock (n >= 14) taken early tempts on the first try (tray planning depth 1 while
  it sits unmatched in the tray); after a loss that started that way, restraint (stochastic). The
  thresholds were found on 188: the blind test checks them.
- Blind 1 (Dennis's results not in git): g2 (frozen) 187 3.0, 194 6.7, 183 6.1, 185 7.9;
  g2.1 (seed 4711) 187 1.25, 194 6.15, 183 6.2, 185 7.8.

## Blind test 1 scored (Dennis 2026-10-31)
| board | recipe | Dennis | g1 | g2 (frozen, before he played) | g2.1 (seed 4711, also unseen) |
|---|---|---|---|---|---|
| 187 house | deepKeys + iceChain, spare 1 | 3 tries, 4 stars "the locks put you in the right direction" | 1.3 | 3.0 | 1.25 |
| 194 hourglass | deepKeys + iceChain, spare 1 | 4, 5 stars, right, "very hard but fun hard" | 7.7 | 6.7 | 6.15 |
| 183 blob | chainReaction, spare 2 | 5 | 17.0 | 6.1 | 6.2 |
| 185 vase | iceLockClock, spare 2 | 6, 4 stars "hard but I like the pile shape better than blobs" | 22.8 | 7.9 | 7.8 |
Order: g1 and g2.1 exact, g2 one swap (Spearman 0.8). Size of the miss (mean |bot - Dennis|): g1 8.6,
g2 1.4, g2.1 1.7; the bots run about 1.3x high on the hard ones. g2.1 stays the meter.
Dennis: "Get rid of the blob levels": the blob shapes are out of `piles_for.js`; `piles-175-noblob.json`
keeps every non-blob pile and gives 178 pyramid, 182 bowtie, 183 butterfly, 190 octagon, 191 castle ·
two islands (piles now try every variation against the overlap rule).

## Batch 8: planned levels picked by g2.1 (`tools/factory/plan_g2.js`)
Recipes rotate per attempt; the clock spare follows his notes (chainReaction 3, with iceChain 1, others 2);
g2.1 expectedTries (2 x 20 games, seed 4711) picks: aim 2.5 at 175 rising to 4.0 at 194 (+-0.6), else the
closest attempt. The strong bot is no longer a gate. Every level stays valid by construction.
Runs (2026-10-31): the bot's ratings are bimodal (1-2 or 6-8 tries) and the clock spare hardly moves
them, so the batch mixes hard levels (5-7.9) and breathers (1.8-3.5), the hard share rising 30% -> 60%;
recipes rotate per level; a fix-up pass (AVOID) rebuilt 180, 182, 183, 184, 185, 191 for variety and to
get off the bot's maximum (8). Result `batch-175-g2.jsonl`: 9 hard (4.9-7.9), 11 breathers (1.8-3.5);
recipes: lockedPartners+iceChain 5, deepKeys+iceChain 4, lockedClock 4, iceLockClock 3,
dontGrab+lockedPartners 3, chainReaction 1. For Dennis (lab ids 8175, 8185, 8193, no bot numbers shown):
175 first (chainReaction, letterH, 7.1), 185 middle (deepKeys+iceChain, vase, 5.9), 193 hardest
(deepKeys+iceChain, ushape, 7.85). A second blind check of the meter at the same time.

## Order: easier first, then middle, then hard (Dennis 2026-10-31: "the breathers at the start; the curve
should get harder and harder: breathers 175-x, middle x-y, hard y-194")
Two new piles on unused shapes (diamond, block; `piles-mid.json`) were built for the middle band 3.6-4.8,
but the bot rarely lands there: diamond came out 1.0 (chainReaction), block 6.9 (chainReaction).
`reorder_batch.js` -> `batch-175-ordered.jsonl` (all shape/overlap checks pass):
breathers 175-182 (1.0-2.8), middle 183-187 (3.3-5.9), hard 188-194 (6.1-7.85); within a tier the
puzzles alternate. Left out: old 179 and 189 (locked-clock breathers; their shapes stay at 176/194).
For Dennis (lab ids 9175, 9185, 9194): 175 diamond chainReaction (1.0), 185 butterfly
lockedPartners+iceChain (3.45), 194 ushape deepKeys+iceChain (7.85). Release: with the key changes
(wip/key-shake), once he approves these.

Release check (2026-10-31): big boards (more than 88 tiles) belong on every 10th level only (game rule,
tests/t_reorder_honest.js). So 180 is a new big breather (twins, 96 tiles, lockedClock, 1.8;
`piles-big.json`) and the big steps board moves to 190; old 179, 189 and 192 are left out. The first,
middle and hardest stay the same boards (lab 9175, 9185, 9194). Shipped on `wip/release-1.63` with
`tools/factory/ship_batch.js` (HARD_LEVELS.revisions [[175,194,"f1"]]: only saves on these levels, or
later levels that cycle back to them, start again). Factory boards keep long clock routes (up to 42
moves); the clock test exempts them.
