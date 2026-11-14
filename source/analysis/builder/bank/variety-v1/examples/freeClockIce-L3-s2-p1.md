# freeClockIce · layout 3

The clock is already free, but taking it now uses the tray space needed for the two-stage thaw of its partner.

![Board schematic](freeClockIce-L3-s2-p1.svg)

| Fact | Value |
|---|---|
| Tiles / layout | 80 / 3 (ushape) |
| Clock | tile 4: 7 shortest + 1 spare = 8 |
| Winning first moves | 2 proven; 0 unresolved out of 14 |
| Dearest unrelated temptation | 5+48: +2 clock moves |
| Tray on stored clock route | peak 3, run at 2+ = 6, visits to 3 = 3 |
| All-route tray bound | At least 3 waiting; {"cap1":"lose","cap2":"lose"} |
| Tail greedy win | 0.2737, 219/800, seed 977 |
| Face down | 20.0% |
| Close twins | 0 visible, 0 within four-copy pictures, 0 overall |
| UI dependency | none |

## Proven bait

- Tiles 72: loss through clock 10; dearer than the unrelated control.
- Tiles 4: loss through clock 10; dearer than the unrelated control.

## Each special matters

- ice 76: clockRoute; {"kind":"ice","tile":76,"by":"clockRoute","kWithout":1}
- ice 79: clockRoute; {"kind":"ice","tile":79,"by":"clockRoute","kWithout":1}

Easier: spare 2; one wrong neighbour; shorter key dig. Harder: spare 1; two wrong neighbours; tail width 3.

[Board, strict solution and complete proof card](freeClockIce-L3-s2-p1.json)

The tray trace describes the stored route. The capacity proof, when resolved, covers all game routes. Tail greedy win is the specified fixed-seed diagnostic, not a human rating.
