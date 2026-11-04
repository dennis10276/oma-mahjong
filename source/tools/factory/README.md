# Build levels quickly

The factory designs a trap on an approved pile, measures it with the family bot,
then edits that board towards an explicit difficulty curve. A stored solution
must obey the game rules. A finished candidate must also pass the skilled
planner, the luck/relief check, trap attribution, special-removal comparisons,
and an independent family-bot seed. `REVIEW` rows are retained for inspection.

The bundled `human-g6.2` bot includes the learned clock/lock traps and calibrated
planner. No other checkout or `HUMAN_BOT` setting is needed. See
`../sim/refit/PROVENANCE.md` for the snapshot's origin.

## Run

From the repository root, build the original 200–225 batch offline:

```powershell
node source/tools/factory/run_original.js source/analysis/factory/batch-200-225-plan.json source/build/original-levels 4 6 8
```

The last three numbers are construction workers, bot workers, and fresh pairing
candidates per intended level. The pipeline checks each fresh deal, scouts edits,
runs full ratings and quality checks, then selects one design per slot. Tuning
siblings never fill several levels. Missing slots produce `coverage.json`, not
a successful batch. A selected batch is independently verified in `levels.jsonl`.

Run the same command again to resume. Measurements and construction attempts
survive interruption. Changed inputs or construction code require a new output
directory; compatible bot measurements still share the cache. Output stays
offline and does not publish levels or alter game tables.

For this batch, 200 starts at seven family-bot tries, 224 reaches nine, and 225
reaches ten. Only 210 and 220 are big. Ratings pool 80 campaigns: 40 on each of
two fixed seeds, with the original calibrated family profile and 20-try cap.
The two seed estimates must also agree within two tries. The historical pilot's
2.1/2.6/3.6 targets were a software benchmark, not this difficulty curve.

## Plan

Paths in the plan are relative to its file:

```json
{
  "piles": "my-piles.json",
  "curve": [[200, 7], [224, 9], [225, 10]],
  "bigLevels": [210, 220],
  "levels": [
    {"level": 200, "concept": "buriedChain"},
    {"level": 201, "concept": "iceBeforeKeys", "extra": ["deepKeys"]}
  ]
}
```

Use the intended curve's anchors, on the current meter's scale. Targets are
interpolated by absolute level number, so splitting a batch does not restart
the curve. Extrapolation is rejected. A row may instead specify `target`.

Concepts: `buriedChain`, `clockBesideLock`, `dontGrab`, `oneFreeSpot`,
`iceBeforeKeys`, `combo`. Extra traps use names from `tools/lab/ideas.js`.

Generate piles with `piles_for.js`, or supply its JSON format. The build checks
approved shapes, 52px tiles, towers, big-board slots, repeated shapes and tile
overlap, including kept levels around the batch and played levels 70–164.
Every new level starts from a fresh deal and an authored trap brief. Inventory
boards are rejected. Cropping a big board, shifting its layers, rotating it,
or changing its pictures does not count as a new level.

The 200–225 batch uses `original_layouts.js` to create whole layouts. All eight
rotations/reflections are compared with the campaign and the rest of the batch;
shared coordinates must stay below 75%. Each level owns one creation ID and its
layout stays fixed while the bots tune its puzzle. Recipe repetition is limited
as well. These are objective safeguards; human play remains the check for how
distinct and enjoyable the levels feel.

For existing designed boards, skip seed preparation:

```powershell
node source/tools/factory/steer_design.js starts.jsonl source/build/tuned.jsonl
```

Each start row needs `level`, `target`, `recipe`, and `design` (including its
clock and solution).

To build and check a playable phone preview after a complete batch:

```powershell
node source/tools/factory/preview_check.js source/build/original-levels/levels.jsonl source/build/original-preview
```

This uses `source/tests`' Playwright dependency and Chromium (`CHROME` may point
to an installed browser). It checks layout bounds and replays the stored routes
through the real game. Preview ratings stay on the local device.

## Extra fresh candidates

When an initial design is unsuitable, build more whole layouts and place each
qualified new design into an available curve slot. Candidate IDs 300+ identify
creation slots; the output plan still contains levels 200–225 only. One creation
can fill at most one output slot. Big-board positions and every bot gate stay
the same.

Twenty extra whole layouts are supplied in `batch-200-225-extra-piles.json`.
They pass the same global originality, tower and tile-size checks. They are
layout candidates; their puzzles still require full bot qualification.

After the baseline production job finishes, run this separate job:

```powershell
node source/tools/factory/candidate_pool.js source/analysis/factory/batch-200-225-plan.json source/build/batch-200-225-original-v9 source/build/batch-200-225-extra 4 6 8 source/analysis/factory/batch-200-225-extra-piles.json
```

Construction finishes before simulation starts. The output folder contains a
candidate plan, a combined output plan, measured candidates and coverage. The
original output plan is preserved. An optional final argument includes a JSON
file of externally tuned rows. `run_original.js` also accepts zero construction
workers for evaluating an existing pool without rebuilding its seeds.

## Where the time goes

- Family measurements come first. Off-curve boards and boards with idle
  specials skip the expensive skilled planner until those problems are fixed.
- Six-game scouting ranks edits. Full 20-game/two-seed measurements decide
  accepted edits; scouting never qualifies a level.
- Exact clock-route searches have a 20,000-node / 1.5-second budget per call.
  An unresolved edit is skipped. The factory never labels a longer fallback
  route exact. API options `routeNodes` / `routeMilliseconds` tune steering;
  matching plan fields tune seed construction.
- Cache entries include the board, bot source, profile, seed, run count and
  capture mode. Invalid or computation-censored measurements are not cached.
- The queue caches stage records and board predictions, updating records when
  workers finish. Restart the coordinator after externally replacing stage
  files so it reads those replacements.
- Full family ratings supersede a quick scout when choosing the direction of
  picture edits. The full acceptance measurements and limits stay unchanged.
- Only five final decisions per attempt are captured for steering. The actual
  simulated taps, retry memory and ratings remain the same.

Defaults: `TOL=0.5`, `DENNIS_MAX=6`, `ATTR=0.6`, `STEPS=14`. A `dontGrab`
candidate must demonstrate that taking the clock immediately is worse by at
least one expected try. Late tray squeeze remains an advisory warning, following
Dennis's decision to test such boards rather than automatically reject them.

`pass` means the automated checks passed. The bot is a difficulty estimate;
this is not a new calibration or a guarantee that a person finds a board fun.
