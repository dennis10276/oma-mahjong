# Experiment25: earlier failed-route preferences

Status: rejected-full; retain adopted23. All six workers and supervisor
native2850 exited0. No benchmark worker remains live. Actor sources stayed
unchanged through measurement; separate diagnostics now keep them frozen while
running. Consecutive unadopted count2. No goal completion is claimed.

Preregistered in b0d339f; optional implementation1544b7e. See
HUMAN_FAILED_ROUTE_PREFERENCES.md for mechanism, bounds, tests and actual-history
comparisons. Default remains adopted23, profile7a73e26d6089fbb3c8545d8921b679224da42aa38c5b7b28d4b8877619da8a72.

| Development42 actual boards, salt1 | Cleared | Within Dennis+1 | Complete repairs | Passing target regressions | Slowest move |
|---|---:|---:|---:|---:|---:|
|Retained23|40/42|38/42|baseline|—|—|
|Candidate25|40/42|38/42|0|0|1639.3ms|

Only10011's successful-attempt count changes8->6; Dennis2+1 remains unmet.
CPU/wall mean1.0458, minimum1.0063; valid production replay and timing. The
unchanged off-salt-full-check-v2 rule advances a partial development gain with
no target/clearance regressions because86 remains an earlier off-salt failure.
Full adoption must still repair an entire failing target across all three salts
and break no passing target. The partial improvement is not an adoption.

## Full159-board result, salts1/2/3

| Policy | Cleared every salt | Within Dennis+1 every salt | Complete repairs | Passing target regressions | Slowest move | Mean minutes/board |
|---|---:|---:|---:|---|---:|---:|
|Retained23|157/159|154/159|baseline|—|1759.2ms|0.652|
|Candidate25|156/159|151/159|0|102,112,124|1760.9ms|0.961|

All159 records are valid; CPU/wall mean0.9992, minimum0.9448. Six native worker
exits and supervisor2850 exit0 are recorded in supervisor-native-exit.json.
Full result is not an adoption.10011 changes8/8/8->7/null/6, adding a censored
salt despite some lower clear counts; the development6 does not reproduce as
the same full salt1 count.102 changes3/3/3->4/3/3;112 changes2/2/2->2/2/3;
124 changes4/4/4->5/3/4.92 improves3/3/3->3/2/3 but was already passing.
The other original failures remain:86 1/1/3,32 null/null/null,49 5/3/5,
52 null/null/null. New open failures total8. No censored attempt is a clear.

## An observed candidate defect to investigate after measurement

10032 remains censored. It records six physical tray losses, followed by an
unresolvedBudget/contextChoiceLimit attempt7 with512 accepted taps. Its suffix
alternates68/0 without new pictures. This is a computation limit, not a physical
loss or impossibility proof. The audit independently reproduces699 taps across
the seven recorded attempts; terminal known pictures64/86, unchanged from23.

Repeated route replanning may be interrupting the selected alternative prefix.
That is a hypothesis pending actual-policy tracing, not an established cause.
Do not patch the live actor. After all full workers and supervisor are terminal,
trace this actual candidate history and investigate prefix retention/inspection
cycles before interpreting another route-learning variant as an improvement.
No unit test or fixed-history choice change demonstrates a campaign repair.

The follow-up public-state replay confirms482 repeated positions in attempt7,
starting before tap30, which repeats tap28 with tray2/openPeek0 and selected68;
tap31 repeats tap29 with tray2/openPeek68 and selected0. The full observer output,
remembered pictures/orientations, alive tiles, tray, moves, peek, relief and arrivals
are equal at these repeats; only physical-tap budget consumption advances. All699
taps independently replay again(native exit0). This rules out unseen picture
or changing visible-role discovery as an explanation for that repeated suffix.
Raw audit-candidate25-public-cycles.js and candidate25-public-cycles-v1.json/.log
retain these facts. The prepared trace-experiment25-cycle-prefix.js refuses to
run while benchmark workers are active; it has not yet been executed.

A fast observer/memory-only replay reconstructs the retry preferences without
running any decision search. All699 taps replay; the recorded key-identity
evidence matches and64 pictures remain known. At tap28/openPeek0 the selected68
has penalty0, but available78 has risk/route penalties1/1. At tap29/openPeek68,
selected0 has risk/route penalties0/1, while78 still has1/1. The pattern repeats
at taps30-33. The controller's reset condition tests whether ANY available root
has a positive penalty, so it can discard a cached route even when its next
chosen move is unpenalized. This supports tracing that guard first, rather than
adding another blind search-budget increase.

This replay reconstructs public memory only, not the actual decision reports,
pending prefix or known-win guard; it does not yet establish the complete cause
or demonstrate a fix. Raw audit-experiment25-cycle-preferences-v2.js and
experiment25-cycle-preferences-v2.json/.log retain the split risk/route costs;
native exit0. The earlier-v1 output is retained but its broad
trackedKnowledgeUnchanged label was only an existence check; v2 instead checks
that a current route cost matches this public-knowledge context.

## Actual-policy trace and regression attribution

The instrumented frozen25 controller reproduces232 accepted taps with zero
drift(native77651 exit0), covering six complete attempts plus the first45 taps
of attempt7. At taps28-31 the plans alternate[68,4,78] and[0,4,78]; each next
step is4, but a reset from decide's retry-penalty guard occurs before that
step can execute. The reports are not known wins. Role-revision resets do not
occur in this repeated suffix. This establishes repeated cached-prefix
interruption by the any-penalized-root reset, not a hypothetical hidden reveal.

On the actual23 baseline histories for102/salt1,112/salt3 and124/salt1, the25
candidate reproduces580 taps with zero baseline drift and zero changed
suggestions(native75138/67718/22641 exit0). The full-run regressions therefore
cannot be attributed to a particular override from those comparisons.

An additional identical-source/identical-profile self-replay of25's102/salt1
history independently reproduces227 physical taps but disagrees with seven
recorded choices. First disagreement is attempt3 tap46: recorded37, both
identical controllers55. The two controllers agree with each other on every
suggestion; maximum times reach1500.6/1500.2ms. Native3002 exit0, with the
diagnostic explicitly reporting policyAttributionAllowed:false. This is
consistent with bounded-search execution sensitivity, not proof of its cause.
Keep the observed regressions and do not fit a WHEN condition to fabricated
deterministic differences. Raw comparison scripts/logs and JSONL outputs are
under when-failed-route-preferences-full-v1/ and
when-failed-route-record25-selfreplay-v1/, plus trace-experiment25-cycle-prefix-v1.jsonl.

Next fix the verified prefix-interruption defect while preserving existing
public-information, known-win, clock-safety and move-budget guards. Then test
the repaired mechanism with actual histories and a new campaign; no25 repair
or adoption is implied by this diagnosis.

## Reproducibility and next action

Candidate source8dbd22174eb21227690589d6042255c24b788625f943ac439c4dffbb75ed1f33;
profile471b254326a3cff54156048349ab69ddf13f692a683881317d133d5611cc27d0.
Fresh159-board cohort confirmed2026-10-26T15:09:31.088Z; selectionv10 unchanged.
Raw .codex-runs/level-measure/experiment-25/ contains dispatch-state.json,
catalog-refresh.json, development-summary.json and development/full-shard*.jsonl.
The source snapshot is frozen-8dbd22174eb2-experiment25/ under the same raw root.
Supervisor/process-event logs, candidate25-retry-information-v1.json/.log and
audit-candidate25-retry-information.js are also retained there.

Supervisor2850 and all six workers are terminal0;25 is rejected. The subsequent
policy traces listed above are also terminal0 before actor edits. Retain default23
and consecutive count2. Track A remains unmet; Track B and future20 remain
unstarted. Every future adoption still requires full repair/no-regression,
fresh-cohort/source/native-worker/replay/timing verification, followed by
profile-only adoption and post-adoption tests/CLI. No goal completion is claimed.
