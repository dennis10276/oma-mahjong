# Task B3: finish the skilled benchmark for builder use

Prepared for Gemini, 2026-11-10, at Dennis's request.

## Outcome

Make the skilled benchmark ready to judge builder puzzles without discarding
good boards because of its own planning weaknesses. Dennis's requirement is
unchanged: **it should not be worse than his demonstrated play**. Preserve the
real B2 improvements and resolve its remaining consequential failures. This
is a practical solver improvement experiment, not a testing-infrastructure task.

Deliver working code, honest paired results and a concrete adoption proposal.
Do not substitute a better overall average or a polished report for readiness.
If the criteria remain unmet, say not ready and leave the actual cause and a
runnable next step. Do not label known unresolved policy failures conditional
readiness for autonomous rejection.

## Workspace and starting evidence

Use the prepared worktree
`C:\Users\den_k\Idea\OmasMahjong\gemini-skilled-bot-b3`, branch
`wip/gemini-skilled-bot-b3`. It contains B2 `07f36261`, the lead's B2 review
and this assignment. Preserve subsequent work before starting. Do not change
the lead's checkout or the B1/B2/G9 checkouts.

Read `AGENTS.md`, `source/analysis/builder/LEVEL-DESIGN-FACTS.md`, B2's task,
and especially `source/analysis/skilled-bot-b2/REVIEW.md` and `review/`.
B2's READY report contains disproved statements; use the review and saved
campaign outcomes to establish the baseline. Own new candidate code and results
under `source/analysis/skilled-bot-b3/`. Preserve prior bots for comparisons.

Verified B2 results that need action:

| Case | Human evidence / comparison | B2 evidence |
| --- | --- | --- |
| G9 | Dennis first-try easy win | Fixed: fresh seed 99173, 37/40 first wins, S1.07 |
| factory2-184 | Dennis first-try easy win | Fixed: fresh seed 99173, 38/40 first wins, S1.05 |
| factory1-189 | Dennis first-try easy win | 57/120 first wins (47.5%); fresh 24/40, S1.68 |
| factory3-176 | Dennis first-try easy win | 50/80 first wins (62.5%), S1.40 |
| Qualified 223 | Earlier planner substantially stronger | Old S4.45/5.42/5.80; B2 S7.70/9.63/8.88 on the three declared settings; 30/120 uncleared |
| blind1-185 | Recorded Dennis win in 6 tries | S17.52; only 17/80 clear within 20 attempts |

Use exact board identity, not the level number. For example, factory1-189
actually has 72 tiles and 29 face-down tiles; B2's claimed 76/36 was incorrect.
Single human wins do not establish true probabilities, but they also do not
establish that Dennis was lucky. Explain observation-level constraints before
claiming a mismatch is unavoidable.

## Work in priority order

1. **Correct the comparison before more tuning.** B2's runner divides old/B1
   first-block counts by two-block populations. Reconstruct statistics from
   the retained campaigns for every bot. The corrected full benchmark is
   old 1,103/3,720 first wins with 200 uncleared; B1 1,347/3,720 with 182
   uncleared; B2 1,503/3,720 with 192 uncleared. Show pooled and per-block
   outcomes consistently. Preserve censoring separately from completed losses.
   A resumed result must match board, behavior fingerprint and all measurement
   settings; an ID alone is not a valid cache/resume key. Retain effective
   profiles, versions, source hashes and both-style wall/CPU costs.
2. **Diagnose qualified 223 against the stronger earlier bot.** Capture a few
   paired decision traces with the same seeds and observations. Locate the
   first consequential planning mistakes and distinguish clock routing,
   key/ice dependencies, tray reservation and insufficient search. B2 itself
   acknowledges a routing weakness: fix the general mechanism rather than
   declaring this board too hard or changing its clock.
3. **Diagnose the remaining human comparisons.** Inspect Dennis's recorded
   route and bot failures on blind1-185, factory1-189 and factory3-176.
   Use what was actually observed at each move, not knowledge from the complete
   board afterward. Separate avoidable choices, forgotten observations and
   repeated failed plans from genuine unknown-information risk. Improve general
   planning, attention or memory as justified. The competence reference may be
   stronger than the historical personal-fit model; leave that released personal
   reference and the family bot unchanged.
4. **Freeze the candidate and check transfer.** Reuse all 24 exact human boards
   plus G9 and verified original 200/225 human comparisons. Add the independent
   builder sample B2 omitted: about 12-20 frozen boards including rejected/high-S
   candidates, unfamiliar layouts and combinations of clocks, keys/locks, ice,
   four-copy choices and face-down/peek-pair play. Declare seeds and reserved
   cases before tuning. Picture relabeling is not structural diversity. Keep
   some genuinely reserved cases after any failure has become development data.
5. **Make adoption concrete.** Run the frozen candidate through the existing
   meter with an explicit entry point, new behavior fingerprint and separate
   cache namespace. Show real selection classifications and disputed decisions
   across repeated settings. Include a proposed registration/pin patch and the
   remeasurement plan. Leave default pins unchanged for lead review; do not
   promote boards into an accepted library in this task.

Prefer a coherent improvement to how the bot plans over a growing collection
of penalties. Bounded deeper reasoning over known information is allowed.
If using several legitimate strategies, declare a small fixed portfolio before
evaluation and show every style's cost and outcomes. Do not select strategies
by board ID, take the best of endless per-board tuning variants, or secretly
replay actual attempts and present the selected winner as a first try.

## Evidence required for readiness

Keep the B2 criteria. The following make the remaining review decisions concrete;
they are experiment criteria, not new level-design policies:

- G9 remains at least 90% first-try wins pooled over declared repeated settings.
  Other exact boards Dennis won first try and called easy should each reach
  the declared 80% bar, including factory2-184. Show per-board and per-setting
  results, not just a suite average.
- Resolve qualified 223's reproducible loss of capability. Match or improve
  the old planner's paired competence across repeated settings within sampling
  uncertainty, and remove the unexplained excess of uncleared campaigns.
- For blind1-185, work toward S at most 6 and at least 95% campaigns clearing
  within the normal 20-attempt cap across repeated settings. This is a practical
  target grounded in Dennis's recorded six-try win, not a claim about his true
  expected tries. A large unexplained gap remains a readiness blocker.
- Any claimed unavoidable hidden-information exception needs actual decision
  observations and a defensible information argument. Do not relax a bar after
  seeing an inconvenient result, assume the human got lucky, or grant the bot
  unseen information. An unresolved exception requires explicit lead review
  and cannot silently pass the universal competence claim.
- Demonstrate transfer on the reserved human/builder cases, and investigate
  material regressions or extra uncleared campaigns. Repeat important disputed
  cases at settings 4711, 18427 and a fresh setting fixed before tuning, using
  normal 40-campaign ratings for promising versions. Small development probes
  come first; avoid repeatedly running the whole suite after every tweak.
- Only observed pictures/roles, public geometry and permitted memory/inference
  may affect decisions. No hidden-picture oracle, solution/human replay lookup,
  unknown-as-joker matching or hindsight selection of actual trial winners.
  Preserve real tray, inspection, peek, clock and actual-loss retry rules.
- Replace B2's non-discriminating defect assertions with a few causal checks.
  All four B2 tests also pass against known-defective B1; decision-exists
  assertions do not verify tray relief or unblocking bonuses. Show that the
  focused checks fail on the broken behavior and pass on the repair. Exercise
  information boundaries through the real observation path. More test volume
  is not the objective.
- Correct reporting and practical costs must be reproducible. Timing/censoring
  `valid` is not proof of competence. Keep per-move work bounded within the
  existing ceiling and report complete evaluation median/worst costs. Any
  performance shortcut must preserve information integrity and capability.

The skilled selection band remains 2.5-6; the documented explicit fallback to
2 is only for when really needed. Scores below the normal band are below it,
not automatically accepted. A stronger bot may correctly make some boards too
easy for that band. Do not preserve bot mistakes or weaken it to fill the band.
Family difficulty, the level-250 start and continued rise after 275 remain
unchanged. No easier/peak alternation.

## Execution and deliverables

Use a new B3 version/cache namespace for changed behavior. No behavioral cache
migrations or silently mixed old ratings. No further delegation/review agents.
One heavy job/worker at a time via `source/tools/builder/loop/heavy.js`, respecting
other jobs and locks, in resumable chunks of about 18 minutes.

No new routine playtesting demand on Dennis, game-level edits, main merge,
Firebase writes or release. Use the existing human records.

Deliver the working candidate, causal traces/explanations, frozen manifest and
complete paired outcomes, a builder decision table, full costs and a truthful
ready/not-ready recommendation. Push `wip/gemini-skilled-bot-b3`. After heavy
runs finish, copy the final report to
`C:\Users\den_k\Idea\OmasMahjong\gemini-tasks\results\skilled-bot-b3\REPORT.md`.
If unfinished, leave a resumable checkpoint with the specific remaining cause.
The lead reviews adoption; do not declare readiness while the agreed blockers
remain unresolved.
