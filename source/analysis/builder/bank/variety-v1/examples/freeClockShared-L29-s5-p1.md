# freeClockShared · layout 29

The free clock and the free melting neighbour compete for tray room while the keys open the clock partner route.

![Board schematic](freeClockShared-L29-s5-p1.svg)

| Fact | Value |
|---|---|
| Tiles / layout | 96 / 29 (hourglass) |
| Clock | tile 72: 7 shortest + 1 spare = 8 |
| Winning first moves | 2 proven; 0 unresolved out of 17 |
| Dearest unrelated temptation | 0+84: +2 clock moves |
| Tray on stored clock route | peak 3, run at 2+ = 6, visits to 3 = 3 |
| All-route tray bound | At least 3 waiting; {"cap1":"lose","cap2":"lose"} |
| Tail greedy win | 0.2437, 195/800, seed 977 |
| Face down | 19.8% |
| Close twins | 0 visible, 0 within four-copy pictures, 0 overall |
| UI dependency | none |

## Proven bait

- Tiles 90: loss through clock 10; dearer than the unrelated control.
- Tiles 72: loss through clock 10; dearer than the unrelated control.

## Each special matters

- lock 92: clockRoute; {"kind":"lock","tile":92,"by":"clockRoute","kWithout":1}
- lock 94: clockRoute; {"kind":"lock","tile":94,"by":"clockRoute","kWithout":1}
- ice 91: clockRoute; {"kind":"ice","tile":91,"by":"clockRoute","kWithout":1}

Easier: spare 2; one wrong neighbour; shorter key dig. Harder: spare 1; two wrong neighbours; tail width 3.

[Board, strict solution and complete proof card](freeClockShared-L29-s5-p1.json)

The tray trace describes the stored route. The capacity proof, when resolved, covers all game routes. Tail greedy win is the specified fixed-seed diagnostic, not a human rating.
