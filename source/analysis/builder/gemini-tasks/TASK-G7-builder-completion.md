# Task G7: find and fix the bottlenecks to completing the builder

Prepared for Gemini by Codex, 2026-11-09, at Dennis's request:
"Make a g7 task to let gemini look for bottlenecks to complete the builder like
you are now."

Assignment prepared for handoff; this document does not mean a run has started.

## Objective and autonomy

Work toward a robust builder that makes deliberate, readable puzzles at a
requested difficulty and can follow Dennis's rising level plan. Find the most
important current bottleneck, fix it, verify the improvement, then work on the
next bottleneck. Choose the approach from evidence. This is broader than another
fixed experiment: do not end the entire task after the first negative pilot or
recommend a new numbered task for every next step.

Improve the actual builder and its ability to follow a plan. Measurement tools
are useful when they resolve a concrete uncertainty; a new report, a decorative
control, a lucky board or another clock sweep does not complete the objective.
Keep an honest list of what is working and what remains unproved. If a genuine
external blocker or session limit stops progress, deliver a reproducible
checkpoint and state that the builder is unfinished.

## Starting point

Read `AGENTS.md`, `source/analysis/builder/LEVEL-DESIGN-FACTS.md`,
`source/tools/builder/SPEC.md`, and the current `loop/policy.js` first.

Fetch the latest pushed `origin/wip/cc-builder-loop`, including the lead's G6
review at `source/analysis/builder/g6-puzzle-balance/LEAD-REVIEW.md`. Use a new
worktree `gemini-builder-completion`, branch `wip/gemini-builder-completion`.
Check for existing work before creating either; preserve unfinished work.
Do not work in or modify the lead's checkout, the G6 checkout, or an old G5
checkout. Commit and push your isolated branch for integration; no merge to main.

Read the G6 lead review **before** relying on the original G6 report. Its raw
data and original source are retained as historical evidence, not installed as
a qualified construction mode. In particular:

- `chokeDelay` changed card metadata, not board content. It did not experiment
  with consequence timing. Tests that only check successful builds missed it.
- Picture-label permutations and duplicate recipes are not independent matching
  structures. Count structural diversity as well as calls and content hashes.
- The original report contradicts its raw diagnostic values and fork counts.
  Some historical comparisons also mixed family and skilled clock settings.
- A6's zero tempting lose-forks before the clock does not prove there are no
  losing choices anywhere. A passing static gate does not establish difficulty.
- A recommendation for a decoy/relief mechanism is a hypothesis. No experiment
  has established that it creates a gradual difficulty dial or passes B7.

Also read `four-copy-correctness-v1/REPORT.md`, `choice-motifs-v1/REPORT.md`,
`dependency-choices-v1/REPORT.md`, and
`process-v1/PIPELINE-AND-ACCEPTANCE.md` under `source/analysis/builder/`.
The corrected engine branches over ambiguous four-copy matches, including
matching clocks. Unknown proofs must remain unknown. Preserve that correction.

## Working loop

1. **Choose the bottleneck.** Inspect the actual code, failed designs, proof
   states and traces. Maintain `BOTTLENECKS.md` with each problem, supporting
   evidence, expected impact, next action and status. Distinguish a missing
   construction mechanism from a proof-budget issue, a measurement limitation,
   or a misleading report. Prioritize what most directly improves puzzle supply
   and the ability to follow a difficulty plan.
2. **Make one causal change.** Prefer an explicit constructor control or a
   demonstrable correctness/performance fix. Before an expensive sweep, prove
   that the proposed control changes the relevant physical board or decision.
   Trace the intended temptation, the visible winning alternative, and its
   consequence under the real rules. Require an actual strict winning witness.
   A changed parameter, card, picture name or witness order alone is insufficient.
3. **Test a small fixed comparison.** Start with a handful of structural probes;
   freeze hypotheses, exact designs/recipes, seed calls, budgets and source
   identity before rating. Measure both family D and skilled S at the **same
   actual clock setting**, including off-band controls where useful. Keep all
   misses and unknowns. Do not tune thresholds, repeat refused seeds or grow an
   unguided 500-build search to conceal a failed mechanism.
4. **Integrate the useful part.** Add truthful cards, explicit unsupported-plan
   failures, focused causal regressions, and normal builder/pipeline access
   when appropriate. Bind new construction/proof helpers into rejection,
   acceptance and resume identities. Preserve deterministic baseline behavior
   unless there is a demonstrated bug. Then identify the next bottleneck.
5. **Test transfer and plans.** When a control is useful, freeze its mapping
   from requested difficulty to parameters. Choose parameters on new geometries
   before seeing their ratings; do not count retuned validation boards as
   held-out successes. Keep variants of one body on the same side of the split.
   Start with targets 10 and 13, normal skilled band, and at least three genuinely
   different unused geometries. Expand toward target 16 and a provisional
   250–259 plan when the lower targets have support. Preserve holes and misses.

Current promising questions include necessary choices versus avoidable traps,
shared versus separate tray commitments, and prompt consequences without
repeated-known-error inflation. These are options, not a prescribed solution.
Known misses include isolated row/clover copies, simple interleaving and adding
known pair covers to reserve relief. Do not assume that more of those works.

## Evidence required for progress and completion

Keep separate counts for attempts, distinct physical boards, distinct matching
structures, build failures, unresolved proofs, quality failures, off-band
diagnostics, qualified candidates, provisional slot matches and final accepted
results. There is no requirement to manufacture a success count.

For construction improvements, show a repeatable change in actual choices and
useful D/S response, with both ratings valid. Show readable geometry and pictures,
real clock minima and strict witnesses. Use the existing calibrated `e5-v1`
profile and retain raw A5/A7 report-only results. Fixed survivors must undergo
the existing 80-campaign trace, C1/C2 and B7 checks at the chosen setting.
Repeatedly making the same learned mistake is not stronger puzzle construction.

For a claim that the builder follows a plan, supply frozen predictions and
independent measurements on unused geometries, target errors, quality outcomes
and failure coverage. A ten-level plan must respect every five-level window and
boundary context, retain holes and use the existing assignment/acceptance tools.
Do not replace a missing supply problem with a new acceptance implementation.

Fresh ACCEPT work is only appropriate after selection is frozen and all earlier
checks pass. Use the existing reservation/checkpoint protocol, preserve already
consumed reservations, keep an isolated ledger, and hand over all used ranges.
Never retry a fixed refusal on new seeds, reuse a historical receipt as new
supply, or present an individually accepted row as a complete batch. No accepted
research output changes the game's levels automatically.

Run the full builder, loop **and `loop/research`** suites under `heavy.js`, plus
focused new checks. Use independent exhaustive small-state verification for new
proof shortcuts, including four-copy escapes. Tests must check the advertised
behavior, not merely the presence of a metadata field. Preserve raw evidence
and source snapshots when changing a helper mid-study. Record cache use,
per-stage CPU/wall cost and measurement uncertainty; CPU per finished level is
unmeasured when zero levels qualify.

## Dennis's fixed decisions

- New work starts at 250. Family about 10 at 250, 12 at 274, 13 at 275, then
  about +3 per 25 levels (16 at 300, 19 at 325). No alternating easy levels and
  peaks, big-slot peak exception, or silently flattened curve. The capped ruler
  limits what can be claimed at higher targets; report that limit explicitly.
- Skilled 2.5–6 per board and selected clock setting. Minimum 2 is an explicit,
  individually recorded fallback if really needed, not the default search band.
  No skilled averaging, hidden margins or silent fallback. Family tolerance is
  ±1 per level on primary and independent ratings and ±0.5 per five-level window.
- At least 72 tiles, recognizable original shapes, no blobs/blocks, tiles at
  least 52 px. 96-tile boards only every tenth level. Visually inspect example
  layouts; a card's shape label does not verify recognizability.
- Clock, keys and locks visible at the start; necessary matching information
  observable before the decision. No hidden main challenge, luck-only losses,
  or a long free cruise with the sole puzzle at the end. Every special matters.
  Preserve free inspections, peek pairs and the actual tray rules.
- Keep game files, level tables, root published assets, Firebase and main
  untouched. No release or deployment. Keep bots, ruler pins, policy, thresholds
  and gate semantics fixed in this task. If one is a genuine blocker, document
  a minimal reproducer and validation needed rather than quietly changing it.
  Do not require Dennis to routinely playtest.

## Ownership, execution and handoff

Own new opt-in builder code/tests and research under
`source/analysis/builder/g7-builder-completion/`. Make small useful commits, keep
`BOTTLENECKS.md` and `REPORT.md` current, and give concise progress updates when
the bottleneck changes or a useful improvement is verified. No review agents or
further delegation. One heavy job/worker at a time on Dennis's PC, through
`source/tools/builder/loop/heavy.js`, in resumable chunks of about 18 minutes.
Respect its busy/lock checks. Keep live logs in your own `source/build/`.

Push your isolated branch with exact reproduction commands, complete raw
ledgers/designs, source/pin/profile identities, tests, and the remaining work.
Copy the final report to
`C:\Users\den_k\Idea\OmasMahjong\gemini-tasks\results\builder-completion\REPORT.md`
after heavy runs have ended. Do not write heartbeat logs to the shared results
root. Report the branch and commit to Dennis, and clearly say whether the
builder objective is achieved, partially improved or still blocked by an
identified mechanism. Do not claim it complete because a pilot or session ended.
