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

From the repository root, this small pilot exercises the pipeline:

```powershell
$env:STEPS = '3'
node source/tools/factory/build.js source/analysis/factory/codex-pilot-plan.json source/build/factory-pilot.jsonl
```

Run the same command again to resume. Prepared boards, accepted edits and bot
measurements survive interruption. A completed run makes no new bot calls.
If inputs, code, profiles or steering settings change, choose a new output
filename; compatible measurements are still shared through the cache.

The pilot's 2.1/2.6/3.6 targets are a software benchmark, **not a replacement for
the production difficulty curve**. Output stays offline; this command does not
publish levels or alter game tables.

## Plan

Paths in the plan are relative to its file:

```json
{
  "piles": "my-piles.json",
  "curve": [[175, 4.5], [180, 6.2], [199, 7]],
  "levels": [
    {"level": 175, "pile": 175, "concept": "buriedChain"},
    {"level": 176, "pile": 176, "concept": "iceBeforeKeys", "extra": ["deepKeys"]}
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
It first looks for a measured trap on the **same tile coordinates** in
`analysis/factory/fallback-g61.jsonl`. An optional `inventory` selects another
JSONL pool. Otherwise it designs a new seed (up to `seedAttempts`, default 4).
Known ratings select seeds; every resulting board is measured again.

For existing designed boards, skip seed preparation:

```powershell
node source/tools/factory/steer_design.js starts.jsonl source/build/tuned.jsonl
```

Each start row needs `level`, `target`, `recipe`, and `design` (including its
clock and solution).

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
- Only five final decisions per attempt are captured for steering. The actual
  simulated taps, retry memory and ratings remain the same.

Defaults: `TOL=0.5`, `DENNIS_MAX=6`, `ATTR=0.6`, `STEPS=14`. A `dontGrab`
candidate must demonstrate that taking the clock immediately is worse by at
least one expected try. Late tray squeeze remains an advisory warning, following
Dennis's decision to test such boards rather than automatically reject them.

`pass` means the automated checks passed. The bot is a difficulty estimate;
this is not a new calibration or a guarantee that a person finds a board fun.
