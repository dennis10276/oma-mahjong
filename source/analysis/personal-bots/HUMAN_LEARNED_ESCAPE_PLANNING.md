# Learn the chance of an out from earlier bot games

Dennis's additional steering:make the bot plan for the highest chance of an out,
learned from previous levels it played. Combine this with the new eight-trial
survival/key-logic authorization48–55. Keep all original repair/no-regression,
public-information,production-replay and strict2s requirements. Default40 stays
retained until a candidate passes.48/49 rejected;conditional50 running;3/8 used.

## Shared experience without benchmark leakage

Inventory455 full recorded openings without reading human action/results/count
labels. Exclude every exact benchmark board;also exclude every topology used by
any of the159 benchmark boards. The initial72-board inventory needed correction:
tile-order-invariant topology audit excluded2 overlaps and grouped a duplicate.
The eligible70 boards have69 topologies,14 key boards and3 clock boards.
Existing gamesOf() filters key pictures out,so
use recorded initialBoard() directly instead. Original private board setup goes
only to the production engine;the bot and features use ONE public observer.

The bot plays this fixed earlier-experience curriculum before the learned model
is fitted/frozen. Three workers,default40,one published salt,max3 actual tries,
512 physical taps/try. Retain public retry memory within each board,never across
boards. A topology-group hash assigns20% to validation;no board/topology crosses
training/validation,or curriculum/benchmark. Curriculum metadata never enters
the shared model. Do not choose different models/settings per level.

No human attempt labels,winning routes,tile IDs,picture IDs,board IDs,player
names,seeds or private pictures are model features. Record only public feature
vectors and subsequent actual BOT outcomes. Future benchmark outcomes do not
train this first frozen version. Later updates require declared earlier completed
experience and a new frozen version;no retroactive prospective scoring.

## Escape target and public features

Estimate the probability of surviving the next12 physical taps AND finding
relief:tray pressure falls,a live clock is removed,or the level clears. A loss
within that horizon is negative even after temporary relief. A short censored
episode is unknown,not a failed escape or death proof. Observing a full horizon
without relief is a negative horizon label,not proof the position is impossible.

The26 general features describe tray pressure/orphans,currently known tray
matches,constructive on-pile pairs,remembered key access/visible locks,clock
room,unknown closed tiles,and known consequences of a candidate root. Picture
values are used only for equality/matching,never encoded as identity features.
Known-physics projections stop at uncertainty;no imagined picture fills it.

Fit one small shared escape critic on the bot's earlier curriculum actions.
Validate on held-out topology groups against a constant escape-rate predictor;
report probability calibration/loss,not human attempt accuracy. These are
behavior-policy estimates with selection bias,not guaranteed causal outcomes.
Then use the estimate to rank public route/continuation options. Keep proved
wins/clock exits and immediate-loss exclusions separate from learned scores;
unknown/sample agreement never becomes a proof. Full benchmark still decides
whether the bot actually improves. Do not simply fit attempt-count thresholds.

## Foundation verification

153/153 tests pass19s(native21362 exit0). A production fixture at tray3 matches
two known closed key tiles on the pile,unlocks a waiting tray partner,and clears;
8 taps independently replay. Features read no private fields or mutate state.
Horizon-label tests distinguish relief followed by loss,clearance,censoring and
observed no-relief windows. Runtime now imports the frozen model and planner,
behind disabled-by-default learnedEscapePlanning;no adoption/benchmark-gain claim.

Training-only getter instrumentation exposes the existing public model/roles,
changes no decision code,and must pass an original/instrumented production
decision-parity control before collection. Archive both source hashes,freeze
actor and feature files during collection,and independently replay every actual
attempt. Raw escape-training-board-inventory-v1.json,escape-experience-v1/.
After collection:audit labels/exclusions,fit/freeze critic,integrate bounded
route ranking,run meaningful controls,then count the first measured48 trial.

Collection native7545 and all3 workers exited0;getter-only parity control passes
8 independently replayed winning taps with identical original/instrumented
decisions. Actor source remains8b40b45eaeab…;feature source61feb851fb86….
The original topology audit failed on tile-order permutations;retain that failed
audit. BEFORE reading labels,seal corrected fit-plan-v2.json:53 training boards
(8 keys,2 clocks),17 validation boards(6 keys,1 clock),no benchmark or split
topology overlaps. Keep original collection manifest/raw split unchanged;join v2.
One held-out clock board gives limited evidence;report that limit honestly.
The first fixed critic uses board-balanced L2 logistic fitting(800 epochs,
step0.5,L2=0.01),26 public features plus5 fixed contextual interactions. Fit
and initialize only from training outcomes. No benchmark-driven threshold fit.

Completed collection:6581 independently production-replayed taps,73 attempts,
1241 examples;97 excluded with the2 overlapping boards. Eligible training has
794 labeled rows(28 negatives);validation350(15 negatives),no censored rows.
Independent artifact audit checks source hashes,format,horizon/status consistency;
full numerical offline label recomputation is unavailable because full frames
were not retained. Physical replay occurred inside each collector.

Frozen escape-model-v1.json SHA256:
2f4924e3b6dd14b86e49360d9a8301d1643369f2501ab4bb9ddb33a99054717e.
Fresh deterministic refit exactly reproduces weights and metrics(native exit0).
Validation board-balanced Brier0.017698 vs constant0.018993;log loss0.072650 vs
0.095686;unweighted AUC0.88199. Sparse failures and mostly easy experience limit
transfer evidence;all predictions remain above0.8,so coarse calibration bins
cannot establish calibration on difficult positions. No benchmark gain claimed.
Model fit committed dd72ddd;runtime integration2751cef,pile habit12ef793. Measured48
is rejected. Frozen experience weights are tracked as public_escape_model_v1.json.

## Candidate runtime behavior

When tray>=2 OR clock live(the training domain),rank public guaranteed root
actions by the shared learned escape Q. Discard only existing certified dead
roots or immediate known-physics losses. A70ms/512-node bounded search builds
a known prefix of up to12 taps toward tray relief or clock removal;stop at
unknown pictures/roles. Scores are estimates under the earlier follow-up policy,
not new-policy causal guarantees. Highest chance means highest estimate among
evaluated eligible roots within budget. Do not turn caps into impossibility.

Existing proven wins,safe clock exits and necessary survival continuations are
protected. Retain a selected known prefix only while the expected physical state,
public picture/orientation/role knowledge and actual takeability still agree;
replan after new information,blocked taps or retry reset. Deadline includes the
earlier planner's elapsed decision time. Full benchmark must verify the2s gate.

Production controls cover a tray3 closed key-pair chain unlocking tray relief,
complete independent replay,controller actually invoking learned planning,
protected proofs,private-field guards,model-weight-dependent root ordering and
caps remaining unresolved. Seven actual retained40-history comparisons completed
1070 replayed taps,zero baseline drift,485 changed suggestions,max1602.922ms.
All7 child processes exited0;supervisor83685 exited1 only because its final source
check called a nonexistent verify method. A separate native0 finalizer verified
all81 source hashes and every footer;preserve the original failed finalization.
These are counterfactual suggestions,not candidate campaigns or clearance gains.

## Face-down pile-pair habit(user steering after first history comparisons)

Prefer a known matching pair on the pile when one or both members are face down.
Open the closed member first;then tap its mate to remove both without occupying
any tray slot. Never invent the picture of an unknown hidden tile. Existing tray
matches follow production tray priority and remain pressure-reducing alternatives.
Among zero-slot pair routes and immediate tray relief,rank learned-domain actions
by the same frozen escape critic. This explicit user habit takes precedence over
speculative commitments. Below tray2 with no clock,apply the public matching habit
without claiming a learned probability outside the training domain.

Validate both physical taps,clock survival and actual takeability;check the
resulting public continuation with bounded survival search. Reject only proved
dead continuations;unknown/capped checks remain possible. Existing proven wins,
safe clock exits and necessary survival continuations remain protected. Controls
cover one/both down,zero tray occupancy at every tap,unknown-picture rejection,
clock expiration,proved dead ends,and8 additional independently replayed taps.
Combined model+habit history comparisons completed1070 replayed taps,zero baseline
drift,528 changed suggestions,max1545.681ms;native6659/all7 workers exit0. All82
source hashes verified independently. Actual48 now runs fixed42 development
salt1(native48101,3 workers),then the unchanged qualifier/full159 salts1–3.
No adoption or repaired-target claim yet;default40 retained. Raw protocol and
trial artifacts are separate from the completed experience/model fit evidence.

## Trial48 investigation while frozen development completes

Early completed boards show severe regressions,including unresolved512-tap
cycles:10011 alternates41/40,10052 alternates60/61,49 alternates56/5. Preserve
the whole fixed42 run;do not modify actor files while workers remain live.
Independent synthetic public-state probe reproduces the mechanism:remembered
closed singletons alternate with learned P≈0.94,knownRelief:false,removed:0.
The model's earlier-policy estimate was wrongly allowed to rank a bare known
peek as a route. No new picture,board removal or tray/clock relief follows.

Next correction AFTER native48101 terminates:do not discard the shared critic
or pile habit on this first failure. Require an override to construct a public
prefix ending in relief or real board progress without increased tray pressure,
or an actual new-information boundary. Search another eligible root if the
highest-scored root has no such prefix;caps stay unknown and fall back to the
retained planner,never to repeating a known peek. Add a regression test proving
the reproduced singleton-peek cycle cannot recur. Investigate repeated physical
losses on10041/10032 separately,using actual first-divergence public histories.
No adopted policy or baseline accuracy changes. Trial48 still running;1/8 used.
Raw diagnostic:learned-escape-known-peek-cycle-probe-v1.json;actual tails:
inspect-trial48-repeats.js. Outcome/audit now complete:10/42 clears vs41/42,
no repairs,30 target/31 clearance regressions,27 alternating-peek censored runs.
All3 workers/native48101 exit0;102 attempts/15328 taps independently replayed;
82 frozen sources verified. No full run or adoption. The described correction
is now implemented,unmeasured,and153 tests pass19s. Actual48-history audit next,
including repeated physical losses on10041/10032;then authorized49. Default40.

Update:correction4983f36 passes the eight actual48-history checks(first80 taps per
attempt),699 replayed taps,zero baseline drift,251 changed suggestions,max451.064ms.
Native85338/all8 workers exit0;all82 sources verified. Measured49 now running
native21910,3 workers,fixed42 development/salt1;actor frozen.2/8 used,6 remain.
No adoption or new campaign improvement claimed until the run and audits finish.

49 result:28/42 clears vs41/42;10049 salt1 improves5→3,but12 target and13
clearance regressions. Native21910/all3 workers exit0;175 attempts/9100 taps
independently replayed,82 sources verified. Four alternating censored tails remain.
Same-history comparison of repaired10049 and broken10032/10041/10015/105/110
finds early opening changes at tray0/live clock;native95805/all6 exit0,zero drift.
Try the already-declared broad WHEN thresholds,unchanged:opening clock20–40 AND
at most4 visible locks. This covers80/81/10049/10052,excludes the inspected broken
controls,and requires fresh fixed42/full159×3 validation. No per-level selector.
Prototype1572f73 latches this selection,retains40 families and unchanged model;
154 tests pass19s. Native91511 now audits seven actual retained40 histories.
No measured50 yet;2/8 used,6 remain. Default40 retained;A/B/unseen20 unmet.

Conditional audit complete:91511/all7 workers exit0,562 replayed taps,zero drift,
79 changed suggestions,max1524.922ms,all82 sources verified. Five broken controls
unchanged;10049 keeps45 changed suggestions. Measured50 now runs(native22724,
3 workers,fixed42 development/salt1);3/8 used,5 remain. Actor frozen. Default40.
