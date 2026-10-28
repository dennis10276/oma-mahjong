# Learn the chance of an out from earlier bot games

Dennis's additional steering:make the bot plan for the highest chance of an out,
learned from previous levels it played. Combine this with the new eight-trial
survival/key-logic authorization48–55. Keep all original repair/no-regression,
public-information,production-replay and strict2s requirements. Default40 stays
retained until a candidate passes. No measured48 trial yet.

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

150/150 tests pass19s(native30802 exit0). A production fixture at tray3 matches
two known closed key tiles on the pile,unlocks a waiting tray partner,and clears;
8 taps independently replay. Features read no private fields or mutate state.
Horizon-label tests distinguish relief followed by loss,clearance,censoring and
observed no-relief windows. New features are not yet imported by the runtime
actor;no default-policy adoption or benchmark-gain claim.

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
Model is fitted;actor integration and first measured48 remain pending.
