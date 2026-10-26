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

## Experiment10: clock-gated drawn-back-symbol information planning

Preregistered after09 public-history comparison: adopted08 plus drawnRoleInformation:true,
drawnRoleClockSlackRange:[5,20]. Start the added planning only with a live clock and
5-20 estimated spare moves. One public feature, round endpoints, no board IDs.
The actual observations and remembered facts remain available outside the gate.
Detailed fit and limitations: HUMAN_DRAWN_ROLE_WHEN_DECISION_ANALYSIS_V1.md.

All1909 comparison taps independently replayed; four trace commands exit0. The
implemented predicate matches the fitted feature on all658 differing/drift
positions. All121 reference tests pass14s(native76506 exit0), including interval
boundaries, missing/taken clocks, known-key dependencies, invalid settings,
controller exposure behavior and hidden-picture invariance.

Candidate source97f6aa2ca756fd64e249945053bc3a352d89d1a764bad4212d7d81d5f23db675;
profile6b6094dc0a84e0e1988a9f3e3585863da68ddc0a2a00d554d8214c18b7bb21a1.
WHEN fit SHA2560a263696bbd33d29547194b4ed8bb8dda69b292ea9bbebbe9d2a6f8d16403e86.
Use the same v5 selection,38 development boards and adopted08 full-shard
comparator as09. Refresh targets before launch;3 game workers, salt1 development,
then all155 salts1-3 only after a repair with no passing regression. Preserve
strict2s/move,12 actual attempts and independent production replay. Default08
stays frozen during testing. Counter before10 is1; rejection makes it2.
Raw evidence: .codex-runs/level-measure/experiment-10/.

Development10:38/38 valid, all3 native workers exit0. Slowest1673.7ms.

| Scope | Repairs | Passing regressions | Previously worsened controls | Decision |
|---|---|---|---|---|
|38 real boards, salt1|10033:>12 to5|None|102:3;150:4;10011:8 restored|Run full155 salts1-3|

Parent85182 remains live with3 full-run workers. This is development qualification,
not adoption. The default stays08 and the counter remains1 pending full results.

Final10: all155 measurements valid; all6 native workers and parent85182 exit0.

| Scope | Clear every salt | Dennis+1 every salt | Repairs | Passing regressions | Decision |
|---|---|---|---|---|---|
|155 real boards, salts1-3|151/155|148/155|10015:1/3/3 instead of1/>12/>12|None|Adopt10|

The development repair10033 is partial in full validation:5/>12/5, so it remains
open.10011 stays8/8/8,10041 and10045 stay3/3/3, and150 stays4/2/3. Slowest1641.7ms;
mean0.539 minutes per board for all3 salts. Mean CPU/wall1.0434(minimum1.0015).

Verifier71461 exit0 re-summarized all raw shards/comparisons, checked all69 actor
files against the frozen snapshot and the unchanged validated harness, and
refreshed all155 boards/targets at2026-10-25T23:34:45.913Z. The catalog is unchanged.
Only the default profile JSON changed from measured source97f6aa2ca756fd64e249945053bc3a352d89d1a764bad4212d7d81d5f23db675
to adopted05fd8d1b70c20af0f66865a8f88dca77abde5799996263644527ee1821d693e5.
Default profile now exactly matches tested6b6094dc0a84e0e1988a9f3e3585863da68ddc0a2a00d554d8214c18b7bb21a1.

Post-adoption121/121 tests pass14s(native51930 exit0), with an explicitly ungated
drawn-role privacy control retained after changing the default. CLI from an
unrelated working directory clears out-of-cohort lab61 in1/1/1, valid,
slowest361.3ms(native25642 exit0). Raw mapping, verification, CLI and test logs
are in experiment-10/. Adopted; the consecutive-unadopted counter resets to0.
Track A still has seven open boards; Track B has not started. The next prepared
strategy is observed-safety transfer, requiring actual integration and a fresh
development/full test. Keep10015 as a passing regression control;10033 still fails
full salt2 despite passing salt1, and must remain in the open-failure list.

## Experiment11: observed-key safety transfer without placement bounds

Preregistered: adopted10 plus observedSafetyTransfer:true only. A real safety
witness while an actually observed key was alive excludes a lock; an equally
large count of removed starting neighbors discharges any ice sufficient at that
witness. Candidate geometry must be free. No role exclusivity, key-count cap,
ice-strength cap, board ID or hidden picture is assumed. Relief witnesses are
excluded. This expands availability proofs, not remembered picture identities.

Component checks cover9000 production-rule transfers and two actual winning
routes; the controller controls independently replay a real failed try and a
different winning retry. The actual full123/123 suite passes14s(native53085
exit0), including private-data invariance, label-free API counters and isolation.
Detailed proof: HUMAN_OBSERVED_SAFETY_TRANSFER_DRAFT_REVIEW.md.

Candidate sourceb06c8480613f55dd602725c2d76180b80e6dabeb4e97ebf964516306d7c112fd;
profile9b3adc9864e7b5fb3c38f263d220a45d44b72c07588bfcab57cebec9f74e741e.
Comparator: adopted10 full raw shards, measured source97f6aa2ca756fd64e249945053bc3a352d89d1a764bad4212d7d81d5f23db675,
profile6b6094dc0a84e0e1988a9f3e3585863da68ddc0a2a00d554d8214c18b7bb21a1.
Selectionv6 keeps all38 levels and20 guards; repaired10015 becomes a passing
control.10033 remains a full salt2 failure. Selection SHA256
af55b91518324bf9602f02ba2c4ef76da3f5eab82d4cdc4ca7489a472b96a198.

Refresh targets before launch. Use3 workers, salt1 development, then full155
salts1-3 only after a development repair without a passing regression. Preserve
strict2s/move,12 actual tries and independent production replay. Mixed outcomes
require public WHEN diagnosis; do not reject without comparison. Default10 stays
unchanged during testing. Counter before11 is0; rejection makes it1.
Raw evidence: .codex-runs/level-measure/experiment-11/.

Final11 development:38/38 valid; all3 native workers and parent31891 exit0.
Slowest1502.5ms. No formerly passing development board broke, but no full
Dennis+1 failure was repaired in this salt1 check. No full run dispatched.

| Scope | Partial improvements | Other worsening | Gate repairs | Decision |
|---|---|---|---|---|
|38 real boards, salt1|10049:>12 to5;144:5 to4|10011:8 to>12|None|Do not adopt; diagnose mixed behavior|

Actual transfer proofs were used:10049 had8353,144 had1306 and10011 had68276.
These are query-level proof hits, not unique facts or accuracy measures. The
improvements still miss their limits(10049<=3,144<=2). Default10 is retained;
consecutive-unadopted count becomes1. All other development try counts match10.
Compare actual public histories of144,10049 and10011 before selecting a WHEN
condition or discarding the strategy. Raw comparisons: when-observed-safety-v1/.

## Experiment12: live-clock observed-key safety transfer

Preregistered: adopted10 plus observedSafetyTransfer:true and
observedSafetyClockOnly:true. The one-feature condition comes from934 actual
replayed11 decision-history taps:9 changes on partial improvements were all
clock-on;97 on the worsening case were all clock-off. Zero strategy replan drift.
Detailed fit, proof semantics and limitations:
HUMAN_OBSERVED_SAFETY_WHEN_DECISION_ANALYSIS_V1.md.

All123 reference tests pass14s(native94467 exit0), including live/missing clocks,
first-attempt isolation,48 independent physical retry-control taps, composite
roles, private-data invariance and invalid configurations. No hidden fact is
supplied, and actual memory persists when the planning condition is false.
Source0036f3233c40087c4db422ea14a103806ceb1177fc04c602be1c5a0e7828df08;
profilea620f081b9a1efd8c3c6c972c106c4e7746da81f62ffc03f7c1c8d7ef987a110.
WHEN fit SHA2561a68307ca2ac119579862d57473d64a3696db4a1b68f60bc4b186250e1ec2fb8.

Use the same adopted10 full comparator and v6 selection as11:38 development
levels,20 fixed guards,10015 retained as a passing control. Refresh all targets,
run3 game workers, salt1 development, max12 actual tries, strict2s/move and
independent production replay. Default10 stays unchanged during the experiment.

An ordinary development gate repair without regressions advances to full testing.
The preregistered off-salt-full-check-v1 protocol also permits a full check after
partial development gains only when there is no passing regression or lost prior
clear and an existing other-salt failure(86/10033) cannot be tested by salt1.
The same final full-repair/no-regression adoption rule remains mandatory. The
auditor rechecks raw development, source/helper hashes, projected salt1 controls
and a real full repair of an off-salt target if that exception is used.
Qualification helper SHA25619db395fc287c558b0678fd13a23c202b5509af86d6252e9f6ced08914fb52ab;
8 synthetic controls and the real11 rejection check pass. Benchmark/evaluator
source unchanged. Counter before12 is1; rejection makes it2. Raw profiles,
snapshots, qualifications and native exits: .codex-runs/level-measure/experiment-12/.

Development12: all38 valid, all3 native development workers exit0. Slowest1639.2ms.

| Scope | Partial gains | Restored earlier clear | Passing regressions | Full-test decision |
|---|---|---|---|---|
|38 real boards, salt1|144:5 to4;10049:>12 to5|10011 stays8|None|Check other-salt failures under preregistered protocol|

There is no formal salt1 Dennis+1 repair. The recorded qualification has no
clearance regression, partial gains144/10049 and existing off-salt targets86/10033.
Parent46925 remains live with3 full-run workers. This is testing eligibility,
not adoption; default10 stays retained and the unadopted counter remains1.

Final12: all155 valid, all6 native workers and parent46925 exit0. Slowest1640.2ms;
mean0.536 minutes/board for3 salts. Full comparison has no Dennis+1 repair and a
passing regression on10041. The other-salt targets86/10033 were not repaired.

| Scope | Partial improvements | Passing regression | Clear every salt | Dennis+1 every salt | Decision |
|---|---|---|---|---|---|
|155 real boards, salts1-3|144:4/1/1;10049:5/3/5|10041:3/>12/6 instead of3/3/3|151/155|147/155|Reject; retain10|

The clock condition restores10011 to8/8/8 but does not protect10041 on salt2.
10049 now clears all three salts, yet5/3/5 still misses its<=3 limit. Counter
becomes2. The declared off-salt qualification triggered a full test, not an
adoption exception; the unchanged final rule correctly rejects this result.
Next: compare actual12 histories on existing development boards144(salt1),
10049(salt1) and regressed10041(salt2). Record this data scope explicitly before
fitting another public WHEN condition. Raw traces: when-safety-clock-v2/.

## Experiment13: bounded-clock proofs and tight-clock preparation

Preregistered combination against adopted10: observedSafetyTransfer:true,
observedSafetyClockOnly:true, observedSafetyMaxClockSlack:30,
tightClockRecovery:true and tightClockRecoveryMaxSlack:5. Expanded safety
planning requires an active clock with estimated spare moves<=30. The separate
new recovery branch requires exactly one tray tile and3-5 estimated spare moves;
the existing ample-clock recovery condition is retained. Each condition uses at
most2 public features and no board IDs or hypothetical pictures.

The refined proof gate comes from741 actual12 taps on existing development
boards144/10049 salt1 and regressed10041 salt2. It keeps9 helpful-case changed
positions and excludes53 regression positions; all trace commands exit0 and
strategy replan drift is0. The implementation matches the fitted predicate at
all62 changed positions. Tight-clock preparation uses the earlier published04
development-only fit. This combination tests interaction; it does not claim
separate campaign gains before measurement. Detailed data scopes and caveats:
HUMAN_COMBINED_CLOCK_POLICY_V1.md.

All123 reference tests pass17s(native66393 exit0), including72 actual retry-control
taps, clock/tray/cap boundaries, preserved ample-clock behavior, a production
clock clear and standalone/combined concealed-world invariance.
Source120aee30205ecb739ccec79c640414b017e304044cd73d8816526f7d5b78f8a0;
profile16dc83e7ac0e06b5b456928684584aa890fe2face5936b4dd2c5ea273e758146.
Safety fit SHA2560aa16f10d5a74bbf736bb5842df9740187360dc68abdaa8a1f7fe35dccf9fd1d;
tight fit SHA25613e1c96078e15537ffa018a160fcb08860cbedbd09b1650962e682c657a6fe79.

Same adopted10 full comparator, selectionv6,38 development levels and20 fixed
guards. Refresh targets,3 game workers, salt1 development, max12 actual tries,
strict2s/move and independent production replay. The declared off-salt-full-check-v1
qualification may advance guarded partial gains to full testing, as in12; the
unchanged full adoption gate remains an actual three-salt Dennis+1 repair with
no passing-board regression. Default10 remains unchanged. Counter before13 is2;
rejection makes it3. Raw profiles, snapshots and exits: experiment-13/ under
.codex-runs/level-measure/.

### Experiment13 cohort expansion before any games

The initial13 preflight detected four new recorded clears and exited1 before
launching any game worker. Its dispatch and actor snapshot remain archived as
experiment-13-startup-catalog-v1 and frozen-120aee30205e-experiment13-startup-catalog-v1.
No strategy result was measured; the consecutive unadopted count remains2.

Fresh catalog observed2026-10-26T02:48:32.393Z preserves all155 previous boards
and targets unchanged and adds exact recorded openings157-160. Catalogv2 has159
boards(144 natural,15 lab), hash216d526976fa5c04bd1696cc5a5e82b71e649ec31d579ea080ba8fe5450bdd8d.

The original frozen adopted10 actor(97f6aa2ca756fd64e249945053bc3a352d89d1a764bad4212d7d81d5f23db675,
69 files) and its explicit measured profile(6b6094dc0a84e0e1988a9f3e3585863da68ddc0a2a00d554d8214c18b7bb21a1)
measured the four additions under the same salts1/2/3, max12 and production replay.
All three supplemental workers and supervisor(native93957) exit0. Existing155
raw measurements retain their original catalog headers; aggregation verifies
identical old entries, actor/profile identities and board hashes rather than
rewriting provenance. Raw evidence: adopted10-cohort-v2/.

| New level | Dennis | Adopted10 salts1/2/3 | Dennis+1 every salt |
|---:|---:|---|---|
|157|2|3/3/4|false|
|158|2|1/1/1|true|
|159|2|1/1/1|true|
|160|1|1/1/1|true|

Expanded adopted10:155/159 clear every salt;151/159 within Dennis+1 every salt.
These are Track A clearance counts, not personal prediction accuracy.
Selectionv7 retains all38 prior development boards and20 guards, adds157 as a
full-salt failure and158-160 as passing controls(42 boards total). Its hash is
22031d85e42cd1c8bec18ad548bc5d3f975285df32e67fcc506e2ef325f6783c.
The relaunched13 keeps its exact source/profile and qualification rules.
Its pre-run snapshot pins the catalog path/hash and expanded baseline records
hash; the adoption auditor independently recomputes that full comparator.

### Experiment13 measured result

All42 salt1 development measurements are valid. Supervisor23081 and all three
workers exit0; slowest move1644.6ms. The combined strategy repairs144 on salt1
but breaks the previously passing salt1 result on10033. The development
qualification rejects advancement; no full13 test or adoption is claimed.

| Level | Dennis | Adopted10 salt1 | Combined13 salt1 |
|---:|---:|---:|---:|
|144|1|5|1|
|157|2|3|3|
|10011|2|8|8|
|10033|5|5|9|
|10041|7|3|3|
|10045|2|3|3|
|10049|2|>12|5|

This is unsuccessful experiment3 in a row after adopted10. Retain the current
default. To investigate WHEN rather than discard the strategy, actual-history
comparisons are running on existing development144,10033 and10049 salt1,
with baseline10, bounded-proof-only and combined13 policies observing and
acknowledging the same recorded physical actions. Every complete attempt is
independently production-replayed. These comparisons are diagnosis, not new
campaign results or proof that any individual suggestion caused the outcome.
