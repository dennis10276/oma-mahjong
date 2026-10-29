# Milestone2 calibration and source audit

ACTIVE and UNMET. human-v0 remains the released factory version (bcac396).
The previous goal turn made concrete progress: first release, source audit and
full calibration baseline. This turn tests fixed behavioral profiles; no per-level
routes, settings or successful-attempt regression are used.

Factory d/e/timing/valid must be retained by every candidate. The original
calibration contract remains unchanged while a question about its human phase
and clock-case evidence is pending. No human-v1 tag is justified yet.

| Version/trial | Dennis first try | Family first try | Clock-loss shares D/F | Factory d/e |
|---|---:|---:|---:|---|
|Released v0 baseline|55.56%|25.69%|45.58/64.76%|pass|
|1: reallocate short planning|49.72%|37.29%|62.55/30.94%|pass|
|2: isolate clock estimate/reach|49.10%|33.40%|61.45/48.74%|pass|
|3: variable attention per attempt|51.39%|30.00%|55.41/53.93%|pass|
|4: equal family attention split|51.39%|29.17%|55.41/54.57%|pass|
|5: learn deadline attention after losses|51.39%|29.17%|50.40/54.57%|pass|

All five are complete74-board,20-campaign,up-to12-actual-try evaluations.
Every tap independently replays; all native workers exit0. The same profiles and
actor/physics sources are verified between each factory and calibration run.

## Predeclared progress and stop accounting

The retained anchor starts at v0. Preserve every passed M1 check and previously
passed M2 a/b/c check; a tradeoff that loses a check cannot reset the stop counter.
Progress gains a complete check or improves total fractional constraint distance
by at least.01. Distance sums violations of first-rate/phase intervals, risk-gap
minimum and the average deficit across the four clock-case majorities. Missing
clock shares retain a.5 deficit. Stop after8 consecutive experiments without
progress on this milestone. Raw ledger: .codex-runs/human-style/milestone2/ledger.json.

Trial1 loses family.a, so is not progress. Trial2 preserves previous checks and
improves the preregistered distance0.77784->0.59734; no full gate set passes.
Trial3 gains Dennis.a and Dennis.b; trial4 improves the score further. Trial5
repairs the retry regression but loses Dennis.b under the disputed original
phase target, so it is a tradeoff and does not reset the counter. Retained
score anchor4; latest no-progress counter1. This score does not establish that
the original human targets are correct.

## Trial hypotheses

1. Dennis uses a short clock deadline estimate, with four-tap tray thinking and
   three-step partner access. Family gets a three-step clock cone plus geometric
   slack. This isolates allocation of bounded human planning effort.
2. Dennis changes only to the short clock estimate. Family extends clock reach
   without geometric deadline urgency. This separates the coupled mechanisms.
3. A person's attention varies between attempts. Dennis checks geometric clock
   slack with probability.2, otherwise uses a short estimate; family extends its
   clock lookahead by one with probability.6. A separate RNG leaves the existing
   move-noise stream intact. These alter decisions, never inject synthetic losses.

4. Keep Dennis unchanged; reduce family extra-look probability.6->.5.
5. Increase Dennis deadline attention by.4 after each actual clock loss. Mid
   losses and computation caps do not provide clock-learning evidence.

The factory runner now accepts an optional candidate-profile file. Experimental
profiles are labeled human-v1-development and do not inherit v0's validation
claim. Default v0 profiles and its tag remain unchanged.

## Evidence requiring a target clarification

HUMAN_PHASE_TARGET_AUDIT.md documents a fresh read-only event audit. The UI's
clock event records saving the clock, including saving it on the final move.
Dennis's current natural-first-clear records do not support forcing135/142/144
to fail predominantly before clock. The original gates are preserved pending
user clarification; no data disagreement is silently hidden or fitted away.

## Retry repair and current limits

Trial4 leaves3/20 hard factory campaigns uncleared within12; its complete mean
remains null. Trial5 clears all20 with mean3.6 tries and all100 factory campaigns
clear; easy rates remain75/70/95/100%, hard first rate0%. The original qualitative
d/e gates pass in both. The missing hard clears remain a visible adoption concern
for4; they are not hidden by the score ledger.

Across all74 boards, changing only family attention (3->4) preserves every
Dennis campaign. Adding retry learning (4->5) preserves every Dennis first
attempt and every family campaign. Default v0 reproduces all100 tagged-release
campaign outcomes exactly.175/175 offline tests pass, including fixed-profile bounds and the new phase
audit; final suite output is kept in milestone2/suite-03.log.

Research configurations are committed in human_v1_attention_profiles.json (4)
and human_v1_retry_profiles.json (5). Pass one explicitly as the API profiles
option to reproduce it. They return human-v1-development. No default profile
or release tag is replaced, and no human-v1 calibration claim is made.

Trial1 started before the candidate-version metadata correction. Its recorded
version string is retained as raw evidence; the source/profile hashes identify
the experiment. Later non-default profiles are explicitly marked development.

Source support committed47e79b2. Final175/175 suite completed with native exit0;
all five factory/calibration process pairs and their four-worker groups exited0.
The score anchor remains4;5 is retained as the retry-repair research candidate.
The default release is still human-v0 atbcac396.
