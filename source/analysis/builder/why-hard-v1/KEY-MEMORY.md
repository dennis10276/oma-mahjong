# Hidden-key memory check

10 boards, 60 sampled family campaigns; 643 adjacent-try opportunities on 10 boards.

An opportunity is an actual observed key glyph in a lost try with a subsequent try in the same campaign. Picture recall and key identity are separate. Toward-cover means the first removal touches that observed key or its geometric cover ancestors. Strict straight means no removal outside that cover corridor before a previously seen key is re-exposed. This deliberately strict operational definition can penalize useful side clearance or tray relief; it is not a proof of shortest optimal play. Never seeing a key provides no memory opportunity. No bot or profile changed.

First commitment toward the previously observed key's cover: 24/643 (3.7%). Strict straight cover dig: 1/643 (0.2%). The next try re-exposes a previously seen key in 520/643. Key picture available after the next try's first observation (memory OR currently visible): 74.4%. Among currently hidden key pictures specifically, correct recall is 418/653 (64.0%). Key glyphs visible at the next opening: 0.

Released family retryKeyIdentityMemory: false; skilled: true.

Source: human_factory_controller.js beginAttempt resets roles every try. Only the optional createKeyIdentityMemory retains observed static key glyph identities. The released family profile does not enable it, although pictures may survive with retryRetention0.65. decide uses prior key targets only when that memory exists; route keyTiles/needLeft also derives key roles from the current attempt. Pictures remembered at the right location therefore do not by themselves preserve the fact that the tile is a key.

| Board | full family / skilled | next-try opportunities | first commit toward cover | strict straight | re-exposed | hidden-key picture recalled | median reveal-move change |
|---|---|---:|---:|---:|---:|---:|---:|
| keysOnIsland-L18:spare | 16.61/2.33 | 50 | 0 | 0 | 29 | 64.8% | 1 |
| keysFarSide-w14-t5-l0-x1-s1 | 17.215/1.1 | 95 | 1 | 1 | 95 | unobserved | 0 |
| clockInSight-L16:spare | 18.259999999999998/3.6 | 22 | 13 | 0 | 5 | 79.3% | 0 |
| lockBeside-L29:three4 | 19.1/2.1 | 21 | 0 | 0 | 6 | 71.1% | 1 |
| clockInSight-w14-t5-l1-x0-s2 | 18.535/4.17 | 41 | 7 | 0 | 15 | 63.4% | 0 |
| keysOnIsland-w18-t5-l0-x0-s1 | 18.575/2.05 | 99 | 0 | 0 | 97 | 64.6% | 0 |
| keysFarSide-w14-t5-l1-x0-s3 | 19.09/4.1 | 97 | 0 | 0 | 81 | 62.0% | 0 |
| clockInSight-w14-t5-l2-x0-s1 | 18.935000000000002/10.53 | 9 | 0 | 0 | 0 | 71.4% | unobserved |
| keysOnIsland-w18-t2-l0-x0-s1 | 19.009999999999998/2.02 | 95 | 2 | 0 | 78 | 64.4% | 0 |
| keysFarSide-w18-t2-l0-x0-s1 | 19.45/1.07 | 114 | 1 | 0 | 114 | 59.6% | 0 |

## Scope of the conclusion and proposed repair

First-try uncertainty about a genuinely hidden key is real. Continued wandering after its glyph was observed also has a concrete family-bot memory limitation: its static key identity is discarded on retry, independently of retained picture memory. The opportunity counts above measure behavior with the existing bot, not a rating for a repaired bot. A20 must not be interpreted as evidence that a person would also keep failing20 times.

The proposed fix is to enable and validate the existing observed-key identity memory for the family, and ensure the clock/key access heuristics consume those remembered targets when their glyphs are covered again. Facts must come only from an actually observed key glyph, never from the engine obstacle list or unseen keys. Check keyTiles/needLeft as well as knownKeys/priorKeyTargets. This would be a changed behavioral bot requiring a new version, cache invalidation and recalibration; it is not a zero-drift speed optimization. No fix or counterfactual rating was applied here.

Affected evidence boards are listed above; key-memory.json retains every adjacent-try comparison and prefix. No claim is made that all their full ratings would fall, or by how many tries. Both old and proposed policy paths need a controlled follow-up before changing the yardstick.
