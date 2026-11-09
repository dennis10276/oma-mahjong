# Task B2: make the skilled benchmark ready for builder decisions

Prepared for Gemini, 2026-11-09, at Dennis's request after the B1 review.

## Objective and finish line

Deliver a skilled bot whose competence and measurements justify using it to
judge builder puzzles. Dennis's requirement remains: **the bot should not be
worse than his demonstrated play.** A builder must not discard a good puzzle
because its benchmark cannot see a plan Dennis sees. Keep the family difficulty
measure separate and unchanged.

B1 made a real improvement on G9 but did not finish this objective. B2 must
resolve the remaining causes, demonstrate generalization, and end with an
evidence-backed **ready / not ready** adoption recommendation. A better average
alone is insufficient. Treat this as a practical competence experiment. Focus
on decisions and working improvements; avoid a large testing project.

## Workspace

Use the prepared separate worktree
`C:\Users\den_k\Idea\OmasMahjong\gemini-skilled-bot-b2`, branch
`wip/gemini-skilled-bot-b2`. It starts with B1 commit `dad2fe45` plus this
assignment and the lead's review. Preserve subsequent work before starting.
Do not edit the lead's checkout or the B1/G9 checkouts.

Read `AGENTS.md`, `source/analysis/builder/LEVEL-DESIGN-FACTS.md`, B1's task and
report, and especially `source/analysis/skilled-bot-b1/REVIEW.md` with its
`review/` evidence. The review takes precedence over unsupported conclusions
in the B1 report. Own candidate modules, diagnostics and results under
`source/analysis/skilled-bot-b2/`. Preserve B1 as a reproducible comparison.

Use a new explicit bot version and source fingerprint for changed behavior.
Keep candidate caches separate from B1 and the current pinned planner. No
behavior-changing cache migration, silently reused ratings, or global pin
replacement. B1 has not been adopted into the builder.

## Verified starting points

The lead independently checked four exact boards with seed 18427, 20 runs per
block, two blocks, 20 attempts maximum. Counts pool the selected style's 40
campaigns:

| Board | Human result | Old planner S | B1 S | B1 first wins |
| --- | --- | ---: | ---: | ---: |
| Exact G9 | 1 completed winning try, easy | 10.15 | 1.05 | 38/40 |
| factory2-184, 34 face-down tiles | 1 try, easy | 3.80 | 4.03 | 2/40 |
| Qualified 201 | No attached human result | 5.92 | 6.30 | 0/40 |
| Qualified 223 | No attached human result | 5.42 | 3.45 | 0/40 |

On B1's original seed, factory2-184 worsened from S3.90 to S4.63. Qualified 223
instead worsened from 4.45 to 6.15 on that seed: its reversal above means the
earlier report did not establish that its clock needed tuning. Do not repair
boards to accommodate an unexamined bot weakness or a noisy estimate.

Two implementation defects are already reproduced:

1. `candidate_controller.js:418-452`: the claimed target-specific tray relief
   drops `targetFace` in recursion and ignores it in the base case. The exact
   function can return true when no tile matches the target orphan, because a
   different pair becomes available. Correct the search's tray transitions and
   target semantics throughout; merely forwarding an argument may be incomplete.
2. `candidate_controller.js:1314`: the unblocking heuristic tests word `nw0`
   regardless of the tile index. Tiles 32-127 need their own word. A live tile
   69 can lose its unblocking bonus according to unrelated tile 5's status.

B1 measured only 10 of 24 saved exact human boards. Its aggregate report also
mixes pooled S with first-block win/uncleared statistics and omits individual
campaign outcomes. The lead's review details these measurement limitations.

## Work in order

### 1. Repair demonstrated defects and establish honest measurements

Fix the two defects in the B2 candidate. Add small causal checks for the
demonstrated cases, including all four tile-index words and target relief at
recursion/base-case boundaries. Check unknown pictures and face-down handling.
Use existing engine/replay checks. Do not rebuild physics or infrastructure.

Make report statistics refer to the same campaign population: first wins,
tries, losses, censoring, uncleared runs, validity and slowest moves across all
requested seed blocks. Retain per-seed and per-style campaign outcomes. Keep
computational censoring separate from actual completed losses. `valid` must
not be presented as proof of behavioral competence or of an unrun test suite.
Report actual effective profiles/options and their hashes, not just an unused
defaults object. Measure complete evaluation wall/CPU cost, including both
styles; retain style-specific costs too.

### 2. Diagnose the remaining human mismatches

Start with factory2-184. Compare Dennis's recorded observations and moves with
the candidate's first consequential mistakes, using the exact board/version.
Explain what was knowable at each decision. Separate tray/clock/branch planning
failures from forgetting, needless stochastic mistakes and genuine unknown
information. Include factory1-189 and other weaker cases as the evidence warrants.

Improve general competence, rather than tuning tile IDs, board hashes or labels.
Planning prerequisites together, choosing matching copies, reserving working
tray space, remembering observations and changing a failed plan are all in
scope. B2 may have stronger attention, memory and bounded planning than the old
personal-fit model. Explicitly document such changes: preserving Dennis's
occasional mistakes or old fitted MAE is not the objective. Keep the released
personal reference and family bots untouched.

Do not spend the task cycling through tiny weight tweaks with no causal
explanation. If a mechanism fails, improve the planning mechanism. Bounded
search over genuinely known information is allowed; hidden-information search
or replaying actual secret trials to select a first-try winner is forbidden.

### 3. Establish competence beyond the development cases

Before tuning further, save a board/seed manifest identifying development and
reserved cases. Use all 24 saved exact human boards, G9, and exact original
200/225 human comparisons where identity is verified. Respect censored records
as lower bounds, not wins. The 14 human boards not measured by B1 are useful
initial reserved cases; inspect their outcomes only after freezing a candidate.
If they become tuning cases, say so and reserve additional different structures.

Also freeze a small independent builder sample, including previously rejected
high-S boards and unfamiliar geometries/seeds. About 12-20 well-chosen boards
is sufficient initially. Cover clock/key dependencies, ice, four-copy choices,
competing branches and face-down/peek-pair play. Picture relabeling is not
structural diversity. Include qualified 201/223 to inspect real regressions and
seed sensitivity. Do not select only examples on which the candidate wins.

Use small development runs first, then normal 40-campaign paired ratings for
the frozen candidate. Compare the pinned old planner, B1 and B2 on important
cases; reuse verifiable unchanged baseline measurements where settings and
source fingerprints agree. For human mismatch cases, regressions and borderline
builder decisions, repeat at 4711, 18427 and a seed fixed before tuning.
Report the spread and avoid treating a noisy mean as a precise threshold.

### 4. Assess the actual builder decision

For the frozen builder sample, show old/B1/B2 scores, uncertainty and resulting
selection classifications using the existing skilled band. Explain remaining
failures before calling a board genuinely too difficult. A high score that
comes from an identifiable policy defect remains a bot defect.

Demonstrate the explicit candidate entry point through the existing meter with
a separate fingerprint/cache namespace, including cache invalidation on a
behavior change. Provide a concrete proposed adoption/pin change and list the
old ratings requiring remeasurement. Keep default pins unchanged for lead
review. Do not silently promote boards into an accepted library.

## Adoption criteria

Use these as declared B2 criteria, not new level-design policies:

- **Information integrity:** observed/public information only; correct tray,
  inspections, peek pairs, clocks, and actual-loss retry semantics. Add a small
  observation-equivalence check: changing unseen picture assignments while
  holding public observations and RNG state fixed must not change the decision.
  No saved human/winning route, unknown-as-joker shortcut or board-ID policy.
- **Demonstrated easy-board competence:** preserve G9's consistent first-try
  performance (at least 90% pooled over the declared repeated settings). Aim
  for at least 80% pooled first-try wins on each other exact board Dennis won
  first try and called easy, with per-seed results visible. These are practical
  evidence bars, not estimates of Dennis's true win probability from one play.
  A persistent mismatch such as factory2-184's 2/40 is not an adoption pass.
- **Explain unavoidable uncertainty:** if genuinely unseen information makes
  an easy-board bar unattainable, show the observation-level reason rather
  than granting hidden knowledge or moving the bar after seeing results.
  Mark that limitation explicitly for lead review. An unresolved exception
  cannot be hidden inside a claim that the bot is universally trustworthy.
- **Generalization and regressions:** demonstrate gains on reserved human and
  builder structures. Investigate any material loss of capability or increase
  in uncleared campaigns. A better aggregate cannot excuse a reproducible new
  blind spot. Small sampling differences must not trigger endless tuning.
- **Useful, repeatable measurements:** pooled and per-block outcomes, explicit
  censoring, versions/hashes and full evaluation costs are reproducible. A
  single seed setting must not determine a disputed rejection. Keep within
  the existing per-decision time ceiling and report median/worst full-board
  costs against B1; resolve excessive costs with bounded work, not deliberate
  decision mistakes.
- **Honest adoption status:** ready means the declared criteria are supported
  and material remaining blind spots are resolved. Otherwise report not ready
  with the specific cause and a runnable checkpoint. Do not call delivery of
  code or passing checks alone completion of the competence objective.

The existing new-level band remains S2.5-6, with the already documented explicit
fallback to 2 only when really needed. A stronger bot may correctly rate G9
near one and classify it below this band. Do not weaken the bot to preserve
the band. Family targets start at level 250 and continue at approximately the
same rise after 275; no easier/peak alternation is introduced by B2.

## Execution and handoff

No further delegation or review agents. Run one heavy job/worker at a time via
`source/tools/builder/loop/heavy.js`, respecting other work and locks. Keep runs
resumable in chunks of about 18 minutes. No routine new playtesting demand on
Dennis: use his existing records. No game-level edits, main merge, Firebase
writes or release.

Deliver a working B2 candidate, causal explanations of the fixes and remaining
human comparisons, frozen benchmark manifest and complete outcomes, builder
impact table, CPU costs, and a ready/not-ready adoption recommendation. Leave
the next action concrete if unfinished. Push `wip/gemini-skilled-bot-b2` and
copy the final report, after heavy runs finish, to
`C:\Users\den_k\Idea\OmasMahjong\gemini-tasks\results\skilled-bot-b2\REPORT.md`.

Do the practical work needed for adoption, rather than ending with another
general list of possible bottlenecks. The lead reviews the evidence and
proposed pin update before adopting the new ruler.
