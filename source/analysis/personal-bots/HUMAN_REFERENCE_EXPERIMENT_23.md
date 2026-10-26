# Adopt23: condition clock inspection and ranking on the public starting budget

Both clock-inspection and clock-slack ranking now operate only when the visible
clock starts with10-30 moves. Inspection also retains the existing tray limit2
and proved worst-case first-tap clock bound. Known wins, safe clock exits and
constructive tray recovery retain priority. Estimated clock access/slack remains
a ranking heuristic, never a loss certificate or hidden-picture deduction.

| Full real-board run,salts1/2/3 | Clear every salt | Within Dennis+1 every salt | Repaired targets | Passing target regressions | Slowest move | Mean minutes/board |
|---|---:|---:|---|---:|---:|---:|
|Retained19|156/159|153/159|baseline|—|1661.4ms|0.552|
|Adopted23|157/159|154/159|10033|0|1759.2ms|0.652|

All159 targets remain included:144 natural first clears17-160 plus15 authorized
labs. Max12 actual attempts per salt, independently replayed through production.
Existing historical-board provenance remains explicit. The full goal is unmet:
five targets still fail. These reference-bot rates are not personal prospective
prediction accuracy; Track B and the frozen future20 remain outstanding.

## Outcome and why the conditions matter

10033 changes5/null/5 ->4/3/6, meeting Dennis5+1 on every salt. The preceding
variant22 had the same repair but regressed10041 to5/8/12.23 restores10041 to
3/3/3.144 remains1/1/1 and10045 remains3/3/3.150 is4/1/2, still within its
target4; its salt1 count is worse than retained19's2. No target regression is
not a claim that every individual attempt count improves.

The initial budget range was fitted on development evidence:144's short
6-move clock,10033's18-move clock and10045's48-move clock.41's development
slowdown3->5 already identified the extra inspection behavior as a concern.
The existing10-30 band was then applied to that component as well; no new
numeric cutoff was fitted from full-set outcomes. This uses a public numeric
feature, no level IDs, per-board settings, decks, seeds or recorded routes.

Actual-history controls reproduce19's41 salt1/salt3 decisions over353 taps and
22's complete33 salt1 campaign over162 taps, with zero changes and zero drift.
All515 taps independently replay. These supported the candidate; the fresh
full run supplies the adoption evidence. Earlier mixed variants20-22 remain
preserved as unadopted experiments. The consecutive-unadopted count resets0.

## Verification and mapping

Three new development and three new full workers exit0. Supervisor61548 exits0;
independent adoption auditor94429 exits0. The auditor re-summarizes raw outputs,
confirms the unchanged full repair/no-regression rule, verifies71 runtime files,
checks original baseline records and refreshes all159 current targets unchanged.
Development's5->4 improvement on33 qualified for a full check because its earlier
full salt2 result was a failure; actual complete repair is still required.

Only the default profile changes during adoption; all other actor files match
the measured snapshot. Measured source:
837dad59c872dc695e2edb24564ef9119e0672c2a3328a03ce41f3f9f8796ac7.
Profile7a73e26d6089fbb3c8545d8921b679224da42aa38c5b7b28d4b8877619da8a72.
Adopted source19246943fbcf91e183fcc9f09b20a08ab3e0fa1f9a653b75fb730cb630e5f7d3.
Mean CPU seconds/wall second1.023359; minimum0.887209. Every actual move remains
below2s. Mean0.652 minutes/board covers all three salts at three workers.

Post-adoption126/126 tests pass36s(native6566 exit0). From external cwd
C:/Users/den_k, the absolute CLI clears unlabeled lab61 in1/1/1, valid, slowest
1502.6ms(native70778 exit0), with no Dennis count supplied. The159 actual raw
board records are aggregated for the next baseline and reproduce full summary
rows exactly. The canonical goal retains its ten-line measure API and80-line cap.

## Open targets

- 86: Dennis1, bot1/1/3.
- 10011: Dennis2, bot8/8/8.
- 10032: Dennis5, botnull/null/null.
- 10049: Dennis2, bot5/3/5.
- 10052: Dennis3, botnull/null/null.

The earlier public retry audit identifies information stalls on32 and repeated
failed clock sequences on52, with existing risk penalties often arriving late.
Those are diagnostic leads, not newly validated strategies or impossibility
claims.33 joins passing regression controls; no failing target is excluded.

Raw evidence under .codex-runs/level-measure/experiment-23/: dispatch-state.json,
development-shard*.jsonl, full-shard*.jsonl, full-summary.json,
supervisor-native-exit.json, adoption-verification.json, auditor-native-exit.json,
adoption-audit-01.log, adopted-profile-mapping.json, post-adoption-suite-01.log,
unseen-lab61-post-adoption.json/.log and full-records-for-next.json.
