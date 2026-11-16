# Hand-designed traps for 350+ (Claude, from 2026-11-16)

Dennis, 2026-11-16: "Go build the 350-400 set and get to understand how to make hard and challenging AHA puzzles", then "Seems like
you should handdesign some more to automate it after when you can see a pattern". This folder holds the hand designs, written as
motifs for `tools/builder/bank/hand.js`, and what they teach.

## What Dennis's verdicts say (all labs, 101 rated boards, `aha_study.js` in the session scratchpad)
- **AHA = a wrong idea he has not met in that form, inside a chain of 3-4 linked specials.** Known ideas get "familiar", "easy to
  spot"; two-link chains get "too easy to see the right route".
- **Hard to spot = the natural move is the wrong one.** His hardest liked boards (lookalikeWay-L14, 5 stars, 7 tries; 2042210,
  11 tries "too extreme", 999+) have long routes (10-18 moves to the clock), spare 1, and a tray that is full on every route: on
  lookalikeWay-L14 2+ waiting on 17 of 18 moves, 3 waiting 8 times, and the engine proves no route manages with less than 3.
  One extra single (a lookalike key, the wrong melter) costs a slot that never comes back.
- Static traits (route length, tray share, chain count, face-down share) do not separate his easy boards from his hard ones on
  their own. The difference is the kind of wrong idea and whether it is new to him.
- After the trap: light for hard traps (pressure parks about 2 at 300+), 5 for easy ones.
- Two second chains after the clock (silver holds, no new idea): "too easy and straightforward", "no AHA" (2026-11-16). A second
  chain needs its own hidden link too, not only tray caution.

## Method
1. Write the trap as a motif: named tiles and relations (`on`, `iceNb`, `side`, `free`, `deep`, `far`, `notOn`, `minLayer` ...),
   the specials, the route goals (`hand.js` digs to each goal), the trap pairs, and the intended wrong moves.
2. `hand.js design <motif.js>` searches the layouts for tiles that fit, fills the other pictures (twins kept apart), and proves:
   strict replay, exact clock minimum, each intended wrong move bites, all tempting moves priced (`trap_offers.js`).
3. Look at the board in the game, then a lab for Dennis.

## Geometry lessons (pyramids)
- A deep clock's neighbours on its own layer stay covered until the clock is reached: a wrong move "next to the clock" is never
  free. Put the tempting tiles where the dig or the surface opens them (`minLayer`, `at: 'auto'` finds the moment).
- Tiles under a tile also count as its ice neighbours but can never go first; tiles on it count and must go anyway (the roof melts).
- A key under the clock's lock cannot be dug: lock tiles block everything below them.

## Motifs so far
| motif | hidden link (the AHA) | status |
|---|---|---|
| freeMelt | the dig melts the frozen key; melting it first from outside costs | proven: 13-move route, both outside melters lose |
| silverWait | a gold key carries a silver lock; a frozen silver key melts on the way | proven: 19-move route; the "early gold key" bait only opens late |
| keyMelt | the keys touch the clock: taking them opens the lock and melts it | proven but short (5 moves): needs the depth elsewhere |
| doubleMelt | one pair touches two ices | proven: 9-move route, both lonely melters lose (ice near the surface) |
| silverPair | the free key pair is the wrong colour | proven: 23-move route, the free silver pair at move 12 loses |
| silverMelter | the gold key's melter is silver-locked: silver first | proven: 19-move route, early gold key loses, outside melt costs 2 |
