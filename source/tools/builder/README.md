# Brief-first level builder

`builder.js` builds a board from a shape and a story. It plans the route to the
clock, assigns specials, places picture partners to create the requested tray
pressure, then proves the result. Every returned board has a witness and a design
card. A failed request is returned as `{ fail, detail }`.

```js
const { build } = require('./builder.js');
const result = build({
  layout: 10, story: 'deepClock', stage: 'centre', seed: 1,
  frame: { spare: 1, way: 14 },
  targets: { trayRoom: 0, hiddenOnWay: 1, maxDown: 0.3, three: 5 }
});
```

`trayRoom` 0/1/2 means exactly 3/2/1 waiting tiles on the witness to the clock.
`hiddenOnWay` is a minimum hidden dig count; `maxDown` caps the rounded total
hidden count. Optional `luck`, `three` and `frame.way` allow a tolerance of one.
Explicit `traps` must be proven. Covered-partner stories require trayRoom 0 or 1.
`frame.share` and `trapDepth` currently return `unsupportedTarget`.
Custom layouts must also have 72–96 tiles.

Run from the repository root:

```powershell
node --test source/tools/builder/test_*.js source/tools/factory/test_*.js
node source/tools/builder/gate.js --seeds 1,2,3 --jobs 2 --tag my-review
node source/tools/builder/export_pools.js source/build ../codex-tasks/results/pools-export
node source/tools/builder/knob_study.js prepare source/analysis/builder/gate/results-codex-final.json source/build/my-clock-study
node source/tools/builder/knob_study.js run source/build/my-clock-study 4
```

The study saves its selection/settings before bot measurements and resumes from
per-board checkpoints. A bot or implementation change requires a new study.
Its `pass` field is the extra strict-effect test (80% strictly easier). The plan's
monotone-direction benchmark permits ties and is reported separately; see
`analysis/builder/knobs/clock-spare-1/REPORT.md` for the completed comparison.
Run one CPU-heavy job at a time. The gate measures construction/proof speed;
bot measurements are a separate phase. These commands do not publish levels.

Use `engine.js` for game-rule proofs, including peek pairs and the after-action
clock check. `{strict:true}` retains the older single-tile rules for comparison.
The independent review and current limits are in `analysis/builder/codex-review.md`.

The earned-tray recipe deals new boards around two ice fronts. Use
`node source/tools/builder/bank/earned_tray.js <variant> <seed> <output.json> [tries]`.
It requires a complete win and a competing local thaw that fills the tray without
a way out, even with the clock relaxed. The `keys` variant also proves that taking
the first exposed key can strand the tray. The `reserve` variant checks a
visible pair that can be played after the clock but makes the board unsolvable.
The `competing` variant requires a visible key and a separate clock-directed
opening that can both be played and make the board unwinnable.
The `refund` variant builds a shelf layout. With a full tray, either matching
copy releases the same slot and helps a different ice goal. The certificate
records the earliest winning clock for the decoy and a playable continuation.
It rechecks the finish after rewiring the shared picture.
In `release`, a waiting picture needs both spare tray slots to reach its visible
mate. Each of two wrong parks opens a different playable match and leaves the
old slot occupied. Both branches have a proved loss and a legal continuation.
The clock proof requires the three release tiles to stay on the board until
the clock is taken on every on-time winning route.
`release-roofs` puts the two wrong parks on separate top-layer roofs. Both
release layouts can re-pair filler tiles and recheck the entire board.
`release-keys` starts with separate losing moves toward the key and the clock,
then uses the release on the opposite shelf at the exact clock deadline.
`pair-context` gives the same visible pair two outcomes. It is safe with one
picture waiting. A useful park opens a different pair, spends a slot, and
makes clearing the original pair a delayed loss.
All variants screen for a winning opening sweep and verify finish pressure on two
samples. The main builder exposes these recipes through
`build({ mode: 'earnedTray', variant: 'reserve', seed: 454 }, { tries: 1 })`.
Mixed-chain builds can request the local thaw check with
`targets.requireStrandedThaw`.

`node source/tools/builder/bank/choice_benchmark.js <corpus.json> [results.json]`
reports proof incidence by reference class and layout-family split. The corpus
has an `index` array of records with `id`, an exact `board`, and an optional
`class` of `easy`, `good` or `too-hard`. Missing proofs remain inconclusive about
the wider puzzle difficulty.

Task 10 uses `task10_study.js prepare <dir>`, then `measure <dir> all <workers>`.
The preparation freezes 24 same-puzzle bases, their variants, and the complete
range grid before any bot call. Run `task10_study.js traps <dir>` only after the
main measurements finish, then measure that frozen addendum with `measure <dir>
traps <workers>`. `task10_report.js report <dir>` produces the per-story range
and additive tables. Its diagnostics commands freeze and report the separate
frozen-key ablations. `task10_pilot.js` prepares/builds/checks up to five boards
per missing slot and preserves the existing twenty. Run these phases in order,
with one heavy pool at a time; never change a running worker's dependencies.
