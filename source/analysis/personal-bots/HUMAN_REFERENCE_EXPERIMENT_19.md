# Experiment19: adopt earlier closed-tile inspection

The adopted profile inspects unknown closed tiles with up to two occupied tray
spots when no clock is active. Known wins, safe clock exits and constructive
tray recovery retain priority. It also enables the already tested broader
information probe after a primary known-dead report. These two settings were
measured together; the campaign result does not independently attribute an
improvement to the dead-end probe.

| Real-board full run, salts1/2/3 | Clear every salt | Within Dennis+1 every salt | Repaired targets | Passing regressions | Slowest move | Mean minutes/board |
|---|---:|---:|---|---:|---:|---:|
|Retained14|156/159|152/159|baseline|—|1639.9ms|0.541|
|Adopted19|156/159|153/159|157|0|1661.4ms|0.552|

All159 recorded targets remain included, each with at most12 actual attempts
per salt. Every attempt independently replays the production engine. A null
result remains a failure, never an inferred clear. Track A is still unmet;
these clearance/target rates are not personal prediction accuracy. Track B and
the frozen future20 remain outstanding.

## Why the changed move helps

On157, counts change3/3/4 ->2/2/2. At the first changed decision on all three
salts, attempt1 tap9, the public tray contains pictures12 and1 and no clock is
active. Retained14 takes tile51, known picture2, filling the third tray spot.
The candidate instead inspects an unknown closed tile:80 on salt1 or83 on
salts2/3. The real salt1 tap matches a tray tile, reducing occupancy to1; the
other two reveal a picture while occupancy stays2. The actor does not know
the hidden picture before tapping. Actual observations and proved match
deductions may subsequently enter same-salt retry memory.

The preceding campaign histories are identical up to each first changed
decision. Both immediate branches and preceding histories independently replay
78 production taps(native exit0). This establishes real public-state decision
differences; it does not claim that later divergent histories are shared states.
The implemented WHEN condition uses only active-clock state and tray count.

## Full-check protocol and adoption evidence

Experiment18's42-board development run improved157 salt1 from3 to2, while both
counts already met that single-salt target. Retained14 nevertheless failed157
salt3. The preregistered off-salt-full-check-v2 therefore permits a full check
for a strict development improvement on a known full-run failing board. Full
adoption still requires an actual complete target repair and no passing target
regression. The final result meets that unchanged rule on157.

Experiment19 uses exactly18's actor/profile and three original development
worker outputs. Their raw headers, PIDs, native exits and bytes remain intact.
Three new workers execute the full159-board, three-salt benchmark. The first
19 startup stopped before launching any new games because noncanonical shard
ordering changed the last decimal of a CPU average. Canonical shard ordering
fixes that reconstruction; failed startup artifacts remain preserved separately.
It is not an extra measured strategy experiment.

All three new full workers and the supervisor exit0(native session26930).
The independent adoption auditor exits0(session89018), reproduces raw summaries,
checks original development/native provenance, verifies70 runtime files and
refreshes all159 current targets unchanged at2026-10-26T08:03:34.324Z.
Mean CPU seconds/wall second is1.041738; minimum1.009432.

Only the default profile changes during adoption: inspectionTrayLimit1->2 and
deadEndInformation enabled. Other actor files match the measured snapshot.
Measured source90a8b5cfbc2b6e8c247e07f9b5e31a030b7253c601700274f3600e3b25ee9e50;
profile5d05b10f0b786db09cffa2ff4ec40f1d72925f3e1351f9962f4549137ca554f1;
adopted source360dbec30c9c364cdcc0536debb2fb9c581d92d16e7e508be927c06337510423.

Post-adoption:124/124 tests pass17s(native50368 exit0). From external cwd
C:/Users/den_k, the absolute-path measure CLI clears the unlabeled lab61 board
in1/1/1, valid, slowest969.8ms(native35182 exit0). The CLI requires no Dennis
count. Actual159 raw board records are aggregated for the next paired baseline
and independently reproduce the full summary rows.

## Open failures and next work

- 86: Dennis1, bot1/1/3.
- 10011: Dennis2, bot8/8/8.
- 10032: Dennis5, botnull/null/null.
- 10033: Dennis5, bot5/null/5.
- 10049: Dennis2, bot5/3/5.
- 10052: Dennis3, botnull/null/null.

The consecutive-unadopted counter resets to0 after adopting19. Trials15-18
remain preserved as unadopted experiments. Earlier active-clock inspection
diagnostics identify possible new information on10052; they do not yet prove a
winning continuation or justify an active-clock inspection policy.

Raw evidence is under .codex-runs/level-measure/experiment-19/: full-shard*.jsonl,
full-summary.json, dispatch-state.json, supervisor-native-exit.json,
adoption-verification.json, auditor-native-exit.json, adoption-audit-01.log,
adopted-profile-mapping.json, post-adoption-suite-01.log,
unseen-lab61-post-adoption.json/.log, full-records-for-next.json,
level157-prefix-comparison-01.json and level157-first-divergence-replay-01.json.
