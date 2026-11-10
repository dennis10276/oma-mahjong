# B2 adoption review, 2026-11-10

**Verdict: substantial improvement, but not ready to be the builder's sole
rejection judge.** Gemini's READY recommendation is stronger than its evidence.
Reviewed commit `07f36261`; no candidate adoption, code change, or pin update.

## Independently confirmed progress and limits

Ran the delivered B2 candidate through the lead's heavy-job lock on a new seed
99173, two blocks of 20 campaigns, maximum 20 attempts. These are four targeted
checks, not a replacement for the delivered benchmark. Counts pool the selected
style's 40 campaigns. Full per-block/style outcomes, runner and reviewed-source
hashes are in `review/`.

| Board | B2 S | First-try wins | Uncleared |
| --- | ---: | ---: | ---: |
| Exact G9 human comparison | 1.07 | 37/40 | 0/40 |
| factory2-184 | 1.05 | 38/40 | 0/40 |
| factory1-189 | 1.68 | 24/40 | 0/40 |
| Qualified 223 | 7.72 | 0/40 | 7/40 |

The G9 and factory2-184 improvements are real. Inspection confirms that B2 fixes
the two identified implementation defects: the search carries its initial-tray
matching criterion and simulates intermediate pair removal, and the unblocking
heuristic selects the appropriate word for tile indices above 31. The latter
fix is independent of picture information. The inspected policy delta does not
introduce a hidden-picture oracle; this is not a certification of every inherited
code path.

## Why the adoption criteria are not met

- The report claims all easy human boards reach the 80% first-win bar. Its own
  saved outcomes contradict this: factory1-189 has **57/120 (47.5%)**, and
  factory3-176 **50/80 (62.5%)**. Dennis won both first try and called them easy.
  The fresh factory1-189 result remains below the bar. One human win does not
  establish his true probability, but it also does not justify the report's
  claim that favorable revelation explains the difference. No observation-level
  demonstration establishes an unavoidable information limitation. The report
  also misdescribes factory1-189 as 76 tiles/36 face down; the exact tested board
  has 72 tiles/29 face down.
- Qualified 223 genuinely regresses: old planner S4.45/5.42/5.80, B1
  S6.15/3.45/4.70, B2 **S7.70/9.63/8.88** on settings 4711/18427/23456.
  B2 leaves 30/120 campaigns uncleared. The fresh S7.72 check reinforces the
  concern. A more capable earlier policy on the same board is evidence to
  investigate before deciding the puzzle itself should be discarded. The report
  acknowledges the routing weakness but still marks readiness.
- The wider human competence requirement remains unresolved on blind1-185:
  Dennis has a recorded win in six tries, while B2 clears only **17/80** campaigns
  within 20 attempts and scores S17.52. This is not proof of a deterministic
  bot defect by itself, but it prevents a broad claim of demonstrated competence
  at least equal to Dennis without further decision-level explanation.
- The builder sample is still the same 18 already-qualified boards, rather
  than the requested independent sample including rejected/high-S candidates.
  The 14 additional human boards are useful broader evidence. They do not
  establish generalization to unfamiliar builder output on their own.

## Measurement and verification problems

B2's own measurement module improves pooling, retains per-style block outcomes,
and reports effective profiles and both-style timing. However, its benchmark
runner divides baseline/B1 first-block counts by the full two-block population.
It thereby approximately halves their reported first-win rates and uncleared
counts while comparing them with genuinely pooled B2 statistics.

Recomputed from the saved individual campaign outcomes, across the same 3,720
selected-style campaigns per bot:

| Bot | First wins | First-win rate | Uncleared |
| --- | ---: | ---: | ---: |
| Old planner | 1,103 | 29.7% | 200 |
| B1 | 1,347 | 36.2% | 182 |
| B2 | 1,503 | 40.4% | 192 |

This supports a real first-try gain, considerably smaller than the misleading
baseline percentages imply. It does not show a reduction of uncleared campaigns
against B1. Scores and first-try rates alone must not conceal those failures.
G9's saved B2 count is 110/120, not the report's 111/120; this small error does
not change its successful G9 result.

The four delivered causal tests pass on B2, **and all four also pass when their
controller import is redirected to the known-defective B1 controller**. Tests
1 and 3 assert only that a decision exists, rather than verifying the relief
result or word-dependent bonus. Their PASS messages do not establish the claimed
behavioral properties. Use small discriminating checks, not more test volume.

The report also labels below-band cases accepted (e.g. S1.76 and S2.46), although
the normal band is 2.5-6. Its readiness conclusion cannot rely on that table as
an actual builder acceptance result. A correctly easy score is useful evidence
and may legitimately put a board below the selection band.

## Next useful work

Keep the real G9/factory2-184 gains. Diagnose qualified 223's first consequential
decision errors against the stronger earlier policy and inspect the remaining
human mismatches, including the hard key/lock case. Repair the benchmark's
baseline pooling, replace the non-discriminating defect assertions, and evaluate
a small genuinely independent builder sample. Explain any unavoidable unknown-
information limits from actual observations rather than attributing human wins
to luck. Do not weaken the bot, alter the band, or retune boards to hide policy
defects. The current pinned planner is also known to have weaknesses; retaining
its pin does not certify it. Adoption remains pending evidence, not more paperwork.
