# lookalikeThaw · layout 18

A matching ordinary picture cannot replace the guarded key: save the true key pair to unlock the neighbour that thaws the clock.

![Board schematic](lookalikeThaw-L18-s2-p1.svg)

| Fact | Value |
|---|---|
| Tiles / layout | 76 / 18 (frame) |
| Clock | tile 44: 11 shortest + 1 spare = 12 |
| Winning first moves | 5 proven; 0 unresolved out of 12 |
| Dearest unrelated temptation | No candidates outside the mechanism |
| Tray on stored clock route | peak 3, run at 2+ = 8, visits to 3 = 4 |
| All-route tray bound | At least 2 waiting; {"cap1":"lose","cap2":"win"} |
| Tail greedy win | 0.2775, 222/800, seed 977 |
| Face down | 25.0% |
| Close twins | 0 visible, 0 within four-copy pictures, 1 overall |
| UI dependency | none |

## Proven bait

- Tiles 52: +2 clock moves; dearer than the unrelated control.
- Tiles 59+75: +2 clock moves; dearer than the unrelated control.

## Each special matters

- lock 50: clockRoute; {"kind":"lock","tile":50,"by":"clockRoute","kWithout":5}
- ice 44: clockRoute; {"kind":"ice","tile":44,"by":"clockRoute","kWithout":1}
- ice 45: clockRoute; {"kind":"ice","tile":45,"by":"clockRoute","kWithout":9}

Easier: spare 2; obviousness dial 0. Harder: spare 1; obviousness dial 2 requires a greedy first bait.

[Board, strict solution and complete proof card](lookalikeThaw-L18-s2-p1.json)

The tray trace describes the stored route. The capacity proof, when resolved, covers all game routes. Tail greedy win is the specified fixed-seed diagnostic, not a human rating.

## Chain and opening facts

Signature: `clock<ice; thaw<lock; keyA<cover:ice; keyPair<lookalikeChoice`. Chain links: 4. Layers: 3.

Two traps: {"kind":"hardChainAndMediumBait","hardLinks":4,"mediumLinks":2,"mediumEvidence":[{"bait":[52],"kind":"lonelyThaw","links":2,"thawHosts":[44],"twin":9,"twinCovers":[36,42,66,70,65]},{"bait":[59,75],"kind":"ordinaryKeyLookalike","links":2,"realKeys":[20,59],"opens":[50]}],"baits":[[52],[59,75]],"note":"Two separately priced bad decisions on one connected chain; no claim of additive sequential costs."}

Two frozen fronts: []

Obviousness dial 0: first route taps 67, 51; greedy sets {"rank":"freePair","tiles":[59,68,71,75]} / {"rank":"freePair","tiles":[51,53,59,68,71,75]}. Greedy prefix: false; ready free route pair: false; greedy-preferred baits: [[59,75]].

Tail waiting shares (before taps), 0 / 1 / 2 / 3: 0.354 / 0.492 / 0.138 / 0.015. Longest 2+ run: 2.
