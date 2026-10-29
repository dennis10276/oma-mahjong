# Human simulator: approved targets and verified repairs

ACTIVE and UNMET. Source8df9a86 repairs shared ice prerequisites; baa07d1 adds
short public clock/key outs, stagnation protection, honest censoring summaries
and exact clock-event timing. These are explicit human-v1-development profiles;
human-v0 remains the released tag and frozen policy40 is unchanged.

Dennis approved person-specific before-clock targets:20-30% near his audited
25%; family35-45%, referencing Mrs. Doubtfire. First-try and factory gates stay
fixed. Separate audited top10-loss/10-zero-observed-loss cohorts replace the
old four-case pre-clock-majority rule. Clock-contact is its own disjoint class.

|Candidate|Dennis first|Family first|Before-clock D/F|Risk gap D/F|Factory d/e|
|---|---:|---:|---:|---:|---|
|shared-ice-full|52.71%|29.24%|45.40/53.71%|26.50/0.50pp|pass|
|key-outs-repair-full|51.04%|29.10%|50.96/50.19%|35.00/4.00pp|pass|
|clock-outs-refined-full|51.18%|29.51%|50.94/50.39%|35.00/3.00pp|pass|
|clock-order-full|51.18%|29.51%|50.94/50.39%|35.00/3.00pp|pass|

The earlier key-outs-full run was REJECTED: supervisor exit1, worker3 exit2,
five censored campaigns. Caps were never losses or free retries. The exact five
seeds now produce real outcomes; all three subsequent full runs are valid.

Current142: Dennis19/20 first wins,20/20 clear;
family1/20 first,20/20 clear within12. Null success
entries in the JSON are unfinished campaigns, not successes at the cap.
The simpler shared-ice candidate cleared all20 family campaigns on142.

Current136: Dennis18/20 clear, versus0 in the shared-ice baseline;
current141: Dennis20/20 clear, versus0. The rule preserves a matching
out for the clock rather than consuming it in another pair. It can deliberately
use a temporary third spot, then match the clock and recover tray space.

Factory: all100 campaigns clear; easy first rates75/70/95/100%; hard first0%,
mean2.5. Gates d/e pass. Max20-campaign measurement0.777minutes;
slowest decision10.02ms. All181 offline tests pass. All100 default
v0 campaign outcomes reproduce the archived release. Exact clock-removal timing
changed no legacy outcome in2960 campaigns; only annotations changed.

M2 still fails: before-clock50.94/50.39% misses20-30/35-45%.
Family risk/control gap3.00pp misses10pp. Neither a release tag, an
actual lab ranking nor prospective accuracy is claimed. Current score anchor
key-outs-repair-full; no-progress counter1. Historical contract1 trials are kept intact;
the metadata-only timing rerun does not count as another experiment/reset.

Reproduce via human_bot.js with profiles loaded explicitly from
human_v1_shared_ice_profiles.json or human_v1_clock_outs_profiles.json. Both
accept arbitrary unlabeled boards. The first is the minimal142 repair; the
second is current research, not a calibrated default. Raw execution imports,
profiles, all campaigns and native exits are in .codex-runs/human-style/phase-v2.

Next: rule out optional clock-mate/key routes that cannot fit the public clock
budget. The optional locked-mate route on132 needs at least seven ordinary removals
with six clock moves when both mates are face up. The level itself is winnable
through another opening; this is not an impossibility claim about the board. Keep the
136/141/142 repairs and d/e, then test the complete paired cohort. Family logs
also show clock rush/contact losses that this model rarely reproduces; tuning
the same short-horizon probabilities alone has not created the required risk
gap (historical corrected-cohort diagnostic is retained, not a new evaluation).
