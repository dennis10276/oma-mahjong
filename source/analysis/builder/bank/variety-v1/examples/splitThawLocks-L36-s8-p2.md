# splitThawLocks · layout 36

The locked thaw tile clears a picture carried through the key dig; save the free clock’s tray slot until that relief is ready.

![Board schematic](splitThawLocks-L36-s8-p2.svg)

| Fact | Value |
|---|---|
| Tiles / layout | 76 / 36 (hourglass) |
| Clock | tile 0: 11 shortest + 2 spare = 13 |
| Winning first moves | 2 proven; 0 unresolved out of 11 |
| Dearest unrelated temptation | 69: loss through clock 14 |
| Tray on stored clock route | peak 3, run at 2+ = 5, visits to 3 = 4 |
| All-route tray bound | At least 3 waiting; {"cap1":"lose","cap2":"lose"} |
| Tail greedy win | 0.2087, 167/800, seed 977 |
| Face down | 19.7% |
| Close twins | 0 visible, 0 within four-copy pictures, 0 overall |
| UI dependency | none |

## Proven bait

- Tiles 74: loss through clock 14; no dearer than the unrelated control.
- Tiles 25: loss through clock 14; no dearer than the unrelated control.
- Tiles 0: loss through clock 14; no dearer than the unrelated control.

## Each special matters

- lock 63: clockRoute; {"kind":"lock","tile":63,"by":"clockRoute","kWithout":5}
- lock 68: baitDefused; {"kind":"lock","tile":68,"by":"baitDefused","bait":[74],"winsAt":13}
- ice 73: clockRoute; {"kind":"ice","tile":73,"by":"clockRoute","kWithout":7}

Easier: spare 2; one wrong neighbour; shorter key dig. Harder: spare 1; two wrong neighbours; tail width 3.

[Board, strict solution and complete proof card](splitThawLocks-L36-s8-p2.json)

The tray trace describes the stored route. The capacity proof, when resolved, covers all game routes. Tail greedy win is the specified fixed-seed diagnostic, not a human rating.
