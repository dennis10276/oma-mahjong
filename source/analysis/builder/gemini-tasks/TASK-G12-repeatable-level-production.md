# G12: turn working puzzle examples into reliable level production

Prepared for Gemini, 2026-11-10, at Dennis's request for the next builder task.
Keep broad ownership of construction, planning, repair, quality, diversity,
yield, sequence scheduling, cost and support for the future curve.

## Starting point and objective

G11 made real progress. The lead independently reproduces the target-13,
pyramid/layout-6, seed-4 request through the actual builder: **D12.115, S2.67,
all required static and trace checks passing**, in the normal skilled band.
Keep that capability. The next bottleneck is producing that quality reliably
across requests, rather than relying on selected successful seeds.

On the same fresh-cache settings, seed 5 returns **NO_MEASURED_HIT** after six
proposals: its rated candidates remain D3.155-3.825. Clock adjustments around
the existing body do not recover target 13. Fix the construction/repair strategy
behind this gap and demonstrate practical yield. You may substantially redesign
the experimental layer when needed; do not limit this assignment to a benchmark
or scheduler patch.

Use the prepared worktree
`C:\Users\den_k\Idea\OmasMahjong\gemini-builder-g12`, branch
`wip/gemini-builder-g12`, containing G11 `f2147271`, the independent review and
this task. Preserve subsequent work. Do not edit earlier checkouts or the lead's.

Read `AGENTS.md`, `source/analysis/builder/LEVEL-DESIGN-FACTS.md`, the G11 task,
and `source/analysis/builder-next/G11-REVIEW.md` with `g11-review/`. G11's broad
READY claim is not an accepted reliability result. Its normal-band example is
accepted as reproduced experimental evidence, not a release qualification.

Keep implementation in `source/tools/builder-next/`. Put new retained results
and the report in `source/analysis/builder-next/g12/`.

## Main work

### Make construction transfer

Diagnose consequential structural differences between successful and failed
requests, initially including the seed-4/seed-5 pair. Improve component choices,
matching structure, obstacle dependencies, visible decisions, working-space
requirements and controlled face-down placement as the evidence warrants.
Develop repairs that change the relevant puzzle structure, not just its clock
or metadata. Keep the main challenge readable and avoid luck-only difficulty.

A bounded search over derived seeds may be part of the planner, but make it
explicit, deterministic and costed. Do not silently redirect every request to
a known good seed, omit failed deals, or present unlimited seed shopping as
target control. The requested difficulty must meaningfully steer construction.
Use learned knowledge to select and repair components, and retain physical
diversity. Reuse verified physics and the reviewed B3 `faa0295c` bot.

### Produce the normal skilled band first

Normal S2.5-6 remains the construction objective. G11's four saved examples
contain only one normal-band case and three explicit fallback cases. Improve
normal-band supply instead of making minimum 2 the default production policy.

Remove the CLI's automatic `layout === 27` fallback. Fallback 2-2.5 must require
an explicit caller decision for an individual output, with the reason and work
that failed to find a normal candidate recorded. Report normal and fallback
yield separately. Never relax the maximum 6 or change the bot to fill the band.

### Build and validate actual level plans

Provide an executable plan-to-level path that chooses suitable bodies and
repairs for each slot, enforces scheduling and evaluates the actual outputs.
Demonstrate levels **250-254 with five distinct retained boards**. A 96-tile
board is allowed at 250, not 253. Do not repeat the same board or clock-only
variants to fill the sequence. Identify repeated matching structures even when
picture names differ.

Validate every output's numerical and quality constraints, then the five-level
curve average. Generate cards and summaries from those outputs. G11's sequence
used a forbidden 96-tile board at 253, repeated earlier boards and hardcoded
some ratings; a passing arithmetic average did not qualify the sequence.

### Demonstrate yield on reserved requests

Freeze a practical request matrix and work budget before final tuning. Cover
targets 10 and 13 on at least three recognizable shapes and multiple fresh seeds;
then add 16 and, when measurement permits, 19. Reserve cases not used to choose
recipes. Start with small diagnostics, improve the builder, and scale only once
there is useful control. Count every requested output and every failed trial.

For any target tier advertised as reliably supported, aim for at least **80%
normal-band request fulfillment** under the declared work budget, with all
required quality checks. Treat this as the practical G12 readiness bar, not a
new level-design policy. Show per-target and per-shape results; a strong average
must not conceal an unsupported tier. If the bar is missed, improve the system
or explicitly limit the claim. Fallback successes cannot inflate normal yield.

Preserve exact designs/hashes, complete effective briefs, layout-catalogue
identity, seeds, repairs, code/ruler/protocol fingerprints, gate outcomes and
campaign results. Separate fresh-cache, cached and receipt-based costs. Report
CPU/wall cost per usable level including construction failures, discarded
candidates, proof work and all bot styles. The lead's fresh seed-4 hit took two
trials, 25.423 s wall / 29.266 s CPU; do not imply warm receipt costs describe
fresh production.

### Support the continuing curve

The plan starts at family 10 for level 250, reaches 12 at 274 and 13 at 275,
then continues about +3 per 25 levels: 16 at 300, 19 at 325. No plateau or
alternating easier/peak pattern. Demonstrate higher-target construction and a
short higher-range plan when supported; do not claim all future levels from
one target-13 example.

The current limitation is **20 attempts per campaign**, not 20 campaigns.
Extend the measurement protocol explicitly where censoring prevents meaningful
high-target ratings. Keep family playing behavior unchanged, version the new
protocol/cache, and establish comparability with lower-range anchors. Do not
mix incompatible capped and extended ratings in one curve or silently flatten
the requested rise. Return an explicit unsupported-range result when necessary.

## Functional integrity and settled boundaries

- A hit needs the requested family band, valid skilled-band ratings, resolved
  required static checks and passing required trace checks on the exact output
  and clock setting. No hardcoded success booleans or unmeasured sequence values.
  Keep proposed changes to a technical gate versioned and evidence-backed;
  failed quality checks cannot be waived to improve yield.
- Audit effective construction parameters. `hiddenOnWay:2` is currently clamped
  to 1 by the underlying constructor. Parameters such as `frameSpare`, `traps`
  and `tailPairWidth`, and the actual layout catalogue, belong in construction
  identity where relevant. Do not treat inert controls as physical improvements.
- Use a few discriminating checks to protect actual qualification, explicit
  fallback, scheduling, diversity and cache identity. Fix the stale fast check
  that currently fails on retained `expectedS` fields without deleting meaningful
  invariants. Keep the focus on working puzzles, not a large test project.
- Family tolerance +/-1 per level and every five consecutive levels within
  +/-0.5 on average. Repeat important/borderline output ratings with independent
  settings and a seed reserved before tuning. No averaging away individual misses.
- At least 72 tiles, 96 only every tenth level, recognizable original shapes,
  no blocks/blobs, tiles at least 52 px. Clock, keys and locks visible initially;
  necessary matching information observable before the relevant choice. Every
  special must matter; no hidden main challenge, luck-only loss or only a late
  tray squeeze. Preserve real tray, inspection, peek-pair and clock rules.
- Keep shared default pins, live levels, game files and main unchanged pending
  lead review. No Firebase writes, release or routine new playtesting demand on
  Dennis. Generated sequences remain experimental, not replacement level tables.

## Delivery

No review agents or further delegation. One heavy worker/job at a time via
`source/tools/builder/loop/heavy.js`, respecting other jobs/locks, in resumable
chunks of about 18 minutes. Live logs stay in your own `source/build/`.

Deliver the working single-request and level-plan commands, the construction
improvements, reproducible boards/cards, reserved-matrix yield, valid sequence
results, full costs and an honest supported-range/readiness statement. Continue
improving the actual builder when diagnostics expose a fixable construction
failure; do not end with another general list of bottlenecks.

Push `wip/gemini-builder-g12`. After heavy runs finish, copy the final report to
`C:\Users\den_k\Idea\OmasMahjong\gemini-tasks\results\builder-g12\REPORT.md`.
If unfinished, leave a runnable checkpoint and the specific remaining cause.
The lead reviews adoption and any actual level proposal.
