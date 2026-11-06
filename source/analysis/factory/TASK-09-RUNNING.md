# Task 09: empirical production, active

Worktree `codex-level-factory`, branch `wip/codex-level-factory`. Task is
`codex-tasks/TASK-09-fill-the-last-ten.md` in the parent workspace.
Output staging: `source/build/batch-200-225-v14`; portable handback will be
`../codex-tasks/results/200-225-v14`. This is NOT a completed handback yet.

Keep the 16 Task 08 boards exactly fixed. Fill 204, 206, 208, 210 (89+ tiles),
214, 215, 216, 217, 219, 221. Family curve 10 at 200 to 12 at 224, then 13 at
225, tolerance 1, complete five-level mean tolerance .5, edited boards require
reserved seed 29717 within 1, all seed gaps <=2. Skilled 2.5–6, existing human
wins only at 200/225. All existing quality/originality gates remain in force.
No predictive composition models, bot edits, game edits, main or release.
One heavy job at a time. Do not edit dependencies during workers.

New empirical construction/steering modules preserve whole original layouts,
explicit recipes, fixed-spare graded interventions, full two-seed family
judgment before costly skilled checks, and per-child checkpointing.
100 factory tests passed after empirical mechanism-first confirmation. Bot fingerprint remains
f32859281c746f4277ab5ef4c0006d43c76dddcc342741af8b0ff45a1b63d561.

Production rounds so far: big-first exposed inherited alternative recipes;
fixed explicit briefs in 1cc167f and kept actual results as failed/actual-recipe
observations. big-explicit constructed 14/24 legal large boards, no qualified
board. big-grades-1 was stopped because full skilled searches on family-far
boards wasted time; recovered 12 completed observations, 9 fully paired,
without new simulations. Corrected family-first and checkpoints in 54c8677.
stock-grades-1 completed 12 edits of three parents (fourth had no legal edit).
Two quality passes failed reserved-seed/placement checks; still 16/26.

Further rounds: big-spare-one 48 attempts, 25 legal boards, one family9–14
candidate but skilled1.13/idle support; no addition. clock-rebuild-1 physically
moved free clocks onto existing locks (six edits): vase b8c2bf1052fa7349 has
family9.575/skilled3.02/quality true but seed gap2.25, so cannot place.
clock-route-grades-1 moved the owned clock lock along a prior large board's
route (24 legal edits); its only family9–14 candidate had gap2.08/skilled1.07.
No addition. All observations and proposals are saved, including rejected ones.

All-pools inventory now includes 6,622 physical boards, 1,063 with full family
proof, prior to later rounds. Only one non-block eligible-layout candidate was
missing from the Task08 pool: 2cdf01bcaa6c719d (bowtie ridges76,
iceLockClock+deepKeys, family10.165, skilled unknown). Prepared for checking.

Active next round is floor-near-misses-1: measured parents 6ae464f981a12297,
72fc8c82cd86947c, 84a049f6b0bb7c31 (big210), 29f31b21b86b66aa,
104c6711cfd61363 (diamond), b33b9c52bad54617, 0e7075fdded33ebf (oval),
0a4f241ea9fdb81e (pyramid84). These were only .1–.3 below the skilled floor.
The .progress.json files save each genome and completed observation.

Performance correction: a family9–14 score alone is insufficient reason to run
the skilled search. Empirical steering now checks its actual working interval
and seed spread first. Unknown baseline skilled stays unknown; it never triggers
a fictitious "too easy" repair. empirical_confirm checks room/attribution,
component ablations, special ablations and any free-clock counterfactual before
the expensive full skilled run. Qualified boards still pass the original full
confirmation; no acceptance gate changed. Skipped skilled scores are null.

Prepared but not yet evaluated: clock-rebuild-1/input.json (completed above),
visibility-grades-2/input.json (40 edits), additional-stock/input.json (one board).
Scripts task09-check-input.cjs and task09-round.cjs should use empirical_confirm
and actual compatible slot/seed-gap checks for subsequent rounds. Keep workers'
dependencies unchanged while a heavy job runs. Only one heavy job at a time.

Ignored task09 scripts and round files preserve all proposals and observations.
Do not rerun task09-prepare.cjs: it would reset the pool. Do not resume old
rounds with changed dependencies; use a new name. Original Task 07/08 outputs
and model reports remain immutable. All 16 keep IDs in v14/kept.json.

Promising unused stock: d948a93a4eb1566b (pyramid96, family16.975, skilled3.17),
d398a162a3090dc3 (vase76, family12.265, skilled4.28, fits only214),
45a4a267a6d52c36 (cross84, family9.465, skilled2.92),
eef9b6983c79055d (letterH80, family9.93, skilled2.88, atTrap .5799).
LetterH80 was played at217: keep any reuse on217 per plan.playedLayouts.
KeyToEscape stock on unused bowtie76 and letterH76 has family9–11/skilled3,
but fails the wrong-free-clock counterfactual. Any repair must physically
change the clock mechanism and reprove/rerate, never relabel unchanged physics.

Palette has 48 whole original layouts. Remaining usable small shape families:
cross, letterH, diamond, oval, pyramid, bowtie, twins (later slots), vase214.
Big210: house96 or pyramid96; star220 is fixed. Recipe cap3 still applies.
keysAcross+frozenGuards and clockOnTopLocked already have three keepers each.
