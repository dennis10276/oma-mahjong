# lookalikeWay · layout 18

The matching lookalike spends the wrong key; thaw the way to the true partner before the separate clock roof.

![Board schematic](lookalikeWay-L18-s1-p1.svg)

| Fact | Value |
|---|---|
| Tiles / layout | 76 / 18 (frame) |
| Clock | tile 19: 12 shortest + 1 spare = 13 |
| Winning first moves | 3 proven; 0 unresolved out of 13 |
| Dearest unrelated temptation | No candidates outside the mechanism |
| Tray on stored clock route | peak 3, run at 2+ = 9, visits to 3 = 4 |
| All-route tray bound | At least 3 waiting; {"cap1":"lose","cap2":"lose"} |
| Tail greedy win | 0.1525, 122/800, seed 977 |
| Face down | 25.0% |
| Close twins | 0 visible, 0 within four-copy pictures, 0 overall |
| UI dependency | none |

## Proven bait

- Tiles 53: loss through clock 15; dearer than the unrelated control.
- Tiles 44: loss through clock 15; dearer than the unrelated control.
- Tiles 44+58: loss through clock 15; dearer than the unrelated control.

## Each special matters

- lock 19: clockRoute; {"kind":"lock","tile":19,"by":"clockRoute","kWithout":10}
- ice 45: clockRoute; {"kind":"ice","tile":45,"by":"clockRoute","kWithout":10}
- ice 48: baitDefused; {"kind":"ice","tile":48,"by":"baitDefused","bait":[53],"winsAt":13}

Easier: spare 2; obviousness dial 0. Harder: spare 1; obviousness dial 2 requires a greedy first bait.

[Board, strict solution and complete proof card](lookalikeWay-L18-s1-p1.json)

The tray trace describes the stored route. The capacity proof, when resolved, covers all game routes. Tail greedy win is the specified fixed-seed diagnostic, not a human rating.

## Chain and opening facts

Signature: `clock<lock; clock<cover:ice; keyA<way:ice; keyPair<lookalikeChoice`. Chain links: 4. Layers: 3.

Two traps: {"kind":"hardChainAndMediumBait","hardLinks":4,"mediumLinks":2,"mediumEvidence":[{"bait":[53],"kind":"lonelyThaw","links":2,"thawHosts":[45],"twin":9,"twinCovers":[36,42,66,70,65]},{"bait":[44],"kind":"earlyKey","links":2,"partner":28,"partnerCovers":[48,72],"opens":[19]},{"bait":[44,58],"kind":"ordinaryKeyLookalike","links":2,"realKeys":[28,44],"opens":[19]}],"baits":[[53],[44],[44,58]],"note":"Two separately priced bad decisions on one connected chain; no claim of additive sequential costs."}

Two frozen fronts: []

Obviousness dial 0: first route taps 72, 67; greedy sets {"rank":"freePair","tiles":[44,58]} / {"rank":"freePair","tiles":[44,58]}. Greedy prefix: false; ready free route pair: false; greedy-preferred baits: [[44],[44,58]].

Tail waiting shares (before taps), 0 / 1 / 2 / 3: 0.391 / 0.484 / 0.109 / 0.016. Longest 2+ run: 3.
