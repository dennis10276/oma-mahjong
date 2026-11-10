# G11: finish a reliable request-to-puzzle builder

Prepared for Gemini, 2026-11-10, at Dennis's request after the independent G10
review. Keep ownership broad: construction, planning, repair, quality, variety,
yield, cost and support for the future difficulty curve.

## Goal

Deliver a working builder that fulfills difficulty requests with good, varied
puzzles within a practical, bounded amount of work. Continue improving the
actual construction system until that capability is demonstrated. A report
claim, a few numerical examples, a blueprint collection or passing software
checks do not establish reliable level production.

You may replace or substantially redesign `source/tools/builder-next/` when
the evidence warrants it. Reuse verified physics, bot implementations and useful
checks. This is a practical experiment: prioritize executable construction,
real bot measurements and concrete boards over a large testing framework.

## Workspace and authoritative starting evidence

Use the prepared separate worktree
`C:\Users\den_k\Idea\OmasMahjong\gemini-builder-g11`, branch
`wip/gemini-builder-g11`. It starts with G10 `f3f395ef`, the lead's independent
review and this assignment. Preserve subsequent work before starting; do not
edit previous Gemini checkouts or the lead's checkout.

Read `AGENTS.md`, `source/analysis/builder/LEVEL-DESIGN-FACTS.md`, the G10 task,
and especially `source/analysis/builder-next/G10-REVIEW.md` with `g10-review/`.
The G10 report's success claims are not accepted findings. The review takes
precedence where they conflict. Use the reviewed B3 `faa0295c` solver through
the explicit source-fingerprinted adapter; its current limitations remain
visible when inspecting disputed rejections. Do not restart general bot tuning
to make a builder recipe fit.

Implementation stays in `source/tools/builder-next/`. Put new evidence, retained
outputs and the final report in `source/analysis/builder-next/g11/`. Preserve
G10's historical files for comparison.

## G10 findings that must be addressed

- Seven logged `EXPERIMENTAL_HIT` examples, **zero satisfying all requirements**.
  Generated U cases score S7.08 and S8.20, above the unchanged maximum 6.
  Blueprint cases fail required static checks and have no passing trace result.
- Independent execution of the advertised target-10/layout-22/seed-1 request,
  six trials and 80 family campaigns, returns **NO_MEASURED_HIT**. Its first
  down-10 recipe measures D4.59/S1.05 rather than the logged D10.50/S7.08.
  Reproduce and explain this exact-board/measurement discrepancy before using
  those figures as construction calibration.
- `blueprints.json` is not loaded into the recipe proposals. The blueprint
  pass-through branch does not make those examples available through normal
  requests. Vase/layout 7 is advertised but not registered in the builder.
- Recipes still use fixed tile IDs. The claimed fresh-seed dynamic key resolver
  is not delivered, and the single seed-2 transfer record has no D/S ratings.
- There is no demonstrated quality-passing yield on reserved requests, no
  reliable cost per usable puzzle, and no sequence/future-cap evidence.

These are concrete starting problems, not a prescription to limit G11 to
connecting JSON files or correcting reports. Fix the construction capability.

## Work toward the complete capability

**Establish one honest executable path first.** From a clean checkout, a
documented request must build the actual board that is measured and reported.
Persist its complete design, exact hash including deadline/down tiles, request,
seed, recipe/edits, solver/profile/source fingerprints, effective settings,
proof and quality results, campaign outcomes and costs. A resumed/cache result
must match those identities, not merely a board ID or reused bot-version label.
Generate summaries and hit labels from retained executable results rather
than hand-written example rows. Make the advertised command reproduce them.

**Develop transferable puzzle construction.** Learn useful matching and
dependency mechanisms from the prior work and human-liked boards, then turn
them into construction rules that work on actual geometry and observations.
Create meaningful choices, commitments, working-space decisions and relief,
with consequences a player can understand. Controlled face-down placement,
multi-branch interactions, picture structure, obstacle placement and geometry
are all in scope. Choose mechanisms from evidence; three ablations do not prove
that face-down tiles are the only source of difficulty. Preserve readable
intent and avoid luck-only difficulty.

Existing blueprints may teach patterns and supply comparisons. A reliable
future builder needs to generate varied matching structures; copying old
boards, relabelling pictures or changing only their clocks is insufficient.
If a mechanism depends on a visible pair or structural location, resolve that
relationship on the current board rather than retaining a layout-specific ID.

**Make the target drive planning and repair.** Use measured knowledge to choose
components and adjust the complete puzzle. Keep proposals, predictions and
actual measurements distinct. Do not assume a globally monotone clock response.
Investigate the first consequential decisions behind misses, preserve useful
parts, remember attempted edits and avoid cycles or unrelated random retries.
Bound construction, proof, rating and repair work, and return an honest miss
when the current budget is insufficient. Continue improving the construction
model rather than concluding that every failed recipe needs another task.

**Keep qualification real.** A successful result needs the requested family
band, skilled band, valid measurements, resolved required static checks and
passing required trace checks on the exact output and clock setting. Never
count an out-of-band or failed-gate reference as a hit. Use the existing quality
checks and Dennis's saved likes/dislikes. A suspected gate false positive may
be investigated with concrete paired boards and replay evidence, then proposed
as a versioned correction. Do not excuse failed visibility/fairness checks as
idle-lock artifacts or silently loosen gates to raise yield. Keep proposed-gate
results separate from qualification under the current rules.

**Demonstrate reliability and diversity.** Before final tuning, freeze a modest
request matrix spanning family targets 10 and 13, multiple recognizable shapes
and fresh seeds, then include a higher target such as 16. Reserve cases that
were not used to choose the rules. Declare a practical yield/work-budget bar
before the final run; do not lower it after seeing misses. Retain every request
and trial. Show completed requests/attempted requests, full quality-passing
yield, distinct physical matching structures, repairs, cache usage and total
CPU/wall cost per usable level, including failures and proof work.

Start small and fix failures before scaling up. Once there is real control,
run a larger resumable yield experiment. Demonstrate a short consecutive level
plan, not only unrelated target examples. Passing one selected board or proving
a route on a fresh seed is not measured target transfer.

**Support the levels ahead honestly.** The curve starts at family 10 for level
250, reaches 12 at 274 and 13 at 275, then rises at about +3 per 25 levels
(16 at 300, 19 at 325). Do not flatten it or alternate easier levels and peaks.
Handle the measurement ceiling as an explicit protocol limitation: capped
scores are not precise evidence for high targets. Establish a versioned way
to extend the measurement range where necessary, with a comparability account
and unchanged family playing behavior. State the supported range; do not claim
arbitrary future levels from experiments confined to 10-13.

## Settled constraints

- Skilled band **2.5-6** per output; minimum **2** only as an explicit,
  individually recorded fallback when really needed. Do not weaken B3,
  silently change the band, invent a margin or average across unsuitable boards.
- Family tolerance +/-1 per level; every five consecutive levels average
  within +/-0.5 of the curve. Both bots rate the same actual deadline. Repeat
  borderline/important results with independent settings and a reserved seed.
- At least 72 tiles. 96-tile boards only in every-tenth-level slots. Original,
  recognizable shapes, no blocks/blobs, tiles at least 52 px. Respect large-board
  scheduling when demonstrating a level sequence.
- Clock, keys and locks visible initially; necessary matching information
  observable before the relevant decision. No hidden main challenge, luck-only
  losses or a long free cruise with the only puzzle at the end. Every special
  must matter. Preserve real tray, free inspection, peek-pair and clock rules.
- Keep family/reference behavior, shared default pins and live levels unchanged
  pending lead review. Version changed code/protocols and isolate caches.
  No game-level edits, main merge, Firebase writes or release. No routine new
  playtesting demand on Dennis; use the existing records.

## Delivery

No review agents or further delegation. One CPU-heavy job/worker at a time via
`source/tools/builder/loop/heavy.js`, respecting other jobs and locks. Work in
resumable chunks of about 18 minutes; live logs stay in your own `source/build/`.

Deliver the working builder command, reproducible qualified outputs with design
cards, the frozen request/sequence results, full yield/cost accounting, and an
evidence-backed readiness assessment with explicit supported ranges and limits.
Use small discriminating checks for demonstrated software defects, not test
volume as the completion metric. If the current system still produces no
admissible outputs, improve it before calling the task finished.

Push `wip/gemini-builder-g11`. After heavy runs finish, copy the final report to
`C:\Users\den_k\Idea\OmasMahjong\gemini-tasks\results\builder-g11\REPORT.md`.
If unfinished, leave a runnable checkpoint and the specific remaining
construction cause. The lead reviews adoption and any actual level proposal.
