# G10: make the level builder reliably construct planned puzzles

Prepared for Gemini, 2026-11-10, at Dennis's request. **Keep this task broad.**

## Ownership and goal

Own the construction and difficulty-planning problem end to end. Improve the
builder into a practical system that takes a difficulty plan and produces good,
varied puzzles at that difficulty within a bounded amount of work. This is
the original purpose of the builder loop, beyond improving individual controls.

Construction, component design, difficulty control, repair, quality, diversity,
yield and CPU cost are all in scope. Choose the most useful architecture. You
may substantially replace the experimental planning/construction layer when
the evidence warrants it. The interim finite recipe table is a starting point,
not the required solution. Avoid ending with another list of bottlenecks when
you can implement the next useful improvement in this task.

Treat this as an experiment: prioritize an executable builder, real puzzles
and small informative bot runs. Use focused checks for actual new invariants;
do not turn the assignment into a large test or benchmark framework project.

## Workspace and evidence

Use the prepared separate worktree
`C:\Users\den_k\Idea\OmasMahjong\gemini-builder-g10`, branch
`wip/gemini-builder-g10`, starting from the lead's pushed handoff. Preserve any
subsequent work. Do not edit the lead's or previous Gemini checkouts.

Read `AGENTS.md` and `source/analysis/builder/LEVEL-DESIGN-FACTS.md` first.
Implementation belongs in `source/tools/builder-next/`; experiments and results
in `source/analysis/builder-next/`. Reuse the verified physics, existing builder
components and useful checks rather than rebuilding them without cause.

The latest skilled solver is B3 **`faa0295c`**, copied into this checkout under
`source/analysis/skilled-bot-b3/`. Read the latest assessment
`source/analysis/skilled-bot-b3/REVIEW-faa0295c.md`; older NOT READY reviews
describe an earlier revision. Its major hard-board mismatch is independently
fixed. It is approved here for controlled builder work; retain known exceptions
and inspect disputed rejections instead of treating bot numbers as truth.

The lead's starting code:

- Reuses the G9 component constructors, with an explicit B3 yardstick adapter.
  Family/reference pins remain unchanged; B3 is isolated by its actual source
  fingerprint, not merely the reused version label.
- Discards old skilled estimates, learns from current recipe measurements,
  remembers misses, avoids repair cycles and duplicate physical boards, and
  scopes knowledge to exact code/rulers/body/measurement identities.
- Fixes the G9 false-success path: a numerical target hit cannot qualify with
  invalid ratings, failed/unresolved required quality gates or the wrong spare.
  Expensive trace checks run on promising outputs at the requested sample size.
- Provides an executable CLI and a small controller regression check. Read
  `source/tools/builder-next/README.md` for commands and current limitations.

The real pilot in `source/analysis/builder-next/b3-pilot/` made four requests:
targets 10 and 13 on U and castle bodies, four proposals per request. It produced
**zero hits in 16 trials**. Twelve trials reached numerical ratings; their
family scores ranged from 2.625 to 20, but B3 needed only **1.00-1.15 tries**.
The G9 U recipe with keys [12,16], ice 44 strength 2 and clock 16 still gives
family D13.515, but B3 S1.05 instead of the old skilled bot's S9.22. Dennis
already cleared that exact board first try and called it easy. The old S values
were measuring a bot weakness, not sufficient puzzle challenge.

These results invalidate the old component calibration for skilled difficulty;
they are not proof that useful construction is impossible. The current bodies
also preserve G9's zero-face-down visible-planning control. Deliberate face-down
placement outside the readable main challenge is one hypothesis, **not a
prescribed solution or the whole scope of G10**. Investigate whatever mechanisms
produce genuine decisions and useful difficulty for both bots.

## What the finished approach must do

**Construct puzzles with a reason for their difficulty.** Build and compose
components that create meaningful choices, commitments, dependencies, relief
and consequences. Learn which interactions affect family and skilled play.
Use actual board relationships rather than tile-ID recipes that only work on
one shape. Matching structure, geometry and obstacle interactions may all be
changed. A stored witness, shuffled pictures or another clock setting alone
is not evidence of a new puzzle mechanism.

**Plan toward a requested target.** The requested family difficulty must affect
construction decisions. Use measured knowledge to choose and adjust components
while keeping the skilled band. A simple empirical model is fine if it helps.
Do not presume monotone clock responses: the pilot's castle recipe became
harder for the family when given an extra move. Keep proposed effects distinct
from measured ones, and verify the complete composed board.

**Repair meaningful misses.** Let measurements and decisions identify what to
change. Preserve useful structure rather than repeatedly starting unrelated
deals. Bound candidates, proof work and expensive ratings, remember what was
tried, and explain failure without calling a budget miss impossibility. The
planner should improve as experiments accumulate, not merely collect logs.

**Demonstrate transfer and practical yield.** Freeze a small, representative
request set with multiple recognizable shapes and seeds, initially including
targets 10 and 13, then a higher target such as 16 when the approach supports it.
Reserve some structures/seeds before tuning and keep misses in the results.
Compare against the starting builder under comparable work limits. Report
target-hit rate, quality-passing yield, distinct matching structures, repairs
and CPU/wall cost per usable result, counting failed attempts. Declare what
would count as useful reliability before evaluating the frozen version; one
successful recipe is not a general builder.

Scale to a larger yield run only after the small experiments show useful
control. Do not begin by spending CPU on hundreds of failed builds. When useful,
make the larger run resumable and show how often the system can fulfill a plan,
not just the number of candidates it can generate.

**Keep quality and usability central.** Use Dennis's saved likes/dislikes,
design facts and existing checks. Every special must matter; the puzzle's intent
and alternatives must be readable. Keep pressure within the puzzle, not solely
an arbitrary late tray squeeze. No hidden main challenge or luck-only loss.
If a technical gate is demonstrably miscalibrated, present the evidence and
version the proposed correction; do not loosen it merely to make output pass.
Save representative boards and design cards explaining their actual decisions.

## Constraints that remain settled

- New levels start at **250**: family about 10 at 250, 12 at 274, 13 at 275,
  then about +3 per 25 levels (about 16 at 300 and 19 at 325). No plateau or
  alternating easier levels and peaks. Address the measurement cap explicitly
  as targets approach/exceed it; do not flatten the curve or treat capped scores
  as precise high-target estimates. Protocol changes need new identities and
  an explicit comparability account; keep family playing behavior unchanged.
- Skilled **2.5-6 per board**, normal minimum 2.5. Minimum **2** is only an
  explicit, individually recorded fallback when really needed. Do not weaken
  B3, invent a margin, average over unsuitable boards or silently lower the band.
- Family tolerance is +/-1 per level, and every five consecutive levels average
  within +/-0.5 of the curve when evaluating a sequence. Measure both bots at
  the same actual clock setting. Repeat important/borderline results with the
  existing independent settings and a seed reserved before tuning.
- At least 72 tiles; 96-tile boards only in every-tenth-level slots. Recognizable
  original shapes, no blobs/blocks, tiles at least 52 px. Layout/seed diversity
  must be physical, not picture relabeling or labels on the same board.
- Clock, keys and locks visible initially; necessary matching information
  observable before the relevant choice. Keep real tray, free inspection,
  peek-pair, clock and retry rules. No oracle bot or physics shortcuts.
- Old ratings are historical. Use actual source fingerprints and separate caches
  for changed behavior/protocols; no silent migrations or mixed calibrations.
  Keep shared default pins unchanged until lead review. A real bot defect may
  be diagnosed and isolated explicitly, but do not detour back into general
  bot tuning to make a construction result look better.
- No game-level edits, main merge, Firebase writes or release. No routine new
  playtesting demand on Dennis. Generated outputs stay experimental.

## Execution and handoff

No review agents or further delegation. One heavy job/worker at a time through
`source/tools/builder/loop/heavy.js`, respecting other jobs and locks. Use
resumable chunks of about 18 minutes; keep live logs in your own `source/build/`.

Deliver a working builder command that takes a difficulty request/plan and
returns measured puzzles or honest bounded misses. Include the construction
knowledge gained, concrete examples, success/miss and quality yield, transfer
results and full cost accounting. State precisely which difficulty ranges,
components and shapes are supported and what remains unproven. Do practical
improvement work before concluding that another numbered task is needed.

Push `wip/gemini-builder-g10`. After heavy runs finish, copy the final report to
`C:\Users\den_k\Idea\OmasMahjong\gemini-tasks\results\builder-g10\REPORT.md`.
If unfinished, leave a runnable checkpoint and the next specific construction
change. The lead reviews adoption and any final level proposal.
