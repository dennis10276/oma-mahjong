# TASK 11 — Why built boards are easy or brutal: data for builder v3 (Claude → Codex, 2026-11-07)

Thank you for Task 10: careful work and an honest negative. It has been merged into `wip/level-builder` (merge
`646a8d2`, plus Gemini's GPU probe `6ca23a0`).

**Main objective (Dennis, 2026-11-07): improve the level builder.** Completing 200–225 may happen along the way,
but it is not the goal of this task. Your job is to measure what the builder needs to learn. Claude changes the
builder (v3) from your findings.

## What Task 10 taught us
- **Picture-level knobs do nothing.** On the same puzzle, more moves with 3 waiting, more luck and more designed
  traps move the bot ratings by about 0 tries.
- **Clock spare works,** about −1.1 family tries per extra move (frozen keys excepted).
- **Difficulty lives in the structure and jumps:** a way of about 10 moves gives 2–6 tries; 14+ often hits 20.
- **Claude's reading:** the builder made pressure without choices. When every move on the way is forced, a
  player (or bot) cannot go wrong, however full the tray. Historical boards are hard because their pressure comes
  with real choices.
- **Frozen keys partly fool the planner,** which does not see a frozen key as a key. That story is out of builder
  v3.
- **Readability:** every pilot board failed the readable-objective rule, because face-down tiles on the way hide
  it. Builder v3 keeps the way readable.

## Rules (as before)
- **Branch:** start `wip/codex-why-hard` from `origin/wip/level-builder`.
- **Hands off:** never touch `main` or Firebase. No release and no change to the game's level table.
- **The PC:** one CPU-heavy job at a time. Gemini may benchmark in short bursts.
- **Results:** `codex-tasks/results/why-hard-v1/` and `source/analysis/builder/why-hard-v1/`, plus a running note
  in `source/build/TASK-11-RUNNING.md`.
- **Speed:** use early stopping wherever the full protocol is not needed, as in Task 10. Gemini is making a
  zero-drift fast mode for the bots (Task G2 part A). Once Claude merges it into `wip/level-builder`, switch to
  it: it gives identical ratings.

## 0. First: hidden keys (Claude's finding, `analysis/builder/why-hard-claude.md`)
On Task 10's boards with keys, the jump is mostly key visibility at the start.

| keys showing at the start | family median | share at 18+ |
|---|---:|---:|
| none | 19.8 | 88% |
| one | 13.0 | 38% |
| both | 6.3 | 36% |

On a 20-try board the family bot wanders. Its first losing move is an off-way pair, and when those pairs are
removed it wanders with singles. It does not know where the keys are.
- **Check the bot's memory.** After a key has been uncovered in try k, does the family bot go for it in try k+1?
  Look at `public_key_identity_memory.js`, `retryKeyIdentityMemory` and `human_factory_controller.js`
  (keyTiles/needLeft).
- **Measure it.** On 10 hidden-key boards, measure how often the bot's next try digs straight to a key it already
  saw.
- **Report plainly:** is the 20 real difficulty (a person would also keep failing), or a memory blind spot?
- **Fix what you find (Dennis, 2026-11-07: "It may fix anything really. If it finds another blind spot let it fix
  that as well").** That covers the bots, the builder, the engine, the describe and gate tools and the factory
  pipeline: any blind spot or bug you find in this task, not only the key memory. Each fix gets a test, a line in
  your running note and a line in the hand-back. For the bots, the rules below apply.
  - Fix the decision logic only (controller and memory: `human_factory_controller.js`,
    `public_key_identity_memory.js` and their neighbours). Gemini is speeding up the environment
    (`human_style_environment.js`, `human_board_visibility.js`, `production_physical_session.js`) in Task G2.
    While G2 part A is open, avoid editing those three files: if a fix needs them, put the change in your note
    and Claude will coordinate it.
  - Make it a new bot version, never a silent change: a new profile/setting name, a fingerprint change in
    `meter.js`, and no cache migration (ratings really change).
  - The new bot must still match real people at least as well as today. These were the fits used to release the
    bots:
    - Dennis's own lab wins on his 24 lab boards (off by 2.05 with the current planner);
    - Dennis's first tries on 200 (5) and 225 (4);
    - the live levels 85–174 against the family's real plays (off by about 1.05–1.10).

    Give both numbers, old and new. If the fit gets worse, stop and report instead of shipping.
  - Re-rate with the new bot: the 20 kept levels for 200–225 (show how many still sit within ±1 of the curve),
    the Task 10 boards with hidden keys, and your part 2 ladder.
  - Put it on your branch with tests. Claude reviews and merges it. The bots are offline tools, so nothing in
    the game changes.
- **Use it in part 1:** add "keys showing at the start" and "moves until both keys show" to every error profile.
- **The second cause:** builder v3 now has `targets.keysShown`. Claude's causal check (`why-hard-claude.md`
  section 5) shows that hidden keys raise the rating on 5 of 6 pairs. Some boards are brutal with both keys
  showing, because the order is unique under forced pressure: only 1 of 16 moves at the start wins, and it is
  not the obvious one. Measure in part 1 how often that is the cause.
- **New since Task 10:** builder v3 keeps the way readable by default, as a proven intent (`placement_score.readable`).
  Build part 2's boards with it.

## 1. Where do the bots lose? (main job)
Take about 60 Task 10 boards spread across the range: about 20 at 2–6 family tries, 20 at 8–14, and 20 at 18–20,
from several stories and layouts. No frozen-key boards.
- **Record traces:** for each board, record the family bot's and the planner's moves in a sample of campaigns.
  The environment already has a `capture` option.
- **Score every move with the engine:** for each decision of the bot, run `engine.js` `classify` on the state
  before the move. Was the chosen move winning or losing? How many legal moves did it have? How many of those
  lose, and how deep (moves until the loss is forced)?
- **Per board, write an "error profile"** and a short plain story of the typical loss:
  - the number of real decision points on the way to the clock (≥ 2 legal moves and at least one losing);
  - the bot's chance of a losing pick at each, and the kinds of losing pick (a 4th tile, the clock too late, the
    wrong dig, a free pair taken too early, a peek);
  - at which move and which try it usually loses;
  - and, across tries, what memory fixes and what it does not.
- **Compare** the error profiles of the 2–6, 8–14 and 18–20 boards. What is different about the hard ones:
  - more decision points;
  - deeper hidden losses (the loss only shows many moves later);
  - choices that look the same but are not;
  - or the route itself (keys far away, length)?
- **Check what's real and what's bot:** for the 18–20 boards, say whether the losses look like real difficulty
  for a person or like a bot blind spot, as you did for frozen keys. Give 2–3 example boards with move numbers,
  so Claude and Dennis can play them.

## 2. Way ladder: a slope or a cliff?
- Pick 6 story/layout pairs (not frozen keys).
- Build each with `hiddenOnWay 0` (a readable way) and the way length in single steps from 9 to 15 moves (only
  the steps the layout allows), at spare 1 and at spare 2. Use a few seeds per cell.
- Rate them (full protocol, family and planner).
- Report the rating against way length per pair: a steady slope (then the way length is a knob) or a jump (then
  where).
- Also report any other structural quantity on the builder's card that moves with the jump: key distance, number
  of specials, dig shape, decision points from part 1.

## 3. Along the way: 200–225
- If a board from part 2 happens to land in a missing slot's band (208, 210, 215, 216, 217, 221) and passes your
  Task 9 qualification (with the readable-objective rule), hand it back with the usual evidence.
- Do not build boards just for the slots.

## Hand-back
Say "Task 11 done", with the branch, the results folder and a `summary-for-dennis.md` in plain language:
- where and why the bots lose on easy and on brutal boards;
- whether way length is a slope or a cliff;
- the 3 most useful things builder v3 should be able to control, with the evidence for each.
