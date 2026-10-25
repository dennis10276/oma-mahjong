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

## Tight-clock follow-up hypothesis; not executed

The earlier minimum-slack-only sweep cannot retain the helpful low-slack144 change.
Both144 and harmful10045 have differing moves at estimated slack3, but their trays
hold1 and3 tiles respectively. Reusing only the existing salt1 development traces,
a separate sweep of tray ceilings1,2,3 and spare-move ceilings5,10,20 selects:
start tight-clock recovery only with exactly1 tray tile and3-5 estimated spare moves.
The existing safety guard supplies the lower bound3;5 is the selected round ceiling.
Exactly two public features are used, with no level IDs or per-level settings.

This retains144's one helpful change(at tap2), no harmful10045 change, and no change
on the other three trace cases. Among candidates retaining no harmful board, the
fixed rule maximizes helpful boards then minimizes tray and spare-move ceilings.
Only one helpful board supports this branch; suggestions remain counterfactuals,
not individually proved causes. This needs fresh development and full-salt testing
before any adoption. Preserve the independent ample-clock branch if combining them.
No full06 outcome enters this fit and no measured actor was changed. Labs remain
the immediate priority for the prepared key-memory and drawn-role experiments.
Reproducible script: .codex-runs/level-measure/fit-tight-clock-when.js;
input hashes, all nine candidates, positions and selection: when-tight-v2/condition-fit.json.
