# Public visibility diagnostic

The existing geometry visibility gate dominated a CPU profile of developed level81,
salt1, primitive32x1, progress scores and paired2SE, capped at8 actual taps.
`exposedRegion` accounted for about44% of profile samples, compared with about11%
in production taps and3% in prefix replay. This motivated compiling only public
geometry occluders; the rectangular subtraction and its boundary tests are unchanged.
The cache checks a geometry signature on every call and stores no pictures, roles,
orientation, alive state, memory or forecasts.

Before compilation the capped diagnostic completed12 fillings and121 action
evaluations; after compilation it completed26 and261 respectively. The latter
accepted8 independently production-verified taps, ended `unresolvedBudget`, and
had a slowest decision of1297.33ms. The earlier diagnostic was profiled and the
later one was not; timing and completed counts also depend on machine load.
These observations justify a complete seeded comparison, not an adoption claim.

The compiled gate matches the original gate in86,016 exhaustive comparisons,
including alive/down combinations, requested subsets, mutable geometry, subpixel
boundaries, nonfinite fallback, returned-value mutation and private-picture reader
guards. The offline human-reference suite passes99/99 in11s.

Commit544558d contains this implementation and tests. Frozen profiles in e68ea28
test progress32x1, progress12x16 and primitive32x1 against the original24/48
baseline, all16 levels and salts1-3. No planner change has passed the adoption gate.
