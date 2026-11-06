# Build levels quickly

Task 08's approved curve rule is ±1 per level (also the reserved seed), with
every complete five-level window averaging within ±0.5 of target. Assignment
maximizes coverage, then minimizes total absolute family offset. Set
`tolerance: 1` and `curveWindow: { size: 5, tolerance: 0.5 }` in a current plan;
historical plans remain reproducible with their older rules.

The new frame-first experiment uses `pressure_frame.js`, `frame_calibrate.js`,
`frame_model.js`, `frame_designer.js` and `frame_prospective.js`. See
[the Task 08 report](../../analysis/factory/frames-v2.md) for commands and limits.
The reuse handback has 16/26 passing levels, including the big board at 220.
The registered new-composition test failed 0/12: the model remains experimental.
Keep its frozen input/model/test artifacts; use a new directory for another fit
and a new prospective test. Full bot and quality gates remain mandatory.

Task 07 adds a separate measured-piece workflow: `pieces.js`, `compose.js`,
`piece_designer.js`, `piece_confirm.js` and `piece_factory.js`. See
[the piece prototype report](../../analysis/factory/pieces-v1.md) for commands,
calibration data and validation. This workflow saves predictions before full
confirmation and repairs one mechanism at a time. Its current composition model
does **not** predict the target curve reliably; bots remain the acceptance gate.
The steering/scouting description below documents the older workflow.

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

Dennis's current preference: every new level has at least 72 tiles. Block shapes
(including their variations) are fallback choices: whole-layout generation tries
the other shapes first, and assignment prefers a qualified non-block alternative
even when a block is slightly closer to the curve. This does not weaken a bot gate
or ban a block when it is the only qualified option.

Candidate targets now follow the supplied plan's range. Task 03 uses family
10 at 200, 12 at 224, 13 at 225, and skilled 2.5–6 (aim 3). Keep the run's bands
consistent: `FACTORY_SCREEN=7,17`, `FACTORY_RATE=8,15`, `FACTORY_SKILLED=2.5,6`.
Custom recipes/briefs survive layout generation. More choices include frozen keys,
a clock beside an unrelated lock, and a tray dig followed by an ice chain. The
212-style key/ice/clock idea has a fresh 76-tile two-island candidate; its old
64-tile board is ineligible for the new batch.

Explicit steering results carry the ID of the fully measured board. They receive
full rate/quality checks even when a noisy scout or a per-creation quota would
otherwise skip them. Automatic siblings cannot borrow this status: their ID must
match the measured ID. Only full measurements and the independent final seed can
qualify a level.

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

Tuned rows, including automatic edits chosen from bot feedback, also need a
reserved final family seed (29717, 20 runs × 2). It must independently land
within 0.5 of the placed target, with a maximum pairwise seed gap of 2. The
original two-seed pooled curve is retained. This final measurement never guides
steering; untuned constructions keep the original two-seed rule. The production
runner measures viable tuned finalists before assignment, and the verifier
rechecks the result.

For an incomplete production run, hand back only qualified rows plus explicit
coverage and distinct diagnostic proposals:

```powershell
node source/tools/factory/handback.js source/build/batch-200-225-extra/output-plan.json source/build/batch-200-225-extra/pool.json source/build/batch-200-225-extra ../codex-tasks/results/200-225
```

The report includes each seed, planner, trap attribution, relief, special
ablations and failures. `closest-assignment.jsonl` contains unqualified proposals
as well; its diagnostic rows are never treated as accepted levels.

## Where the time goes

### Trap placement and combinations

New construction uses `trap_composer.js`. It explores several placements on the
same fresh pairing, keeps a small beam of legal choices, and records why each
trap belongs there. It preserves the actual witness order while varying the
order in which locations and key pairs are considered. Seeded placement intents
prefer linked dependencies, a route across the board, staged unlocks/thaws, or
tray escape with relief. These are authoring preferences, not difficulty ratings.

A later recipe must retain the earlier clock, waiting clock partner, shared key
pair, locks, ice, and authored picture/hidden-tile relationships. A combination
that overwrites those roles is rejected. Add-ons extend existing roles where
possible: `frozenGuards` uses the current clock, frozen tray partners use its
actual dig, and additional partner locks use the existing keys. They cannot
silently turn a two-trap brief into a different one-trap board.

Three additional motifs are available:

| Motif | Required structure | Placement |
|---|---|---|
| `keyGuardIce` | Existing keys with a covered dig | Ice on an actual blocker of those keys |
| `partnerRelay` | Existing clock route with a carried single | Ice on that single's later partner outside the dig |
| `thawRelay` | A relevant frozen clock/key guard | Ice on an earlier neighbour on its thaw route |
| `midgameRelay` | A single carried through the clock | Its partner remains frozen after the clock, then becomes legally available before 60% of the witness |

The midgame relay is checked on the recomputed legal route. It must still be
frozen with its matching single in the tray after the clock, need at least three
remaining takes by the physical dependency lower bound, and become takeable
before 60% of the board. Its thaw route is visible and included in the one-hidden-
tile limit. Ice that would automatically melt while removing its covers is not
enough: the height includes a genuine extra thaw requirement. Its separate
ablation still decides whether that structure matters to the family bot.

`original_layouts.js` includes corresponding briefs. A slot may set
`placementIntent` to `linked`, `cross-board`, `staged`, or `tray-escape`.
Plan options are `placementProbes` (default 3), `placementBeam` (2),
`placementMilliseconds` (1200 for a whole composition), and
`placementProbeMilliseconds` (400). Each remaining recipe step receives a share
of the time budget. Legacy inner route searches share the deadline. A solver
completion can slightly overshoot it; an unresolved route is never accepted.
Proved exact routes are reused within this composition, including when only
the clock spare changes. Failed/unproved routes are not cached this way.

Construction rows include `trapPlan`: the intent, actual per-step role changes,
cover/unlock/thaw/partner edges, and an arrangement signature. Recent signatures
on the same creation receive lower priority. Dependency edges describe the
stored witness and do not prove every possible solution follows that route.
The `authoredBoard` hash identifies this initial snapshot; after steering,
`authored(row)` detects whether it still matches. Recompute `analyze(row.design)`
when explaining an edited board. Historical warm deals remain usable in the
measurement pool, but only current, matching placement proofs fill the new
constructor's requested composition quota. Placement does
not qualify a level: full bot ratings, special ablations, relief, attribution,
originality and independent-seed gates still decide acceptance. Existing
construction checkpoints require a new output directory after this change.

Quality also removes each supporting component on its own, leaving the primary
trap intact (`trap_supports.js`). Its full family rating must change by at least
0.3 expected tries or 0.15 first-try probability, using the existing meaningful-
special threshold. A missing or idle support is rejected before the expensive
skilled planner. The change can make the board easier; its eventual curve rating
still decides placement. Support manifests fingerprint quality records, so a
cached group-only check cannot qualify a newly composed combination. Historical
rows without these additions keep their original quality requirements.

New compositions also record the ice and lock collections owned by each recipe
step. Each collection is checked separately, so a strong secondary trap cannot
hide an idle primary one. A failed component stops further probes before skilled
planning; any unchecked collections are recorded explicitly. When a measured
idle collection is removed as an alternative, its recipe is re-authored and the
exact clock is rebuilt with the same spare. It does not keep a frozen/locked
label after that feature has disappeared, and it remains a variant of the same
creation. Approved board repairs can forbid this simplification.

Task 05 adds `placement_score.js`, based on Dennis's round-2 lab verdicts. Its
0–100 authoring score is timing (30), clarity of clock/signposts (25), visible
objective route (20), fair clock spare (15), temptation opportunity (5), and
recognisable shape (5). Decisive specials around 15%–60% of the witness score
better than a puzzle concentrated at the ending. A visible off-route pair or
waiting clock is only a temptation candidate; the score does not claim it has
proved the move wrong. Existing clock-first bot checks still establish that
where required. Intent preferences adjust this ranking, and actual difficulty
still comes from the bots. Every delivered row is rescored on its actual board.

New construction exposes the clock, keys and locks and leaves at most one
hidden tile on the actual clock/key witness path. It rejects an explicitly
authored memory trap that conflicts with this rule instead of silently erasing
it. `playerFeedback: false` preserves the earlier authoring mode. New feedback
rows carry the rule through automatic variants, steering and final verification;
steering cannot substitute more blind digging for the intended order puzzle.
Frozen/locked tray-juggle briefs try clock spare 1 first. Historical approved
boards are kept physically intact and receive the same reported preference
score. A slot `keepId` makes an eligible approved board mandatory, including in
partial assignment. If it no longer qualifies, `preservedFailure` identifies it
and requires an explicit repair or plan update. `candidateStart` can select a
fresh creation-ID range when adding another palette to an existing batch.

`analysis/factory/batch-200-225-smart-piles.json` saves 48 whole layouts,
including the earlier twenty extra layouts and the new 74-tile hourglass and
96-tile pyramid. It can be supplied as `existingPiles` when preparing another
palette. The three `smart-trap-examples.jsonl` boards are diagnostic examples,
not curve-qualified levels. Their phone previews and real-game routes passed.
Fresh palette plans default to four layout trials per shape; `layoutAttempts`
can change this search budget without changing any acceptance limit. A failed
layout search preserves completed layouts. Comparison masks and their D4 views
are reused throughout each creation's search.

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
- Task 04's planner-only revision has one explicitly approved family-cache
  migration (`ac24aad…` → `cae3bc3…`, upstream `8e33270`). Only family entries
  are copied to the new keys; old planner results are never reused. Any different
  source/profile/environment fingerprint requires new measurements. Factory
  regressions cover both the family reuse and planner isolation.
- Task 05's planner-only revision (`3201e1e`, fingerprint `f328592…`) likewise
  permits family reuse from the exact `cae3bc3…` and `ac24aad…` fingerprints.
  Qualification always uses the current skilled player. The unchanged family
  profile, seed, run count and capture mode must still match.
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

Task 09 uses empirical production rather than composition predictions.
`empirical_results.js <build-root> <report.json>` counts distinct measured
physical boards across all `batch-200-225*` pools, split by recipe, shape and
observable frame. Fresh attempts and edited siblings are reported separately.
Missing current skilled results remain unknown; paired hit rates are explicitly
conditional on being measured. They are not prospective success probabilities.

`empirical_construct.js` accepts explicit recipe jobs and never substitutes an
inherited alternative brief. `empirical_steer.js` measures graded journal edits
with both family seeds first, checks skilled/quality only near the working band,
and checkpoints each proposed genome and completed observation. The original
accepted creations are protected. Spare changes and added traps are excluded.
`empirical_visibility.js`, `empirical_route.js` and `empirical_clock.js` provide
small visibility grades, movement of an existing clock/lock component, and a
physical conversion of an unsuccessful free-clock objective onto an existing
lock. Every structural edit reproves the route at the same spare; component
ownership follows the physical move. No unchanged board is relabelled to evade
a counterfactual or recipe cap. All final acceptance gates still apply.

Empirical steering only runs skilled confirmation once the two family seeds
can enter the slot's working band and satisfy seed spread. An absent baseline
skilled result stays unknown. `empirical_confirm.js` checks room, attribution,
component/special ablations and any free-clock counterfactual first, then runs
the unchanged full confirmation. Rejected mechanisms need no skilled search;
those reports have `skilledBot: null` and an explicit rejection reason.
