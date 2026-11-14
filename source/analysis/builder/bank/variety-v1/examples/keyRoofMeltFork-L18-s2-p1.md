# keyRoofMeltFork · layout 18

Thaw the key roof through its own neighbour before collecting the two keys together.

![Board schematic](keyRoofMeltFork-L18-s2-p1.svg)

| Fact | Value |
|---|---|
| Tiles / layout | 76 / 18 (frame) |
| Clock | tile 58: 11 shortest + 1 spare = 12 |
| Winning first moves | 2 proven; 0 unresolved out of 11 |
| Dearest unrelated temptation | 67+74: +2 clock moves |
| Tray on stored clock route | peak 3, run at 2+ = 10, visits to 3 = 5 |
| All-route tray bound | At least 3 waiting; {"cap1":"lose","cap2":"lose"} |
| Tail greedy win | 0.3787, 303/800, seed 977 |
| Face down | 19.7% |
| Close twins | 0 visible, 0 within four-copy pictures, 0 overall |
| UI dependency | none |

## Proven bait

- Tiles 53: loss through clock 14; dearer than the unrelated control.

## Each special matters

- lock 58: clockRoute; {"kind":"lock","tile":58,"by":"clockRoute","kWithout":1}
- ice 44: clockRoute; {"kind":"ice","tile":44,"by":"clockRoute","kWithout":9}
- ice 52: clockRoute; {"kind":"ice","tile":52,"by":"clockRoute","kWithout":4}

Easier: spare 2; one wrong neighbour; shorter key dig. Harder: spare 1; two wrong neighbours; tail width 3.

[Board, strict solution and complete proof card](keyRoofMeltFork-L18-s2-p1.json)

The tray trace describes the stored route. The capacity proof, when resolved, covers all game routes. Tail greedy win is the specified fixed-seed diagnostic, not a human rating.
