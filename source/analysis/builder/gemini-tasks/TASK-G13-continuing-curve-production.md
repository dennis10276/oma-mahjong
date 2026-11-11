# G13: reliable construction across the continuing difficulty curve

Prepared for Gemini, 2026-11-11, after Dennis asked whether G12 is ready or
needs the next task. Own the whole remaining production problem: construction,
target control and repair, quality, general plans, diversity, yield and cost.

## Starting point

Use the separate prepared worktree
`C:\Users\den_k\Idea\OmasMahjong\gemini-builder-g13`, branch
`wip/gemini-builder-g13`. It contains G12 `906e9f61`, the independent review
and this task. Preserve subsequent work; do not edit the lead's or earlier
Gemini checkouts.

Read `AGENTS.md`, `source/analysis/builder/LEVEL-DESIGN-FACTS.md`, the G12 task,
and `source/analysis/builder-next/G12-REVIEW.md` with its `g12-review/` evidence.
The report's statement that all requirements were met is not accepted.

Preserve real progress: five distinct saved bodies with legal slot tile counts,
four normal-band examples and a recorded level-250 fallback. The lead reproduces
target 10 / diamond 30 / seed 4 at D10.30/S3.33, passing actual quality checks.
G11's normal target-13 pyramid seed-4 example also reproduced previously.

But G12's submitted yields are **4/5 at target 10, 1/3 at 13, 0/2 at 16**.
The independent target-10 diamond seed-11 request misses after four proposals;
the original and derived-seed candidates rate only D3.545-4.20/S1.05. The higher
curve is not reliably supported. Selected examples are not evidence of general
yield, and an unsupported high range is not a completed future builder.

Implementation remains `source/tools/builder-next/`; new retained evidence and
the final report belong in `source/analysis/builder-next/g13/`.

## Main construction objective

Make the requested target reliably steer actual puzzle construction across
10, 13 and 16, then support 19 with an honest measurement protocol. Keep the
normal skilled band and all player-facing design constraints. You may replace
or substantially redesign the experimental construction/planning layer. Keep
verified physics and the reviewed B3 `faa0295c` solver intact.

Diagnose the structural difference between hard and easy bodies before spending
more CPU on nearby clock settings. Use actual decisions, visibility, proved
detour/consequence costs, dependency paths and tray-space requirements to
develop transferable components and repairs. A legal witness-order check alone
does not guarantee meaningful family difficulty. Learn why a tempting choice
actually competes with the objective, and compose several meaningful decisions
without introducing blind digging, repeated known mistakes or only late pressure.

Use small paired construction experiments and implement the useful mechanism
inside the builder. Clock tuning, a longer list of calibrated seeds, or merely
declaring an easier seed unsuitable is insufficient. Bounded deterministic
derived seeds are allowed, but disclose actual seeds, count all work and avoid
silently routing all requests to a few known successes. Record physical and
matching-structure diversity, not just different picture names or deadlines.

At targets 16+, inspect the actual early losses before claiming that the quality
gates cannot be met. Design the meaningful visible choices where the difficulty
arises; do not relabel every random loss as an authored trap or lower gate
thresholds to force a pass. A genuinely incorrect technical gate can be examined
with concrete paired examples and proposed as a versioned correction, with
current-rule and proposed-rule qualifications reported separately.

## Make the production path general

Implement a plan API/command taking a start level, count, reproducible seed,
work budget and explicit per-output exception policy. Derive targets and board
slot constraints from the requested plan, choose/repair structures, and return
the actual qualifying outputs or honest bounded misses. Do not implement the
plan as another fixed list of selected `SEQUENCE_SPECS`.

Demonstrate a fresh five-level plan at 250-254, and a higher-range plan after
275 once supported. Every level must satisfy its own constraints before the
five-level average is checked. Enforce tile-count scheduling for every slot,
and enforce distinct matching bodies even when the picture names are changed.
Do not fill levels with the same board or clock-only variants.

Normal skilled S2.5-6 remains the objective. An individual fallback to 2-2.5
requires an explicit caller choice, rationale and recorded failed normal work.
Keep normal/fallback yield separate. The big-board slot alone is not a reason
to apply fallback automatically. No board above 6 or below 2 is admissible.

## Finish the measurement protocol

G12's extended family ratings allow 40 attempts per campaign, but its quality
trace capture still hardcodes 20 attempts and counts uncleared runs as 20.
Make the protocol coherent. Propagate the declared cap/settings through rating,
trace capture, censoring, summaries, cache keys and retained campaigns. Preserve
the intended quality diagnostic windows explicitly; if retaining a first-20
window, define and validate it rather than calling it full 40-attempt evidence.
Reject unknown protocol names and keep protocol-specific knowledge intact.

Keep family playing behavior unchanged. Compare the lower-range anchors and
frontier boards under both protocols and quantify drift. Same heuristics do
not make capped means automatically equivalent. Establish a consistent scale
for the requested curve; do not silently mix old cap-20 and new cap-40 values
in a sequence or flatten the rise to avoid measurement limits. Scores that
remain censored are not precise evidence for a high target.

## Demonstrate actual reliability

Separate development/known-good cases from a genuinely reserved matrix. Fix
the request set, unseen seeds and work budgets before final tuning, retain its
manifest/hash, freeze the candidate, then run it without selecting only good
outcomes. If cases become tuning data, identify them as development and reserve
new cases. Include multiple shapes and fresh seeds at each advertised tier.

Keep G12's practical readiness bar: **at least 80% normal-band fulfillment per
tier advertised as reliable**, with target accuracy and all required quality
checks under the fixed budget. Aim to meet it at 10, 13 and 16, then extend to
19. An aggregate cannot hide a weak tier. Unsupported ranges must be explicit;
do not describe all future levels as ready while 13/16 still fail this bar.

Start small, fix informative misses, then run a larger resumable yield check
only when useful. Preserve full builder results, actual effective briefs,
layouts/board hashes, source/ruler/protocol identities, complete campaign
outcomes, repairs, quality verdicts and wall/process-CPU cost. Count every failed
deal, proof search and bot style, and distinguish cold from warm costs.

Fix the current matrix exporter: it reads `res.history`/`res.candidate`, whereas
the API returns `res.attempts`/`res.finalCandidate`; trial counts and recipe
identities are therefore wrong. Generate hit labels, supported-range claims,
cards, sequence validations and summaries directly from retained outcomes.
The lead's independent diamond example cost 17.099 s wall / 20.453 s CPU fresh;
the seed-11 miss cost 20.563 s / 21.890 s. Receipt/cached costs are not fresh
production costs or a substitute for cost per usable level including misses.

## Settled constraints

- Family about 10 at 250, 12 at 274, 13 at 275, then about +3 per 25 levels:
  16 at 300 and 19 at 325. No plateau or alternating easier/peak pattern.
- Tolerance **+/-1 per level**, including frontier requests; remove G12's
  exploratory +/-1.5 acceptance settings. Every five consecutive levels average
  within +/-0.5. Both bots see the same actual deadline. Repeat important and
  borderline outputs on independent settings and a reserved diagnostic seed.
- At least 72 tiles. 96 tiles only every tenth level. Original recognizable
  shapes, no blocks/blobs, tiles at least 52 px. Clock, keys and locks visible
  initially, necessary matching information observable before the relevant
  choice, every special meaningful, no hidden main challenge/luck-only loss
  or only a late tray squeeze. Preserve actual tray/inspection/peek/clock rules.
- Use focused discriminating checks for real new invariants and protocol
  compatibility. This remains a practical construction experiment; do not
  spend the task on a large test framework or re-proving unchanged physics.
- No game-level edits, main merge, release, Firebase writes or routine new
  playtesting demand on Dennis. Keep default shared pins unchanged for lead
  review. Generated plans are experimental artifacts, not replacement tables.

## Delivery

No review agents or further delegation. One heavy job/worker at a time via
`source/tools/builder/loop/heavy.js`, respecting other jobs/locks, in resumable
chunks of about 18 minutes. Live logs stay in your own `source/build/`.

Deliver working request and general-plan commands, the construction changes,
coherent protocol evidence, fresh reserved-matrix yield, diverse legal plans,
full costs and a truthful supported-range/readiness assessment. Continue
implementing fixable construction improvements instead of ending with another
general list of bottlenecks. If unfinished, leave a runnable checkpoint and
the specific remaining construction cause.

Push `wip/gemini-builder-g13`. After heavy runs finish, copy the final report to
`C:\Users\den_k\Idea\OmasMahjong\gemini-tasks\results\builder-g13\REPORT.md`.
The lead reviews adoption and any actual level proposal.
