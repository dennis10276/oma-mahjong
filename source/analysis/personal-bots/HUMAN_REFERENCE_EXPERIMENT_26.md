# Experiment26: retain valid retry prefixes

Status: rejected-full; retain adopted23. Supervisor native71724 and all six
workers exited0; no measured worker remains live. Consecutive unadopted count3.
Actor source stayed unchanged through measurement. No target repair or adoption.

Implementation0d6f9df; preregistrationa9d7f9f, documented in
HUMAN_RETRY_PREFIX_RETENTION.md.129/129 tests pass17s(native95400 exit0).
Default23 is retained. Trial25 was rejected in53a06a3: no target repair,
regressions102/112/124, plus10011's newly censored salt. Consecutive count before26
is2; unadopted26 makes3. No old trial is erased or relabeled as an adoption.

The repaired mechanism delegates cached-prefix retry revision to validation of
the NEXT action, preserving unpenalized prefixes. Its diagnostic takes4,78,4
from25's recorded loop position and ends in a physical tray loss, rather than
repeating peeks until512 taps. It does not clear that position or repair a target.
All218 diagnostic taps independently replay(native83268 exit0). The old-history
comparison reproduces232 taps without baseline drift(native86880 exit0);102
control reproduces178 without changed suggestions(native62150 exit0).

Current sourcebf71b62cad0867ba9e24e701c146d2231f70de8c93db8306c8a07d8e830e4db1;
candidate profile471b254326a3cff54156048349ab69ddf13f692a683881317d133d5611cc27d0.
This is retained23 plus retryRiskLearning and retryFailedRouteLearning, with the
cache bug fixed. It includes none of24's added peek preferences/search allowance.
Default profile7a73e26d6089fbb3c8545d8921b679224da42aa38c5b7b28d4b8877619da8a72 is unchanged.

Use actual23 baseline records, catalogv2, selectionv10's same42 boards/20 guards
and all retained passing controls. The fresh159-board cohort is unchanged at
2026-10-26T16:39:34.486Z. Three workers. Development salt1 first; full159/salts1-3
only after unchanged off-salt-full-check-v2 qualification. Adoption still requires
at least one entire failing target repaired, no passing target regression,
independent production replay and every actual move strictly below2s.

Raw .codex-runs/level-measure/experiment-26/ contains dispatch-state.json,
profile.json, baseline summaries and catalog-refresh.json. The source snapshot
is frozen-bf71b62cad08-experiment26/ under the same raw root. run-experiment-26.js,
experiment-26-supervisor-01.log, experiment-26-process-events.jsonl and
retry-prefix-native.json retain the runner, native tracing and prerequisites.

After measurement is terminal, record the actual outcome and counter. If
qualified, require supervisor exit0, adoption-auditor exit0, fresh cohort/source/
worker/replay/timing verification, profile-only adoption and post-adoption tests
and unlabeled external-cwd CLI. If rejected, preserve harmful histories and
investigate actual decisions.25's102 self-replay has drift, so no causal WHEN
condition is fitted to invented differences. Track A remains unmet; Track B
and future20 remain unstarted. No completion or perfect-bot claim is made.

## Completed result

| Full159 actual boards, salts1/2/3 | Cleared every salt | Within Dennis+1 every salt | Complete repairs | Passing target regressions | Slowest move | Mean minutes/board |
|---|---:|---:|---:|---:|---:|---:|
|Retained23|157/159|154/159|baseline|—|1759.2ms|0.652|
|Candidate26|157/159|154/159|0|0|1658.5ms|0.538|

All159 records are valid; CPU/wall mean1.0400, minimum1.0057. The original five
targets remain unmet:86 1/1/4(D1),10011 6/6/6(D2),10032 null/null/null(D5),
10049 5/3/5(D2),10052 null/null/null(D3). Compared with23,86's last salt worsens
3->4,10011 improves8/8/8->6/6/6, and150 improves4/1/2->2/1/2 while remaining
passing. None repairs a complete target.25's passing-target regressions are absent
in this run, but this does not retroactively erase them or prove their cause.

Development42/salt1 also had no complete repair or passing-target regression;
10011's partial gain allowed the unchanged v2 off-salt full check. Its slowest
move1640.9ms. All six workers and the actual supervisor exit0 are recorded in
experiment-26/supervisor-native-exit.json. Default23 remains unchanged; counter3.
No adopter or profile replacement was run. Retain all raw results for subsequent
actual-history comparisons; Track A and all later gates remain unmet.
