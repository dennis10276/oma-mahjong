# 50 trap ideas with an AHA (Dennis 2026-11-17: "Make 50 ideas like this. keep working untill done.")

Each idea is a hidden reason why a natural, goal-directed move wastes clock moves or tray slots, or a hidden resource that saves
them (slot accounting, NOTES.md). DONE = a board proven by hand.js on the whole board (exact clock, stored solution in the game's
own validator, the wrong move priced) - files `<id>.js` / `<id>.board.json` in this folder. Tools: hand.js, orders.js,
idea_search.js (roles + tests), gen_corridor.js (corridor + face-down pair, exhaustive), escape_variant.js (variants on a proven
corridor). "too easy" = Dennis's lab verdict of 2026-11-16; such ideas need a harder board before a level.

## Single ideas
| # | idea | hidden link | board | status |
|---|---|---|---|---|
| 1 | The corner holds the twin | at a full tray the needed tile's twin is a face-down tile far away (no slot) | h1 | DONE - Dennis: "Cool you need the face down skill" |
| 2 | Don't take the clock yet | a free clock waits in the tray for a deep twin whose dig needs all three slots | i2 | DONE |
| 3 | The dig melts the key | the frozen key's melters are tiles the dig takes anyway | freeMelt | DONE, too easy |
| 4 | One pair, two melts | one pair touches two ices | doubleMelt | DONE, too easy |
| 5 | The free key pair is the wrong colour | the free silver pair opens nothing the clock needs | silverPair | DONE, too easy |
| 6 | Silver opens the melter | the gold key's only melter is silver-locked | silverMelter | DONE, too easy |
| 7 | The keys melt the clock | the keys touch the frozen clock | keyMelt | DONE, too easy |
| 8 | The gold key waits for silver | a gold key carries a silver lock; the silver key is frozen | silverWait | DONE, too easy |
| 9 | The clock goes to the tray too | at the end the tray is full: the clock's face-down twin | - | open (never forced yet) |
| 10 | The face-down pair melts | the face-down pair you must use also melts the frozen clock | i10 | DONE (on 356's corridor: rebuild elsewhere) |
| 11 | Both are face-down | the needed tile and its twin are both face-down | i11 | DONE |
| 12 | Uncover the escape first | the escape lies under a tile whose twin is far: a visible pair needs a free slot | i12 | DONE |
| 13 | The silver keys melt the gold key | double duty across the colours | i13 | DONE |
| 14 | Crossing | the silver key on the clock carries a gold lock; the free silver key taken first only waits | i14 | DONE |
| 16 | The long way is the only way | one side of the clock is short but slot-hungry, the other long but pairs | i16 | DONE |
| 17 | The twin is under the lock | free clock; its twin under a gold-locked tile | i17 | DONE |
| 22 | The clock's twin is behind silver | free clock; its twin under a silver-locked tile | i22 | DONE |
| 23 | The clock's twin is frozen | free clock; its twin frozen 3 | i23 | DONE |
| 29 | The twin is behind both colours | free clock; twin under gold lock; a gold key carries a silver lock | i29 | DONE |
| 30 | Melt the escape first | the escape is frozen; melting it is a visible pair (needs a free slot) | i30 | DONE |
| 31 | Unlock the escape first | the escape is silver-locked; the silver keys are a visible pair | i31 | DONE |
| 34 | You don't need the keys | the short side is gold-locked; the keys route is shorter in tiles but all of them wait | i34 | DONE |
| 36 | The escape lies on the clock | the tile that needs the face-down twin is the clock's own roof | i36 | DONE (on 356's corridor: rebuild elsewhere) |
| 39 | Gold opens the way to melt silver | the frozen silver key's melters are gold-locked; a gold key lies under the free silver key | i39 | DONE |
| 40 | One colour at a time | the clock is locked twice; one free key of each colour taken early leaves two waiting | i40 | DONE |
| 43 | The twin melts the clock | the frozen clock's last melter is its own twin | i43 | DONE (18 deep) |
| 47 | The melting pair | the clock's two side tiles are a pair: take both to finish the melt slot-free | i47 | DONE |
| 52 | The gold key lies on the silver key | lift the gold key, open silver, fetch the second gold key | i52 | DONE |
| 55 | Save the escape | an easy face-down pair early spends the escape needed at the full tray | i55 | DONE |
| 56 | The escape is gold-locked | the escape's keys are a dig pair: take them before the tray fills | i56 | DONE |
| 57 | The roof can wait | the clock's only roof is a silver key; its partner is deep: lift the roof last | i57 | DONE |

## Two chains / combinations
| # | idea | links | board | status |
|---|---|---|---|---|
| 59 | Don't take the clock: its twin needs the escape | free clock + face-down escape | i59 | DONE |
| 60 | The silver key belongs to the second half | gold chain to the clock, silver chain after it; the free silver key taken early waits | i60 | DONE (two chains) |
| 62 | Free clock, silver-locked escape | free clock + escape behind silver | i62 | DONE |
| 63 | Free clock, gold-locked escape | free clock + escape behind gold | i63 | DONE |
| 65 | Free clock, both face-down | free clock + both tiles of the escape face-down | i65 | DONE |
| 67 | Free clock, save the escape | free clock + the easy face-down pair spends the escape | i67 | DONE |
| 68 | Free clock, the escape on the clock | free clock + the escape's partner is the old clock's roof | i68 | DONE |
| 71 | Escape, then silver | face-down escape to the clock; a silver chain after it, its free key taken early waits | i71 | DONE (two chains) |
| 72 | Both face-down, then silver | | i72 | DONE (two chains) |
| 73 | Uncover the escape, then silver | | i73 | DONE (two chains) |
| 75 | Gold-locked escape, then silver | | i75 | DONE (two chains) |
| 77 | The escape is the key pair | the clock's gold keys are the face-down pair itself (the key sign shows on the back) | i77 | DONE |
| 79 | The escape opens silver, silver opens gold | face-down pair = silver keys; silver frees a gold key; gold opens the clock | i79 | DONE (spare board i79b) |
| 81 | Escape and gold keys in the dig, then silver | | i81 | DONE (two chains) |
| 83 | Save the escape, then silver | | i83 | DONE (two chains) |
| 84 | Both face-down keys | both tiles of the escape are face-down and are the clock's gold keys | i84 | DONE |
| 85 | Uncover the escape, which is the key pair | | i85 | DONE |
| 87 | Melt the escape, which is the key pair | | i87 | DONE |
| 88 | Uncover the escape, then the key chain | | i88 | DONE |
| 89 | Save the escape, which is the key pair | | i89 | DONE |
| 90 | The escape is silver-locked and a gold key | crossing: silver keys open the escape, the escape opens the clock | i90 | DONE |

## Dropped or parked (with the reason)
- Mixed keys: the game matches equal pictures by itself - no wrong move exists.
- Look before you dig: after the wrong side the right side's tile still matches - no wrong move.
- Park the twin early / clear a visible pair while you can: never forced (if there is room to park, there is room for the tile
  itself); only a face-down pair changes the slot count.
- The way that melts: every side tile also touches the clock's ice, so both ways melt the same.
- 27 The ice ladder (2026 too open), 46 Start at the far edge (lives inside 356; not forceable on 1023), 50 Its twin is behind
  silver (the waiting tile always fits), 53 The keys thaw each other (search too slow), 61 Free clock + frozen escape (slack),
  64 The clock melts the silver key (on 1032 the side tile melts it anyway).

Count: 32 single ideas (with 77 and 79) + 19 combinations / two-chain boards = 51 proven. Failed combinations (slack: the wrong
move still wins): 61, 66, 70, 74, 76, 80, 82, 86.
