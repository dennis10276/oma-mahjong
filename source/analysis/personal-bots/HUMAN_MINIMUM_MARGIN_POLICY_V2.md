# Minimum-margin clock recovery: experiment14

Experiment13 repaired natural144 on salt1 but regressed lab10033 on salt1.
Its completed42-board development comparison was rejected. The default remains
adopted10; the consecutive unadopted counter is3.

## Actual-history comparison

Baseline10, bounded-proof-only and combined13 policies each observed and
acknowledged the same recorded13 histories on three existing development boards.
All585 taps independently replayed through production. Native comparison
sessions76732,42948,94283 exit0. All strategy replan drift counts are0.

| Board | Actual13 attempts | Replayed taps | Tight-specific differences | Public positions |
|---:|---:|---:|---:|---|
|144|1|106|1|attempt1/tap2, tray1, estimated spare moves3|
|10033|9|262|4|attempts4/5/7/8, tap9, tray1, estimated spare moves4|
|10049|5|217|0|seven baseline differences instead belong to bounded proofs|

These are comparisons on the candidate's real histories, not independent
campaign outcomes for the other policies or proof of individual move causality.
Baseline and bounded-proof-only suggestions agree at all five tight-specific
positions. Lab10049's seven differences remain unaffected by the proposed
clock-recovery refinement on these recorded histories.

## Preregistered refinement

Use tight-clock recovery only with exactly one tray tile and exactly three
estimated spare clock moves. This uses two public features: tray count and
clock slack. Three is the existing smallest accepted integer margin above the
planner's urgent-clock guard, rather than a fractional fitted threshold.
Caps3/5/10/20 were compared offline; cap3 retains the helpful144 position and
none of the four harmful10033 positions. Keep the independent ample-clock
recovery branch and bounded proof condition(active clock, slack<=30) unchanged.

This narrows13's tightClockRecoveryMaxSlack from5 to3 using existing supported
configuration. It does not add a new runtime strategy or claim repaired games.
The measured actor source remains
120aee30205ecb739ccec79c640414b017e304044cd73d8816526f7d5b78f8a0.
Candidate profile hash:
89aa97fbaf33ae211c170be5c0c14eabcfac09e89a214693e6349a4667757fc8.
Fit SHA256456588d6fd66980d6995c1d2087065a4a5372f415e0d8d1a37003bdd88c950ee;
raw input hashes and all candidates are in
.codex-runs/level-measure/when-combined-clock-v1/condition-fit-v2.json.

All123 reference tests pass15s(native36259 exit0), including the refined
3/4 margin boundary, unchanged baseline choice above the cap, retained ample
clock behavior and previously established physical/privacy controls.

## Required measurement

Use unchanged catalogv2(159 boards), selectionv7(42 development boards and20
guards), explicit adopted10 frozen-actor baseline and three game workers.
Refresh all recorded targets before starting. Run salt1 development, then
full salts1/2/3 if the predeclared qualification advances. Max12 real tries,
strict2s/move and independent production replay remain mandatory.
Full adoption still requires a Dennis+1 repair and no passing-board regression.
A failed14 makes the consecutive unadopted count4; an adoption resets it.
No personal accuracy or goal completion is claimed by this diagnostic fit.
