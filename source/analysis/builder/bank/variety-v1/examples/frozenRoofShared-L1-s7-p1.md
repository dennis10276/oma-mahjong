# frozenRoofShared · layout 1

The free clock shares its picture with a tile behind a roof that is both frozen and locked; prepare the far key route first.

![Board schematic](frozenRoofShared-L1-s7-p1.svg)

| Fact | Value |
|---|---|
| Tiles / layout | 76 / 1 (steps) |
| Clock | tile 68: 11 shortest + 1 spare = 12 |
| Winning first moves | 6 proven; 0 unresolved out of 18 |
| Dearest unrelated temptation | 0+47: +2 clock moves |
| Tray on stored clock route | peak 3, run at 2+ = 10, visits to 3 = 5 |
| All-route tray bound | At least 3 waiting; {"cap1":"lose","cap2":"lose"} |
| Tail greedy win | 0.3412, 273/800, seed 977 |
| Face down | 19.7% |
| Close twins | 0 visible, 0 within four-copy pictures, 0 overall |
| UI dependency | TASK-13 |

## Proven bait

- Tiles 68: loss through clock 14; dearer than the unrelated control.

## Each special matters

- lock 71: clockRoute; {"kind":"lock","tile":71,"by":"clockRoute","kWithout":5}
- ice 63: clockRoute; {"kind":"ice","tile":63,"by":"clockRoute","kWithout":1}
- ice 71: clockRoute; {"kind":"ice","tile":71,"by":"clockRoute","kWithout":1}

Easier: spare 2; one wrong neighbour; shorter key dig. Harder: spare 1; two wrong neighbours; tail width 3.

[Board, strict solution and complete proof card](frozenRoofShared-L1-s7-p1.json)

The tray trace describes the stored route. The capacity proof, when resolved, covers all game routes. Tail greedy win is the specified fixed-seed diagnostic, not a human rating.
