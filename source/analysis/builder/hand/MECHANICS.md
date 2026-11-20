# Oma's Mahjong - every rule and subtlety that matters for traps (2026-11-20)

Dennis 2026-11-20: "I want you to really understand the game and all of its mechanics and subleties so the design of traps feels
even more cool. Every small subtlety that is NEEDED in a trap and not easily seen is very cool."

Read from the game itself (`wip/second-key` www: js/board.js, js/specials.js, layouts.js, hard.js, js/rules.js, js/lang.js,
style.css), then **checked in the real game**: 14 tiny boards, one rule each, played by a script that taps and reads the game's
state (`tools/builder/bank/mech/`: `make_mech.js` writes the boards, `run_mech.js` plays them in a lab; all 14 pass).
"verified" below = one of those checks.

## 1. Where a tile can be taken (geometry)
- **Covered** by any tile in any higher layer with |dx| < 2 and |dy| < 2 - two layers up counts too, with nothing between.
- **Free** = not covered and one side open: no tile in the same layer at x - 2 (|dy| < 2) **or** none at x + 2. One open side is
  enough. A tile half a row up or down (|dy| = 1) blocks a side; a tile half a tile further away (dx 3) does not.
- **Darkened**: covered or side-blocked tiles are drawn darker (setting "darken stuck tiles", on by default). A frozen or locked
  tile that is free is NOT darkened - only its ice or lock picture says it cannot be taken.

## 2. The tray
- 4 slots; a tile whose twin waits matches at once; a 4th tile without a partner ends the level (verified). Colours: 2 waiting
  "careful", 3 waiting "full".

## 3. Face-down tiles
- First tap turns it over (no move); second tap takes it. **One open at a time**: turning another over closes the first
  (verified).
- **An open tile counts as already picked** (the game's own text): tap its twin - face-up or face-down - and both go at once, two
  moves, no slot, with any number waiting (verified). So while a tile is open you **cannot take its twin alone**; close it first
  by turning another face-down tile over (verified).
- **Its twin already waits** -> the first tap takes it, no turning over (verified).
- **Two face-down twins**: open one, tap the other once -> both go, the second never shown on its own (verified). A wrong guess
  only turns the second over (no move) - testing face-down tiles against each other is free (verified).
- At a full tray every tap on a face-down tile is safe: it opens, or it matches.
- A face-down tile that is covered, frozen or locked cannot be turned over: its picture stays unknown until it is free and open.
- Special signs (key, lock, clock, ice) show on the back; only the picture is hidden.

## 4. Ice
- Melts when tiles **leave the board** (to the tray, a match, a pair): `h` of its ice neighbours gone since the start.
- **Ice neighbours**: same layer within dx <= 2 and dy <= 2 but not both 2 - the side tiles, the tiles straight above and below
  in the next rows (dx 0, dy 2), half a tile over in the next row (dx 1, dy 2, verified: melts without blocking), and the tiles
  half a row up/down beside it (dx 2, dy 1: these also block a side); plus **one layer** up or down overlapping it. A tile two
  layers up covers it but does **not** melt it (verified). Tiles under it count but can never go first.
- **Display: ❄️ = 1 melt left, ❄️❄️ = 2, ❄️3 / ❄️4 ... = that many** (wip/second-key 6696c25c; Dennis 2026-11-20 "Show the real
  number"). Before that, ice 3+ looked like ❄️❄️ and every text said 2. Live levels use only 1 and 2; hand boards with 3-5 (b1,
  b2, b5, b12, f10, i10, i13, i23, i43, i47) need a lab built from that branch.
- A tap on a frozen tile (even a covered one) lights up every tile that still melts it: the neighbourhood is discoverable.
- A face-down tile under ice cannot be turned over.

## 5. Locks and keys
- A lock opens when **every** key of its set has left the board - **matched or not**: two keys waiting in the tray already opened
  it (verified). **Every** lock of that colour opens at once (verified).
- A locked tile cannot be tapped or turned over; it still covers what lies under it and blocks its neighbours' sides.
- A tap on a locked tile (even buried) wiggles the keys and makes the tiles on buried keys see-through.
- A key may carry the other colour's lock (shows both signs). Gold is the only set unless the idea needs a second one (Dennis
  2026-11-18: silver only next to gold). The shuffle keeps the two keys of a set the same picture (keys are meant to be twins).

## 6. The clock
- A number of moves: every tile that leaves the board is one (a pair is two). Turning over, see-through taps and taps on stuck
  tiles cost nothing.
- Checked after each **action**: the clock as the n-th single tile is in time; the n-th tile not being the clock loses at once.
- **A face-down pair counts as one action**: started with one move left, the clock as one of its two tiles is still in time - one
  move past the number (verified: number 2, taken as the 3rd tile). Allowed as a design trick (Dennis 2026-11-20);
  `Hard.validSolution` agrees since 6696c25c (only a pair that holds the clock gets the extra move).
- The clock's own picture matches like any tile (it can close a waiting pair, or be half of a face-down pair). The clock button
  makes the clock flash red through the pile.

## 7. The sun ("the ice melts by itself", specials.js obRelief)
- After a move: if **no tile can be taken** but some free tile is frozen or locked, and the tray is not full, **all ice on the
  board melts** at once - or, with no ice left, the gold locks open, then the silver ones - **without a move** (verified, both).
- A full tray never gets it: the free tiles are takeable (as a fatal 4th), so it is not "nothing takeable".
- The builder's engine and the game's validator do not know it. `relief_scan.js`: on all 71 hand boards, 2000 sensible random
  games each, it never happens (some tile is always takeable) - every proof so far stands. **Safety net only** (Dennis
  2026-11-20): no trap may need it; idea_search rejects a board where it can happen.

## 8. What a player can see without a move
- **See-through tap**: a tap on a covered tile makes the tiles on it 78% see-through for 1.8 s - its picture can be read (verified).
  Dennis does this a lot before his first move (lab replays: "(covered)" taps, 356: seven on one tile). So buried face-up pictures
  are not really hidden. **Not hidden**: covered face-up tiles. **Hidden**: face-down tiles until opened; a covered frozen or
  locked tile (its tap shows its melters or keys instead, not its picture).
- A tap on a frozen tile shows its melters; on a locked tile, its keys; the clock button, the clock.

## 9. Helpers that can get in the way
- **Auto-finish** (from level 50): with 24 or fewer tiles left, no clock on the board, no ice or locks, and every order safe, the
  game plays itself and ignores taps (verified - it swallowed a test tap).
- **Lucky glow** (from level 10, 30% once per level): a random free tile that matches the tray or has a free twin glows for bonus
  points - a random hint, cannot be designed for.
- **Hint and shuffle** after level 50 only with 3 stars on every earlier level; a shuffle re-deals every picture (keys kept as a
  pair) and dissolves any designed trap. Jokers are gone from 50; rescue is grandma-only.

## Subtleties that can carry a trap (needed, not easily seen, and fair)
| subtlety | why it is easy to miss | how a trap needs it |
|---|---|---|
| ice melts from the next row (dx 0-1, dy 2) | that tile touches nothing you look at; it does not block | the cheap melter: the wrong plan digs to melt, the right takes the tile in the next row ("Break the circle" uses it) |
| every lock of a colour opens at once | you open the clock's lock; the other lock looks like a separate job | the far locked tile is the twin you need at the full tray - it opened with the same keys |
| the keys open from the tray | you think the keys must be matched first | with keys that are not twins (game assumes twins - ask) |
| an open face-down tile grabs its twin | "looking is free" | the open tile turns your planned single into a pair (2 moves) - close it by opening another |
| a face-down twin of a waiting tile goes on the first tap | "the first tap only looks" | an extra move spent on a look |
| two face-down twins pair blind | you think you must see both | the escape at the full tray is two face-down tiles - open one, tap the other |
| face-down under ice or a lock cannot be opened | you plan to peek it | its picture (the escape?) only shows after the melt / the keys |
| the clock in a pair may be one move late | the number says you are a move short | allowed (Dennis 2026-11-20): the only way in time is the clock as half of a face-down pair started with one move left |
| only the tile right on top melts (now that the number shows) | a stack of three on ❄️3 looks like three melts | the top tile, two layers up, does not count: the third melt has to come from the side or the next row |
| the sun | nobody ever sees it | not used: safety net only (Dennis 2026-11-20) |

## Decisions (Dennis 2026-11-20)
1. Thick ice: **show the real number** - done on wip/second-key 6696c25c (❄️3, texts with the count, a line in the lesson).
2. The clock in a face-down pair one move late: **allowed as a trick** - Hard.validSolution aligned (same commit).
3. The sun: **safety net only** - idea_search rejects boards where it can happen.
