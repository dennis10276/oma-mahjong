# Task 07: measured trap pieces

The implementation is a working research prototype. It can place local mechanisms,
measure them, predict a composition and confirm it. The current model **cannot yet
place new levels on the requested curve reliably**. The first twelve new
compositions had family prediction MAE 7.64 tries; none qualified. Do not replace
the full bot gates with its predictions.

The handbacks are `codex-tasks/results/pieces-v1/RESULT.md` and
`codex-tasks/results/200-225-v12/RESULT.md` beside this checkout. The latter has
10/26 qualified slots: the nine Task 05 keepers plus the exact approved 225 under
Task 07's existing human-win rule. No new composition qualified. The game,
calibrated bots, Firebase and release files are unchanged.

## Pieces and measurements

`tools/factory/pieces.js` contains sixteen local mechanisms, each with at most
two parameters. `place(kind, board, way, params, rng)` returns a valid board or
null. It records owned fields and their before/after patch;
`remove(board, instanceId)` reverses it only when later writes do not conflict.
Dependent clock timing can prevent isolated removal. The factory's existing
component ablations remain the acceptance gate. Inferred pieces on older boards
are descriptive decompositions, not reconstructed authoring history.

Eight original calm 72–96 tile layouts have family ratings 1.01–1.42. The 33
single-piece settings and all fifteen pairs of the six most common mechanisms
gave 384 attempted placements, 358 legal, fully measured boards and 26 placement
failures. No failed placement was given a synthetic rating. Family uses two full
seeds (4711 and 18427, forty campaigns each), skilled forty campaigns. Effects
include log spread, factor IQR, support counts and changed pair contexts.

The six pair mechanisms are clock, luckDig, relief, blindTwins, keys and blindWay.
An isolated clockLock/clockIce on a clock-free base affects a *prospective* clock
site: these measurements do not estimate its full interaction with an active
clock. Pair placements can change tile roles. Some route settings have only one
successful base. These are substantial calibration limits, not universal trap
constants. A tempting pair is an opportunity until a counterfactual proves it bad.

## Model and production

`compose.js` fits separate ridge models of log family and skilled tries. Physical
piece parameters, pair terms, board size/layers/free share and clock-spare/route
hinges describe a board; a training-only smearing correction converts geometric
estimates to expected tries. Effects may reduce difficulty. The model uses 1,800
deduplicated boards, 1,791 family labels (1,326 pooled) and 613 full current-bot
skilled labels. Historical family fingerprints are accepted only through the
existing explicit unchanged-family migrations. Seed 29717 never enters fitting.

The split holds out entire D4 layouts (1,392 train boards / 408 test boards).
Family is within one/two tries on 41.0%/57.5% overall, but 24.3%/56.8% in the
9.5–13.5 target range. Target-range rank correlation is only 0.166. A training
median baseline beats target-range family MAE (1.75 versus 1.96). Skilled overall
92.4% within one is dominated by easy controls; the target skilled range has
only four held-out examples (25% within one). Uncertainty intervals are residual
approximations, not calibrated guarantees. Original geometric-fit reports are
preserved externally: the mean correction was added after inspecting that first
report, so this is not a pristine second independent test.

`piece_designer.js` ranks placed piece lists using the model. `piece_factory.js`
reserves played layouts, builds original whole boards, saves predictions before
confirmation, and confirms each selected board once. An off-target result can
change one piece using calibrated settings and its measured starting rating.
`replaceOne` preserves other physical fields apart from derived fair timing.
`piece_confirm.js` records full family and skilled even when a special fails its
quality gate. It never uses the old six-game scout or fourteen-step blind steerer.

For v12, 33 compatible unused whole layouts yielded 114 candidate compositions.
Eight point-selected candidates and four explicitly labelled interval probes were
confirmed, followed by ten initial repairs and four targeted follow-up boards.
All 26 confirmations are retained; none passed every curve/quality requirement.
No variant of one creation is delivered as another original level. Block and blob
layouts are excluded by this path; all tiles stay on their original layout.

The large pyramid demonstrates the remaining cliff: swapping one luck dig for
blind twins moved family 11.55 → 16.975 and skilled 2.20 → 3.17. Keeping all other
fields fixed and changing clock spare 1 → 3 moved family to 7.275 and skilled to
2.20. A useful piece catalogue needs stronger conditional and higher-order
calibration before it can achieve the requested fast, reliable curve placement.

## Commands

Run from the repository root, with one heavy job at a time. Measurement and
construction checkpoints reject incompatible input/source hashes; use a new
directory after changing their implementation. Do not resume the old v12
construction state after changing its designer dependencies.

```powershell
node source/tools/factory/piece_measure.js <experiment-input.json> <measurements-dir> 6
node source/tools/factory/learn_pieces.js <experiment-dir> <model-output-dir>
$env:FACTORY_RATE='1,20'
$env:FACTORY_SKILLED='2.5,6'
node source/tools/factory/piece_factory.js <plan.json> <batch-dir> <model.json> <effects.json> 4 6
node source/tools/factory/batch_verify.js <plan.json> <levels.jsonl> --partial
```

The batch directory needs its prepared original candidate pool, layout palette,
context table and played-layout reservations. The committed model is bound to its
physical feature implementation and frozen bot fingerprint. Raw experiment
inputs, measurements, training data, independent seeds, production predictions,
confirmations, changes and phone previews are in the external handbacks.

Task 07 also completed all thirteen missing independent-seed measurements and
traced level 201's face-up paradox to a planner route/tray interaction. Both
versions have a legal stored route; no bot change was made. Existing exact-board
human wins are checked by physical board hash plus gold positions; 225 uses
Dennis's four tries alongside the raw skilled bot's 2.08, and 200 uses five
alongside 5.15. Easy or lost plays do not override the skilled floor.

Validation: 81 factory tests passed; all ten handback levels passed phone bounds
and their stored route in the actual game at 390×820. Cached full-bot verification
used zero new calls. Detailed held-out strata, constant baselines and prospective
results are saved with the model. No routine Dennis playtest is requested.
