# freeClockKeys · layout 42

Leave the exposed clock until the frozen key roof is cleared, or its waiting picture blocks the key dig.

![Board schematic](freeClockKeys-L42-s1-p1.svg)

| Fact | Value |
|---|---|
| Tiles / layout | 76 / 42 (hourglass · ridges) |
| Clock | tile 61: 11 shortest + 1 spare = 12 |
| Winning first moves | 4 proven; 0 unresolved out of 6 |
| Dearest unrelated temptation | No candidates outside the mechanism |
| Tray on stored clock route | peak 3, run at 2+ = 4, visits to 3 = 2 |
| All-route tray bound | At least 3 waiting; {"cap1":"lose","cap2":"lose"} |
| Tail greedy win | 0.32, 256/800, seed 977 |
| Face down | 19.7% |
| Close twins | 0 visible, 0 within four-copy pictures, 0 overall |
| UI dependency | none |

## Proven bait

- Tiles 61: loss through clock 14; dearer than the unrelated control.

## Each special matters

- lock 68: clockRoute; {"kind":"lock","tile":68,"by":"clockRoute","kWithout":1}
- ice 60: clockRoute; {"kind":"ice","tile":60,"by":"clockRoute","kWithout":1}

Easier: spare 2; one wrong neighbour; shorter key dig. Harder: spare 1; two wrong neighbours; tail width 3.

[Board, strict solution and complete proof card](freeClockKeys-L42-s1-p1.json)

The tray trace describes the stored route. The capacity proof, when resolved, covers all game routes. Tail greedy win is the specified fixed-seed diagnostic, not a human rating.
