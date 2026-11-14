# repeatedKeyChoice · layout 19

Pictures can match while only one key leaves: pair the two real keys rather than the free key and its ordinary lookalike.

![Board schematic](repeatedKeyChoice-L19-s2-p1.svg)

| Fact | Value |
|---|---|
| Tiles / layout | 76 / 19 (hourglass · ridges) |
| Clock | tile 47: 7 shortest + 1 spare = 8 |
| Winning first moves | 5 proven; 0 unresolved out of 12 |
| Dearest unrelated temptation | No candidates outside the mechanism |
| Tray on stored clock route | peak 3, run at 2+ = 6, visits to 3 = 3 |
| All-route tray bound | At least 2 waiting; {"cap1":"lose","cap2":"win"} |
| Tail greedy win | 0.3225, 258/800, seed 977 |
| Face down | 19.7% |
| Close twins | 0 visible, 0 within four-copy pictures, 0 overall |
| UI dependency | none |

## Proven bait

- Tiles 73+67: +2 clock moves; dearer than the unrelated control.

## Each special matters

- lock 47: clockRoute; {"kind":"lock","tile":47,"by":"clockRoute","kWithout":3}

Easier: spare 2; one wrong neighbour; shorter key dig. Harder: spare 1; two wrong neighbours; tail width 3.

[Board, strict solution and complete proof card](repeatedKeyChoice-L19-s2-p1.json)

The tray trace describes the stored route. The capacity proof, when resolved, covers all game routes. Tail greedy win is the specified fixed-seed diagnostic, not a human rating.
