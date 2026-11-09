# Task B1: make the skilled bot a trustworthy competence benchmark

Prepared for Gemini, 2026-11-09, at Dennis's request.

Dennis's latest clarification defines the scope: **the skilled bot measures the
builder. Boards are discarded when it struggles, so it should not be worse than
his demonstrated play.** This is broader than fixing one G9 board. Improve its
general ability to recognize and solve the puzzles Dennis can handle, using
the same observable information. Keep work practical and experiment-led.

## Why this matters

The builder has been treating a high skilled score as evidence that a puzzle
is too hard. That conclusion is unsafe when the score comes from a bot blind
spot. Conversely, a useful puzzle must not be declared challenging merely
because it exploits a poor bot policy.

Treat the skilled bot as a **strong competence reference**, not a simulator
whose purpose is to reproduce Dennis's occasional mistakes. Aim to match or
exceed his demonstrated ability. Where he wins an easy board on one try, the
bot should usually do so too; it must not repeatedly lose to a simple pattern.
Existing fitted scores are evidence to examine, not a reason to preserve
weaknesses. The family bot remains the separate measure of family difficulty.

## Workspace and ownership

Start from the latest pushed `origin/wip/cc-builder-loop` containing this task
and `source/analysis/skilled-bot-b1/evidence/`. Use the prepared separate
worktree `C:\Users\den_k\Idea\OmasMahjong\gemini-skilled-bot-b1`, branch
`wip/gemini-skilled-bot-b1`. Preserve subsequent changes before starting.
Do not modify G9's checkout or the lead's checkout.

Read `AGENTS.md`, `source/analysis/builder/LEVEL-DESIGN-FACTS.md`, the evidence
summary below, `source/tools/builder/loop/yardstick.js`, and the existing planner
entry point/controller/measurement code. Own new behavior modules, an explicit
candidate bot entry point and results under `source/analysis/skilled-bot-b1/`.

Register a separate bot version/fingerprint and cache namespace when measuring
changed behavior. Preserve the old planner for paired comparisons. Do not
silently replace pins, relabel old cached ratings or add a behavior-changing
cache migration. Keep the family/reference bots and production physics unchanged.
Avoid edits to shared modules that would change those bots as a side effect.

## Starting evidence: Dennis's actual G9 play

The frozen board and raw local lab events are in
`source/analysis/skilled-bot-b1/evidence/`. Read `human-result.json` and
`manifest.json`; do not substitute another board with the same shape or level
number. Exact board hash:

`e038d9ff3e4a48228ead2c9d0e732a8f0677fffa476543976a3294e7efa4a176`

- 76-tile U geometry, keys `[12,16]`, ice tile 44 at strength 2, clock tile 26
  with deadline 16. The current skilled score is **9.22** (route 9.22, plain
  10.90), with 11 of 40 chosen-style campaigns uncleared at the attempt limit.
- The lab recorded **one completed try, one win**, and Dennis marked it **easy**
  with one star. It also recorded two starts and no completed losses; retain
  those facts rather than hiding the restart/start distinction.
- His 70 captured manual removals replay legally on the exact frozen board.
  He takes the clock at removal 15, within its deadline. Six tiles remain after
  the manual log; the lab records a completed win, and the lead verified a legal
  finishing continuation. The recorded continuation witness is not claimed to
  be the precise unrecorded automatic-finish order.
- His opening is `[75,73,43,41,62,60,2,51,12,16,68,65,50,42,26,72]`.
  A sampled bot opening is
  `[75,73,68,65,42,41,50,43,60,62,2,16,51,12,26,72]`; that bot attempt later
  loses to tray pressure after 34 taps. Inspect the whole sequence and the first
  consequential error; a different opening alone does not prove an error.
- A quick paired comparison increased tray lookahead from 2 to 3 and 4. All
  40 campaign outcomes stayed identical at S9.22. A balanced-key control stayed
  S2.95. The released Dennis-reference profile scored 13.70 on the hard board.
  Merely turning the existing lookahead knob was not a fix.
- No tiles were face down because G9 explicitly used `hiddenOnWay:0` and
  `maxDown:0` to isolate visible planning. The lab preserved `down:[]`. This
  does not mean every covered picture was initially visible, and is not a rule
  that future levels should have no face-down tiles.

This is a concrete mismatch to investigate, not evidence of a physical ceiling
on puzzle construction. Family D13.515 is a separate bot estimate, not an actual
family play result. Do not tune the family bot to restore a preferred ordering.

## Work: improve competence across the builder's puzzle types

1. **Understand the decisions.** Compare the human route and bot failures using
   actual observations, tray state, known matches, key/ice dependencies and
   clock slack. Identify where the bot commits to a losing plan, fails to
   anticipate a visible requirement or fails to learn from an actual loss.
   Recapture full observations for a few bot campaigns if the retained tail
   captures are insufficient. Explain the cause before choosing a fix.
2. **Implement general improvements.** Consider planning prerequisites together,
   tray-space reservations, choosing between four matching copies, meaningful
   clock routes, and adapting a plan when the board opens. Keep the approach
   open: diagnose what actually fails rather than prescribing another weight
   adjustment. Do not cap reasoning at the old shallow horizon merely to retain
   human-like mistakes; bounded deeper search over legitimately known information
   is allowed. Avoid unbounded exhaustive search on every move.
3. **Broaden the evidence early.** Use Dennis's exact saved boards and known
   results, including the archived 24 lab boards and exact original 200/225
   cases where appropriate. Match board content/version, not just level number.
   Respect censored/non-winning records as lower bounds. Include representative
   builder puzzles with clock pressure, locks/keys, ice, four-copy choices,
   competing branches, and face-down/peek-pair play. Inspect cases where the
   current skilled bot underperforms his demonstrated result, not only G9.
4. **Make small paired runs.** Start with a few campaigns during development,
   then use the normal fixed settings on promising versions. Compare baseline
   and candidate on unchanged boards and the same seeds. Keep first-try wins,
   tries until win, uncleared/censored runs, repeated bad decisions and CPU cost
   visible. Report per-board outcomes; an overall mean must not conceal boards
   where the candidate is still much worse than Dennis.
5. **Check generalization.** Reserve different boards/mechanisms and fresh
   diagnostic seeds before tuning. A G9-specific fix is a starting point, not
   completion. Show whether improvements carry to unfamiliar matching structures
   and face-down boards. Picture relabeling is not structural diversity.
6. **Assess builder impact.** Rerate a small frozen sample of previously
   rejected/high-S builder boards. Separate genuine competence improvements
   from remaining hard puzzles and bot-specific weaknesses. Show which boards
   would change classification under the candidate; do not silently promote
   them into an accepted library or change the family curve.

Known human results should constrain the conclusion: aim for first-try
performance consistently on boards Dennis finds easy, and at least his
demonstrated competence on the wider exact-board sample. Report uncertainty and
remaining exceptions honestly. A model may become more capable than his recorded
try count; do not reject a genuine competence gain merely because it is a more
optimistic prediction than the old personal-fit MAE. Retain those historical
metrics for context and inspect any real losses of capability.

## Information and measurement rules

- Use only the normal observation stream, public geometry, legitimately seen
  roles/pictures and permitted memory/inference. No hidden-picture oracle, true
  future faces, stored winning solution, human replay or board-ID lookup in the
  decision policy. Unknown pictures must not become free matches/jokers in a
  planning relaxation. The human replay is analysis evidence, not a bot script.
- No special cases for the G9 hash, tile numbers, layout IDs or desired grades.
  Express behavior in terms of board relationships and available information.
- Preserve real tray, free inspections, peek pairs, clock timing and retry
  semantics. Only a completed actual loss permits loss-learning/retry. Do not
  turn computational censoring into a loss or pretend an unproved choice wins.
- Keep first-try and retry competence distinct. Do not obtain a good "one try"
  score by secretly running many attempts and choosing a winner afterward.
- The new skilled reference is allowed to be stronger. If it correctly rates
  the G9 board near one try, report that the board is easy for it. Do not weaken
  the bot to preserve the builder's 2.5-6 selection band. That band and the
  family curve remain unchanged in this task; recalibration/requalification
  after changing the reference must be explicit and versioned.

## Practical validation and handoff

Treat this as a focused improvement experiment, not a large testing project.
Prioritize captured decisions, actual human comparisons, a working candidate
and small real runs. Add focused regressions for the demonstrated behavioral
fix and information boundaries. Use the existing production replay/validity
checks; do not spend the task rebuilding verified game physics or infrastructure.

The existing two styles and the candidate's strategy must be described clearly.
Keep measurement settings, versions, source hashes, exact boards and complete
outcomes reproducible. Behavioral changes invalidate old skilled ratings; do
not reuse their caches as candidate results or silently mix versions in G9.

No further delegation or review agents. One heavy job/worker at a time via
`source/tools/builder/loop/heavy.js`, in resumable chunks of about 18 minutes,
respecting other jobs/locks. Keep live logs in your own `source/build/`.
No game-level edits, main merge, Firebase writes, release or new routine demand
for Dennis to playtest. He has supplied this play voluntarily; use existing
records for broader comparisons.

Deliver a working separately versioned skilled candidate, the causal explanation,
human/baseline/candidate comparisons, builder-impact sample, runtime costs and
remaining weaknesses. Continue beyond a single negative tweak. If the session
ends, leave a runnable checkpoint and clear next action rather than calling an
unresolved model reliable. Push `wip/gemini-skilled-bot-b1` and copy the final
report, after heavy runs finish, to
`C:\Users\den_k\Idea\OmasMahjong\gemini-tasks\results\skilled-bot-b1\REPORT.md`.
The lead will review adoption and the explicit update of skilled pins/ratings.
