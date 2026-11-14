# roofKeyGuard · layout 16

The easy key lies on the clock, but its partner is behind an icy roof on the other side.

![Board schematic](roofKeyGuard-L16-s5-p1.svg)

| Fact | Value |
|---|---|
| Tiles / layout | 74 / 16 (moon) |
| Clock | tile 6: 15 shortest + 1 spare = 16 |
| Winning first moves | 4 proven; 0 unresolved out of 16 |
| Dearest unrelated temptation | 0+29: +2 clock moves |
| Tray on stored clock route | peak 3, run at 2+ = 5, visits to 3 = 4 |
| All-route tray bound | At least 3 waiting; {"cap1":"lose","cap2":"lose"} |
| Tail greedy win | 0.3362, 269/800, seed 977 |
| Face down | 16.2% |
| Close twins | 0 visible, 0 within four-copy pictures, 0 overall |
| UI dependency | none |

## Proven bait

- Tiles 44: loss through clock 18; dearer than the unrelated control.

## Each special matters

- lock 6: clockRoute; {"kind":"lock","tile":6,"by":"clockRoute","kWithout":5}
- ice 47: clockRoute; {"kind":"ice","tile":47,"by":"clockRoute","kWithout":7}

Easier: spare 2; one wrong neighbour; shorter key dig. Harder: spare 1; two wrong neighbours; tail width 3.

[Board, strict solution and complete proof card](roofKeyGuard-L16-s5-p1.json)

The tray trace describes the stored route. The capacity proof, when resolved, covers all game routes. Tail greedy win is the specified fixed-seed diagnostic, not a human rating.
