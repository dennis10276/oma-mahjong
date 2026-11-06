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

Task 10 uses `task10_study.js prepare <dir>`, then `measure <dir> all <workers>`.
The preparation freezes 24 same-puzzle bases, their variants, and the complete
range grid before any bot call. Run `task10_study.js traps <dir>` only after the
main measurements finish, then measure that frozen addendum with `measure <dir>
traps <workers>`. `task10_report.js report <dir>` produces the per-story range
and additive tables. Its diagnostics commands freeze and report the separate
frozen-key ablations. `task10_pilot.js` prepares/builds/checks up to five boards
per missing slot and preserves the existing twenty. Run these phases in order,
with one heavy pool at a time; never change a running worker's dependencies.
