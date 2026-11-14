# Ribbon prototype · layout 3

Clear the numbered source before its arrow tile, then follow the melt route without parking the clock too early.

Take tile 48 (1) before tile 75 (1→). Removing this link reduces the exact clock route from 9 to 7. This is a separate demonstration board, not a numbered level.


The clock is already free, but taking it now uses the tray space needed for the two-stage thaw of its partner.

![Board schematic](ribbon-L3.svg)

| Fact | Value |
|---|---|
| Tiles / layout | 80 / 3 (ushape) |
| Clock | tile 4: 9 shortest + 1 spare = 10 |
| Winning first moves | 3 proven; 0 unresolved out of 13 |
| Dearest unrelated temptation | 10+11: +2 clock moves |
| Tray on stored clock route | peak 3, run at 2+ = 8, visits to 3 = 4 |
| All-route tray bound | Unresolved: {"cap1":"unknown","cap2":"unknown"} |
| Tail greedy win | 0.2737, 219/800, seed 977 |
| Face down | 20.0% |
| Close twins | 0 visible, 0 within four-copy pictures, 0 overall |
| UI dependency | none |

## Proven bait

- Tiles 72: loss through clock 12; dearer than the unrelated control.
- Tiles 4: loss through clock 12; dearer than the unrelated control.

## Each special matters

- ice 76: clockRoute; {"kind":"ice","tile":76,"by":"clockRoute","kWithout":1}
- ice 79: clockRoute; {"kind":"ice","tile":79,"by":"clockRoute","kWithout":1}

Easier: spare 2; one wrong neighbour; shorter key dig. Harder: spare 1; two wrong neighbours; tail width 3.

[Board, strict solution and complete proof card](ribbon-L3.json)

The tray trace describes the stored route. The capacity proof, when resolved, covers all game routes. Tail greedy win is the specified fixed-seed diagnostic, not a human rating.
