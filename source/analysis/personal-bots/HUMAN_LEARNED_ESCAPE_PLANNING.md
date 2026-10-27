# Learn the chance of an out from earlier bot games

Dennis's additional steering:make the bot plan for the highest chance of an out,
learned from previous levels it played. Combine this with the new eight-trial
survival/key-logic authorization48–55. Keep all original repair/no-regression,
public-information,production-replay and strict2s requirements. Default40 stays
retained until a candidate passes. No measured48 trial yet.

## Shared experience without benchmark leakage

Inventory455 full recorded openings without reading human action/results/count
labels. Exclude every exact benchmark board;also exclude every topology used by
any of the159 benchmark boards. This leaves72 distinct recorded boards,including
16 with keys and5 with clocks. Existing gamesOf() filters key pictures out,so
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

149/149 tests pass19s(native81687 exit0). A production fixture at tray3 matches
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
