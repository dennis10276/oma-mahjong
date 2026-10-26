# Bounded-clock safety proofs and tight-clock preparation

Experiment12 restored10011 but broke10041 on salt2. It cleared10049 in5/3/5
tries, still above its<=3 limit. The next candidate combines two prepared public
conditions instead of assuming either extra knowledge or recovery always helps.

## Capping expanded safety planning

Both policies were compared on actual full12 histories of three existing
development boards. This refinement explicitly uses the observed full12
regression as new development evidence; its next full run is not described as an
independent unseen holdout. The later frozen20-level check remains required.

| Board and salt | Taps replayed | Changed decisions | Estimated slack at changes | Replan drift |
|---|---:|---:|---|---:|
|144 salt1, partial gain|128|2|2-3|0|
|10049 salt1, partial gain|217|7|24-29|0|
|10041 salt2, regression|396|53|32-48|0|

All741 taps independently replayed; native commands83577,48657,29899 exit0.
The fit enumerated round caps0,5,10,20,30,40,50,60, retaining no regression
position, then maximizing improved boards, changed positions and the cap.
Selected: start expanded observed-key safety planning only while the public
clock is active with at most30 estimated spare moves. Two public features,
no IDs. This retains all9 helpful-case changes and none of53 regression changes.
Counterfactual suggestions do not identify individual causes or guarantee a clear.

The cap uses public geometry, observed mechanics and retained positive key
identities, including keys whose separate route-ranking gate is closed. The
heuristic is not an exact shortest route, lower bound or safety certificate.
The gate is evaluated once per actual observed position and cached for search;
it does not rerun a route-cost calculation for every transfer query. Actual
facts remain remembered when the condition disables expanded planning.

A replay audit reconstructs every changed public position and confirms the
implemented gate agrees with the fitted predicate on all62 positions. Raw:
when-safety-clock-v2/gate-feature-mapping.json. Fit SHA256
0aa16f10d5a74bbf736bb5842df9740187360dc68abdaa8a1f7fe35dccf9fd1d.

## Prepared tight-clock recovery

The separately prepared condition starts tray-debt recovery only with exactly
one tray tile and3-5 estimated spare clock moves. It uses two public features.
Its prior fit used existing04 development salt1 first-attempt clock-on traces;
it retained the helpful144 decision at tap2, tray1, estimated slack3, and no
harmful10045 position. See HUMAN_WHEN_DECISION_ANALYSIS_V1.md and raw
when-tight-v2/condition-fit.json, SHA256
13e1c96078e15537ffa018a160fcb08860cbedbd09b1650962e682c657a6fe79.

The established ample-clock recovery branch(tray>=1, estimated slack>=50) stays
separate. The new branch reranks the existing public recovery search rather than
adding hypothetical reveals or a new simulation engine. Recovery timing and
all physical decisions remain subject to the existing search and outer budgets.

## Combination and validation

Expanded cross-retry safety proofs need earlier actual evidence; they do not
invent new facts on a first monotone attempt. Tight-clock preparation can affect
the first attempt, so the combination is a deliberate interaction test. No
separate contribution to campaign performance is claimed before measurement.

All123 reference tests pass17s(native66393 exit0), including cap boundaries,
remembered-key route dependencies, missing/taken clocks, first-attempt isolation,
72 independently replayed controller-control taps, tight-clock slack2/3/5/6
boundaries, tray0/1/2, preserved ample-clock behavior and an actual tight-clock
production clear. Combined and standalone tight-clock hidden-world controls pass.
Default10 remains enabled; both additions are optional until full validation.
