# Task G6: find construction controls that balance puzzles

Prepared by Codex for Gemini, 2026-11-09, at Dennis's request.

Status: assignment prepared for handoff. This file does not establish that an
experiment is running. G5 is integrated; this is new construction research on
the corrected builder, not a request to resume the old G5 checkout.

## Goal

Improve the builder so an explicit plan produces puzzles at a requested
difficulty. Find out which visible, deliberate choices change family difficulty
gradually while keeping a useful skilled challenge and understandable mistakes.
Deliver reusable construction controls and evidence for their limits. A lucky
board or a batch of rerated clocks is not sufficient evidence of that ability.

The immediate problems are an easy/hard cliff and slow feedback after a wrong
choice. You may propose a different construction approach if the observations
support it; do not spend the task repeating the known misses below.

## Start and ownership

Read `AGENTS.md` and `source/analysis/builder/LEVEL-DESIGN-FACTS.md` first.
Start from the latest pushed `origin/wip/cc-builder-loop`, containing both
`891b5cf6` (proof correction and constructors) and `1a6dd719` (frozen evidence).
Do not use the old G5 copy of the proof engine.

Use a new worktree/folder `gemini-puzzle-balance` and isolated branch
`wip/gemini-puzzle-balance`. Do not reset, reuse or modify `gemini-g5`,
`gemini-visible-choice-builder`, the lead's checkout, or any other agent's
checkout. Pull/fetch before starting. Check for an existing G6 branch/folder
before creating one; preserve unrelated or unfinished work.

Own new experiment scripts and results under
`source/analysis/builder/g6-puzzle-balance/`, new opt-in construction helpers and
focused tests under `source/tools/builder/`. A small explicit dispatch or mode
integration is fine. Preserve the baseline builder's deterministic output.
Changes to a shared helper must have a causal regression and a clear reason;
do not restore the unsound matching shortcut to make proof searches faster.

No review agents or further delegation. One CPU-heavy job at a time on this PC,
one worker. Run heavy commands through `source/tools/builder/loop/heavy.js` in
resumable chunks of at most about 18 minutes, and respect its busy checks and
the lead's lock. Put live logs under your own `source/build/`; copy the final
report into the shared `gemini-tasks/results/puzzle-balance/` only when a chunk
has ended. Do not write heartbeat logs into the shared results root: `busy.js`
treats recently changed shared logs as evidence that another job is running.

## Read the evidence before designing the experiment

1. `source/analysis/builder/four-copy-correctness-v1/REPORT.md`,
   `counterexample.json`, `final-controls.json` and `evidence-audit.json`.
   The final static audit is important even though the short report emphasizes
   the skilled scores: all three checked reserve controls fail required A6.
2. `source/analysis/builder/choice-motifs-v1/REPORT.md`, especially the original
   U body, copy-context controls and clock-context comparisons.
3. `source/analysis/builder/dependency-choices-v1/REPORT.md`, especially the
   staged matching-relief comparisons, trace errors and B7 ceiling.
4. `source/tools/builder/SPEC.md`, the current constructors, `loop/policy.js`,
   `loop/yardstick.js`, `loop/gate_profile.js` and
   `source/analysis/builder/process-v1/PIPELINE-AND-ACCEPTANCE.md`.

Established observations, not hypotheses to rediscover:

- The engine used to mistake some winning four-copy choices for losses. It now
  branches over ambiguous matching copies, including matching clocks; strict
  finishing proofs are complete within a budget. Unknown is never a loss.
  The 250-test baseline passes; 136 historical frozen designs retain their
  recorded minima and choice outcomes after correction.
- Isolated row templates, clover reserves and 18 coupled matching-copy forks
  across six layouts are real logical choices but too easy for the skilled bot
  (the coupled forks rate S=1.00–1.02). Repetition and simple interleaving did
  not give useful skilled difficulty.
- The readable musical-note reserve construction rates S=1.30 with one passage
  and S=16.50 with two. Releasing one waiting picture before passage two gives
  S=1.13; covering that relief with one known pair gives 1.13 and with two gives
  1.05. An earlier S=18.50 version hid a reserve picture and is invalid fairness
  evidence. These results do not establish a smooth difficulty dial.
- Final calibrated static checks on one passage, two passages and two-pair
  relief all fail A6: the loss after a wrong matching copy appears only after
  more than six further removals. The initial pair fork also lacks an obvious
  goal-directed alternative under the current check. The other required static
  gates pass without unresolved proofs. Diagnose the actual states; do not
  weaken or relabel A6 to make the construction pass.
- Context matters: on one U geometry there are useful normal-skilled bodies
  around S=2.7–3.8. Fixed clock/prelude/detour controls reached D=8.35/S=3.75,
  still below the opening family band. A different staged-relief proposal
  measured D=13.2/S=3.1 and passed B1–B6, C1 and C2, but repeated known errors
  made B7 cap its usable target at 10. More repeated errors are not successful
  construction of a target-13 puzzle.

## Experiment, in order

### 1. Explain the cliff and the delayed feedback

Reproduce a small fixed set of the existing readable easy/hard/relief controls
with the current code. Reuse valid caches; do not claim warm-cache timings as
fresh simulation cost. Inspect full traces and real proof states, not just D/S.

At the first consequential choice record the waiting pictures, visible legal
alternatives, winning/losing/unknown proofs, which copies must be reserved, and
whether a different order bypasses the intended choice. Record how the error
becomes apparent using the current A6 semantics. Track later repetition of the
same already-known error separately from new choices and losses. Explain what
the skilled bot avoids on the easy board and fails to anticipate on the hard
board, with concrete move IDs and pictures mapped to their roles.

State two or three testable construction hypotheses before the new sweep.
Useful axes include the number of unavoidable choices, how choices share a
reserved tray place, when a matching relief becomes available, and how close
the visible consequence is to the commitment. Separate the number of choices
from their depth and from harmless padding. Keep geometry/clock/picture context
fixed in a paired comparison whenever that isolates the intended cause.
Changing only the number of passages or relief-cover pairs repeats a known miss.

### 2. Fixed discovery comparisons

Implement up to three small construction families, each with explicit controls
and strict winning witnesses. Do not silently try new seeds or another recipe
until the requested one passes. Freeze the full schedule, hypotheses, controls,
code fingerprints, budgets and seed calls before rating it. Aim for 24–48
new physical boards total in discovery, including zero-strength/easier controls.
This is a bound on the pilot, not a quota to fill with clones or failures.

Measure **both D and S** on the declared valid discovery boards, including
off-band controls, so the response can be explained. A board outside the
skilled band remains diagnostic and does not count as supply. Do not compute
only whichever metric makes a variant look useful. Use the pinned family
ruler and planner settings, production pooling and `allResults:true` where
campaign evidence is needed. Record the actual chosen spare; never borrow the
skilled score at spare 2 for another clock setting. Hold spare fixed for the
main causal comparisons, then examine spares 1–3 on promising controls.

Run calibrated static checks and retain raw A5/A7 report-only findings. Classify
each board as build failure, unresolved proof, quality failure, off-band
diagnostic or possible survivor. Full 80-campaign trace/C1/C2 checks belong on
the fixed promising survivors, not every plainly failed control. Check B7 and
actual repeated-error behavior before claiming family difficulty as useful.
Do not count a good D/S point as a qualified board.

Produce a small response table/plot for each control: D, S, censoring/uncleared
campaigns, actual spare, proof/quality failures and CPU cost. Report paired
effects and uncertainty; do not impose a monotone fit on non-monotone data.

### 3. Freeze a plan, then test transfer

If discovery supports a useful control, freeze the constructor and a simple
rule that chooses its parameters from a requested difficulty. Select at most
two families. Reserve genuinely different, previously unused geometries for
validation; picture renaming or another seed on the same matching graph is not
geometric generalization. Keep variants of one body on the same side of the
discovery/validation split.

Test requested family targets 10 and 13, normal skilled 2.5–6, on up to three
held-out geometries per selected family: at most 12 new validation proposals.
Freeze target, recipe, geometry, spare, parameters and diagnostic seed calls
before measuring each proposal. Choose a setting from the discovery rule,
not from a curve you have already measured on that validation board. Preserve
the misses without retuning the held-out set. Target 16 is optional only after
the lower targets work and the current measurement limits permit it.

Use a preregistered independent non-ACCEPT diagnostic seed set as a validation
check, recorded explicitly and disjoint from development and reserved ACCEPT
calls. Do not invent an acceptance receipt from these diagnostic ratings.
Evaluate target error (±1), normal skilled band, quality, and observed versus
predicted effects. Three geometries are a small transfer test, not proof that
the builder can handle every future difficulty or shape.

If no family shows a useful intermediate response or all survivors fail the
fixed quality checks, stop after the bounded pilot. Explain the failed
mechanism, show the complete schedule and recommend one next construction
change. Do not start another 500-build sweep or keep searching seeds until
one point looks good. A well-supported negative result completes the research.

## Fixed decisions and boundaries

- New levels start at 250. Use `loop/policy.js`: family 10 at 250, 12 at 274,
  13 at 275, then approximately +3 per 25 levels. No alternating easy levels
  and peaks, big-slot peak exception or plateau. The 20-try cap is a measurement
  limit; report censoring and do not claim control of targets beyond support.
- Normal skilled band stays 2.5–6 per board and selected clock setting. Dennis
  permits an explicit minimum-2 fallback when really needed, but G6's primary
  experiment is normal-band balance. Label below-2.5 observations as diagnostic;
  do not lower the screen to make the hypothesis succeed. No averaging or
  hidden margin. Do not reuse the historical fallback receipt as new supply.
- Final target tolerance remains ±1 per level on primary and independent
  ratings, and ±0.5 for every five-level window. G6 is research, not authority
  to assign a batch or publish levels. Leave ACCEPT seeds and receipts untouched;
  qualified survivors go to the lead for the existing acceptance workflow.
- At least 72 tiles; 96-tile proposals only every tenth level. Tiles at least
  52 px on the standard viewport. Recognizable original shapes, no blobs or
  blocks. Show representative layouts so geometric/readability claims can be
  inspected; a shape name alone is not visual verification.
- Clock, keys and locks visible at the start. Relevant matching pictures must
  be observable before the decision. No hidden main challenge, luck-only loss,
  or long free cruise with the sole puzzle at the end. Every special matters.
  Preserve the real tray, free inspection and peek-pair rules.
- Keep bots, fingerprints, ruler pins, policy, thresholds and gate semantics
  unchanged. Do not edit `source/www`, level tables, published root assets,
  Firebase or main. No release, deployment, merge to main or routine request
  for Dennis to playtest.

## Deliverables

Commit and push the isolated branch. Deliver:

1. A concise report: what controls balance D/S, which do not, what causes the
   cliff/delayed feedback, transfer results and the remaining limits. Distinguish
   diagnostic points, qualified candidates and accepted levels; G6 runs no
   acceptance. Include failed designs and unknowns in all denominators.
2. Explicit opt-in constructor controls and design cards explaining the choice,
   why it matters, the visible alternative and the demonstrated consequence.
   Unsupported plans fail rather than silently substitute another request.
3. Reproducible commands, frozen schedules, exact designs/content hashes, all
   ratings/proof/quality outputs, source and pin/profile fingerprints, and
   per-stage wall/CPU accounting. Preserve raw ledgers and historical results.
   If a helper changes mid-study, snapshot its exact bytes and start a new
   experiment identity; do not mix source versions in one response curve.
4. Focused causal tests for the controls, deterministic builds, no mutation,
   readable choices, strict witnesses and clock minima. Any new proof shortcut
   needs independent exhaustive small-state checks, including four-copy escapes.
   Run the complete builder/loop/research suites under `heavy.js`; the starting
   baseline is 250 passing tests. Report meaningful failures instead of
   excluding tests or changing the ruler.
5. Final report copy at the shared
   `C:\Users\den_k\Idea\OmasMahjong\gemini-tasks\results\puzzle-balance\REPORT.md`,
   plus a short completion message with the branch, commit, commands and next
   recommendation. Leave the lead's checkout and acceptance ledgers untouched.

The goal is a better builder that can follow a plan. Do not claim that goal
solved unless the fixed transfer experiment supports it.
