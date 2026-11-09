# Task G9: experimental rebuild of construction and difficulty planning

Prepared for Gemini, 2026-11-09, at Dennis's request.

Dennis's latest direction: rebuild the builder using what we learned, in a
separate folder. Treat this as an experiment. Do not spend most of the work on
tests, a large benchmark framework or another collection of isolated controls.
Build a working prototype and learn from small real bot runs.

## Goal

Replace the construct-rate-reject cycle with a coherent construction/planning
layer that uses the requested difficulty to decide what to build and how to
adjust it. Keep the verified physics engine, pinned bots and useful existing
checks. The new layer should give the accumulated knowledge a practical home:

1. A small collection of useful puzzle components with visible alternatives,
   demonstrated consequences and real construction parameters.
2. A planner that chooses components and settings from the requested family
   difficulty while preserving skilled difficulty.
3. A bounded build-rate-repair loop: measured misses cause a specific structural
   adjustment, rather than another unrelated random attempt.
4. Simple experimental evidence showing whether requests for 10 and 13 can be
   met, how often they miss, and what the process costs.

A rewrite alone cannot supply missing knowledge about difficulty. Develop
that knowledge inside this prototype, rather than adding more disconnected
experimental builder modes to the old implementation.

## Separate workspace and implementation

- Worktree: `C:\Users\den_k\Idea\OmasMahjong\gemini-builder-rebuild`.
- Branch: `wip/gemini-builder-rebuild`, starting from the latest pushed
  `origin/wip/cc-builder-loop` containing this assignment.
- New implementation: **`source/tools/builder-next/`**.
- Experiments and results: **`source/analysis/builder-next/`**.
- Shared final report:
  `C:\Users\den_k\Idea\OmasMahjong\gemini-tasks\results\builder-rebuild\REPORT.md`.

The worktree and starting folders are prepared by the lead. Inspect their
status before starting; preserve any subsequent changes. Keep the existing
builder intact for reference and comparison. Reuse its engine, measurement and
quality helpers through adapters; do not copy or rewrite those verified systems.
Existing constructors may supply components, but a thin wrapper around the old
builder's search is not the requested planning-layer rebuild.

This is the next direction after G8. Preserve G8's branch/results and any work
in progress. Do not reset its checkout or run competing heavy jobs. Use useful
committed findings from G8 when available, identifying their source; do not
assume an unreviewed completion claim is established evidence.

## Start with what is actually known

Read `AGENTS.md`, `source/analysis/builder/LEVEL-DESIGN-FACTS.md`, and the lead
reviews for G6 and G7. Read the original reports as historical observations,
with their corrections, not as implementation guarantees.

Useful starting points include the existing `keyedChoice` recipes and four
normal-skilled bodies. The lead's G7 evidence shows that family difficulty is
still too low on most of them. Keyed U ice 61 gives D7.45/S3.33 with passing
traces; ice 72 gives D10.95/S3.20 but fails pacing and repeats known errors.
The original G7 controller returns the same D6.14/S2.88 board for targets 10
and 13. Its false-relief claims were not implemented in that controller.

Do not repeat metadata-only delay controls, picture relabeling as diversity,
or witness reordering as a change to physical difficulty. Components interact:
check the composed puzzle instead of assuming individually sound components
retain their effects when combined.

## Approach: prototype first, small experiments, then improve

Choose a simple architecture and implement an executable path early. The
caller should supply a family target, normal skilled band, geometry/seed and
a work budget. The result should contain either a measured candidate with its
actual settings or a clear account of why no suitable candidate was found
within that budget. A bounded search miss is not proof that the target is
impossible.

Start with one or two useful component families. Record the relevant choices,
visible information, commitments and real parameters. For each proposed change,
ask what it should do to family difficulty, skilled difficulty and pacing.
Use the bots to check that expectation. Keep a short knowledge table of measured
effects and interactions so the planner can use them on later requests.

Try a small set of target-10 and target-13 requests. Measure both bots at the
same actual clock setting. When a board misses, use its rating and error traces
to choose a repair: change the relevant choice, relief, commitment or pacing.
Record the reason, actual edit, before/after result and cost. Do not silently
substitute another target, lower the skilled floor or keep trying fresh seeds
until something passes. Bound candidates, repairs and expensive proof calls;
checkpoint useful progress instead of letting a constructor search indefinitely.

Keep the interface and working loop more important than an elaborate model.
A small empirical rule table or simple fitted response is fine if it improves
the decisions. Do not force a monotone model onto observed cliffs or treat a
single lucky result as a generally valid recipe.

Once there is a promising response, try a few geometries that were not used to
choose the rule. Choose settings before viewing those ratings and retain misses.
This is a practical transfer experiment, not a large formal benchmark project.
Use the same small request set and resource limits for an old/new comparison
where meaningful. Count all attempts and repairs, not only successful outputs.

Continue improving the prototype from those results. A failed mechanism is a
reason to revise the planner or component model, not to end the entire task
with a recommendation for another numbered assignment.

## Keep validation lightweight

Do not build a large test harness first or rerun the full suites after every
experiment. Prioritize implementation, real bot measurements and readable
example boards. Use existing solvability, clock and visibility checks; keep
unknown proofs unresolved. Add focused checks only where they protect a real
new invariant or fix a demonstrated bug. If verified physics/proof code is
unchanged, do not spend this experiment re-proving it from scratch.

Run expensive quality/trace checks on promising outputs rather than every
plainly failed trial. Keep the existing rules and thresholds: an experimental
rating hit that fails pacing or repeated-error checks is still a failed proposal.
No fresh ACCEPT campaigns or final level assignment are needed in this phase.
Save that work for a prototype that has shown useful target control.

Use a simple JSON/JSONL record and a concise report. Preserve the request,
recipe/design, selected clock, measured D/S, important quality outcomes,
repair history, source/pin identities and CPU/wall/cache accounting. Generate
summary numbers from those records. State the number of distinct boards and
matching structures, success/miss rate and cost including failed attempts.
Do not claim a reliable general builder from a small exploratory sample.

## Requirements that stay in force

- New levels start at 250: family about 10 at 250, 12 at 274, 13 at 275, then
  about +3 per 25 levels. No easy/peak alternation or flattened curve. Start
  this prototype with 10 and 13; report higher-target measurement limits.
- Skilled 2.5-6 per board and selected setting. Minimum 2 is only an explicit,
  individually recorded fallback if really needed. No hidden lowering or
  averaging. Family tolerance stays +/-1 per level, +/-0.5 per five-level
  window when evaluating a sequence; an experiment does not change that policy.
- At least 72 tiles, recognizable original shapes, no blobs/blocks, tiles at
  least 52 px. 96-tile boards only every tenth level. Inspect representative
  shapes rather than relying on a card label.
- Clock, keys and locks visible at the start; necessary matching information
  observable before the choice. No hidden main challenge, luck-only losses,
  or a long free cruise with the only puzzle at the end. Every special matters.
  Keep the real tray, free inspection and peek-pair rules.
- Keep physics, bots, ruler pins, policy and useful checks unchanged. Do not
  edit game files, level tables, published assets, Firebase or main. No release
  or routine request for Dennis to playtest. The new builder remains separate
  until its experiment has been reviewed.

## Execution and delivery

No review agents or further delegation. One CPU-heavy job/worker at a time on
Dennis's PC, through the existing `heavy.js`, respecting busy/lock checks and
using resumable chunks of about 18 minutes. Keep live logs in your own
`source/build/`, not the shared results root.

Deliver the working prototype and a simple command that requests difficulty
10 or 13. Include what it built, what repairs helped, what did not work,
success/miss rate, cost and the remaining limitation. Push your isolated branch
and copy the final report to the shared location after heavy runs end.
If the experiment stops before useful control is achieved, leave an executable
checkpoint and the next concrete change. Call it an experimental result, not
a completed reliable builder.
