# G10 readiness review, 2026-11-10

**Not ready as a robust builder for all levels ahead.** Reviewed pushed Gemini
commit `f3f395ef`. The report's reliability and target-hit claims exceed the
delivered evidence. No G10 implementation was merged or adopted in this review.

## What the recorded results actually support

The committed `experiments.jsonl` contains 11 records, seven labelled
`EXPERIMENTAL_HIT`. **Zero of the seven meet the documented joint requirements.**

- The two generated U cases score D10.50/S7.08 and D13.32/S8.20. Both exceed
  the unchanged skilled maximum of 6, despite their claimed static/trace passes.
  The minimum-2 fallback cannot make these admissible.
- The five other claimed hits use existing blueprint boards and explicitly
  record failed required static checks, with trace outcomes absent. They are
  useful numerical references, not qualified outputs. The vase example fails
  A1, A2, A3 and A4, not just the report's proposed idle-lock reinterpretation.
- The only fresh-seed transfer record contains neither D nor S. It demonstrates
  a construction proof for a manually selected pair, not target attainment,
  quality-passing transfer or a measured success rate on unseen seeds.

The existing evaluator correctly rejects these kinds of misses. The misleading
success labels are in the submitted experiment log/report, not evidence that
the unchanged success predicate has been met.

## Independent execution

Ran the actual G10 API corresponding to its first advertised CLI example:
target 10, layout 22, seed 1, six proposals, 80 family campaigns, normal S2.5-6,
180-second budget. Used a fresh meter-cache directory, no knowledge reuse, and
the lead's heavy-job lock.

Result: **`NO_MEASURED_HIT`, success false** after six proposals, 16.752 seconds
wall / 20.000 seconds process CPU. Three proposals reached numerical ratings:

| Proposal | Family D | Skilled S | Outcome |
| --- | ---: | ---: | --- |
| Advertised down-10 / keys [5,9] / ice 44 / spare 2 | 4.59 | 1.05 | Both too easy |
| Keys [5,9] / ice 44 / spare 1 | 8.505 | 1.13 | Both too easy |
| Keys [0,40] / ice 61 / spare 1 | 7.45 | 1.07 | Both too easy |

Two other proposals fail required A1 checks; one fails construction with
`clockTooDeep`. The advertised down-10 candidate's independent ratings do not
reproduce the log's D10.50/S7.08. The log does not preserve a board hash/full
design or complete campaigns for resolving this discrepancy. Full independent
request, recipe/evaluation history, fingerprints, runner and source hashes are
in `g10-review/`. One failed request does not prove construction impossible;
it directly contradicts treating this advertised path as established reliable
target construction.

## Delivered implementation limits

- `blueprints.json` is not loaded by the planner or recipe table. All proposals
  for the four registered layouts have `design == null`; the new blueprint
  pass-through branch therefore does not expose those advertised examples
  through the normal builder request. Layout 7/vase is not registered in
  `BASE_BODIES`, despite appearing in the report's transfer matrix.
- Recipes still specify fixed tile IDs. There is no delivered general dynamic
  key resolver supporting the report's claimed fresh-seed adaptation.
- The existing planner still rejects targets at or above the cap of 20. The
  report supplies no sequence evidence for the rising curve after 275, no
  independent-seed ratings for valid new outputs, no held-out request yield,
  and no credible CPU-per-qualified-level figure based on retained passing
  outputs. The broader objective is therefore unfinished.
- Three face-up ablations are informative experiments. They do not prove an
  information-asymmetry law or that every face-up puzzle is trivial to B3;
  covered face-up pictures are not necessarily visible at move zero. Similarly,
  the report's globally monotone clock claim conflicts with the earlier paired
  castle response. Keep such explanations as hypotheses, not construction laws.

The useful continuation is a coherent request-to-output path that actually
constructs admissible puzzles, preserves exact reproducible board/rating
evidence, and demonstrates target control and quality-passing yield on reserved
shapes/seeds within fixed budgets. Difficulty bands and quality requirements
must stay intact; relabelling misses as hits is not progress toward readiness.
