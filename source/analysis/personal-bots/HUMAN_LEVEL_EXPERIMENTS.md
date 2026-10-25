# Real-board planner experiments

These use the current real-board gates. Old salt-screen and certified re-deal
experiments are archived separately and do not count toward this eight-trial batch.
No private pictures, future reveals, target counts or level IDs enter a policy.
Certain deductions may enter trusted picture memory only with a rule-supported
proof covering every consistent hidden board; agreement of sampled boards is not proof.

## Experiment01: complete public-memory retry witness

Pre-run design: preserve first-try behavior and existing constructive wins. On a
retry whose alive pictures are all known, seek a complete winning physical route.
Search is positive-only: capped or failed searches do not prove impossibility and
return the primary plan unchanged. Respect remaining physical-choice allowance.
Global profile is baseline dc0d1ecd18b9fcc9c860187df2a9ae3bf7abcc56361e201aa2f94d0eb87a78f2
plus retryCompleteWitness=true, retryCompleteMs=250, retryCompleteNodes=2000.
Implementation aa610a7;113/113 reference tests pass, including production retry replay.

Comparator: corrected baseline-v2, source
596e37bde6e1c996ad068614c888e30ac29d1d14e8670d6d4f7bddf876f48618.
Reuse its actual measurements without a redundant baseline run. Real boards and
salts1,2,3 remain identical; max12 actual tries/salt, at most12 game workers.
Development selection hash:
806fc19e13ee57989fcc8bd4d8ca785020e858ca1c5da50a3f1d3fca79b93b1d.
Failing levels:86,144,150,10011,10015,10032,10033,10041,10049,10052.
Twenty passing guards:33,36,39,42,49,52,54,72,77,78,91,92,97,102,103,105,110,114,123,124.
Run these30 first; if a failing level is repaired and no passing level breaks,
run the other125. Adoption requires the same condition on the full155 boards,
all independent replays valid and every move under2s. Default profile remains
unchanged until full qualification. A valid rejection counts as one unadopted trial.

Raw profiles, frozen source bytes, native process exits, action sequences and
summaries: .codex-runs/level-measure/experiment-01/.

Result: valid30-board development check, no fixes and no regressions. Every
try count matched baseline. Slowest1504ms; mean1.825 minutes/development board.
All12 native workers closed0; supervisor session64218 exited0. All4722 extra
search opportunities had incomplete public picture memory, so no complete search
ran and no route was changed. Increasing its node/time budget cannot address this
particular bottleneck. Rejected; default unchanged; one consecutive unadopted trial.

| Trial | Change | Boards | Fixed | Broken | Slowest | Decision |
|---|---|---:|---:|---:|---:|---|
|01|Complete-memory retry witness|30|0|0|1504ms|Reject; incomplete memory|
|02|Clock recovery at any tray load|155|2|7|1514ms|Reject; passing levels broken|

## Experiment02: clock recovery before deeper digging

Pre-run design: baseline profile plus clockRecovery=true, with no other profile
change. Existing strategy evaluates known recovery depth and tray pressure before
deeper clock digging when the public clock budget has more than two spare moves
over the route lower bound. Tight clocks and nonclock play retain their existing
logic. This tests whether improving preparation helps reach unexplored tiles
without filling the tray. Complete-memory trial01 remains an unadopted candidate.

Same baseline-v2 comparator,30-board selection/hash, salts and adoption conditions
as trial01. Existing clock-recovery production tests and hidden-world invariance
checks are included in the passing113-test suite. No source code changes since
aa610a7; source3c87db493e0d3d28c865f624e110743b380d570f49d5fd921d074e34c562be01.
Raw profile and outputs: .codex-runs/level-measure/experiment-02/.

Development30 passed the preregistered comparison: repaired86 and10015, no broken
guard. The full155-board run is complete and valid: repaired86 and10015 but broke96,
106,112,10044,10045,10046,10048. Rejected; original baseline retained.146/155 clear
all salts,140/155 within Dennis+1; all four gates remain unmet. Full totals and
correlation stay unresolved due to censored campaigns; cleared-only diagnostic
Spearman-0.2302. Mean1.024 minutes/board; slowest1514ms. All24 native workers closed0
and supervisor session70871 exited0. Two consecutive unadopted experiments. Raw
full-summary.json and full-report.md are preserved; development alone never qualified adoption.

## Experiment03: recover only with a carried tray tile

Pre-run design: baseline plus clockRecovery=true and trayRecoveryClockMin=1.
This preserves the ordinary clock ordering with an empty tray and evaluates
recovery only after carrying a tile, while retaining the public spare-time gate.
This is a parameter refinement of trial02, not abandonment of that strategy family.
No algorithm source or original board changes. Tests for this threshold and
hidden-world invariance are included in the passing114-test suite.

Use the original ten failing levels and twenty fixed passing guards, plus the six
known trial02 regressions and slow pending lab10045:37 development boards. Extra
controls:96,106,112,10044,10045,10046,10048. Selection hash:
fd1face920f153e7483e7829b06d44fa62a266deb1eaf05ab5b5e6651a5921d0.
Comparator remains unchanged baseline-v2. Same adoption rule and salts1,2,3.
Use11 workers so the final trial02 worker can finish within the combined12-game
worker cap. Trial02 is already disqualified by confirmed regressions; it will not
dispatch any further phase. No running bot source is edited. If development
qualifies, run the other118; full155 remains required before adopting anything.
Raw profile, native exits and outputs: .codex-runs/level-measure/experiment-03/.
