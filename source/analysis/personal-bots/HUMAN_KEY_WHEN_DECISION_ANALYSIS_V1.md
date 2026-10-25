# Public WHEN analysis for remembered-key planning

Unconditional key memory repaired lab10041 in salt1 development(>12 to3) but broke
lab10045(3 to>12) and worsened already-failing10011(8 to>12). The default retains
adopted06. Keep the strategy family and determine when its added planning helps.

Both controllers saw the same actual07 public history and acknowledged the same
recorded physical taps. The candidate was recomputed using the same source/profile;
all strategy suggestions matched the recordings. Baseline suggestions are
counterfactuals along that history, not individually proved causal differences.

| Lab | Role | Actual taps replayed | Different decisions | Retained by condition |
|---:|---|---:|---:|---:|
|10041|Repaired|176|12|11|
|10045|Broken passing board|278|14|0|
|10011|Worsened already-failing board|614|20|0|

All1068 actual taps independently replayed through production. Replan drift is0
on all three cases. Native trace sessions56709,43212,87661 exited0. The key facts
learned by replaying the public observations exactly matched each saved07 run's
keyIdentityEvidence, including its actual attempt/tap provenance.

Selected condition: start planning with extra remembered-key dependencies only
while a live clock has more than40 estimated spare moves. One public feature,
clockRouteSlackEstimate; strict round threshold40. It uses current moves and
observed clock budget minus a public route-cost estimate including actually seen
or remembered key identities and observed obstacle roles. No private inventory,
future reveal, level ID or per-level setting enters the predicate.

The fixed sweep0,5,10,20,30,40,50,60 rejects thresholds retaining any changed move
on either harmful case, maximizes covered helpful boards then helpful positions,
and chooses the smallest remaining threshold. It selects40. One helpful late
decision at estimated slack37 is excluded. A valid already-started physical route
may continue after the threshold is crossed; fresh planning uses the current gate.

The estimate is neither an exact shortest route, lower bound nor safety proof.
Only one helpful board supports this hypothesis. New38-board development and
full155-board salts1-3 testing remain mandatory before adoption. Key identity facts
stay in memory and learning stays truthful while extra planning dependencies are
withheld. Tests cover the40/41 boundary with known key/lock dependencies, absent
and taken clocks, private-field guards, memory retention while gated off, physical
failed/winning retry replay and concealed-world invariance. All120 tests pass.

Comparison source635aaa9a0e83f0b77e161fee513d4d108376d1579860aec40fd9b6289175b8b5;
candidate profile2fc9966413161a1eda9647fa046297961325698cb96b76b83ae70bd5a8f850f3.
Raw decision lists, source/input hashes and all thresholds are under
.codex-runs/level-measure/when-key-v1/. Reproduce the fit with fit-key-when-v1.js.
