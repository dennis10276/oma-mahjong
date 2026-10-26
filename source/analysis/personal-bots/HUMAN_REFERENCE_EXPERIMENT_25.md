# Experiment25: earlier failed-route preferences

Status: full measurement running; no adoption, no full-result claim. Actor and
default profile are frozen. Supervisor native2850; PID41160. Development's three
workers are terminal0. Full workers15084/17232/20560 were verified live with
increasing CPU time. Preserve the same supervisor handle across continuation.

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

## Reproducibility and next action

Candidate source8dbd22174eb21227690589d6042255c24b788625f943ac439c4dffbb75ed1f33;
profile471b254326a3cff54156048349ab69ddf13f692a683881317d133d5611cc27d0.
Fresh159-board cohort confirmed2026-10-26T15:09:31.088Z; selectionv10 unchanged.
Raw .codex-runs/level-measure/experiment-25/ contains dispatch-state.json,
catalog-refresh.json, development-summary.json and development/full-shard*.jsonl.
The source snapshot is frozen-8dbd22174eb2-experiment25/ under the same raw root.
Supervisor/process-event logs, candidate25-retry-information-v1.json/.log and
audit-candidate25-retry-information.js are also retained there.

Poll native2850 before any actor edit. If qualified, require supervisor exit0,
generic adoption auditor exit0, fresh cohort/source/worker/replay verification,
then profile-only adoption and post-adoption tests/CLI. If unadopted, consecutive
count becomes2, retaining all prior evidence. Track A remains unmet; Track B
and future20 remain unstarted. No goal completion is claimed.
