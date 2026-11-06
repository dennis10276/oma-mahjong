# Frozen-key diagnostics

Builder v2 frozenGuards is a locked clock with frozen keys. The older lab recipe of the same name freezes the clock covers instead. These labels do not identify the same mechanism.

The game and frozen observer show a frozen key as ice until it thaws. The planner constructs keyTiles from visible key roles, and its route heuristic follows those keys. Source: tools/sim/refit/human_factory_controller.js (keyTiles/usableIn/needLeft), human_style_environment.js (visibleRole), www/js/specials.js (obKind). This is a source-based hypothesis about a hidden-role planning blind spot, not a measured claim about human difficulty.

Removing ice or locks can shorten the required route while leaving more spare. The SameSpare variants reset the timer to the new proven minimum plus the original spare. The one-key variant leaves only one key frozen at strength1. AllFaceUp also removes peek-pair shortcuts; it is not a pure information intervention. Unknown or losing counterfactuals get no rating.

| source | intervention | timer | retimed minimum | family | skilled | planner route / plain | proof/failure |
|---|---|---:|---:|---:|---:|---|---|
| frozenGuards-w14-t5-l1-x0-s2 | original | 14 | — | 4.68 | 1.13 | 1.13 / 2.08 | win |
| frozenGuards-w14-t5-l1-x0-s2 | noIce | 14 | — | 2.27 | 1.05 | 1.05 / 1.07 | win |
| frozenGuards-w14-t5-l1-x0-s2 | noIceSameSpare | 10 | 9 | 2.39 | 1.05 | 1.05 / 1.07 | win |
| frozenGuards-w14-t5-l1-x0-s2 | noLocks | 14 | — | 1.10 | 1.00 | 1.00 / 1.00 | win |
| frozenGuards-w14-t5-l1-x0-s2 | noLocksSameSpare | 5 | 4 | 1.75 | 1.00 | 1.00 / 1.00 | win |
| frozenGuards-w14-t5-l1-x0-s2 | oneKeyIceSameSpare | 10 | 9 | 2.29 | 1.05 | 1.05 / 1.07 | win |
| frozenGuards-w14-t5-l1-x0-s2 | noClock | none | — | 1.69 | 1.13 | 1.13 / 1.13 | win |
| frozenGuards-w14-t5-l1-x0-s2 | allFaceUp | 14 | — | 4.17 | 19.38 | 19.38 / 19.85 | win |
| frozenGuards-w14-t2-l1-x0-s1 | original | 14 | — | 20.00 | 9.10 | 9.18 / 9.10 | win |
| frozenGuards-w14-t2-l1-x0-s1 | noIce | 14 | — | 2.71 | 1.00 | 1.02 / 1.00 | win |
| frozenGuards-w14-t2-l1-x0-s1 | noIceSameSpare | 9 | 8 | 3.40 | 1.00 | 1.02 / 1.00 | win |
| frozenGuards-w14-t2-l1-x0-s1 | noLocks | 14 | — | 4.10 | 1.10 | 1.10 / 1.10 | win |
| frozenGuards-w14-t2-l1-x0-s1 | noLocksSameSpare | 5 | 4 | 4.13 | 1.18 | 1.18 / 1.18 | win |
| frozenGuards-w14-t2-l1-x0-s1 | oneKeyIceSameSpare | 9 | 8 | 2.99 | 1.10 | 1.13 / 1.10 | win |
| frozenGuards-w14-t2-l1-x0-s1 | noClock | none | — | 2.33 | 1.07 | 1.07 / 1.07 | win |
| frozenGuards-w14-t2-l1-x0-s1 | allFaceUp | 14 | — | 20.00 | 17.57 | 17.57 / 17.70 | win |

Loss counts and individual seed results are in frozen-guards.json. A rating of20 is the capped retry yardstick, not proof that humans need exactly20 attempts. Only completed valid campaign measurements are compared.

## What the interventions establish

For the hard source, removing key ice while keeping the exact original spare reduces family20.00 to3.40 and skilled9.10 to1.00. Removing locks with that spare gives4.13/1.18; one weak frozen key gives2.99/1.10. The large effect therefore survives the timer control: it is not just extra clock time. This supports splitting frozen keys from visible guard ice rather than treating all ice stories as one calibrated knob. The mild ablations are too easy, and have not passed production authorship/idle-special/readability checks; they are not new qualified stories.

AllFaceUp raises the skilled rating from1.13 to19.38 on the easier source, and from9.10 to17.57 on the harder source. Both planner styles deteriorate. Face-up also changes available peek-pair actions, so this is not a pure information experiment. It nevertheless exposes a policy/action-representation artifact that prevents interpreting a capped bot score as proof of human brutality. The visible-role/key-routing source hypothesis remains a hypothesis; these two ablations do not identify its exact causal contribution.

Recommendation: require a visible objective cue and test a short, explicit ice-guard dependency separately from ice on the keys themselves. Keep frozen-key cases out of a global spare conversion: the paired study's frozenGuards-L2 board changed17.715→6.515 with only one extra move. A new mild authored story needs its own witnesses, meaningful-special checks and full ratings before use.
