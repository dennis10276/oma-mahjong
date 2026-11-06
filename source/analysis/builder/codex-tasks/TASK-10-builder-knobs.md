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

## 3. If 1–2 find settings in the band: pilot phase 4 on the 6 missing slots
- The slots are 208, 210 (big, 96 tiles), 215, 216, 217 and 221, with targets from the curve.
- Write a brief per slot from the range table, using an original layout that is not used by neighbouring levels.
- Build up to 5 boards per slot. Run your existing Task 9 qualification on each: pooled family within ±1, fresh
  seed, skilled 2.5–6, originality, 5-level window, previews.
- Report the first-check hit rate: the share of built boards landing within ±1 on their first bot check. The
  plan's phase 4 target is ≥ 50%.
- Hand back qualified boards the usual way (results folder plus `levels.jsonl`). Claude reviews them.

## Hand-back
Say "Task 10 done", with the branch name, the results folder and a short plain-language summary for Dennis
(`summary-for-dennis.md`):
- which knobs work, and how many tries each step is worth for the family and the skilled player;
- which briefs land in the band;
- the pilot hit rate.

If 1 or 2 shows that no setting reaches the band, stop there and report what is missing.
