# Real-board planner experiments

These use the current real-board gates. Old salt-screen and certified re-deal
experiments are archived separately and do not count toward this eight-trial batch.
No private pictures, future reveals, target counts or level IDs enter a policy.
Certain deductions may enter trusted picture memory only with a rule-supported
proof covering every consistent hidden board; agreement of sampled boards is not proof.

## Experiment01: complete public-memory retry witness

Pre-run design: preserve first-try behavior and existing constructive wins. On a
retry whose alive pictures are all known, seek a complete winning physical route.
Search is positive-only: capped or failed searches do not prove impossibility and
return the primary plan unchanged. Respect remaining physical-choice allowance.
Global profile is baseline dc0d1ecd18b9fcc9c860187df2a9ae3bf7abcc56361e201aa2f94d0eb87a78f2
plus retryCompleteWitness=true, retryCompleteMs=250, retryCompleteNodes=2000.
Implementation aa610a7;113/113 reference tests pass, including production retry replay.

Comparator: corrected baseline-v2, source
596e37bde6e1c996ad068614c888e30ac29d1d14e8670d6d4f7bddf876f48618.
Reuse its actual measurements without a redundant baseline run. Real boards and
salts1,2,3 remain identical; max12 actual tries/salt, at most12 game workers.
Development selection hash:
806fc19e13ee57989fcc8bd4d8ca785020e858ca1c5da50a3f1d3fca79b93b1d.
Failing levels:86,144,150,10011,10015,10032,10033,10041,10049,10052.
Twenty passing guards:33,36,39,42,49,52,54,72,77,78,91,92,97,102,103,105,110,114,123,124.
Run these30 first; if a failing level is repaired and no passing level breaks,
run the other125. Adoption requires the same condition on the full155 boards,
all independent replays valid and every move under2s. Default profile remains
unchanged until full qualification. A valid rejection counts as one unadopted trial.

Raw profiles, frozen source bytes, native process exits, action sequences and
summaries: .codex-runs/level-measure/experiment-01/.

Result: valid30-board development check, no fixes and no regressions. Every
try count matched baseline. Slowest1504ms; mean1.825 minutes/development board.
All12 native workers closed0; supervisor session64218 exited0. All4722 extra
search opportunities had incomplete public picture memory, so no complete search
ran and no route was changed. Increasing its node/time budget cannot address this
particular bottleneck. Rejected; default unchanged; one consecutive unadopted trial.

| Trial | Change | Boards | Fixed | Broken | Slowest | Decision |
|---|---|---:|---:|---:|---:|---|
|01|Complete-memory retry witness|30|0|0|1504ms|Reject; incomplete memory|
|02|Clock recovery at any tray load|155|2|7|1514ms|Reject; passing levels broken|
|03|Clock recovery with a carried tile|37|3|1|1509ms|Reject; lab10045 broken|
|04|Carried-tray recovery + information routes|37|4|1|1745ms|Unadopted; WHEN analysis required|
|05|Carried tray + estimated clock slack>=50|155|1|2|1790ms|Reject;53 and112 broken|
|06 control|Fresh baseline at3 workers|38|0|0|1502ms|All38 try counts identical|
|06|Same WHEN strategy at3 workers|155|1|0|1683ms|Adopted after paired controls and full validation|
|07|Remember observed key identities|38|1|1|1678ms|Unadopted; public WHEN refinement required|
|08|Public clock gate for remembered keys|155|1|0|1696ms|Adopted after full validation|

## Experiment02: clock recovery before deeper digging

Pre-run design: baseline profile plus clockRecovery=true, with no other profile
change. Existing strategy evaluates known recovery depth and tray pressure before
deeper clock digging when the public clock budget has more than two spare moves
over the route lower bound. Tight clocks and nonclock play retain their existing
logic. This tests whether improving preparation helps reach unexplored tiles
without filling the tray. Complete-memory trial01 remains an unadopted candidate.

Same baseline-v2 comparator,30-board selection/hash, salts and adoption conditions
as trial01. Existing clock-recovery production tests and hidden-world invariance
checks are included in the passing113-test suite. No source code changes since
aa610a7; source3c87db493e0d3d28c865f624e110743b380d570f49d5fd921d074e34c562be01.
Raw profile and outputs: .codex-runs/level-measure/experiment-02/.

Development30 passed the preregistered comparison: repaired86 and10015, no broken
guard. The full155-board run is complete and valid: repaired86 and10015 but broke96,
106,112,10044,10045,10046,10048. Rejected; original baseline retained.146/155 clear
all salts,140/155 within Dennis+1; all four gates remain unmet. Full totals and
correlation stay unresolved due to censored campaigns; cleared-only diagnostic
Spearman-0.2302. Mean1.024 minutes/board; slowest1514ms. All24 native workers closed0
and supervisor session70871 exited0. Two consecutive unadopted experiments. Raw
full-summary.json and full-report.md are preserved; development alone never qualified adoption.

## Experiment03: recover only with a carried tray tile

Pre-run design: baseline plus clockRecovery=true and trayRecoveryClockMin=1.
This preserves the ordinary clock ordering with an empty tray and evaluates
recovery only after carrying a tile, while retaining the public spare-time gate.
This is a parameter refinement of trial02, not abandonment of that strategy family.
No algorithm source or original board changes. Tests for this threshold and
hidden-world invariance are included in the passing114-test suite.

Use the original ten failing levels and twenty fixed passing guards, plus the six
known trial02 regressions and slow pending lab10045:37 development boards. Extra
controls:96,106,112,10044,10045,10046,10048. Selection hash:
fd1face920f153e7483e7829b06d44fa62a266deb1eaf05ab5b5e6651a5921d0.
Comparator remains unchanged baseline-v2. Same adoption rule and salts1,2,3.
Use11 workers so the final trial02 worker can finish within the combined12-game
worker cap. Trial02 is already disqualified by confirmed regressions; it will not
dispatch any further phase. No running bot source is edited. If development
qualifies, run the other118; full155 remains required before adopting anything.
Raw profile, native exits and outputs: .codex-runs/level-measure/experiment-03/.

Result: all37 valid, repairs144,10015,10041; breaks10045 from3/3/3 to uncleared
on every salt. Six other regression controls restored. No adoption; no redundant
118-board remainder. All11 workers closed0; supervisor session75861 exited0.
Mean1.824 minutes/development board, slowest1509ms. Three consecutive unadopted trials.

## Experiment04: combine carried-tray recovery with information routes

Pre-run design: trial03 global profile plus retryInformationWitness=true,
retryInformationMs=250 and retryInformationNodes=2000. The added strategy only
activates after an actual physical loss that learned no new picture, orientation
or starting-role fact. It preserves the primary known win/safe clock exit, seeks
a known physical prefix to new public information, and leaves an unknown peek's
picture unknown until the actual observer learns it. New actual knowledge stops
the intervention immediately. Failed/capped searches retain the original plan.
An1800ms shared outer window and remaining real choice budget bound the search.

This tests the combination, retaining the three repairs while trying to rescue
the stalled lab10045 route and other original failures. No per-level settings,
target count inputs, imagined picture promotion or free physical restarts.
Same37-board development selection fd1face920f153e7483e7829b06d44fa62a266deb1eaf05ab5b5e6651a5921d0,
same original baseline-v2 comparison. Require a repaired failing level and no
passing regression; only then run the remaining118. Full155 validation is required.
All prior native runs are terminal; use up to12 game workers.
Source: ce05009a4d369e0c0ad2723dac15e6b44c80e52184019be429b5c6e60ea42647.
Profile:39211a414cbe9575b4e34a4b5edc236e6c6ed88d733d2fda18f30ebe6d5cd9ca.
All116 reference tests pass12s, including actual post-stall hidden-pair swaps and
independent replay of failed/winning attempts; info-campaign-reference-tests-02.log.
Raw profile, frozen source and outputs: .codex-runs/level-measure/experiment-04/.

Result: all37 valid; repaired144,150,10015,10041; lab10045 remained broken. All12
workers closed0 and supervisor session12281 exited0. Mean1.906 minutes/development
board, slowest1745ms. Four consecutive unadopted experiments. This mixed strategy
is retained for conditional selection, not discarded.

## Revised goal: Track A first and public WHEN conditions

Dennis's cc8ea8eb objective separates strongest clearance from later Dennis-strength
calibration. Development now uses salt1, with salts1-3 across the full cohort before
adoption. Track A gates are clearance and Dennis+1; old total/correlation diagnostics
remain preserved but do not gate Track A. Track B has not started.

## Experiment05: ample-clock-room WHEN condition

The decision comparison is in HUMAN_WHEN_DECISION_ANALYSIS_V1.md. It independently
replayed1340 actual taps on repaired and broken boards and listed differing moves
with public position features. First-attempt clock changes isolate this strategy
from later retry-information search; that fitting subset has zero replan drift.
The full trace discloses13 replan differences on later clock-off level150 positions.

Condition fitted before execution: start a clock-recovery plan only when the tray
holds at least1 tile AND estimated spare clock moves are at least50. Exactly two
public features, round thresholds; no level IDs or hidden information. This retains
four early changes on lab10041 and no first-attempt changed move on broken lab10045.
It is a hypothesis requiring retest; no individual changed move is claimed causal.
The public route-cost estimate is not an exact shortest route or lower bound; the
earlier trial02 design's lower-bound wording was inaccurate. Production replay is
the authority. Retry-information search remains separately enabled after a real
loss with no new remembered tile fact, so the clock-off level150 improvement remains available.

Global profile: retained baseline plus clockRecovery=true, trayRecoveryClockMin=1,
clockRecoveryMinSlack=50, retryInformationWitness=true, retryInformationMs=250,
retryInformationNodes=2000. Source901550e360d574ab5efe898b5ca410f9e7bd7e9a81b2a82ae93e7f666696b6ab.
Profile92b1c12b829d93187b1dc27efd6c8c7760120283ed419f890af879d0b4946049.
Fit input SHA256 cb11be0bfd00c9e74cd7a270abbb5b5bf51f93ad78611a1bac5481902ae1a5e3.

Run37 development boards from selection fd1face920f153e7483e7829b06d44fa62a266deb1eaf05ab5b5e6651a5921d0,
salt1. Compare selected actual frozen baseline campaigns, preserving hashes and
censored outcomes. Only if a failing board is repaired with no passing regression,
run all155 boards afresh with salts1,2,3. Require the same improvement condition
and independent replay/under2s timing across the full cohort before adoption.
Read-only catalog refresh2026-10-25T16:50:45.929Z confirms the same155 records,
unchanged clear counts and identical normalized board hashes. No targets omitted.
All117 reference tests pass27s, including joint threshold boundaries, hidden-world
invariance, salt1 development/full-salt transport and the revised Track A contract.
Raw: .codex-runs/level-measure/when-reference-tests-02.log and experiment-05/.
This WHEN-condition trial counts toward the eight-trial stop rule; four precede it.

Result: all155 valid;148 clear all salts and144 stay within Dennis+1. Repaired150
(4/3/4 versus >12/2/>12) but broke53(>12/>12/>12 versus1/1/1) and112(4/11/3
versus2/2/2). All24 native workers closed0; supervisor7697 exited0. Mean2.700
minutes/board; slowest1789.7ms. Rejected. Five consecutive unadopted experiments.
Development qualification alone did not qualify adoption. Original baseline retained.

Execution diagnostic: eight sampled concurrent workers received0.39-0.49 CPU seconds
per wall second. The cause is not established. Same-source first-try canaries on53
show baseline and candidate producing identical67-tap losses under load, versus
identical91-tap first-try wins in quiet runs. Quiet112 controls both clear on try2
with identical151 taps across attempts. Those canaries are diagnostics, not replacements
for the rejected full run. No level-specific condition is fitted to these regressions.
Raw: first-try-equivalence-53.jsonl, first-try-equivalence-quiet-53.jsonl,
retry-equivalence-quiet-112.jsonl; native71148,58954,12690 all exited0.

## Experiment06: matched execution of the unchanged WHEN strategy

Pre-run: candidate actor/source901550e360d574ab5efe898b5ca410f9e7bd7e9a81b2a82ae93e7f666696b6ab
and profile92b1c12b829d93187b1dc27efd6c8c7760120283ed419f890af879d0b4946049
stay identical to05. Exactly3 concurrent single-thread game workers; no overlapping
owned game audits. Fresh baseline development controls followed by fresh candidate
development, both salt1 on the same38 boards. Preserve the20 original guards and
all7 earlier regression controls, adding53;112 is already included. Record per-board
CPU and elapsed time as execution metadata only, never as policy inputs.

Require a genuine fix against the fresh paired control and no regressions against
either that control or historical baseline-v2. If development qualifies, run the
full155 candidate boards, salts1-3, with3 workers. Full qualification requires a
fix and no historical passing board broken, plus no fresh development pass broken
on salt1. Preserve independent replay, hashes and under2s/move checks. Qualifying
is not automatic adoption; inspect source and terminal exits first. This is trial06,
with five consecutive unadopted experiments before it; failure raises the count to6.
No new public threshold or policy component is added during this compute control.

Foundation commit7e36eb5 adds119/119 passing tests(log role-foundation-reference-tests-02.log),
CPU diagnostics and two unused public role components. Neither new component is wired
into this experiment's policy. Drawn-back-role exposure and positive observed key
identity retention are future strategy leads, not claimed real-board improvements.

Execution started with codeCommit05f88dd; selection hash
0e9fe8ae5e7effae4b55feead6ce58f979f99ff41b95dd136b707b4b72b216ac.
Read-only catalog refresh2026-10-25T18:04:44.130Z confirms155 unchanged boards and
targets. Fresh baseline control completed38/38 valid; all38 exact try counts match
the historical salt1 measurements, with zero fixed/broken boards. All3 native
workers closed0. Slowest1502.3ms; mean CPU seconds/wall second1.048(minimum1.002).
Candidate development is now running with the same3-worker cap. No adoption yet;
five completed unadopted experiments remain the count until06 terminates.

Development completed38/38 valid: repaired150 from>12 to4; no fresh-control or
historical passing board broken. Slowest1683.6ms; mean0.408 minutes/board(salt1).
Mean CPU seconds/wall second1.039(minimum0.999). All3 candidate workers closed0.
The full155-board candidate run, salts1-3, started2026-10-25T18:17:17Z with3 workers.
This does not qualify adoption until the full comparison and terminal exits pass.

Final06: all155 valid,149 clear on every salt and146 stay within Dennis+1 on every
salt. Repaired150(4/2/3), no historical or fresh-control passing regression. All9
native workers and supervisor55767 exited0. Slowest1682.7ms; mean0.610 minutes/board
for3 salts. Mean CPU seconds/wall second1.040(minimum0.992). The baseline control
exactly reproduced all38 historical salt1 try counts before this comparison.

Adoption verification re-summarized the raw full shards, recomputed both comparisons,
verified all67 actor-source files and all9 native exits, and refreshed every155
recorded board/count at2026-10-25T18:52:58.716Z without a change. Verifier43116 exited0.
Default profile now exactly equals tested92b1c12b829d93187b1dc27efd6c8c7760120283ed419f890af879d0b4946049.
Only the imported default JSON changed from measured source901550e360d574ab5efe898b5ca410f9e7bd7e9a81b2a82ae93e7f666696b6ab
to adopted9dfcc78af25b327f78747b6dd3c3bc117d9e245b291b6e0b68156457a6ee92bf;
the policy code and effective configuration are identical to the full tested actor.

Post-adoption119/119 reference tests pass13s(native77445 exit0). Default CLI from an
unrelated working directory independently clears out-of-cohort lab61 in1/1/1,
valid, slowest330.3ms(native33181 exit0). Raw adoption-verification.json,
adopted-profile-mapping.json, adopted-reference-tests-01.log and adopted-lab61.json
are in experiment-06/. Adopted. Consecutive unadopted count resets to0; rejected
trials01-05 remain preserved. Track A still has nine open boards and Track B has
not started. Next priority is the prepared, independently audited typed key-memory
change; it still requires integration tests and a separate measured experiment.

## Experiment07: retain positive observed key identities across retries

Pre-run: adopted06 profile plus rememberKeyIdentities=true only. A key identity
enters memory solely when its glyph actually passes the ONE observer. It survives
same-board/salt retries and later masking, including removed keys needed to retain
known group membership. It does not overwrite starting-role enums or prove absent
ice/locks or future availability. Existing legality and conditional proofs remain
authoritative. Typed identities feed planning dependencies and observed-key proof
inputs. Learning a new positive key identity ends the no-learning retry intervention.
Hypothetical-world sampling is disallowed with this flag until its consistency
constraints support the same typed facts. No sampled picture is promoted.

Implementation138f005;120/120 reference tests pass13s(native21379 exit0). The new
production test independently replays a forced failed attempt and a winning retry,
including an initially concealed ice/key combination. Public observations preserve
the key identity without pretending its starting ice state was known. Concealed
picture/role swaps preserve decisions with an actually visible remembered key.
The three-salt measurement API retains actual fact provenance under optional
runs[].keyIdentityEvidence. Legacy known() and default profile remain unchanged.

Candidate source635aaa9a0e83f0b77e161fee513d4d108376d1579860aec40fd9b6289175b8b5;
profile2fc9966413161a1eda9647fa046297961325698cb96b76b83ae70bd5a8f850f3.
Comparator: adopted06 actual full155 measurements(source901550e360d574ab5efe898b5ca410f9e7bd7e9a81b2a82ae93e7f666696b6ab,
profile92b1c12b829d93187b1dc27efd6c8c7760120283ed419f890af879d0b4946049)
on identical real boards/salts with3-worker execution. Reuse those measurements;
do not rerun unchanged controls without a new unresolved runtime concern.

Keep all20 original guards and nine regression controls, including newly repaired150:
38 salt1 development boards, selection814f23241150ab0645b1e8c48954a3eef28d296544cc52c4c90d701e197aec3b.
Nine current failures:86,144,10011,10015,10032,10033,10041,10049,10052. At most3
single-thread games, unchanged250ms/2000-node retry bounds, max12 actual tries.
Only a repaired failing board with no formerly passing regression qualifies for
a fresh full155 run on salts1-3. Adopt only after the same rule, independent replay
and strict under2s timing pass on the full cohort. Refresh recorded targets before
launch. If results are mixed, compare actual public histories and fit a readable
WHEN condition with at most2 public features before retesting that strategy.
Consecutive unadopted count before07 is0; rejection makes it1. Drawn-role planning,
tight-clock recovery and larger retry budgets remain separate unexecuted candidates.
Raw outputs and frozen source bytes: .codex-runs/level-measure/experiment-07/.

Result07:38 valid development boards; repaired10041(>12 to3), broke10045(3 to>12).
Already-failing10011 worsened8 to>12 and is retained as an additional negative
diagnostic case. Other controls, including150, remain passing. All3 workers and
supervisor81588 exited0. Slowest1678.2ms; mean0.406 minutes/board; mean CPU/wall1.044.
No full run or adoption. Consecutive unadopted count1 since06. Keep the key strategy
family and compare actual public histories before another conditional test.

## Experiment08: ample public clock slack for remembered-key planning

HUMAN_KEY_WHEN_DECISION_ANALYSIS_V1.md documents1068 independently replayed taps
on repaired10041, broken10045 and worsened10011. Both controllers see the same
actual history; candidate suggestions have zero replan drift. Public threshold
fitting retains11/12 helpful differences and none of the14 regression or20
worsening differences. This is a hypothesis supported by one helpful board,
not proof of individual move causality or future performance.

Candidate: adopted06 plus rememberKeyIdentities=true and keyPlanningSlackAbove=40.
Start adding remembered-key planning dependencies only while the live clock has
more than40 estimated spare moves. One public feature, strict round threshold40.
The estimate includes actually observed key identities and observed mechanics;
it is not an exact shortest route or a safety certificate. Actual facts remain
in memory and new observations remain truthful learning while planning is gated.
An already constructed valid physical prefix can continue beyond the threshold.

Implementation8f158df;120/120 tests pass13s(native64805 exit0), including40/41
boundary with known key/lock route cost, missing/taken clocks, private-field guards,
gated-off memory retention, production failed/winning retries and hidden-world
invariance. Candidate sourcea1fb03cddd38de5dcaabe63420231a86cf268734a7f2ddaf06137fb442c353dd;
profile7c0908b9755341f125f58cf96d22da1fd7793efc146d3bcbcf4e33f5b961f0ba.
WHEN input/fit SHA256 c7379a003c2cb825c8b0e7092884a28db2967c67642a6663634bff47c42ea935.

Reuse adopted06 actual comparator and selection814f23241150ab0645b1e8c48954a3eef28d296544cc52c4c90d701e197aec3b:
38 development boards, salt1;20 fixed guards and all regression controls retained.
Three game workers, same250ms/2000-node retry bounds and max12 actual tries.
Refresh every recorded target before launch. Only a fix with no passing regression
qualifies for a fresh full155 salts1-3 run and the same adoption rule. Every attempt
independently replays; every actual move remains strictly under2s. Counter before08
is1; rejection makes it2. A WHEN trial counts;07 remains preserved as unadopted.
Raw profiles, source snapshots and native exits: .codex-runs/level-measure/experiment-08/.

Development08 completed38/38 valid: repaired10041(>12 to3), restored10045 to3,
and retained10011's8-try clear. No previously passing board broken, including150.
Slowest1697.6ms. All3 native development workers exited0; the parent83808 remains
live and dispatched the full155-board run with salts1-3 at3 concurrent games.
Development qualification is not adoption; consecutive unadopted count remains1
until the full result. Default profile remained validated06 during that full run.

Final08: all155 valid;150 clear on every salt and147 meet Dennis+1 on every salt.
Repaired10041 to3/3/3, no formerly passing board broken.10045 stays3/3/3 and10011
stays8/8/8;150 retains4/2/3. All6 native workers and supervisor83808 exited0.
Slowest1696.4ms, mean0.579 minutes/board for3 salts. Mean CPU/wall1.039(minimum0.995).

The post-run verifier re-summarized the raw full shards, recomputed full and
development comparisons, verified all68 actor files and the unchanged validated
harness, and refreshed all155 recorded boards/counts at2026-10-25T22:25:48.691Z.
No target or board changed; verifier71532 exited0. Only the default profile JSON
changed from measured sourcea1fb03cddd38de5dcaabe63420231a86cf268734a7f2ddaf06137fb442c353dd
to adoptedddf4f93bb9ed465ed1e125bde235272750a60a07dbf8665632ef02ec4e23ff04.
The default now exactly matches tested profile7c0908b9755341f125f58cf96d22da1fd7793efc146d3bcbcf4e33f5b961f0ba.

Post-adoption120/120 tests pass19s(native37192 exit0). The privacy test explicitly
retains both ungated and gated configurations after the default changes. CLI from
an unrelated working directory clears out-of-cohort lab61 in1/1/1, valid,
slowest477.1ms(native36319 exit0). Raw evidence: experiment-08/adoption-verification.json,
adopted-profile-mapping.json, adopted-reference-tests-01.log and adopted-lab61.json.
Adopted. Consecutive unadopted count resets to0;07 remains preserved as rejected.
Track A still has eight open boards; Track B has not started. Drawn back-role
information planning is the next prepared strategy, requiring integration tests
and its own development/full comparison.

## Experiment09: plan to uncover drawn symbols on tile backs

Preregistered: adopted08 plus drawnRoleInformation:true only. The actor predicts
which symbols a route will expose, never their values or the concealed pictures.
Actual observations provide those values. The user's certain-picture clarification
remains: a deduction true in every publicly consistent world may enter trusted
memory; sampled consensus may not. Existing actual-match inference retains proofs.

All121 reference tests pass15s, native82092 exit0. New controls check ordinary and
retry information routes, unknown orientations, concealed-picture invariance and
independent production replay. The default adopted08 profile remains unchanged.
Source379c955f3f43241b2b1b9dbc42164457a5f34c5e5a68ea8c134949cd0de8456c;
candidate profilefed1cea23586b8d73b37590dcbe0f51a5c3e840ed2ae16859da087202ea06b32.

Development selectionv5 keeps all38 levels and20 guards;10041 becomes a passing
regression control. Selection1649eb3c5bb8ed21be4c442f5a0442204f820fede7dbbabd05d4e073c62c4574.
Comparator: adopted08 full raw shards, sourcea1fb03cddd38de5dcaabe63420231a86cf268734a7f2ddaf06137fb442c353dd,
profile7c0908b9755341f125f58cf96d22da1fd7793efc146d3bcbcf4e33f5b961f0ba.
Refresh targets, run3 game workers, salt1 development; only a repair without any
passing regression qualifies for full salts1-3. Same12-try, strict2s and replay
gates. Mixed outcomes require public WHEN analysis. Counter before09 is0;
rejection makes it1. Raw evidence: .codex-runs/level-measure/experiment-09/.

Final09 development:38/38 valid, all3 workers and parent29797 exit0. Slowest1503.3ms.

| Scope | Repairs | Passing regressions | Other worsening | Decision |
|---|---|---|---|---|
|38 real boards, salt1|10033:>12 to3|102:3 to7;150:4 to6|10011:8 to>12|Reject unrestricted change|

No full run dispatched. Default08 retained; consecutive unadopted count1. Compare
actual09 public histories on10033,102,150 and the10011 worsening before fitting
a condition with at most2 public features. Raw comparisons: when-drawn-role-v1/.
