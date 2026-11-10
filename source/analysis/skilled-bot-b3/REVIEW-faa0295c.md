# Updated B3 assessment: faa0295c, 2026-11-10

The user correctly identified a newer READY report. The previous review and
fresh measurements covered `7cf39383`, whose own verdict was NOT READY. They
do not describe the subsequent `faa0295c` behavior.

**Recommendation: proceed to controlled builder use.** The major human
competence blocker is genuinely repaired. Full qualification under every
declared B3 criterion remains incomplete; do not equate the READY label with
proof that the bot is always at least as capable as Dennis or should have
unreviewed authority over every disputed high-S rejection. No default pins or
candidate code were changed during this assessment.

## Independent check of the new code

Ran the new candidate through the lead's heavy-job lock at seed 424243, two
blocks of 20 campaigns, maximum 20 attempts. These are the same settings as
the previous fresh review on the hard board. Full per-style/block results,
runner and reviewed-source hashes are in `review-faa0295c/`.

| Exact board | New B3 S | First wins | Uncleared |
| --- | ---: | ---: | ---: |
| blind1-185 | 5.20 | 0/40 | 0/40 |
| Qualified 223 | 4.80 | 0/40 | 0/40 |
| factory1-189 | 1.73 | 23/40 | 0/40 |
| factory3-176 | 1.45 | 23/40 | 0/40 |

The hard-board change is substantial: blind1-185 previously scored S17.43 with
31/40 uncleared on these same settings. It now clears all 40, averaging fewer
tries than Dennis's recorded six-try win. The qualified-223 repair is preserved.

The inspected code delta strengthens learning after actual losses: it remembers
observed unresolved matching partners more broadly, avoids repeating an early
clock commitment that led to failure, permits failed-dig penalties when clock
slack permits, and prevents route bonuses from overriding a full tray's need
for a match. These are general rules using existing observations and loss
memory; the delta contains no board-ID or stored-solution policy.

## What READY still does not establish

The latest delivered benchmark retains factory1-189 at 60/120 first wins (50%)
and factory3-176 at 51/80 (63.75%), below the declared 80% easy-board criterion.
The independent fresh run also remains below it. They do clear consistently
and receive easy scores, so these remaining first-try gaps are different from
the former severe false-hard rejection. The original requirement that the bot
should not be worse than Dennis has not been demonstrated universally.

Known regressions also remain visible in the delivered results: qualified 204
has 10/80 uncleared (B2 had none), and factory6-184 worsens from S4.21 under B2
to S8.24 with five uncleared out of 80. The latter human record is non-winning.
These are appropriate cases to retain in builder decision review rather than
conceal inside the overall 98.93% campaign clear rate.

The latest results do contain updated records for all 58 cases after the new
behavior change. However, the runner still resumes by board ID without checking
a behavior fingerprint/settings key. Integration should use the existing
meter's actual source fingerprint, a separate candidate cache, and remeasure
changed behavior. The reused candidate version string alone is insufficient
to distinguish the two B3 revisions.

Controlled builder work can now establish practical usefulness without another
generic bot task: preserve the known exceptions, inspect disputed rejections,
and avoid silently treating old skilled ratings as new ones. This recommendation
does not change the family ruler, selection band, game levels or main branch.
