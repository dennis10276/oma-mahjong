# Level factory (levels 175+), Claude, 2026-10-28

Task 08 handback (2026-11-06): [tolerance and pressure frames](frames-v2.md).
The complete pool/quality/tolerance pass adds six levels, giving 16/26 qualified
with the ten v12 boards preserved. The registered conditional-frame model test
failed 0/12; it does not justify more automatic generation. Current rule: ±1
per level/fresh seed and ±0.5 mean across each complete five-level window.
Missing-window coverage remains uncertified. No game or bot changes.

Task 07 handback (2026-11-06): [measured trap pieces](pieces-v1.md).
Sixteen local mechanisms and 358 controlled measurements are implemented. The
composition model failed prospective curve placement; full bot gates remain
required. V12 is an explicit 10/26 partial batch, including original 225 under
the existing exact-board human-win rule. Detailed external handbacks are beside
this checkout in `codex-tasks/results/pieces-v1/` and `200-225-v12/`.

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

## Dennis on the 1.63 picks (2026-10-31) and critic v1
175 (diamond, chainReaction): 1 try, right, 4 stars "fine". 185 (butterfly, lockedPartners+iceChain): 2 tries,
gave up, 1 star: "frustrating cause the hard part is tray pressure at the very end to get the keys.
Replace." 194 (ushape, deepKeys+iceChain): 8 tries, never won: "I don't see how I can take the clock
faster than this route. Give +2 spare moves."
Dennis: "think how we can make the bot do what I do now". What he does: difficulty (g2.1 does it) plus
judgements in his notes, sorted in `dennis-notes-labels.json`. The bot's own games already show two:
- late squeeze: share of the bot's losses with a third or less of the tiles left. 185: 0.75 (losses at
  14-36 left, his at 21 and 25); every other rated board 0.21 or less (`critic-probe-rated.jsonl`).
- clock out of reach: share of the bot's tries in which it takes the clock in time. 194: 1 of 233; the
  5-star blind 194: 8%. With Dennis's +2 the new 194 drops from 7.85 to 2.5 tries (reach 41%).
The repeat-the-same-loss share did not separate (high on levels he loved too).
Critic v1 over 1.63 (`critic-1.63.jsonl`): late squeeze also on 178 (moon, lockedPartners+iceChain, 0.72)
and 180 (twins big breather, 0.94); clock out of reach only 194. Dennis 2026-10-31: no rejecting ("Maybe some
are doable"): plan_g2 records the flags as warnings only; flagged levels can be tested.
Rebuilding: the top hard slot (moon pile), the middle slot (butterfly pile), the big breather (twins);
194 with +2 (2.5 tries) becomes a breather.
Dennis: "I liked the old one [194]": the blind-test 194 (hourglass, deepKeys+iceChain, 5 stars) goes into 1.63
as a hard level; arch (7.47) stays (no cap); the moon hard rebuild was stopped.
1.63 order after Dennis's picks (`batch-175-ordered.jsonl`, all checks pass): easier 175-182 (diamond, pyramid
tall, star, house, cross, twins big (new, no warning), ushape = his 194 with +2, frame), middle 183-187
(heart, bowtie, butterfly (new, lockedClock 4.7), castle, vase), hard 188-194 (pyramid, the blind-test 194
on hourglass, steps big, block, octagon, letterH, arch 7.47). In the lab (batch 10): new 185, new 194, 181
(his +2 version) and the two critic tests (moon and the first twins: the bot loses near the end).

## The curve (Dennis 2026-10-31: "We are now making a batch for 175-200 but this should be how we build levels
from now on. Also after 200. Maybe make more easy/middle and the hard ones keep for 300 or so. The
difficulty curve should stay the same from before.")
g2.1 on every live level 150-269 (`curve-live-g21.jsonl`, seed 4711, 2 x 20): trend (values capped at 5)
exp = 0.157 + 0.00989 * level: 1.89 at 175, 2.14 at 200, 2.82 at 269, 3.13 at 300. Live 175-200: p25 1.32,
median 2.1, p75 2.77, p90 3.73, 3 of 26 at the bot's maximum 8 (177, 192, 196). The batch 175-200 copies
that spread (most 1.3-2.8, a few 3-4, a couple of peaks 4-6); the hard boards (6-7.5) wait for ~270-300.

## Batch 175-200 on the live curve (`batch-175-200.jsonl`, `tools/factory/assign_curve.js`)
Inventory (`inventory-175-200.jsonl`): the earlier factory boards up to 6 tries, plus new builds
(`fill-builds.jsonl`): 10 easy levels, 2 big ones, 6 easy ones without the locked clock (the bot rates the
locked clock easy, so the first arrangement had 11 of them). The solver gives each level the class of
the live level it replaces (easy 1-1.6, normal 1.6-2.8, tricky 2.8-4.2, peak 4.2-6; the live 8s at 177,
192, 196 become peaks 5.9, 4.7, 4.85), big boards on 180/190/200 only, no base shape twice within 10, overlap
<= 75%, at most 7 of one puzzle, neighbours differ. Mean 2.16 tries (live 2.38 with 8s counted as 5.5).
Puzzles: lockedClock 7, dontGrab+lockedPartners 5, deepKeys+iceChain 5, iceLockClock 5, lockedPartners+
iceChain 2, chainReaction 2. 190 and 200 are a bit easier than live (no big tricky board came out).
One critic warning: 199 (late squeeze). Waits for Gemini's critic (g3) before Dennis judges.

## New curve (Dennis 2026-10-31: "The old curve was not quite right: many levels are suddenly harder and then
easier again. We have a new judger now that places them better starting from 175. Don't mimic the old curve:
pick it up at 175 like the difficulty of the hardest judged level in 150-175.")
Hardest live level 150-174 by g2.1: 155 (3.85; then 162 3.3, 166 2.98). Target: a smooth rise from 3.85 at
175 to about 6.5 at 300 (the hard boards; Dennis: "keep the hard ones for 300 or so"): about 4.4 at 200.
So 175-200 is all middle (3.3-5). Source of middle boards: the clock spare (1-3, the game's rule) moves many
boards a lot (194: 7.85 -> 2.5 with +2): `tools/factory/tune_spare.js` tries it on every board we have.
Dennis on the big levels: 190 may be easier (a breather on a big board); 200 a small jump above the curve
(about +0.5), and 201 on continue from there.
Spare tuning (`spare-tune.jsonl`, 40 variants): the spare is a strong but erratic knob (vase 5.92 -> 1.07 with
+1; hourglass (Dennis's old 194) 6.15 -> 3.4 with +2; octagon 6.95 -> 6.9 and 7.03; steps (big) 6.65 -> 1.73).
Middle boards so far: heart 3.35, arch chainReaction 3.58, hourglass +2 3.4, butterfly 4.7, castle 4.85,
(bowtie 3.27, frame -1 3.1). Building 18 more middle (3.4-4.9) and 2 big for 200 (4.4-5.4) with plan_g2
TUNE=1 (spare steps towards the band) on new piles (`piles-mid2.json`).

## Gemini's critic g3 (wip/gemini-human-bot 78de423), Claude's review 2026-10-31: adopted as warnings
`critique(board)` in human_bot.js (human_critic.js); measureHuman unchanged (engine files identical to g2.1).
Check A as reported: 5 kinds with 3+ labelled boards each fire on 2-3 of 3, at most 1 of 14 fun boards
(factory4-176 is that one for 3 kinds). Claude's re-run (seed 4711 and 99): 1.63-179, -189 and blind1-194
flag only "fun" both times; 1.63-177 flips "guessing" between seeds (thresholds sit close to the data).
Caveats: thresholds were fitted on 2-3 boards per kind; specialAddsNothing uses 10-game ablations and
fires on 10 of the 20 old 1.63 levels; BLIND2_CRITIC.json is not blind for 175/185/194 (Dennis's results
were in its data) and the other 17 levels are being replaced. Use: warnings in the factory, recorded
before Dennis plays the new batch (that is blind test 2), never a gate (Dennis: "maybe some are doable").
Dennis on that warning: "how the old levels were built a special often didn't add anything. I want to change
that from now. Levels shouldn't get this flag. I feel like the bot can be used to design levels better as
well." New rule for factory levels: every special must matter. `tools/factory/specials_matter.js` removes
each kind (ice, locks with keys, clock) in turn and measures with the full g2.1 measure (2 x 20, not 10
games): it matters when the expected tries drop by 0.3+ or the first-try rate rises by 0.15+. A board
where a special is idle gets that special re-placed (or, for the clock, fewer spare moves) before it can
go into a batch.
First run of specials_matter on the 10 middle candidates (`matter-mid1.jsonl`): every clock matters (drop
2-3.8 tries without it); idle ice on 948 (0.0) and 958 (0.15). On several boards removing the locks or the
ice makes the level HARDER (942: +3.1 without locks): they show the way. So a special counts either way.
Idle ice/locks are taken off and the board measured again.
Middle builds so far (`mid-builds.jsonl`, plan_g2 TUNE=1, band 3.4-4.9): 28 tries, 12 in band, the rest at
1-2.3 or 5-7 (the bot's ratings stay bimodal). Second specials check (`matter-mid2.jsonl`): idle ice on 940,
949, 956 and old 184; taken off. First arrangement on the new curve: the 4.0-4.5 range is almost empty, so
the batch zig-zagged 3.0-5.9 around the line; building 20 more aimed at 3.7-4.6 (`piles-mid4.json`).
Draft on the new curve (`batch-175-200-draft3.jsonl`, `tools/factory/assign_anneal.js`; 93 boards, 35 of them at
3-5.5 tries): all rules kept, mostly rising, but it starts at 2.7 (curve: 3.85) and runs to 5.05 at 199; 180
is a big easy board (2.0, no big board near 4 exists), 190 the big breather (2.2), 200 the big 5.0. The bot
still rarely rates a board 3.8-4.3 (of the last 20 aimed at 3.7-4.6: 5 in, 4 near). Next: more boards around
3.8-4.3, best from Gemini's bot-designer (it is meant to hit a band directly).

## Gemini's bot-designer (wip/gemini-human-bot 3642d85), Claude's hold-out check 2026-11-01
Report: 60% of piles-mid2 in band (3.4-4.9 and 4.4-5.4) within 10 tries, every special matters, 7% warnings,
~5 min per level. Hold-out (`designer-holdout.jsonl`, `tools/factory/designer_holdout.js`): 6 piles it never
saw (piles-mid4, 72-82 tiles), band 3.7-4.6, 6 tries each: 1 hit (982 pyramid, lockedClock 3.92, valid,
2 spare, only "fun"), 5 misses at 23-30 minutes per pile. Two of the misses again with its own band 3.4-4.9:
still no hit. The two big piles for 180 did not finish (2-hour limit). So the 60% does not carry over to new
piles yet; its hits are good boards. Not adopted as the factory's builder yet; a fix goal for Gemini.

## Gemini's g4 (wip/gemini-g4 9f9438a), Claude's review 2026-11-01: not adopted
Real levels: 150 7.53 (target 7) and 132 4.45 above 127-137: met. Overall match still weak: Spearman +0.15 with
Dennis's targets (goal 0.35; hold-out odd levels +0.25), within 1.5 tries 61% (goal 70%); 155 got worse (3.85 ->
5.85, target 1), 147 4.45 -> 5.27 (target 1). Its report says the factory boards are unchanged; Claude's re-run
(`g4-check.txt`, seed 4711) says otherwise: blind 194 6.15 -> 7.55 (Dennis 4), 183 6.2 -> 7.67 (Dennis 5),
6188 3.1 -> 6.06 (Dennis 4), 6190 2.5 -> 4.22 (Dennis 2), 6184 6.5 -> 8.18. Its retry memory now fades with board
size for every board, which inflates every multi-try level. g2.1 stays the factory's meter: on the boards
Dennis played in the factory its order and size held in two blind tests.

## 175-200 release candidate (`batch-175-200-candidate.jsonl`, assign_anneal, curve 3.3 -> 4.5 at 199, 200 +0.5)
The start of 3.85 cannot be reached with the boards there are (and was taken from level 155, which g2.1
overrates: Dennis won it first try). Candidate: 175-189 rise 3.0-4.85, 180 a big 2.7, 190 the big breather 2.25,
191-192 2.6 and 3.0, then 4.0-5.05, 200 the big 5.0. Includes the bot-designer's pyramid (186, 3.92).

## The family's recordings (2026-11-01)
Dennis: "Why can't it find out from the data the players gave?" Every try is recorded tap by tap (Firebase
`replays/`, 30 days; the dashboard plays them in `site/dash/watch.js`). Raw export: `analysis/archive/replays-2026-11-01/`
(git-ignored). `tools/factory/real_losses.js` -> `real-losses-85-174.json`: per level and player, tries up to the
FIRST win only (Dennis: replays after a win don't count; 23 such tries left out), and how each lost try ended.
- 132 (clock 6 moves, shortest way 5): an opening problem. Gerda 54 of 70 losses and Mrs. Doubtfire 18 of 30 were
  the clock running out; the tray losses too came after only 6 of 82 tiles. The bot finds the way 90% first try.
- 150 (clock 7, shortest 6): the clock is taken almost always; then the tray fills in the middle (tiles left at
  the loss: Dennis 58, Gerda 72, Mrs. Doubtfire 54 of 96). The bot loses there too but much later (42 left) and
  wins about 1 in 2.7 tries (Gerda 1 in 81).

## The judge on top of g2.1: not adopted (2026-11-01)
`tools/factory/judge_fit.py` -> `judge-fit-1.json`: a small linear model from what g2.1 sees (expected tries, first-try
rate, clock losses, late losses, clock reach, spare, size, face-down share, ice, locks) to Dennis's targets, 60 live
levels 85-155 + 23 factory boards, leave-one-out. MAE 1.09 vs 1.14 for raw g2.1; ranking of the live levels
(Spearman 0.17 vs 0.18) no better; 150 -> 2.9 (target 5), 132 -> 1.2 (target 6). The bot's own numbers do not hold
what makes those levels hard (the recordings show it: the bot plays the clock opening and the middle game better
than people), so the fix has to be in how the bot plays: goal g5. On factory boards g2.1 already ranks Dennis's
tries well (Spearman 0.79): bot up to ~4 = Dennis 1-4, bot 6-8 = Dennis 4-9.

## Clock warnings checked by Dennis (lab batch 11, 2026-11-01)
- 176, 189, 193 (all "Don't grab the clock + Partners behind locks"; Gemini's critic: clock too loose, the bot reaches
  the clock with 6-11 moves to spare): Dennis "too loose and it adds nothing", "Time to take this flag seriously",
  "too loose is no pass level from now on. The clock is just free to take and no reason for it to be there."
  So clockTooLoose is now a rejection: plan_g2 (with CRITIC_BOT) drops such boards, assign_anneal never lays them,
  and (Dennis: "You can make levels where it would be counterproductive to grab the clock early. These just weren't
  that") the dontGrab puzzle stays, but a board made with it is only kept when the human bot made to take the clock
  first needs at least 1 try more than on the board as built (plan_g2 GRAB_MIN). The full g2.1 specials test had
  called these clocks useful (taking the clock off changed the bot's result), so that test alone does not catch it.
  Boards built before this have no critic3 field: the final check on every batch must run the critic and replace any
  board it flags as too loose.
- 198 ("Ice, lock, then the clock"; critic: clock too tight, the bot reaches it in time in 8% of its tries): Dennis
  "Seems fine. Flag for tight needs work." Too tight stays a warning only.
- Dennis: "I feel like I could pass the levels with grabbing the clock early." Right (tools/factory/grab_early.js):
  on all three the clock is free at the start and the level can still be won after taking it as the first move;
  the human bot made to take it first needs no more tries, mostly fewer: 176 3.27 -> 2.90, 189 4.85 -> 1.23 (95%
  first try), 193 3.98 -> 3.07. The blocked tray slot costs less than the alarm risk of waiting, so the puzzle's
  "don't grab it" never holds; the best play is the obvious one.
- Dennis (2026-11-01): "too loose is a no for don't grab the clock levels. On most it should be a flag to make the
  clock stricter maybe and test again." plan_g2 (CRITIC_BOT): a loose clock on a dontGrab board is out; on other
  boards the spare goes down one move at a time (to 1), measured and criticised again each time; still loose at 1:
  out. The dontGrab early-grab check runs on the final clock.

## Gemini g5 (wip/gemini-g5 10cee30, 2026-11-01): reviewed, not adopted
g5 changes how the bot plays in two narrow cases: boards of 92+ tiles with 28+ face-down tiles in view (memory capped
at 7 hidden tiles, less memory between tries, tray lookahead 2), and a clock of 7 or fewer moves buried under 2+
tiles with tiles on both sides (drawn to open pairs near the clock until it has lost to the clock 3 times). Both
thresholds were set by looking at 150 and 132 (its report: "Calibrated the threshold to >= 28, properly activating
Fog of War on Level 150"), so its 150 = 5.04 and 132 = 5.10 are fitted, not predicted.
Out of sample it does not help: of the boards whose rating moved by 0.3+, leaving out 150 and 132, 10 got closer
to the target and 11 further (total error +4.75 tries), with large misses on levels Dennis won first try: 110
1.05 -> 4.10, 143 1.18 -> 4.15, 128 1.15 -> 3.17, 152 2.55 -> 4.17, 120 5.63 -> 7.25. Its own all-board MAE is
worse than g2.1 (1.079 vs 1.067), within 1.5 tries fewer (70.9% vs 71.8%); only the rank correlation rose
(0.39 vs 0.34). g2.1 stays the factory meter.
The 175-200 candidate measured with g5 (g5-candidate.jsonl): the big boards 180, 190, 200 do NOT meet the fog gate
(it counts face-down tiles in view at the start, fewer than the 34-36 on the board; first note here was wrong).
But g5 moves unfitted factory boards a lot, both ways: 195 4.50 -> 7.67, 194 4.40 -> 3.28, 196 4.65 -> 3.58,
200 5.02 -> 4.25, 178 +0.63, 175 +0.50; 15 of 26 within 0.15.

## human-g5.1 (2026-11-02): Gemini's unfinished g5.1, finished by Claude; adopted as the factory meter
Gemini ran out of quota with uncommitted work in its g5 worktree: g5's tuned rules undone (back to g2.1), plus two
general rules and a memory cap it had tried at 7/10/12 (its cap code was gone). Its own numbers did not reproduce
from what it left. Each piece measured on its own (live 85-174 with a target + Dennis's 24 factory boards; chosen
on odd levels and factory boards, checked on even levels), average error in tries:
| version | odd | even | factory (right = Dennis's tries to +2) | 150 | 132 |
| g2.1 | 1.069 | 1.169 | 0.278 | 2.65 | 1.13 |
| clock beside a lock (kept) | 1.065 | 1.080 | 0.278 | 2.65 | 4.65 |
| + tray lookahead 2 after the clock | 0.898 | 1.099 | 0.337 | 2.33 | 4.67 |
| + hidden-picture memory cap 10 | 0.95-1.28 | 1.11 | 0.34-0.42 | 3.40 | 4.65 |
Kept: a lock right beside the clock (left, right, on top) makes a person go for the keys first until the clock has
been lost twice. Only 132 moves (1.13 -> 4.65, now above every level 127-137; Gerda lost 54 of 70 tries to the
clock); no other live level or factory board moves by 0.3; in the 175-200 candidate only 196 (4.65 -> 5.07). A profile
switch (clockBesideLockKeys, on in the release profiles) so the older mechanism fixtures keep their profiles; the
bot's own tests 192/192. Patch on Gemini's 10cee30: tools/factory/human-g5.1.patch. Version label human-g5.1.
Human limits from the recordings (tools/factory/limits/: every take of the three players 85-174, tries up to the
first win, against the bot's takes on the same levels): when a match could be made, Dennis skipped it in 3.8% of his
takes with the clock gone (81/2123) and 26.8% with the clock on; the bot 3.8% and 25.5%. Gerda 8.5%/28.8%, Mrs.
Doubtfire 6.5%/27.3%. So the bot already overlooks matches like Dennis does (a first count per unmatched take said
5% vs 1%; wrong measure, the bot simply makes more unmatched takes); an "overlook" limit at 4% changed nothing (150
2.65 -> 2.40). What makes 150 hard is not found yet; the bot still rates it 2.65.
Dennis's own +2 rule, done by the bot (2026-11-02): the bot's family profile (setting 'family', plays like Gerda and
Mrs. Doubtfire) rates 150 7.97 and 132 7.63, the easy 145 1.55 and 153 2.2 (g5.1-family-eval.jsonl, all 103 boards).
Rating = Dennis profile + 2 when the family profile is at or above a cutoff. Odd levels say nothing about the cutoff
(their only +2 level, 91, has family 4.4); the factory boards choose 7.5 (factory error 0.278 -> 0.260). Held-out even
levels: 150 2.65 -> 4.65 (target 5), 132 4.65 -> 6.65 (target 6), but 120 and 124 (family 7.50 and 7.83; really
Gerda/Mrs. Doubtfire 4/4 and 7/5) also get +2: even error 1.080 -> 1.113. Live levels in total about equal (1.07 ->
1.09); the two family-hard levels now right. 175-200 candidate (g5.1-family-candidate.jsonl): +2 on 177, 185, 187,
195, 197, 199, 200 (family 7.67-8.22).

## Step 1 of the accuracy plan (2026-11-02): one difficulty per level from all three players
Dennis: "It is not accurate. Make a plan to make it accurate ... Less is more. Do all the work yourself."
`tools/factory/difficulty_fit.py` -> `difficulty-85-174.json`: every try up to each player's first win (plays/ end
records, 840 tries after counting a long losing run only to 12, 228 player-level runs; only tries on the board the
level has now), P(win) = logistic(skill - difficulty + learning). Pulled towards the average with sd 0.5, the strength
that predicts held-out tries best.
- Hardest three: 91, 132, 150, exactly the three levels of Dennis's +2 rule; then 156, 89, 122.
- The three players hardly agree on which other levels are hard: rank agreement of their tries Dennis-Gerda 0.17,
  Dennis-Mrs. Doubtfire 0.18, Gerda-Mrs. Doubtfire 0.06. If all shared one difficulty, the luck in single runs would
  still allow only about 0.31-0.37 (Gerda-Mrs. Doubtfire 0.06 is below even that: their hard levels differ).
- So the old levels limit how accurate any bot can look: a perfect bot would match this difficulty at about 0.5-0.55
  (simulated with the fitted spread). g5.1 for Dennis: 0.22; its family profile 0.28.
- Board facts alone (face-down tiles, clock spare, size) match the old levels at 0.43-0.60 held out, but on Dennis's
  factory boards they get the order backwards (-0.28), while the bot gets them right (0.79): the old levels' difficulty
  followed how the old generator scaled boards, the factory's comes from its puzzles. The bot stays the meter, one
  profile (Dennis): the family profile adds nothing on factory boards and gives false +2s (120, 124).

## Step 2 (2026-11-02): the yardstick and the meter tuned to the family: human-g6
Dennis: "Cause them (normal players) struggle way more then me and we need to tune difficulty to them mostly ... Take
an average tries of us 3 where Gerda counts as factor 1 and me as factor 2 and mrs doubtfire as factor 2."
- Yardstick: `family-weighted-tries.json`: per level (all three played) (2 x Dennis + Gerda + 2 x Mrs. Doubtfire) / 5,
  tries until the first win (+1 if not won). Top: 132 28.6, 150 26.0, 91 23.6, 149 17.2, 144 17.2; median 3.6.
- Gerda and Mrs. Doubtfire agree on almost nothing beyond those (rank 0.03), so most single big numbers are a
  person's own struggle; any bot can only match this yardstick partly (about 0.45 at best, estimated).
- Tried and dropped, from the recordings: skipping a visible match as often as the three do on average (5.8% after
  the clock; calibrated 0.13): the order got worse (0.28 -> 0.21) and 150 easier.
- The family profile tracks the yardstick best (0.32; Dennis profile 0.26-0.28) but lost to the clock in 37% of its
  losses (Gerda and Mrs. Doubtfire 28%), 80-100% on 120, 124, 133, 139. With Dennis's clock settings (look 3 ahead,
  counts the clock's moves, deadline attention 0.35/0.7) it loses 19% to the clock and:
  | family profile | odd | even | factory boards vs Dennis | 150 | 132 | 120 | 139 |
  | as it was | 0.28 | 0.34 | 0.72 | 7.97 | 7.63 | 7.50 | 6.35 |
  | with Dennis's clock settings (human-g6) | 0.33 | 0.40 | 0.80 | 6.20 | 7.05 | 1.83 | 1.45 |
  Bot tests 192/192. Patch on Gemini's 10cee30: tools/factory/human-g6.patch (includes g5.1's clock-beside-a-lock).
  Factory now measures with the family profile (BOT_SETTING, default 'family').
- Known gap: people's tray losses come early (median 68-76% of the board left), the bot's later (48%).
- On this scale (g6-eval.jsonl): old levels' quartiles 1.55 / 2.35 / 3.86, max 7.8 (12 tries per run cap the top);
  their harder-normal levels 121 5.2, 141 5.1, 143 3.7; 150 6.2; 132 7.05.
- Dennis: "I think mostly [I am] playing to the most possible outs always." Recordings (limits/outs_play.js): taking
  the tile that leaves the most visible matches next move: Dennis 32-33%, Gerda 30-40%, Mrs. Doubtfire 35% - no
  difference. Keeping a tray spot free is: after the clock, Dennis lets the tray reach 3 tiles in 11% of his takes,
  Gerda 19%, Mrs. Doubtfire 16%, and both bot profiles 19-20% (same levels). With the clock on: Dennis 14%, Gerda 20%,
  Mrs. Doubtfire 28%, family profile 14%, Dennis profile 11%.
- Dennis: "Some high tries can not really be real efforts but just low effort cause they are raging." Gerda taps a
  little faster on her 15th+ tries (median 0.96 s between taps against 1.20 s on her first three); a cap on each
  player's count (20 or 12 tries) leaves the order of the levels almost the same (g6 odd/even 0.33/0.40 -> 0.37/0.43
  at 12) and takes the rage tail out of the numbers: at 12, top 91 9.2, 132 8.8, 150 8.4, 89 8.0, 144 6.4, 156 6.0.
- human-g6.1 (Dennis: "why does the bot have a cap at 12 tries? 150 is more tries for them"): a bot run now gets up
  to 20 tries, and a run not won counts as 20 (before: at most 12 tries, and an unwon run counted as 4.5-8, so no
  board could rate above 8). The yardstick caps each player's count at 20 too (family-weighted-tries.json, now
  capped): 91 14.0, 132 13.6, 150 13.2, 144 9.6, 89 8.4, 122 7.6; quartiles 2.2 / 3.4 / 4.6. g6.1-eval.jsonl: odd 0.35,
  even 0.41, factory boards vs Dennis 0.82; on old levels the bot's number is about 0.74x the yardstick; 150 6.9,
  132 7.05, 121 7.1, 141 5.7, 143 3.9; factory boards 1-20. Bot tests 192/192. Patch: tools/factory/human-g6.patch.

## Fallback boards (2026-11-02)
`fallback-g61.jsonl`: every factory board built so far (87 + 7 from the first g6 build), rated by human-g6.1 (family
profile, 20 tries), with the clock's spare moved 1-2 steps where that brought a board nearer 7-10 (retunedFrom: the
rating before). Dennis: "save the fallback levels somewhere and move on to this way of designing" (designed levels,
next section).

## Luck: hidden-tile share instead of luck moments (2026-11-03)
Dennis: "Still I think you're overstating those luck moments. Some hard boards I still pass ... If boards really had
so many luck moments how can I and the bot do as well?" Right: a luck moment counted any tile that started face-down,
but a free face-down tile can be turned over before you take it, and pairs can be cleared in between. New measure
(tools/factory/limits/luck_share.js -> luck-share.jsonl): the family profile on the board as it is and with every
tile face-up; the share of the rating that goes away = what hidden tiles add (luck and memory).
150 0.12, 132 0.12, 145 0.08, blind 185 0.07, blind 194 -0.06, blind 183 0 (20 either way), release 185 0.24;
91 0.74, 149 0.60, factory 2-175 0.74; factory 6-190 -0.41 (face-up plays worse: noise or the bot's peeking habit).
So 150, 132 and Dennis's hard blind boards are hard by their traps and clock; 91 and 149 by hidden tiles. The trap
designer keeps the deal's face-down tiles and allows at most 0.3 of the rating from them (above: face-down only on the
traps, measured again; still above: out).
- Dennis: "I will also argue at least 149 is not a luck level. I passed it in 2 tries." The bot for Dennis also
  rates 149 3.45 as it is and 1.50 face-up (91: 2.45 / 1.07), while Dennis needed 2 (91: 5). So hidden-tile
  difficulty is partly skill - keeping a spot free and remembering what you saw, which Dennis does better than both
  bots (tray at 3 after a take: Dennis 11%, bots 19-20%) - not only luck. Limit loosened to 0.5 (half the rating
  may come from hidden tiles). The real fix: give the bot Dennis's free-spot habit; then what hidden tiles still add
  for that player is the luck.

## Real luck needs a bot that plans like Dennis (2026-11-03, night)
- Free-spot habit (spotPenalty: a take that leaves 3 waiting after the clock costs that much): the bot's rate of
  "tray at 3 after a take" 18.5% -> 16.6 (30) -> 15.0 (80) -> 13.7 (200; no lower at 600); Dennis 10.5% on the
  same levels. Closes about 60% of the gap.
- Face-up comparison with that skilled player (luck-faceup-skilled.jsonl) is not a luck measure: with every tile
  face-up the bot plays some boards much worse (150 2.42 -> 6.47).
- Oracle comparison (luck-oracle.jsonl; G51_ORACLE=1: the player is told every hidden picture, the board unchanged):
  132 4.63 -> 3.90, 150 2.42 -> 1.75, 149 3.90 -> 1.43, 91 2.45 -> 1.00, blind 185 19.75 -> 17.43, blind 183 12.5
  -> 6.33; but blind 194 9.53 -> 15.55 and factory 6-190 2.55 -> 3.92: knowing more makes it worse there, so its
  planning is short-sighted. Dennis: "Maybe the planning ahead I do should be added before we can really measure
  luck." Agreed: the test for that planning is that more knowledge never hurts.
- First try at planning (planAhead: an unknown tile counts for less as a way out): tray-at-3 rose (14.6-15.2%), so
  it is not what Dennis does. Next: a short search over known tiles (can the tray be brought down again before a
  4th?), checked by "knowing more never hurts" and Dennis's 10.5%.
- These switches are experiment-only (env G51_SPOT, G51_PLAN, G51_ORACLE); the release profiles are unchanged.

## Dennis's planning, calibrated (2026-11-03 night): the skilled player
Dennis: "do this and keep calibrating planning until the 3-tray rate gets close to my 10.5%". Measure: the share of
takes after the clock that leave 3 tiles waiting, levels 85-174 with lv % 8 in {0, 4} (planning-calibration.log).
| bot | tray at 3 |
| Dennis profile as it was | 18.5% |
| + spotPenalty 200 (a take that leaves 3 waiting costs) | 13.7% |
| + look-ahead (lookDepth 2, lookPenalty 150, from the 1st tile: with known tiles, can the tray come down again?) | 13.3% |
| + pairFirst 100 (after the clock, the first tile of a free face-up pair, when no match is possible) | 12.6-13.3% |
| + freePeekBonus 40 / 70 (turning face-down tiles over) | 11.3% / 10.6% |
| Dennis | 10.5% |
From the recordings behind those habits: with an unmatched take Dennis's tile has its twin free and face-up in 35-54% of
cases (Gerda 41-61%), the bot 16-23%; Dennis turns 1.20 face-down tiles over per tile taken (Mrs. Doubtfire 1.25,
Gerda 0.86), the bot 0.84; Dennis's takes start from an empty tray 20% of the time, the bot's 9%. Raising trayCost
(12, 25) or treating unknown tiles as hope (planAhead) did not help. The switches are env-only for now (G51_SPOT=200
G51_LOOK=2,150,1 G51_PAIR=100 G51_PEEK=70); patch human-g6.patch.
Knowing-more test with this player (luck-oracle-skilled.jsonl; told every hidden picture, board unchanged):
132 4.63 -> 3.90 (luck 0.16), 150 3.08 -> 1.75 (0.43), 149 3.23 -> 1.43 (0.56), 91 3.08 -> 1.00 (0.68), 145 3.77 ->
1.00 (0.73), blind 185 19.9 -> 17.8 (0.10), blind 183 11.95 -> 6.33 (0.47), release 185 5.47 -> 1.48 (0.73),
factory 2-175 2.20 -> 1.88 (0.15). Still worse when it knows everything: blind 194 8.88 -> 15.55 and factory 6-190
2.65 -> 4.00: on 194 (clock 24 moves) its clock losses go 125 -> 297 - with every pair known it keeps pairing and runs
out the clock. That is the next fix (the clock before pairs when the clock's moves run short).
- Fixing "knowing more hurts" (2026-11-03 morning; env-only switches): clockFirst (a pair off the clock's way costs
  when the clock's moves run short) 194 knowing everything 15.55 -> 14.5-14.9, 6-190 4.00 -> 3.15; clockNeedFull (count
  the keys' covers, the second neighbour of double ice, and the tray: needed tiles without their twin beyond 2
  waiting) - the bot's count for 194's clock goes 12 -> 23 without knowledge (the designer's way is 23), 17-19 with
  everything known; 194 still 9.25 -> 14.78. On 194 the clock has 24 moves for a 23-move way: any extra take loses
  the clock. With hidden tiles the bot turns many over (free) and loses to the tray; knowing everything it takes
  pairs off the way and loses to the clock (first 30 taps: 11 off the way). The bot is not a route planner; a person
  finds that exact way over a few tries.
- Route planner (Dennis: "Build a route planner first"; env G51_ROUTE=300,300): while the clock is on, a beam search
  (width 300) for a way to take the clock within its moves, never more than 3 waiting, the clock taken with at most 2
  waiting or a known way down; unknown pictures never match; the plan is followed (+300) and made again when the board
  leaves it. Knowing-more test (luck-oracle-planner.jsonl): factory 6-190 2.38 -> 1.02, blind 194 2.35 -> 1.10 (was
  8.88 -> 15.55; as it is it now needs 2.35, Dennis needed 4), and every board with everything known comes to about 1
  try (132 4.7 -> 1.0, 150 2.35 -> 1.0, blind 185 19.1 -> 1.0); only blind 183 still fails knowing everything (14.55 ->
  20). So with perfect knowledge and planning every board is solved: the hidden tiles are the puzzle, and this
  comparison gives 0.53-0.95 everywhere (132, the clearest skill level, 0.79). It cannot tell luck from skill.

## The skilled player (human-g6.2 'planner') and luck with relief (2026-11-03)
Dennis: "Tune the routeplanner bot to my stats. After, if it then needs more tries than with all tiles showing, part
of it is luck. We can measure those luck moments and they can stay in the game as long as you have a way to relieve
the tray in between so a skilled player passes those luck moments. We want the designer to know about this."
- measureHuman setting 'planner' = Dennis's profile + spotPenalty 200, look-ahead (2, 150, from the 1st tile),
  pairFirst 100, freePeekBonus 70, clockNeedFull, routePlan 300 (beam 300). Tray at 3 after the clock: 10.7% (Dennis
  10.5%). Against Dennis's own tries (planner-eval.jsonl): live 85-174 off by 0.94 on average, rank 0.28 (g2.1 1.00,
  0.18); factory boards good up to the middle (blind 194 2.35, Dennis 4), but too hard on his three hardest: blind 183
  14.55 (Dennis 6), blind 185 19.1 (6), old 194 20 (9+) - next: routeHope (an unseen tile counts as part of a spot).
  The release Dennis and family profiles are unchanged (bot tests 192/192).
- Face-up comparison with the planner (luck-faceup-planner.jsonl): every board to about 1 try face-up (132 4.7 -> 1.02),
  so it cannot be the luck measure: the hidden tiles are the puzzle.
- Luck moments, redefined: a dig - an unmatched take that uncovers a face-down tile not seen - with 2 or more waiting,
  on the emptiest way through; unrelieved when the tray has not come down to 1 or less since the one before.
  132 1/0, 150 0/0, 145 0/0, 91 0/0, 149 1/0, factory 6-190 1/0, release 185 0/0, blind 185 3/1, blind 194 3/2,
  factory 2-175 2/1, blind 183 6/5. The trap designer allows at most 1 unrelieved (UNRELIEVED_MAX) and checks "a
  skilled player can do it" with the planner.
- routeHope 0.5 / 0.25 changes nothing on Dennis's hardest boards: the planner is not what fails there. Blind 185
  (Dennis 6): the planner takes the clock in 187 of 191 tries, then loses to the tray with 60 of 80 left - Dennis
  restarted five times at 61-67 left and won the 6th: same trouble spot, he learns across tries faster. Blind 183
  (clock 37 for a 35-move way): the planner reaches the clock in 6 of 131 tries; Dennis did not win in 5. Old 194
  (clock 19 for 18): the planner never reaches it; Dennis did not win in 8. So the gap is learning over tries on very
  long or tight clocks, not luck or planning in one try.

## Whole boards designed from a tray script (2026-11-03, `tools/factory/script_board.js`)

Dennis: "Can the whole board get designed first instead of being a random deal?" Three tries, family bot g6.2:
- `scriptedDeal`: the way through first, pictures along calm / pressure / relief stretches, face-down only at planned
  digs. Bare boards (no specials, 4 piles): family ~1 try, the same as a random deal (1.0-2.4). With ~10 free tiles
  a player is never bound to the planned way.
- `rescript`: the same along the trap board's own way (pressure on the way to the clock). 175: 7.05 -> 3.8 (tray 2),
  3.75 (tray 3), 3.4 (+ a middle stretch). Easier: under pressure a player matches elsewhere, and the calm stretches
  put easy pairs there.
- `squeeze`: few free pairs anywhere on the way to the clock, many right after. 175: 7.05 -> 2.4 (full) / 2.7 (half);
  177: 18.8 -> 12.4 (full) / 17.1 (half), skilled 1.15 vs 4.8 - not even in order.
Conclusion: no picture rule tried here steers difficulty; moving the pictures of a board that measured hard mostly
loses what made it hard. The structure stays designed (traps, clock, locks, luck and relief checked by the bots);
the pictures are tuned by the family bot itself (steer_design.js). Log: `scripted-boards.log`.

## Codex's factory adopted; rules weighed; learning (Claude, 2026-11-04)

Codex's `wip/codex-level-factory` (4 commits on 13e7ab9) is now `wip/level-factory`: one checkout with the bundled
g6.2 meter (same physics as the calibrated bot), cache, bounded clock-route search, fresh original layouts, pooled two-seed
rating with a held-out seed, batch assignment and phone preview. 23 tests pass.
Curve (Dennis 2026-11-04: "we need to start at 200 now that players are further"): 175-199 stay; new levels 200-225,
200 at 7 family tries -> 224 at 9 -> 225 at 10, big boards only at 210 and 220.
Rules weighed:
- Kept from Codex: original layouts (no crop/mirror/reskin, <75% shared), seed agreement within 2 tries + holdout,
  don't-grab causal check, idle-special repair, late squeeze only a warning (Dennis).
- Kept from before: family target +-0.5, skilled planner <= 6, at most 1 unrelieved dig (relief >= luck - 2), losses at
  the traps >= 60%, every special matters, clock spare 1-3.
- Dropped (agree with Codex): the separate "clock too loose" critic - it needs another bot; the clock must change the
  family rating (ablation) and the spare stays 1-3, which covers what Dennis called "adds nothing".
- Lesson about noise: two 40-game seeds on the same board correlate 0.74 across 316 boards, so single-seed steering steps
  partly chase noise; acceptance uses the pooled rating (tune_original.js).
Learning ("learn from what works and doesn't"):
- `moves.js`: every measured steering change is journaled (`build/factory-moves.jsonl`, seed `moves-seed.jsonl` from the
  first 25); its usual effect ranks the next changes. First lessons: all ice thawed is a cliff, a frozen chain made boards
  easier, the 'softer' face-up and relief swaps did not soften. Hence graded steps: one ice softer/harder, half the ice,
  one lock.
- `predict.js` + `learned-model.json`: family rating guessed from a board's make-up (1537 rated boards; rank 0.59). Orders
  the screening queue only; top quarter lands within 2.5 tries 20% vs 8% for the bottom quarter (in-sample).
  Strongest levers: a long way to the clock (harder), more face-down tiles (easier on these boards).

## New curve (Dennis, 2026-11-04 23:39)
"I think the first levels are too easy. Start the levels at 10 tries at 200." Asked whether that meant the family or
him: "1 [family 10 -> 13] and require the skilled bot to at least need 2.5-3 tries."
- Family curve 200 at 10 -> 224 at 12 -> 225 at 13 (big boards 210, 220): `batch-200-225-v10-plan.json`.
- Skilled player at least 2.5 tries (`skilledMin`, `FACTORY_SKILLED=2.5,6`); at most 6 as before.
- Screen/rate bands follow the curve: `FACTORY_SCREEN=7,17 FACTORY_RATE=8,15`.
- Note for Dennis: on the bot's scale 132 and 150 sit at about 7, so 10-13 is above anything the family has played.
- Of round 1's 15 qualified boards only the 225 board (family 10.05, skilled 5.42) fits the new curve (at 200).
- Dennis's follow-up: all new boards contain more than 70 tiles (minimum 72), and block shapes are discouraged.
  The v10 piles have whole non-block alternatives. The old 64-tile two-island 212 is ineligible; a fresh 76-tile oval
  with two islands explores its key/ice/clock concept on the higher curve. Candidate targets follow the current plan.

Task 04 adopts the planner-only clock-logic fix at `8e33270`. Old skilled scores
are retained for comparison and potential current-curve boards are rechecked,
including every old `plannerScreen` / skilled >6 rejection. The family measure
is unchanged; the factory keeps its values with an explicit revision-pair cache
migration. The 2.5–6 skilled gate remains: a rescued board that now rates below
2.5 still needs hardening. No old planner rating can qualify a new output.

## Direction: a box of trap pieces (Dennis, 2026-11-05 23:27)
"I like all this work but I dont really want to play the levels. We want the designer to have tiny puzzle pieces /
traps that it uses to design every level and knowing how hard the outcoming level generally will be."
- No routine playtesting by Dennis; the bots confirm. His existing lab plays still count where they exist.
- Codex Task 07: a piece catalogue (smallest nameable mechanisms with 1-2 parameters, each owning its tiles), every
  piece measured alone and in common pairs on calm base layouts (family and skilled), a composition model that predicts
  a level's family and skilled tries from its pieces (checked on held-out boards), and a designer that picks pieces to
  hit each slot and tunes one piece at a time by its measured effect.
- Skilled player = better of two styles (3201e1e). Task 05: 9/26; main gap: traps that catch the family but not Dennis.

## Curve tolerance and pressure frames (Dennis, 2026-11-06)
Task 07 (Codex): 16 pieces measured alone and in pairs on 8 calm boards: everything except the clock frame stays at
~x1.00; the clock's depth and the share of the board before it set the difficulty; pieces bite only under that pressure
(one-piece cliffs 11.6 -> 17 -> 7.3). The additive model failed prospectively (12 new boards: family MAE 7.64, none
qualified). 10/26 levels.
Approved ("ye to 2 and 1 ok"):
- Tolerance: per level pooled family within +-1.0 (tuned rows also the fresh seed); every 5 consecutive levels
  average within +-0.5 of the curve. Reason: two runs of one board differ ~1-1.5 tries at 10.
- Pieces inside a pressure frame: frame (clock depth, way share, spare) measured first, then each piece's effect
  inside representative frames; pre-registered test (>= 8 of 12 new compositions within +-1). Codex Task 08.
