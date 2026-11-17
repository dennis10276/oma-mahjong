# 50 trap ideas with an AHA (Dennis 2026-11-17: "Make 50 ideas like this. keep working untill done.")

Each idea is a hidden reason why a natural, goal-directed move wastes clock moves or tray slots, or a hidden resource that saves
them (slot accounting, NOTES.md). A row is DONE when a hand board is proven (hand.js) - file `<id>.js` / `<id>.board.json` here.
Earlier "too easy" boards (lab 2026-11-16) count as ideas but need a harder board before they go to a level.

| # | idea | hidden link | board | status |
|---|---|---|---|---|
| 1 | The corner holds the twin | at a full tray the needed tile's twin is a face-down tile far away (no slot) | h1 | DONE, Dennis: "Cool you need the face down skill" |
| 2 | Don't take the clock yet | a free clock waits in the tray for a deep twin whose dig needs all three slots | i2 | DONE |
| 3 | The dig melts the key | the frozen key's melters are tiles the dig takes anyway | freeMelt | done, too easy |
| 4 | One pair, two melts | one pair touches two ices | doubleMelt | done, too easy |
| 5 | The free key pair is the wrong colour | the free silver pair opens nothing the clock needs | silverPair | done, too easy |
| 6 | Silver opens the melter | the gold key's only melter is silver-locked | silverMelter | done, too easy |
| 7 | The keys melt the clock | the keys touch the frozen clock | keyMelt | done, too easy |
| 8 | The gold key waits for silver | a gold key carries a silver lock; the silver key is frozen | silverWait | done, too easy |
| 9 | The clock goes to the tray too | at the end the tray is full: the clock's face-down twin | - | open (full-board forcing) |
| 10 | The face-down pair melts | the face-down pair you must use also melts the frozen clock | - | open |
| 11 | Both are face-down | the needed tile and its twin are both face-down | - | open |
| 12 | Uncover the escape first | the face-down escape lies under a tile whose twin is far: a visible pair needs a free slot | i12 | DONE |
| 13 | The silver keys melt the gold key | double duty across the colours | i13 | DONE |
| 14 | Crossing | the visible silver key carries a gold lock: taking the free silver key first only waits | i14 | DONE |
| 15 | The roof melts it, the outside costs slots | outside melters are singles that fill the tray late | - | open |
| 16 | The long way is the only way | one side of the clock is short but slot-hungry, the other long but pairs | i16 | DONE |
| 17 | The twin is under the lock | the clock's twin lies under a locked tile: the free clock waits for the keys | i17 | DONE |
| 18 | (dropped) Mixed keys | the game matches equal pictures by itself: no wrong move exists | - | dropped |
| 19 | Which face-down pair | at a full tray two face-down pairs exist; only one opens the way (spare 1) | - | open |
| 20 | The melter is the clock's roof | the frozen key melts only from the clock's roof: dig the roof early | - | open |
| 21 | The clock melts the silver key | after the clock: the clock was the last melter of a silver key (second chain) | - | open |
| 22 | The clock's twin is behind silver | the free clock waits; its twin lies under a silver-locked tile | i22 | DONE |
| 23 | The clock's twin is frozen | the free clock waits; its twin is frozen 3 | i23 | DONE |
| 30 | Melt the escape first | the face-down escape is frozen; melting it is a visible pair (needs a free slot) | i30 | running |
| 31 | Unlock the escape first | the face-down escape is silver-locked; the silver keys are a visible pair | i31 | running |
| 34 | You don't need the keys | the clock's short side is gold-locked; the keys route is shorter in tiles but all of them wait | i34 | DONE |

Rules found on the way (NOTES.md): parking a visible twin is never forced; tiles never become unavailable again, so "do it
while you can" exists only for moves that need a free slot for a moment (a visible pair at a full tray) or for the clock's moves.
| 27 | The ice ladder | the frozen clock's melters are frozen too; only one thaw chain fits | i27 | parked: too open on 2026 (many first moves) |
| 29 | The twin is behind both colours | free clock; twin under gold lock; a gold key carries a silver lock | i29 | DONE |
| 36 | The escape lies on the clock | the tile that needs the face-down twin is the clock's own roof | gen roofesc | proven on 1006 (H1's layout: copy risk), other layouts running |
| 39 | Gold opens the way to melt silver | the frozen silver key's melters are gold-locked; a gold key lies under the free silver key | i39 | DONE |
| 40 | One colour at a time | the clock is locked twice; one free key of each colour taken early leaves two waiting | i40 | DONE |
| 43 | The twin melts the clock | the frozen clock's last melter is its own twin; take it and later the clock matches it | i43 | DONE (18 deep) |
| 46 | Start at the far edge | pure order: only far first moves win; beside the clock fills the tray | i46 | running |
| 47 | The melting pair | the clock's two side tiles are a pair: take both (one side would do) to finish the melt slot-free | i47 | DONE |
| - | (dropped) Look before you dig | after the wrong side the right side's tile still matches: no wrong move | - | dropped |
