# frozenRoofShared · layout 23

The free clock shares its picture with a tile behind a roof that is both frozen and locked; prepare the far key route first.

![Board schematic](frozenRoofShared-L23-s6-p2.svg)

| Fact | Value |
|---|---|
| Tiles / layout | 76 / 23 (hourglass) |
| Clock | tile 62: 11 shortest + 2 spare = 13 |
| Winning first moves | 8 proven; 0 unresolved out of 15 |
| Dearest unrelated temptation | 69: loss through clock 14 |
| Tray on stored clock route | peak 3, run at 2+ = 10, visits to 3 = 5 |
| All-route tray bound | At least 3 waiting; {"cap1":"lose","cap2":"lose"} |
| Tail greedy win | 0.2838, 227/800, seed 977 |
| Face down | 19.7% |
| Close twins | 0 visible, 0 within four-copy pictures, 0 overall |
| UI dependency | TASK-13 |

## Proven bait

- Tiles 64: loss through clock 14; no dearer than the unrelated control.
- Tiles 53: loss through clock 14; no dearer than the unrelated control.
- Tiles 62: loss through clock 14; no dearer than the unrelated control.

## Each special matters

- lock 66: clockRoute; {"kind":"lock","tile":66,"by":"clockRoute","kWithout":1}
- ice 66: clockRoute; {"kind":"ice","tile":66,"by":"clockRoute","kWithout":9}
- ice 75: clockRoute; {"kind":"ice","tile":75,"by":"clockRoute","kWithout":1}

Easier: spare 2; one wrong neighbour; shorter key dig. Harder: spare 1; two wrong neighbours; tail width 3.

[Board, strict solution and complete proof card](frozenRoofShared-L23-s6-p2.json)

The tray trace describes the stored route. The capacity proof, when resolved, covers all game routes. Tail greedy win is the specified fixed-seed diagnostic, not a human rating.
