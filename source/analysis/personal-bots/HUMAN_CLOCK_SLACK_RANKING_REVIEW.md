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

Both new options remain disabled in the default19 profile. The diagnostics below
do not count as a measured campaign experiment; consecutive-unadopted count1.

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

## Actual-history comparison and preregistered experiment21

The comparison completes97 independently replayed taps with zero baseline
drift(native47203 exit0). Ten suggestions change over the first four attempts.
At the previously examined attempt3 tap16 position, the optional rank chooses
an actual required inspection of23 before removing the known22/80 pair. Its
report spends zero known clock moves along that prefix. The same rule already
changes attempt1's opening84->74, so this shared-history suggestion must not be
presented as the actual trajectory a new campaign will follow.

Register21: retained19 plus safeClockInspection:true and clockSlackRanking:true.
This tests an interaction with the unadopted20 route, rather than discarding it
after one failed campaign. Use actual19 baseline records, selectionv9's42 boards
and20 guards, with157 retained as a passing control. Three workers, development
salt1 first; full159 boards/salts1-3 only if the preregistered v2 qualifier
permits it. Adoption still requires a complete target repair, no passing target
regression, independent production replay and every actual move below2s.

Counter before21 is1; an unadopted21 makes2. No winning campaign or improvement
is claimed at registration. Pin source/profile, current catalog/selection,
evaluator, completed native trace and safety evidence before launch. Keep the
actor and default19 profile frozen during measurement. Record actual changed
decisions on helpful/harmful boards before fitting a WHEN condition if needed.

## Experiment21 result and actual decision comparisons

| Scope | Valid boards | Complete repairs | Target regressions | Partial gain | Slowest move | Mean minutes/board |
|---|---:|---:|---|---|---:|---:|
|Development,salt1|42/42|0|144,10045|10033:5->4|1642.7ms|0.403|

All three workers and supervisor13916 exit0. The full run is not launched;
the mixed result fails qualification. The consecutive-unadopted count is2.
Additional count changes remain inside target:10041:3->6,105:1->2,
10015:1->3.10049 worsens5->6 and remains outside target. Default19 is unchanged.

Actual baseline19 comparisons complete without drift on all three selected
development boards:144 has one changed suggestion over106 replayed taps(native
49886 exit0);10045 has45 over165 taps(native81533 exit0);10033 has21 over181
taps(native39930 exit0). These are452 independently replayed taps on shared
recorded histories, not new candidate campaigns. Original21 counts provide the
outcome evidence; suggested later changes are not individually labeled causal.

The sole144 change occurs with tray1, five clock moves left and estimated
access cost2: the previously adopted tight-clock recovery is active.10045's
first changes occur with estimated slack40, while10033's first change has
slack9. Later10045 changes overlap10033's tray/slack values, so those features
do not cleanly separate all suggestions. A condition that merely excludes
slack3 would not explain or protect10045.

## Candidate WHEN: public starting clock budget10-30

The visible starting clock budgets are6 on144,18 on10033 and48 on10045.
Testing the ranking only when the clock starts with10-30 moves separates these
selected boards using one public feature with round thresholds.10052's21-move
clock remains included. This is a development-fitted hypothesis, not proof of
generalization or safety; the unchanged fixed guards and full cohort must test it.
The actor contains no level IDs, per-board overrides or recorded routes.

Optional clockSlackRankingBudgetRange gates only the ranking term using the
public clock.n value; it does not change known-win/exit priorities or create a
proof. Inactive-gate controls require exact original search reports apart from
the gate's audit metadata, and invalid dependencies/ranges are rejected. All
126 tests pass16s(native49306 exit0). Default19 still enables neither new option.

The next actual-history diagnostic compares the gated candidate against20's
safe-inspection policy, checking that the ranking itself no longer changes
144/10045 while preserving changes on10033. Freeze the actor while it runs.
Source9027bc70dee5194feca7c936379bee38c4e7a3e57bd778702920af9c766f9b34.

## Gated comparison and preregistered experiment22

The gated candidate reproduces20's safe-inspection policy on all106 recorded
144 taps and166 recorded10045 taps: zero changed suggestions and zero baseline
drift(native63186/78125 exit0). On10033's first four actual20 attempts,84 taps
replay without drift and nine suggestions still change(native72067 exit0).
That is356 independently replayed taps. These controls establish conditional
activation on actual shared histories, not that new campaigns will win.

Register22: retained19 plus safeClockInspection:true, clockSlackRanking:true
and clockSlackRankingBudgetRange:[10,30]. Keep the exact42-board selectionv9,
20 fixed guards, passing157 control, actual19 baseline records and three workers.
Development salt1 first; full159/salts1-3 only after unchanged v2 qualification.
Adoption requires a complete target repair, no passing target regression,
independent production replay and actual moves strictly below2s. This WHEN
condition trial counts as one experiment; counter before22 is2, rejection makes3.

Pin the completed native traces, source/profile, current catalog/selection,
evaluator and safety evidence. The runner requires both inactive controls to
have zero changes/drift and the active10033 trace to have a changed suggestion.
Freeze the actor and default19 profile throughout measurement. No new campaign
gain or adoption is claimed at registration; full validation is still required.
Candidate profile29e4ccf222a8bf36677e8527d24123fcfed36fcd8d2a209dd0bc6c80fcf361c2.
