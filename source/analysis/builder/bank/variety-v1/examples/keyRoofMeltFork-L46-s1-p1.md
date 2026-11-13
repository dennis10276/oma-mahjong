# keyRoofMeltFork · layout 46

Thaw the key roof through its own neighbour before collecting the two keys together.

![Board schematic](keyRoofMeltFork-L46-s1-p1.svg)

| Fact | Value |
|---|---|
| Tiles / layout | 74 / 46 (hourglass) |
| Clock | tile 60: 9 shortest + 1 spare = 10 |
| Winning first moves | 4 proven; 0 unresolved out of 10 |
| Dearest unrelated temptation | 5+15: +2 clock moves |
| Tray on stored clock route | peak 3, run at 2+ = 8, visits to 3 = 4 |
| All-route tray bound | At least 3 waiting; {"cap1":"lose","cap2":"lose"} |
| Tail greedy win | 0.2137, 171/800, seed 977 |
| Face down | 20.3% |
| Close twins | 0 visible, 0 within four-copy pictures, 0 overall |
| UI dependency | none |

## Proven bait

- Tiles 25: +2 clock moves; no dearer than the unrelated control.

## Each special matters

- lock 60: clockRoute; {"kind":"lock","tile":60,"by":"clockRoute","kWithout":6}
- ice 65: clockRoute; {"kind":"ice","tile":65,"by":"clockRoute","kWithout":6}
- ice 70: baitDefused; {"kind":"ice","tile":70,"by":"baitDefused","bait":[25],"winsAt":10}

Easier: spare 2; one wrong neighbour; shorter key dig. Harder: spare 1; two wrong neighbours; tail width 3.

[Board, strict solution and complete proof card](keyRoofMeltFork-L46-s1-p1.json)

The tray trace describes the stored route. The capacity proof, when resolved, covers all game routes. Tail greedy win is the specified fixed-seed diagnostic, not a human rating.
