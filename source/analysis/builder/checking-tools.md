# Checking tools: what stays, what changed, what went (Claude, 2026-11-06)

Dennis: "Go over the rest of the checking tools and discard or modify if not needed anymore." The cause was the
PEEK PAIR rule (www/js/board.js `peekPair`): a turned-over free face-down tile and its free twin are taken together
without a tray slot, even with 3 tiles waiting. The game and both bots (family, skilled) know it; most of the
offline checkers did not.

## The reference from now on

`tools/builder/engine.js` follows the game's own rules, peek pairs included. `{strict: true}` switches them off and
then agrees with the old checkers. Use it for:
- winnable;
- the real fewest moves to the clock (`clockShortest`);
- decision traps (`classify` / `traps`);
- replaying a stored path that may contain peek pairs (`replay`).

## What the strict checkers missed

On the 18 qualified 200-225 levels, peek pairs make the way to the clock shorter on 5 boards, so their clock has
more spare moves than recorded:

| level | recorded spare | real spare |
|---|---|---|
| 202 | 2 | 4 |
| 203 | 3 | 4 |
| 204 | 1 | 3 |
| 222 | 3 | 5 |
| 225 | 1 | 3 |

Their ratings are still right, because the bots play peek pairs. They stay qualified, as Dennis decided. The
builder sets new clocks from the real fewest moves.

## Kept unchanged (strict is safe: a path they accept also works in the game)

- `www/hard.js` validSolution and clockRoute, and `www/layouts.js` solve (the hint): live game code, not touched.
  - Release-time decision: a builder level whose clock relies on a peek pair has no strict witness. Before such a
    level ships, either validSolution learns peek pairs or the level keeps a strict witness. This needs Dennis's OK.
  - Small game issue: the hint's solver does not know peek pairs either. With 3 tiles waiting and only a peek pair
    as the way out, the hint says "no way" although the level can still be won. The fix (in layouts.js solve) waits
    for Dennis's OK, like every live change.
- Guards of the levels already shipped, used by the game's own tests: `tools/sim/clock_routes.js`,
  `tighten_clocks.js` (`t_clocks`), `reorder_honest.js` + `sim/honest/` (`t_curve`, `t_reorder_honest`),
  `calibrate.js` + `levels.js` (the source of `calibration.json`, `t_hard`).
- Bots and their physics (`tools/sim/refit/`): they already model the peek pair (openPeek in the controllers).
- Factory checks still used by the batch pipeline: `meter.js`, `batch_evaluate.js` (its quality stage now holds the
  "every special matters" rule), `trap_supports.js`, `skilled_evidence.js`, `originality.js`, `preview_check.js`
  (renders a batch in the real game), `real_losses.js`, `design_traps.js` roomProfile (luck moments; its own note
  already says it overstates luck), and the 91 factory tests (all pass).

## Modified

- `tools/lab/exact.js`: the header now says it is strict and can be 1-2 moves too long, and points to the engine for
  the real fewest moves. No code change, because its paths must stay valid for validSolution.
- `tools/factory/batch_verify.js`: `realSpare(design)` (from the engine), reported next to the strict spare for
  every level where the two differ. It only reports and never fails, so the kept levels pass.
- `tools/builder/builder.js`: sets the clock from the engine's real fewest moves (peek pairs on).

## Retired (deleted; still in git history)

| tool | why |
|---|---|
| `factory/specials_matter.js` | bot ablation of each special, replaced by batch_evaluate's quality stage (group ablations) and the builder's proofs |
| `factory/critic_probe.js`, `factory/curve_live.js` | needed a scratch checkout that no longer exists (Gemini g2.1 bot); the curve now lives in the plan files |
| `factory/designer_holdout.js` | hold-out check of Gemini's bot designer, which is not used |
| `factory/judge_features.js` | features for the difficulty "judge"; the composition models were dropped |
| `factory/grab_early.js` | one-off "grab the clock first?" probe; engine `classify` answers that for any board |
| `factory/lab_clock_warnings.js` | one-off lab batch 11 (Gemini critic's clock warnings) |
| `sim/validate_levels.js`, `sim/validate_focused.js`, `sim/measure.js`, `sim/survey.js` | measured the shipped table with the old three test players; the family and skilled bots replaced them, and the game's tests check the table's solutions |

Kept on purpose although they cannot run any more: `factory/limits/*.js`. They are not checkers but the record of
the human-limits study (analysis/factory/README.md cites them, and their results are in analysis/factory/).
