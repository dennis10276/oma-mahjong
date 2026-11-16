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

## Lab 2026-11-16 (8288): all six too easy
Dennis: "not really, easy to spot on second dig" (freeMelt), "really easy" (doubleMelt), "very obvious path, feels forced"
(silverPair), "your last work was better with the ice smartness" (silverMelter), "you're focused on the locks and clock anyway,
not on random free pairs" (keyMelt), "kinda easy but rewarding" (silverWait). His moves (replay_study.js): on freeMelt his first
move was the designed wrong one and he won the second try.

## Understanding the game: slot accounting (H1, 2026-11-16)
- Every waiting tile holds one tray slot from its take until its twin. Three slots, the 4th loses. Difficulty = the slot budget.
- A **holder** is a tile the way forces early whose twin comes late (after the clock, or deep under it). Holders forced early leave
  one slot for everything else; the order of the rest becomes the puzzle (H1: 71's twin after the clock, 47 waits for 10, 63 for 38).
- The natural, goal-directed mistake is a free tile beside the clock whose twin lies UNDER it: it holds a slot the whole dig (H1: 63).
- A face-down pair (a face-down tile + its free twin, no slot) is FORCED only when, at the moment the late tile is freed, the tray
  is full in every order. Otherwise you take the late tile and then its free twin at once. Recipe: the late tile must come after
  several prerequisites (a lock on it, or tiles on it), and three of those prerequisites are holders. The key pair must complete
  before the holders fill the tray. A narrow corridor (hourglass waist) gives the room; the vase neck (1037) does not.
- Narrowness comes from the layout (few entries to the clock), not from the pictures: on an open block (2023) any pictures leave
  7 winning first moves.
- Verify with `orders.js` (every winning order, exact winning first moves). H1: one first move (71) out of three free ones; the
  face-down pair 70+41 forced; won in the real game.

## 356 played (2026-11-16): "Cool you need the face down skill to finish it"
5 tries, no win yet: try 1 the designed wrong start (63 beside the clock), try 2 the corner taken early, then the right opening.
Dennis: "I need way more original ideas like this. using facedown while having 3 in tray should be used more. Like present in 1
every 4 levels in chains." And: "In the end we want to spit out levels not just per 50."

## From hand pattern to generator: gen_corridor.js
The H1 pattern as a generator: per layout, every deep clock spot; the minimal dig from the solver (all pictures equal); every late
tile, a couple of far free tiles as the face-down twin, every pairing of the other dig tiles (one buried holder when odd);
`orders.js` keeps a pairing only when the face-down pair is forced, at most 2 first moves win and no free tile beside the clock
starts a win; then `hand.js prove` on the whole board. Random sampling found nothing (the forced region is about 0.2%); the
exhaustive pairing finds it in seconds (on 1006 it rediscovered H1's mirror: a copy, not used).
Next: variations that keep the core and change the chain (a lock on the late tile with the keys in the dig, ice on a holder,
silver keys), a filter against copies (same layout + mirrored clock region), and the other hand patterns.

## "Park the twin early" is impossible (proved 2026-11-17)
If the tray has room to park a far visible twin F before the late tile L, it has room for L itself: take L, then F right after
(free), same moves, same slots. So parking a visible twin is never forced (gen_corridor --park: 0 boards with real parking in
~130k pairings on 3 layouts, and the argument above says why). Only a face-down twin changes the slot count, because a
face-down pair uses no slot: that is what makes the full-tray face-down pair a real mechanic.
