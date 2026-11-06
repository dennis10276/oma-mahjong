# Task 09: empirical production stopped for Builder v2

## Current checkpoint (2026-11-06, supersedes all archived notes below)

**20/26 qualified, batch incomplete. No old production job is running.**
The refreshed external handback is `codex-tasks/results/200-225-v14/levels.jsonl`.
Missing: 208, 210 (big), 215, 216, 217, 221. Original sixteen stay fixed.
The four additional selected boards are:

- 204 f11eb87bdcc54650, letterH84/frozenGuards, family 10.075, skilled 2.55.
- 206 fb46c7888c54e687, diamond80/frozenGuards+lockedPartners, family 10.775, skilled 3.58.
- 214 f171754b32f49d99, vase76/iceLockClock, family 11.66, skilled 3.98.
- 219 476494d0c31dca55, cross84/frozenGuards, family 11.59, skilled 4.4.

Handback verified 20 with zero new bot calls and 166 cache hits. The optional
background-memory round completed 188 attempts / 133 legal boards / zero
qualifiers; set it aside. The subsequent 40 visibility edits added the vase and
new cross, replacing the older cross in the best assignment. All raw failures,
alternates and measurements are retained. Do not freeze the four new boards.

User's new instruction: continue Claude's brief-first Builder v2. Work now lives
on `wip/codex-level-builder`, merging Claude's `2e66156`. Do not restart the old
random production loops. The current bot fingerprint remains f328592...561.
See `analysis/builder/codex-review.md` for builder verification and knob work.

## Archived earlier checkpoint (historical; not an active job)

**19/26, goal still incomplete.** Original16 fixed. Current best assignment:
204 f11eb87bdcc54650 letterH84/frozenGuards family10.075 skilled2.55;
206 ec63a46d1a4e6eef cross84/chainReaction family10.395 skilled2.98;
214 fb46c7888c54e687 diamond80/frozenGuards+lockedPartners family10.775 skilled3.58,
reserved10.47. The assignment moved the earlier new boards as coverage grew.
Missing208,210(big),215,216,217,219,221. Do not freeze the three new boards: swap
them if it increases coverage or fixes complete windows. Keep the original16.

**ACTIVE HEAVY JOB: session23329**, command task09-stream.cjs memory-budget-1
v14/memory-budget-jobs.json, log source/build/task-09-memory-budget-1.log.
188 registered fresh attempts:48 big first (four large layouts) and140 regular
on the ten new whole layouts. Optional initial40% hidden-budget style: retain
covered memory choices away from the readable goal, check the unchanged whole-
level relief rule after each addition. Every outcome still gets actual bots.
Constructor4workers then ONE six-worker pool streams whole-board family,
compatible-slot checks, mechanism checks and skilled runs. Raw construction has
no tunedFrom/edit; it is registered before measurements. Edited rows retain
the reserved29717 qualification requirement. NO source dependency edits while
this runs. This style is an experiment, not yet a demonstrated yield improvement.

109/109 factory tests passed. Bot unchanged at f328592…561. All source changes
are about to be committed/pushed on own branch. Current external v14 handback
is the older18/26 checkpoint; refresh it after this round. Its eighteen verify
with0new calls/151cache hits. Three new physical boards need current-placement
phone previews after reassignment (204 now changed, cross moved206, diamond214).
The old cross204 and diamond206 previously passed phone/game routes. Original
sixteen IDs, complete design objects and gold passed canonical equality proof.

Recent completed rounds: big-new-layouts-1 64attempts/30legal, two compatible
family scores but skilled1/1.02 -> no addition. regular-near-misses-3 parallel
queue33edits, vase4bcff9334279f872 family11.235/skilled3.2 but reserved8.65 ->
no addition. key-placements-1 16legal existing-marker relocations, none can enter
a slot -> no addition. fresh-small-layouts-1 150attempts/97legal, two compatible
confirmations, one new qualifier f11eb87bdcc54650 ->19/26. buried-clock-1 six
physical moves of old visible locked clocks onto covered tiles, no compatible
family scores -> no addition. These stay diagnostic, not delivered.

Ten new regular layouts900–911 (gaps905/910) are in palette.json (now60 with
the two large alternatives800/801). Sizes76–88, all>=52px, no block/tower/crop.
They are committed as task09-extra-small-piles.json and extra-large-piles.json.
Unused alternatives can overlap; the delivered set still has strict D4/share
checks. A cache-only scan over6897stored candidate IDs found29 full CURRENT
skilled-in-band compatible-layout results, all already checked; no overlooked
direct-reuse candidate. Inspector rejects old skilled and short scouts.

NEXT after the active job: inspect its final assignment and qualifier yield;
keep building if below26. Prepared visibility-grades-2/input.json (40 graded
boards) still NOT RUN. More useful big near-floor parents6ae464f981a12297
(house96, family10.125/skilled2.27),316da08dcb786b37 (house96,10.73/2.33),
d948a93a4eb1566b (pyramid96,16.975/3.17). More useful small near-floor parent
1f226941554c6e3d (oval76,11.135/2.42). Choose by TWO training family seeds,
skilled and actual mechanisms, NEVER use reserved scores as steering input.
Do not rerun prepare/reset scripts. Freeze each round's jobs.json (priors and
seen IDs) on resume. Changed sources require a fresh round directory.

At finish: all26, certify all22five-level windows; original16 unchanged; full
portable handback and preview/game-route checks, all-pools empirical hit rates
per recipe/frame/shape with unknown measurements explicit, source/test/cache
proof, commit/push own branch. No main/game/Firebase/release/model training.

## Earlier history

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

Completed round floor-near-misses-1: measured parents 6ae464f981a12297,
72fc8c82cd86947c, 84a049f6b0bb7c31 (big210), 29f31b21b86b66aa,
104c6711cfd61363 (diamond), b33b9c52bad54617, 0e7075fdded33ebf (oval),
0a4f241ea9fdb81e (pyramid84). These were only .1–.3 below the skilled floor.
The .progress.json files save each genome and completed observation. 29 legal
edits. Diamond533a11ac9126ffd5 passes quality (family11.43, skilled3.55), but
reserved seed12.72 versus search10.68 gives spread2.04, so it is NOT delivered.
Coverage stays16. Other useful measured parents: abc85821f9ac12e5 diamond
family9.75/skilled2.45, 316da08dcb786b37 house96 family10.73/skilled2.33,
056e8376c8b53ee8 pyramid84 family10.4/skill unknown, only idle ice fails.
All future steering must use the two search family seeds and skilled/ablations;
the reserved seed is never a direction/ranking input.

Completed: small-empirical-1, exec session96633, log
source/build/task-09-small-empirical-1.log. 120 attempts over ten unused whole
layouts, explicit six empirically useful recipes, fixed initial spare1.
73 legal constructions, five compatible confirmation candidates, one qualified
new board: 204 ec63a46d1a4e6eef, cross84, chainReaction, family10.395,
skilled2.98. Assignment now17/26; 204 remains provisional for global swapping.
Uses empirical_slots for actual compatible placement
and two-seed spread before empirical_confirm. 101 factory tests passed.
Do not edit any active dependencies. Next planned inputs: additional-stock,
visibility-grades-2, then graded near-floor parents above with larger breadth.

Completed: near-floor-grades-2, session77073,
log source/build/task-09-near-floor-grades-2.log. Parents316da08dcb786b37 and
84a049f6b0bb7c31 big210, abc85821f9ac12e5 diamond, 056e8376c8b53ee8 small
pyramid; budget/breadth12. Whole-board family scores and ablations selected these
parents. Steering now checks ALL compatible missing slots before skilled work,
so a good edit is not discarded merely for missing its initial target. The
original16 stay protected; new204 may be swapped. 101 tests pass.

That round measured39 edits. New206 fb46c7888c54e687 diamond80 passes:
family10.775, skilled3.58, reserved10.47. Coverage18/26 (204 and206 added).
Handback checkpoint in external v14/levels.jsonl, coverage.json and RESULT.md
explicitly says incomplete. It verifies18 with0 new bot calls/151 cache hits.
New204 and206 phone previews and real-game stored routes pass. Original16 are
still exact. Remaining:208,210,214,215,216,217,219,221.

Additional-stock2cdf01bcaa6c719d failed current skilled floor (1.05), no addition.
New independent whole-layout search found two 96-tile alternatives (house800,
pyramid801) from66 trials. They differ from all48 prior layouts by D4 identity
and pass max75% share against live context and the16 fixed boards. Unused
alternatives may overlap one another; batch assignment still forbids doing so
in the delivered set. Both have52.3px tiles and no towers/block silhouette.
Saved in task09-extra-large-piles.json and v14/palette.json (now50 layouts).

CURRENT HEAVY JOB: big-new-layouts-1, exec session32802,
source/build/task-09-big-new-layouts-1.log. 64 attempts on800/801 using four
empirically useful recipe families and fixed initial spare1. One heavy job only.
Do not edit dependencies while it runs. Next: parallel graded search on near
floor stock (vase b8c2bf1052fa7349, pyramid8c0523605ce809c2, oval0e7075fdded33ebf,
letterH eef9b6983c79055d), and prepared visibility-grades-2.

Queue refactor (not yet committed at this note): prepare/checkpoint parents,
dispatch individual genomes through ONE four-worker pool, checkpoint every
child, preserve unknown skilled. Tests include load balancing, worker failure
cleanup, resumable prepared parents and configuration protection. 105/105 pass.
Decimal reverse-step boundary now uses1e-9 arithmetic epsilon (same.25 rule),
with a regression distinguishing .25 from .251. Bot remains frozen.

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
