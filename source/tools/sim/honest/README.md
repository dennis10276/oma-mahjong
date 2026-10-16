# Frozen calibrated observer

`hard.js`, `layouts.js`, and `players.json` are verbatim snapshots of
`origin/wip/honest-observer` at commit `316f3b1` (2026-10-16), from
`source/www/{hard,layouts}.js` and `source/tools/sim/refit/players/bots.json`.
They are offline analysis dependencies, not app scripts. In particular, do not replace the
game's hard.js with this research branch's engine or its generation number.

This revision supports honest observation, clock planning and four-attempt chains with each
player's fitted memory. Later experimental move-cloning revisions were deliberately excluded.
These fits are based on limited data and their training fit is not independent validation.
Independent simulation seeds test ranking stability, not generalization to future human play.

Reproduce the reorder (from the repository root):

```
node source/tools/sim/reorder_honest.js measure
node source/tools/sim/reorder_honest.js apply
node source/tools/sim/reorder_honest.js forecast
```

`measure` uses worker threads with checkpointed results, matching table, profiles and engine
fingerprints. `apply` requires all primary and validation measurements. It only writes the
source level table, mapping, and analysis reports. It never deploys or accesses Firebase.
Text fingerprints normalize CRLF/LF so Windows and Linux identify the same frozen inputs.
`forecast` prepares a separate unpublished prediction artifact for the same 60-level windows
as the current dashboard. It retains predictions through 91 and remeasures or reuses held-out
measurements for the boards now at 92+. It does not replace the live prediction file.
