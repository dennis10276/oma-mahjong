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

## New families (Dennis 2026-11-17: "make 10 family ideas more. combinations dont count as new")
Each one is a single new wrong idea, not two old ones together. Lab on port 8292 (scratchpad lab-families, levels 450-458);
all nine stored solutions win in the real game (second-key www).
| # | family | the wrong idea / the hidden reason | board | proof |
|---|---|---|---|---|
| F1 | Keys before the lid | "dig straight to the clock": the lid is gold-locked and the keys are at the other end; the dig's tiles wait while you fetch them | f1 (1000) | clock 20 (min 19); digging to the lid first needs 23 |
| F2 | The clock is face-down | "I'm stuck at three": the clock itself turns over and goes with its free twin, no slot; taking that twin early only makes it wait | f2 (1011) | clock 14 (min 13); without the face-down pair 25; twin first loses |
| F4 | The clock closes the pair | "avoid the tower whose top tile waits all the way": its top is the clock's twin, and the clock closes that pair at the end; the other tower leaves no room for the clock | f4 (1011) | clock 16 (min 15); the other tower first loses |
| F5 | The escape is too slow | "the face-down pair will save me": it does, but costs three moves (uncover 61, 48, then the pair) - one free tile from the other tower at the right moment keeps the tray from filling | f5 (1011) | clock 13 (min 12); the left way alone: no win in 13, with the escape 14 |
| F6 | Don't rush the clock | "reach the clock": the short way gets there in time with three tiles waiting whose twins are buried - stuck right after the clock; the other way leaves room | f6 (1011) | clock 12 (both ways 12); tail_check: all 100 short-way orders lost after the clock |
| F7 | Trust the full tray | "clear the tray first to be safe": the tray goes to three four times and the next dig tile always matches; the clearing move is one the clock lacks (spare 0) | f7 (1000) | clock 11 (min 11); clearing with 70 first needs 12 |
| F8 | The twin is beside the clock | "its twin is right there": the twin lies uncovered beside the clock but is boxed in until the clock goes; the tile waits the whole left way | f8 (1011) | clock 14 (min 13); the left way alone no win; 2nd left move needs 17 |
| F9 | The bridge melts from both ends | "dig one tower": the frozen clock's only melters are its two bridge partners, one under each tower, and the towers' tiles are twins of each other - dig both in step | f9 (1011) | clock 26 (min 25); one tower first loses; 16 of 16 tempting moves bite |
| F10 | Melt before the lid | F1's ice cousin: the lid is frozen 5, the dig melts it 4 times, the 5th melt (34 under 56) must come first | f10 (1000) | clock 16 (min 15); digging first needs 19 |

Dropped: F3 "The keys pair across colours" (each gold key's twin a silver key) - it reduces to taking a free key early (the worn-out
early-key trap). Jokers (a joker also pulls its target's twin out of the pile, even buried) would give real new families, but
jokers are gone after level 50 by the rules (jokersGoneFrom) - Dennis's call. Tool added: tail_check.js (is the level lost after the
clock for every order over some tiles), orders.js/idea_search.js `trayMax` (a win must leave room after the clock).
Note: F2/F4-F6/F8/F9 all use layout 1011's bridge (an H with two towers): spread them out or move them to other layouts before a
release range.

## Three ideas on hand-made layouts (Dennis 2026-11-17: "Use more variety of layouts and give me 3 new ideas you really thought
## about. You may change the layouts to the needs of the trap")
How they were found: a trap is a wrong set of tiles, a wrong order, wasted moves, or stuck after the clock - and until now always
because of slots or clock moves. The one reason never used: the short way is *impossible* (a loop), not just expensive. N1/N2 build
that; N3 gives the clock a second job (it thaws). Layouts in layouts-custom.json (custom_layouts.js writes and checks them; hand.js
loads ids 3000+); every upper tile half off the ones below (no straight stacks, towers 0). Lab port 8293 (scratchpad lab-three,
levels 460-462); stored solutions win in the real game.
| # | idea | the wrong idea / why | layout | proof |
|---|---|---|---|---|
| N1 | The circle | "take N to melt the wall": the wall F's only melters are N and M, and M is boxed in between F and the clock - F needs M, M needs F. The short way can never open; go round | 3001 Alcove (open left middle so nothing else touches F) | clock 8 (min 7); test 'loop': no win via the left at any length; N first loses |
| N2 | Break the circle | after N1, "the loop is closed, go round": round fills the tray. F has a third melter, V, straight above it in the next row (ice reaches the row above, sides do not): A, V, N melt F | 3002 Terrace (row A V B above the loop) | clock 9 (min 8); route A V N F M S P C; going round (S, R) loses |
| N3 | The icicle | "keep room after the clock" (F6's lesson) / "take the short way": a frozen column hangs under the clock, each tile melted only by the one above; its pictures are R, R2 and the clock's twin. The right way arrives full and the icicle melts into the tray; the short way's tiles have buried twins | 3003 Icicle | clockN 8; tail_check: all 124 short-way orders lost after the clock, right way alive; only X7/X9 are side-by-side twins (the right way needs them to pair); real game: short way stuck with no safe move, right way: the icicle's first tile matches |

## Buried chains (Dennis 2026-11-17 after lab-three "Soo easy": "Make all the new ideas like that. then a lab"; and: "good levels
## are levels where many different wrong paths looks good for a long time. Then to realize AHA i missed this detail several times")
Every new idea rebuilt as a 60-70 tile board on its own hand-made layout (custom_layouts.js, ids 3101-3112; no straight stacks,
every upper corner supported), the idea's key tiles hidden under covers until you have committed, a lock/key chain on top, the
clock 11-20. Proven by hand.js; wrong paths measured by hope.js (points of no return whose false hope lasts 5+ moves) and the best
of several seeds kept (best_of.js); after-clock traps also by tail_check (now inside idea_search: `tailLose`). Lab port 8294
(scratchpad lab-buried, levels 470-480) with NO titles or explanations on the cards (NOHINT=1 in hand_lab.js) - the earlier labs
showed the trap's name and solution above the Play button. All 11 stored solutions win in the real game.
| lv | board | idea | layout | clock | specials | long wrong paths |
|---|---|---|---|---|---|---|
| 470 | b1 | The circle | 3101 Keep | 18 | ice, gold lock+keys | 6 |
| 471 | b2 | Break the circle | 3102 Lattice | 14 | ice, gold lock+keys | 3 |
| 472 | b3 | The icicle (short way dies after the clock) | 3103 Drip | 16 | ice, gold lock+keys | tail |
| 473 | b4 | Keys before the lid | 3104 Well | 19 | gold lock+keys | 7 |
| 474 | b5 | Melt before the lid | 3105 Ridge | 20 | ice, silver lock+keys | 6 |
| 475 | b6 | The clock is face-down | 3106 Hill | 20 | face-down clock, gold lock+keys | 7 |
| 476 | b7 | Trust the full tray (spare 0) | 3107 Steps | 15 | gold lock+keys | 14 |
| 477 | b8 | The clock closes the pair | 3108 Gate | 11 | silver lock+keys | 3 |
| 478 | b10 | Don't rush the clock (short way dies after) | 3110 Pier | 19 | gold lock+keys | tail |
| 479 | b11 | The twin is beside the clock | 3111 Arch | 16 | gold lock+keys | 4 |
| 480 | b12 | The bridge melts from both ends | 3112 Span | 18 | ice, silver lock+keys | 5 |
Not done: b9 "The escape is too slow" (layout 3109 Shelf) - no picture set where the short way needs relief, one plain tile gives
it and the face-down escape is too slow; three redesigns failed (the short way is only 9 moves, too few tiles to hold the pressure).
