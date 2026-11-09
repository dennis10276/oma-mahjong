# Task G8: find and fix further builder bottlenecks

Prepared for Gemini by Codex, 2026-11-09, at Dennis's request.
Assignment prepared for handoff; no G8 run is implied by this file.

## Objective

Continue improving the actual builder until it can follow a deliberate
difficulty plan. Choose the next bottleneck from evidence, implement a causal
fix, verify it, and move to the next. You can change approach when an experiment
fails. Do not end the task after the first negative pilot, or mark the builder
complete because individual recipes pass static checks or skilled ratings.

The main open problem after the lead's G7 review is **joint difficulty control**:
we now have several useful normal-skilled bodies, but cannot yet reliably
construct family targets 10 and 13 with fair pacing and little repeated-error
inflation. These are starting observations, not a prescribed solution.

## Start from the integrated code and verified findings

Read `AGENTS.md`, `source/analysis/builder/LEVEL-DESIGN-FACTS.md`,
`source/tools/builder/SPEC.md`, and these files before designing a new study:

- `source/analysis/builder/g7-builder-completion/LEAD-REVIEW.md` and its
  `lead-audit/` raw results. They supersede the original G7 completion claims.
- `source/tools/builder/keyed_choice.js` and `test_keyed_choice.js`.
- `source/analysis/builder/g6-puzzle-balance/LEAD-REVIEW.md`.
- `source/analysis/builder/four-copy-correctness-v1/REPORT.md`,
  `choice-motifs-v1/REPORT.md`, and `dependency-choices-v1/REPORT.md`.
- `source/analysis/builder/process-v1/PIPELINE-AND-ACCEPTANCE.md`, the current
  `loop/policy.js`, pinned yardstick and calibrated gate profile.

Fetch the latest pushed `origin/wip/cc-builder-loop` containing the G7 lead
integration and this G8 task. Use a new worktree `gemini-builder-bottlenecks-g8`
and branch `wip/gemini-builder-bottlenecks-g8`. Preserve any existing work before
creating either. Do not modify the lead's checkout or reuse G7's worktree.

Verified G7 observations:

- Four distinct catalogue bodies have normal skilled scores: U 2.98, arch 3.95,
  castle 3.45 and hourglass 3.10. Their full family D is only 1.205–3.175 at
  spare 2. These are exploratory successes for skilled supply, not held-out
  difficulty-plan validation or qualified new levels.
- On the keyed U body at spare 1, ice tile 61 gives D7.450/S3.33, passes required
  80-campaign traces, and has B7=0.043. Ice tile 72 gives D10.950/S3.20 but
  fails B6 (post-clock losses 0.773), with B7=0.711 and maximum target 10.
  A better local placement does not establish a universal anti-repeat rule.
- The keyed arch at spare 2 gives D4.640/S5.83 and B7=0.054, but fails B5
  (late tray losses 0.127). Low B7 alone is not quality qualification.
- G7's original `target:10` and `target:13` return the same board/deadline,
  D6.140/S2.88. Its automatic search contains an implicit minimum-2 fallback,
  has no overall work/deadline bound, and the original test file exceeded a
  five-minute independent review limit. Do not resume that unbounded controller.
- Its false-relief helpers are not called by that controller and misuse the
  fair-fork API. Changing stored solution order is not changing physical choke
  distance. G6's delay setting was metadata-only. Neither is a tested dial.

The lead integrated only the useful explicit part as **`mode:'keyedChoice'`**:
declared layout/interleaving, key pair, cover lock and optional thaw prerequisite.
It rejects unsupported controls and implicit targets, does not grade inside
construction or silently search another key pair, and leaves qualification to
the normal pipeline. The archived original G7 constructor is research only.

## How to make progress

1. Maintain `BOTTLENECKS.md`: each problem, actual evidence, expected impact,
   next action, status and remaining uncertainty. Verify a claimed fix in code
   and results before changing its status to resolved. Distinguish construction
   limits from solver correctness, proof cost, bot measurement or report errors.
2. Inspect actual first-error states and alternatives on the fixed useful bodies.
   Separate new choices from repeated learned blunders. Trace why a family
   misses a choice that the skilled bot handles. Use the real visibility and
   rules, and compare alternatives at the same clock setting.
3. Implement one small causal change. It may improve an existing constructor,
   add an opt-in construction mechanism, remove a proof bottleneck, or make a
   target planner use explicit validated controls. Do not add a parameter whose
   only effect is a card label, picture renaming or witness reordering. Preserve
   exact geometry/picture/obstacle changes and unsupported-plan failures.
4. Prove behavior before expensive ratings: valid strict witness, proven clock
   minimum, visible winning alternative, real consequence of the temptation,
   no bypass that defeats the claimed requirement. A new proof shortcut needs
   independent exhaustive small-state checks, including four-copy escapes.
   Unknown remains unknown. A6's scan before the clock does not cover all choices.
5. Freeze a small paired schedule, hypotheses, seed calls, source identity and
   budgets before rating. Measure both D and S at the same actual deadline.
   Retain off-band controls, build failures and unresolved results. Start with
   a few structural probes; expand only when the causal effect is real. If it
   fails, record why and work on the next supported mechanism rather than
   making an unguided large sweep or stopping the entire task.
6. Integrate the useful part into the actual builder and pipeline, with truthful
   cards, causal tests, source-bound rejection/resume/checkpoint identities,
   deterministic behavior and explicit runtime/work limits. Constructors must
   not hide unlimited planner/quality searches. A caller's requested target,
   fallback permission, budget or control must be used or explicitly rejected.
7. When a response is useful, freeze a mapping from requested difficulty to
   construction parameters, choose parameters on unused geometries before
   measuring them, and validate without retuning the held-out set. Keep related
   variants on the same side of the split. Begin with family targets 10 and 13,
   normal skilled band, and three genuinely different unused geometries.
   Advance toward target 16 and a provisional 250–259 plan when evidence supports
   it. Catalogue discoveries and picture relabelings are not held-out transfer.

Necessary versus avoidable choices, how tray commitments interact, and earlier
readable consequences are possible avenues. They are hypotheses, not proven
solutions. Do not assume more copies, more known relief pairs, or an exposed
partner rule solves balance; those already have specific negative evidence.

## Qualification and evidence

Use the existing pinned bots and `e5-v1` profile, retaining A5/A7 report-only
measurements. Require valid D/S measurements. Use both production family calls
and `allResults:true` for full campaign evidence. Do not substitute a 40-campaign
trace D for the complete family ruler, borrow another spare's S, or compare
different clocks as though one parameter was isolated.

Fixed survivors need 80-campaign trace checks, C1/C2, B7 target eligibility and
the remaining existing quality checks at their selected spare. A static pass,
low B7 or a good D/S point alone is not qualification. Do not loosen thresholds
or change gate semantics to accept your construction.

Use independent, preregistered diagnostic seeds for plan validation. Fresh
ACCEPT work is appropriate only after selection is frozen and earlier checks
pass. Use the existing reservation/checkpoint protocol and an isolated ledger,
preserve consumed reservations, and hand over all used ranges. Never retry a
fixed refusal on new seeds or count an old receipt as new supply. Keep holes
and five-level/boundary-window failures visible. No research acceptance changes
the game's levels automatically.

Keep machine-readable records for every attempt: explicit brief/controls,
exact design and content hash, canonical matching-structure identity, source
and pin/profile hashes, selected clock, proof outcomes, full ratings and quality
outputs, and per-stage CPU/wall/cache accounting. Distinguish attempts, distinct
boards, matching structures, failures, unknowns, off-band observations, qualified
candidates, provisional slots and final accepted results. No qualified levels
means CPU per finished level is unmeasured.

Generate the report's summary tables and status counts from the retained raw
data, and check them for consistency before calling the task done. Do not claim
a mechanism was implemented unless its code path runs; do not claim a bottleneck
was solved from a recommendation or an unrelated passing metric.

Run the full builder, loop and **`loop/research`** suites plus focused new checks,
single-worker under `heavy.js`. Check the current integration's test receipt;
do not copy an old test count or silently exclude a slow/failing current test.
The current receipt is 263 passes with zero skips: 256 builder/loop/research
checks plus seven archived G6 checks. Historical G7's separately recorded review
timeout is not a passing test receipt.
Every new advertised control needs a test of its actual causal effect, and
expensive searches need meaningful work limits and honest failure tests.

## Fixed decisions and boundaries

- New levels begin at 250: family 10 at 250, 12 at 274, 13 at 275, then about
  +3 per 25 levels (16 at 300, 19 at 325). No easy/peak alternation, big-slot
  peak exception or flattened curve. Report ruler censoring/measurement limits
  rather than claiming unsupported future control.
- Skilled 2.5–6 per board and selected setting. Minimum 2 is an explicit,
  individually recorded fallback only if really needed; no hidden lowering,
  margins or averaging. Primary and independent family ratings must be within
  ±1 per level and every five-level window within ±0.5.
- At least 72 tiles, original recognizable shapes, no blobs/blocks, tiles at
  least 52 px. 96-tile boards only every tenth level. Visually inspect examples;
  a shape name is not a visual check.
- Clock, keys and locks visible at the start; necessary matching information
  observable before the decision. No hidden main challenge, luck-only losses,
  or long cruising with the sole puzzle at the end. Every special matters.
  Keep the real tray, free inspection and peek-pair rules.
- Keep bots, ruler pins, policy, thresholds, game files, level tables, published
  root assets, Firebase and main unchanged. No release/deployment and no routine
  request for Dennis to playtest. If a frozen component is a real blocker,
  produce a minimal reproducer and validation proposal rather than silently
  changing it.

## Execution and handoff

Own opt-in builder changes/tests and research under
`source/analysis/builder/g8-builder-bottlenecks/`. Make small useful commits and
continue across successive bottlenecks. No review agents or further delegation.
One CPU-heavy job/worker at a time on this PC through
`source/tools/builder/loop/heavy.js`, in resumable chunks of about 18 minutes.
Respect busy/lock checks. Keep live logs under your own `source/build/`.

Keep `BOTTLENECKS.md`, exact reproduction commands and `REPORT.md` current.
If a genuine external blocker or session limit stops work, checkpoint the
working increment, evidence, remaining bottleneck and exact next action; mark
the builder unfinished. Do not call it complete because a pilot/session ended.

Push the isolated branch and copy the final report, after heavy runs finish, to
`C:\Users\den_k\Idea\OmasMahjong\gemini-tasks\results\builder-bottlenecks-g8\REPORT.md`.
Do not write heartbeat logs to the shared results root. Report the branch,
commit, validation, actual improvements and remaining work to Dennis.
