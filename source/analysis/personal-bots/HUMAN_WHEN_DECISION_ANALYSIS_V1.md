# Public WHEN analysis for clock recovery

Both policies received the same actual observed history and acknowledged the same recorded physical taps. Suggestions are counterfactuals, not proofs that each differing move caused the outcome.

| Board | Dennis | Salt1 baseline → strategy | Differing / compared | First-try clock changes | First tray / estimated slack | Replan drift |
|---:|---:|---|---:|---:|---|---:|
|144|1|5 → 1(helpful)|1/106|1|1/3|0|
|150|3|>12 → 4(helpful)|29/265|0|clock off at differing moves|13|
|10015|11|1 → 1(neutral)|25/103|25|2/23|0|
|10041|7|>12 → 2(helpful)|42/160|27|1/59|0|
|10045|6|3 → >12(harmful)|257/706|26|1/40|0|

Start clock-recovery planning only with at least one tray tile and at least50 estimated spare clock moves.

Two public features; round thresholds1 and50. The threshold sweep3,5,10,20,30,40,50,60 selected50: it retains four early differing moves on lab10041 and none on the broken lab10045. This is an activation hypothesis requiring a fresh development and full-cohort retest, not an adoption.

Stalled-retry information search remains separate. Level150 improves after its clock is gone; the proposed clock gate does not disable that intervention.

Lab10015 improves across full salts, but salt1 stays1/1 and is neutral for this salt1 fit.
Level150 has13 recomputed strategy suggestions differing from the recorded trajectory; actual taps independently replay. Those later clock-off positions do not fit this clock gate.
Clock route cost is a public heuristic estimate, not an exact shortest route, lower bound or winning witness. Physical replay and the full retest decide adoption.

All1340 recorded taps independently replayed. The fitting subset(first-attempt clock-on positions) has zero strategy replan drift. Full decision lists, public feature values, input hashes and threshold candidates are in .codex-runs/level-measure/when-v1/.
