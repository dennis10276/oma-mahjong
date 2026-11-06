# TASK 10 — Builder v2, phase 3: knobs that reach the curve (Claude → Codex, 2026-11-06)

Thanks for Task 9, the builder review and the clock-spare study (`analysis/builder/codex-review.md`,
`knobs/clock-spare-1`). Claude has merged `wip/codex-level-builder` into `wip/level-builder` (merge commit `cbb6a29`).
- **Rename:** Claude's rebuild harness is now `tools/builder/knob_rebuild.js`, so your `knobs.js` keeps its name.
- **Restored:** pieces/frames modules that Claude had retired; your empirical_* code still needs them.
- **Tests:** all 157 builder and factory tests pass.
- **Branch:** start a new branch `wip/codex-builder-knobs` from `origin/wip/level-builder`, at commit `0b11415` or later.

## What we know now
- **Phase 2 passes:** your strict gate gives 135/150 builds, every intent proven, 0 idle specials, all under 5 s.
- **Clock spare is a secondary knob:** spare 1 → 3 makes 18/20 boards easier for the family (mean −0.95 tries).
  It is too uneven to convert into a number of tries.
- **Built boards are far too easy at the gate settings, and the skilled bot is almost always ~1.**
  - Family ratings in the spare study are mostly 1–6 tries; the target is 10 → 13 for 200–225.
  - frozenGuards (and one clockInSight board) jump to 15–20.
  - Of the 6 missing Task 9 slots, 5 failed partly on "skilled too easy"; seed disagreement and idle ice are the
    other reasons.
- **What drives difficulty** (Claude's analysis of 1,989 measured boards, `analysis/builder/descriptors-report.md`):
  - **Family:** moves with 3 tiles waiting on the shortest way to the clock (`card.tray.three`), and the length of
    that way.
  - **Skilled:** luck moments, i.e. face-down tiles uncovered while 2+ tiles wait (`card.tray.luck`). After those,
    losing and tempting moves on the way (decision traps).
  - The gate briefs ask for little of any of these.
- **New, `opts.keep`:** `B.build(brief, { keep: result.keep })` rebuilds the SAME puzzle and only places the
  pictures and face-down tiles again. The same puzzle means the same clock, keys, locks, ice, dig and holders.
  - So `targets.three`, `targets.luck`, `targets.traps` and `frame.spare` can each change on their own, the way
    your clock study changed only the clock.
  - Test: `test_builder.js`, last test.
  - Way length and story change the puzzle itself, so compare them across boards.

## Rules (as before)
- Never touch `main`. Never write to Firebase. One CPU-heavy job at a time.
- No release, and no change to the game's level table. Claude selects levels and prepares any release, with
  Dennis's OK.
- Results go to `codex-tasks/results/builder-knobs-v1/` and to `source/analysis/builder/knobs-v1/` on your branch.
- Keep a running note in `source/build/TASK-10-RUNNING.md`.

## 1. Knob study: same puzzle, one knob (CPU-heavy)
- Use the same protocol as clock-spare-1: a frozen plan before any bot call, the same seeded campaigns per
  variant, checkpoints, family (4711 + 18427, 40 campaigns each) and planner.
- Bases: about 24 puzzles, 2–3 layouts per story, built with trayRoom 0, spare 1, moderate targets
  (three 3, luck 1, traps 0), and frame.way as long as the layout allows (≥ 12 where possible).
- Variants of each base via `opts.keep`, one knob each:
  - three: +2 and +4;
  - luck: +1 and +2, raising hiddenOnWay with it;
  - traps: 1 and 2 designed decision traps;
  - spare: 2 (to compare with your study).
- If a target is impossible on a puzzle, the builder returns `unproven`. Record that; don't count it as a
  measurement.
- The check is the plan's: a knob moves the family rating the expected way on ≥ 80% of boards, and cliffs
  (> 5 tries) are banned or split.
- Also report the skilled bot separately: the missing slots need knobs that raise skilled to 2.5–6.

## 2. Range study: which briefs land in the band (CPU-heavy)
- Grid across puzzles: for each story, way ∈ {10, 14, 18} (as the layouts allow), three ∈ {2, 5, 8} and
  luck ∈ {0, 1, 2}, with traps 0 and 1 on the most promising cells. Spare stays 1.
- Use one seed per cell. Add a few cells repeated on 3 seeds to show the spread.
- Output a table per story: family and skilled per setting, plus which settings land in family 10–13 with
  skilled 2.5–6.
- Fit a plain additive table: family tries ≈ story base + way step + three step + luck step + trap step, and the
  same for skilled. Give the median absolute error on held-out cells.
- No fancy models: Dennis wants rules he can read.
- Watch frozenGuards: several boards hit the 20 cap. Find out why (a bot weakness, or a genuinely brutal story)
  and say whether the story needs a milder variant.

## 3. Then straight on: fill the 6 missing slots with the builder (Dennis 2026-11-06: fewer in-between steps)
As soon as 1-2 show settings that land in the band, go on without waiting for a review:
- The slots are 208, 210 (big, 96 tiles), 215, 216, 217 and 221, with targets from the curve.
- Write a brief per slot from the range table, using an original layout that is not used by neighbouring levels.
- Build boards per slot until one qualifies, at most 8 per slot. Run your existing Task 9 qualification on each:
  pooled family within ±1, fresh seed, skilled 2.5–6, originality, 5-level window, previews.
- Report the first-check hit rate: the share of built boards landing within ±1 on their first bot check. The
  plan's phase 4 target is ≥ 50%.
- Hand back the full 200–225 set the usual way (results folder plus `levels.jsonl`): the 20 kept levels plus the
  new ones. Claude reviews them and prepares the release with Dennis's OK.

## Speed (Dennis 2026-11-06): stop early, filter before the bots
Build these into your measuring code first and use them in steps 2 and 3. Step 1 (the knob deltas) keeps the
full protocol, so that its comparisons stay clean.
- **Stop early.**
  - Play the first family run (seed 4711) in blocks of 10 campaigns.
  - After 20 campaigns, stop a board whose estimate is clearly outside the band: more than 4 tries below the
    target, or above it. Give a 20-try cap no special treatment.
  - Calibrate the "clearly" margin on the boards you have already measured in full (clock-spare-1, Task 9
    pools): an early stop must almost never (< 2%) throw away a board that the full protocol would qualify.
    Report that check.
  - A board that is not stopped gets the full protocol, so qualification never rests on a shortened measurement.
  - Do the same for the planner: stop early when skilled is clearly below 2.5, or clearly above 6.
- **Filter before the bots.**
  - Once step 2 has its additive table, predict family and skilled from the brief and the card (story, way,
    three, luck, traps, spare).
  - Skip boards predicted more than 3 tries outside the band.
  - Log how many boards the filter skipped and, on a small random sample of skipped boards that you do measure,
    how often it was wrong.
- **Report the CPU saved:** campaigns played compared with the full protocol.

## Small test: can the GPU play our games faster? (Dennis 2026-11-06: "worth considering")
A feasibility probe only. Do not change the real bots, the meter or any rating.
- **What's on the PC:** check which GPU it has and what can drive it: `nvidia-smi`, the driver, and whether CUDA,
  Python with CuPy/Numba/PyTorch, or Node WebGPU is available. Install only into a separate virtual environment
  or folder.
- **Write a GPU playout kernel** in a new folder `source/tools/gpu-probe/`:
  - It covers the game's rules: free tiles, tray of 3, ice, locks and keys, clock, face-down tiles, peek pair.
  - The bot is deliberately simple: take a tray match if there is one, else a free pair, else a random free
    tile; turn over face-down tiles when free.
  - It plays many independent games of one board at once (one thread or warp per game).
- **Write the same simple bot on the CPU** in Node, for a fair comparison. Check that both give the same win rate
  on 3 boards (within sampling noise) and the same result for a fixed seed where possible.
- **Measure games per second**, GPU and CPU (all cores), on a 76-, 84- and 96-tile board, at 1k, 10k and 100k
  games.
- **Estimate the speed-up for the real family bot,** which branches far more (memory, route planning,
  look-ahead). Say what would have to move to the GPU, what could not, and roughly how much work a full port
  plus re-calibration would be.
- **Report:** `gpu-probe.md`, plain language, with the numbers and a recommendation: worth porting, or not.
- **Timing:** about half a day of work at most. Run it when the CPU-heavy steps are not using the machine, or
  alongside them if the GPU test hardly uses the CPU.

## Hand-back
Say "Task 10 done", with the branch name, the results folder and a short plain-language summary for Dennis
(`summary-for-dennis.md`):
- which knobs work, and how many tries each step is worth for the family and the skilled player;
- which briefs land in the band;
- the hit rate, and which slots are filled;
- the GPU probe's speed-up and its recommendation.

If 1 or 2 shows that no setting reaches the band, skip 3 and report what is missing.
