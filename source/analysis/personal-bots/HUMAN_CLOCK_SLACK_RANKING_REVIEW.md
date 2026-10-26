# Optional clock-slack ranking

Experiment20 demonstrates that an extra safe reveal can be used without
producing a timely clock exit. At its actual10052 attempt3 tap16, the known
pair spends two clock moves and the planner reports an information boundary,
not a safe exit. The subsequent campaign still expires. This motivates a
ranking diagnostic, not a claim that that pair was necessarily the wrong move.

The existing clock rank uses negative estimated access cost. The optional
clockSlackRanking instead uses remaining clock moves minus estimated access
cost at the same position. This accounts for known clock moves consumed along
the candidate prefix. Existing tier, clock-cone, tray-pressure and recovery
priorities keep their positions; the change replaces only the distance term.
Known wins and verified clock exits retain their existing ranks.

The access estimate comes from the existing public geometry/observed-role
heuristics. It is not a lower bound or route witness. Negative estimated slack
does not prune a position or certify a loss. The report records remaining
moves, estimated cost/slack and known prefix moves spent, labeled heuristicOnly.
It does not assign pictures to unknown tiles or predict the removal cost of a
future unknown tap. Separate safeClockInspection uses the worst-case first-tap
cost bound when deciding whether the inspection itself is safe.

Both new options remain disabled in the default19 profile. No measured
experiment21 is registered or counted. The consecutive-unadopted count stays1.

## Controls and diagnostic

Production controls verify urgent clock exits across two concealed ordinary/
Joker assignments with private-input traps, disabled/nonclock identity and
bounded-search uncertainty. Two actual clock-removal taps independently replay.
All126 tests pass16s(native67336 exit0). These controls do not establish a
strategy improvement. A small exploratory sweep of300 public toy positions
finds no different first choice; it is not a clearance benchmark or a proof
that the ranking cannot matter. Its first setup was rejected by known-state
validation for null orientations without a public-frontier projection; the
corrected setup supplies that projection and zeros removed-tile orientation.

compare-clock-slack-ranking-decisions.js compares the measured20 frozen
controller and the optional ranking on the first four actual10052 salt1
attempts. Both follow the same recorded histories and retain20's optional safe
clock inspection. Require zero original-choice drift and independently replay
the actual taps. New suggestions are not physically played and do not imply a
winning continuation. Freeze actor sources during the trace.

Raw artifacts under .codex-runs/level-measure/: clock-slack-ranking-unit-01.log,
clock-slack-ranking-suite-01.log, find-clock-slack-fixture.js,
clock-slack-fixture-search-02.log and compare-clock-slack-ranking-decisions.js.
Current actor source5640bbcdb4e1213659a61f785e5fc7ccb9534658bd94f20e3de26c3b8ceae126.
