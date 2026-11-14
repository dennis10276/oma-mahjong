# keyRoofMeltFork · layout 21

Thaw the key roof through its own neighbour before collecting the two keys together.

![Board schematic](keyRoofMeltFork-L21-s1-p1.svg)

| Fact | Value |
|---|---|
| Tiles / layout | 96 / 21 (star) |
| Clock | tile 80: 13 shortest + 1 spare = 14 |
| Winning first moves | 3 proven; 0 unresolved out of 12 |
| Dearest unrelated temptation | No candidates outside the mechanism |
| Tray on stored clock route | peak 3, run at 2+ = 10, visits to 3 = 5 |
| All-route tray bound | At least 3 waiting; {"cap1":"lose","cap2":"lose"} |
| Tail greedy win | 0.3225, 258/800, seed 977 |
| Face down | 19.8% |
| Close twins | 0 visible, 0 within four-copy pictures, 1 overall |
| UI dependency | none |

## Proven bait

- Tiles 1: loss through clock 16; dearer than the unrelated control.

## Each special matters

- lock 80: clockRoute; {"kind":"lock","tile":80,"by":"clockRoute","kWithout":3}
- ice 55: clockRoute; {"kind":"ice","tile":55,"by":"clockRoute","kWithout":11}
- ice 60: clockRoute; {"kind":"ice","tile":60,"by":"clockRoute","kWithout":7}

Easier: spare 2; one wrong neighbour; shorter key dig. Harder: spare 1; two wrong neighbours; tail width 3.

[Board, strict solution and complete proof card](keyRoofMeltFork-L21-s1-p1.json)

The tray trace describes the stored route. The capacity proof, when resolved, covers all game routes. Tail greedy win is the specified fixed-seed diagnostic, not a human rating.
