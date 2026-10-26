# Preserve a valid retry prefix until its next action needs revision

Default remains adopted23. Trial25 was rejected: no repaired full target,
three passing target regressions and a recorded inspection cycle. Consecutive
unadopted count2. This optional bug fix is not an adoption or target repair.

## Verified defect

The actual25 development10032/salt1 trace reproduces232 physical taps with
zero drift, including the first45 taps of its censored attempt7. From tap28,
the planner alternates[68,4,78] and[0,4,78], with a retry-cost reset before the
pending4 can execute. Both reports are bounded progress, not known wins. The
public state repeats482 times in the512-tap censored attempt. A separate699-tap
public-memory replay confirms that an unrelated available78 has penalty1 even
when selected68 is unpenalized. These are observations, not imagined pictures.

The old controller resets whenever ANY available action has a learned penalty.
That discards the prefix even when its next step is legal and unpenalized.
See HUMAN_REFERENCE_EXPERIMENT_25.md for native exits, raw traces and limitations.

## Change

For retryFailedRouteLearning, delegate retry revision to the reference planner's
existing pending-prefix validation. It already checks expected physical state,
preserved known pictures/orientations, current legality and new information.
Only the NEXT retained root's positive penalty triggers retry replanning.
Known winning routes and safe clock exits are protected. Active clocks remain
protected unless clockRetryLearning is explicitly enabled. New-information
replanning remains in force. Invalid or expired prefixes use the normal search.

The old any-root controller reset remains unchanged when failed-route learning
is disabled. The default23 profile is untouched. The generic reference option
replanOnRetryCost defaults false; the controller enables it only for the optional
failed-route feature. No search budget increases, hidden-value deductions,
heuristic loss certificates or per-level conditions are introduced.

## Verification

129/129 human-reference tests pass17s(native95400 exit0). Eight new prefix cases
cover unrelated versus next-root penalties, default behavior, known wins, safe
clock exits, active-clock protection, explicit clock retry and absent cost data.
All80 physical taps independently replay to real clears; closed pictures are
actually inspected before use. Mock search reports isolate prefix scheduling;
they are not evidence of a real-board campaign gain.

Current sourcebf71b62cad0867ba9e24e701c146d2231f70de8c93db8306c8a07d8e830e4db1.
Candidate profile remains471b254326a3cff54156048349ab69ddf13f692a683881317d133d5611cc27d0:
adopted23 plus retryRiskLearning:true and retryFailedRouteLearning:true. None of
trial24's peek preferences or larger information allowance is included.

Next compare against the exact25 recorded loop history, with zero baseline drift
and independent production replay. Attempt7 is a45-tap prefix only; never teach
a fake outcome from that truncation. Freeze actor sources during comparisons.
Then test actual executed continuations or a fresh campaign; a suggested4 alone
does not establish a clear. A new campaign uses the unchanged42-board development
selection and full159/salts1-3 repair/no-regression gate before any adoption.

The25 regressions are retained. Their isolated baseline-history comparisons show
no changed suggestions, while identical25-source/profile replay of102 disagrees
with seven original choices. Do not fit a WHEN condition to an unreproduced
cause or claim that this cache fix repairs those targets without new measurement.

Raw .codex-runs/level-measure/ contains retry-prefix-retention-unit-01.log,
retry-prefix-retention-suite-01.log and compare-retry-prefix-decisions.js.

## Real-history and executed-continuation results

Native86880 exit0: the old25 loop history reproduces232 physical taps with zero
baseline drift. The fixed controller differs on ten suggestions, all on attempt7;
the first six complete attempts have no suggestion changes. At the repeated
tap28/30/32/... positions it suggests4 instead of68. The45-tap truncated final
attempt teaches neither controller an invented outcome. Maximum old/fixed
decision times1632.0/1630.4ms; public picture memory agrees throughout.

Native83268 exit0: force the same six actual failed attempts and first28 accepted
taps of attempt7, then physically execute the fixed controller. It takes4,78,4,
ending in a real tray loss after three continuation taps, with no repeated public
position and no new known picture(64 before/after). All218 taps across the forced
history and continuation independently replay; maximum1631.3ms. The forced
prefix has one different suggestion earlier in attempt7. This is not a fresh
campaign or a target repair; it verifies removal of the observed inspection loop.

Native62150 exit0:102/salt1's actual23 history reproduces178 taps, zero baseline
drift and zero changed fixed-controller suggestions; max1332.0/1304.9ms. This
control is narrower than a full regression check and does not erase25's regression.

Raw when-retry-prefix-retention-v1/baseline25/10032-salt1.jsonl and
baseline23/102-salt1.jsonl retain the comparisons; retry-prefix-executed-continuation-v1.jsonl
and execute-retry-prefix-continuation.js retain the physically executed diagnostic.

## Preregistered experiment26

Use the exact source/profile above, actual adopted23 baseline records and the
same selectionv10:42 development boards,20 fixed guards and all retained passing
controls. Three workers; salt1 development first; full159/salts1-3 only under
unchanged off-salt-full-check-v2 qualification. Adoption still requires at least
one entire failing target repaired, no passing target regression, independent
production replay and every actual move strictly below2s. No25 result is adopted.

Counter before26 is2; an unadopted26 makes3. Pin completed trace/continuation
native exits, both source/profile identities, baseline records, evaluator,
catalog/selection, tests and this preregistration. Refresh the cohort before
measurement. Freeze actor sources/default23 until all workers and supervisor
are terminal. Preserve regressions and timing-sensitive evidence; do not claim
that a unit test or ending one loop establishes a fresh-campaign gain.
