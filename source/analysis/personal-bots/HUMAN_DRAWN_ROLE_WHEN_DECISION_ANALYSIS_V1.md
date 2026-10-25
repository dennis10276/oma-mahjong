# When to plan for symbols on tile backs

Unrestricted experiment09 repaired lab10033, but broke102 and150 and worsened
already-failing10011. Both controllers were then given the same actual09 public
history and acknowledged its recorded taps. The baseline suggestions are
counterfactuals, not individually established causes of the changed outcomes.

| Case | Recorded taps replayed | Different baseline suggestion | Strategy replan drift |
|---|---:|---:|---:|
|10033 repaired|145|17|0|
|102 broken|312|46|0|
|150 broken|391|8|4|
|10011 worsened|1061|587|0|

All1909 taps independently replayed through production. All four native trace
commands exited0. The four drift positions on150 occurred after the clock was
cleared; they remain recorded and are excluded from fitting. No live-clock
position had strategy replan drift. Actor source stayed379c955f3f43241b2b1b9dbc42164457a5f34c5e5a68ea8c134949cd0de8456c
throughout the comparisons.

The improved board's changed clock decisions had3-10 estimated spare moves.
102's changed clock decisions had4;150's changes were after the clock was taken.
10011's changed clock decisions had29-34 estimated spare moves. The proposed
condition is: start drawn-back-symbol information planning only with a live clock
and5-20 estimated spare moves. This uses one public feature, a round interval.

The fit enumerated interval endpoints0,3,5,10,20,30,40,50,100. It required no
retained changed position on a regression or worsening case, then maximized
helpful boards, helpful positions and interval width, in that order. The selected
interval retains12 changed positions on10033 and none on102,150 or10011.
It intentionally excludes three helpful clock changes and two clock-off changes.

Only one improved board supports this condition. It requires a new development
run and then a full-cohort run, not an assumption that the twelve changes suffice
to win. A previously planned physical route can continue across the boundary.
The condition governs planning opportunities, not observation or retention of
actual facts. Pictures and symbol values are never forecast as known.

The estimate uses public geometry, observed roles and actually remembered key
identities, including retained key facts while their separate planning gate is
closed. It is not a shortest route, lower bound or safety proof. A lightweight
replay reconstructed every recorded feature at all658 differing/drift positions
and verified the implemented gate agrees with the fitted predicate at every one.

Raw evidence: .codex-runs/level-measure/when-drawn-role-v1/; condition-fit.json
SHA2560a263696bbd33d29547194b4ed8bb8dda69b292ea9bbebbe9d2a6f8d16403e86;
feature correspondence in gate-feature-mapping.json. The default08 profile is
unchanged. Counter remains1 until a new measured experiment finishes.
