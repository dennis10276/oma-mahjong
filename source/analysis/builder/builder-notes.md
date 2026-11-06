# Builder v2: what helper D changed and why (2026-11-06)

Files: `tools/builder/builder.js` (rewritten in parts), `tools/builder/test_builder.js` (new, `node --test`, ~5 s).
`stories.js`, `engine.js`, `gate.js` and the briefs are unchanged. `build(brief, opts)` and `fits(story, tiles)` keep their
signatures; the result shape is the same, with `fails` added on success too and new card fields.

## The numbers

**Lead's harness**: every story on layouts 0, 5, ..., 45, brief `{ frame: {spare: 1}, targets: {trayRoom: 0, maxDown: 0.3,
hiddenOnWay: 2}, seed: 1 }`, `{ms: 10000}`. Skipped means `fits()` says no (islands, or roles that cannot be placed).

| | before | after |
|---|---|---|
| built | 86 of 94 (6 skipped) | 88 of 93 (7 skipped) |
| builds returned with an unproven intent | 18 | 0 (a board is only returned when every intent is proven; 5 builds fail as `unproven` instead) |
| forced tray pressure (no order of play keeps a slot free) | 40 of 86 | 88 of 88 |
| moves with 3 waiting on the way: median / boards with 3+ | 2 / 30 | 3 / 56 |
| luck moments (target 2) | 0: 45, 1: 34, 2: 6, 3: 1 (mean 0.57) | 1: 46, 2: 42 (mean 1.48) |
| decision traps proven (E.winnable: lost after the tempting move) | not built | 82 of 88 boards |
| time: median / p90 / max / over 5 s | 121 ms / 1.7 s / 11.8 s / 6 | 31 ms / 0.86 s / 4.8 s / 0 |

**Helper C's gate** (`node tools/builder/gate.js --seeds 1,2,3 --jobs 2 --tag helperD-3`; before = `gate-report.md`, v1):

| | before (v1) | after (helperD-3) |
|---|---|---|
| builds | 146 of 150 | 146 of 150 (97.3%) |
| briefs built for some seed | 49 of 50 | 50 of 50 |
| every intent proven | 132 of 146 | 146 of 146 |
| idle specials | 55 (in 30 boards) | 0 |
| over 5 s | 2 (CPU) | 0 (max 4.7 s wall) |
| static checks clean | | 146 of 146 |

trayRoom 0 boards of the gate (74 built both times): moves with 3 waiting median 2 -> 3, boards with 3+ 24 -> 49, forced
24 -> 67, luck now follows hiddenOnWay (mean luck 0.00 / 0.93 / 1.59 / 2.25 for hiddenOnWay 0 / 1 / 2 / 3).

**The new targets** (`frame.way: 14, targets.three: 5, hiddenOnWay: 1`, the real 200-225 medians), same 10 layouts: built
deepClock 8, keysFarSide 8, clockInSight 8, lockBeside 10, roomInTrayFrozen 8, frozenGuards 6, iceLockClock 4,
chainReaction 1 (of 10). Every built one lands within 1 of all three targets (way 13-15, three 4-6, luck 1).

## What changed and why

1. **Forced tray pressure (the main change).** Before, the tray reached 3 only on the planned order; a careful order kept
   a slot free on nearly every board. Now:
   - `necessary(c, roles, P)`: the dig tiles no way to the clock can avoid (with the tile pinned, everything else that
     can ever leave the board leaves, and the clock still cannot: unlimited time, so it holds for every order).
   - Two necessary dig tiles get holders as twins ("orphans"): tiles covered during the whole dig and more than
     `spare` moves away from it. They wait until after the clock in every order. Then the clock makes the third: it
     closes a dig tile (which waits beside the two orphans until then) or it opens with two waiting. So every way to
     the clock in time reaches 3, whatever the order (cap 2: one orphan; cap 1: none).
   - Proven by `canReachWithin(design, cap - 1)` = 'no'; placements are retried (6 variants, then other roles) until it
     holds. On the harness every built board is forced; on the gate 67 of 74 trayRoom-0 boards.
   - The other dig tiles pair greedily along the dig (open, the next closes it), so once both orphans are out every new
     picture brings the tray to 3. `targets.three` picks the orphan pair whose plan is nearest the target (earlier
     orphans = longer at the cap); without a target, the earliest (most pressure).
   - The keys go together once both are free (planDig, and planRest after the clock), and when only one key is free the
     dig first opens the other key's side: a lone key waiting for its twin would need a fourth slot.
2. **chainReaction / frozenGuards 'dig' and noClockPlace.** Causes: (a) needSet counted a frozen key as the thaw of the
   other frozen key next to it (each waited for the other); `planned` now counts only neighbours that can go on their
   own, and frozen keys may not be each other's ice neighbours. (b) A key's own cover thawed its ice, so ice 1-2 was
   idle on most covered tiles: a key's ice is now `max(keyIce, cover neighbours + 1)` when that is at most 2. (c) Keys in
   a row boxed in by covered tiles at both ends (letter H bar) could never come free: a key must come free with its
   cover and at most 6 side moves; planDig can dig the cover of a row's end tile. (d) Side-opening limit 8 -> 14.
3. **iceLockClock speed.** Locks are placed only on thaw neighbours that can go before the clock (not under it), the
   dear ones (dearer than the keys' way) stay open, and clocks with few thaw neighbours come first. Prune checks story
   specials first and stops when one is idle (the story is lost anyway), tries a quick proof that a special matters
   (a shorter legal planned way that is winnable) before the engine, and an unresolved search is a failure, never
   "matters" (gate point 3). Every engine budget ends at the build's deadline (`clockSearch` gives each candidate
   goal its own finishing budget: that is why one call could take 7 s). Hard stop 4.5 s.
4. **Islands.** The detection is right: the 29 layouts without peaks are single hills (also "castle/oval · two
   islands"); a smaller group size finds nothing more. But only tiles at or above the split layer counted as island
   tiles, so no covered key fitted on small peaks. Now a peak's territory includes every lower tile under or beside it
   (and under or beside no other peak). `fits()` runs placeRoles with 8 fixed seeds (cached), so it answers whether the
   roles fit (gate point 6): keysOnIsland fits 19 layouts.
5. **Luck.** `placeDown` puts exactly `luck` face-down tiles where a dig take opens a picture while 2+ wait (preferably a
   dig tile), and keeps every other face-down tile away from those moments on the planned way. The witness is the
   planned way whenever it is a fewest way, so the count on the card is the planned one. The orphan choice prefers
   plans with enough such steps. A luck moment brings the tray to 3, so with trayRoom 1-2 the luck target is 0 (the
   intent says so); hiddenOnWay face-down tiles still go on the dig at calm moments. Intent: luck within 1 of target.
6. **Decision traps.** A free face-up pair off the dig, in sight from the start, not beside a dig tile or a thaw
   neighbour; its later tile is moved next to the earlier one in the rest order (moving a free tile earlier keeps the
   order legal). Proven by `E.kindOf` = 'pair' (tempting) and `E.winnable` after the first tile = 'lose'. Placed by
   default with spare 1 (`targets.traps` to ask for more); a designed trap that the engine cannot prove lost is not
   claimed (card.traps.designed vs .tempting).
7. **No free cruising.** Intent: the clock is not in the last third of the solution, and the tray reaches min(2, cap)
   in the first half. Holds on every built board (the orphans are early on the dig).
8. **Gate points 1 and 2.** Holders that hold no orphan's twin lose their lock or ice before the clock way is measured;
   "partners held back" counts only holders that are out of reach AND hold the twin of a tile waiting at the clock.
   Covered-partner stories (roomInTray*, deepClock) keep at least one twin waiting, so their cap is at least 2 even with
   trayRoom 2 (card.trayCap says which). Builds retry until every intent is proven.
9. **Way target.** `frame.way`: clocks whose planned dig is within 1 of the target (covered-clock stories may go deeper
   than their usual depth for it); intent within 1.

## What remains weak

- chainReaction rarely reaches a long way (keys with cover 0-1 and a clock at depth 0-2 give short digs): 1 of 10 at
  way 14. iceLockClock: 4 of 10; its fewest-way searches stay ~1 s each on some boards, so builds near 4 s happen.
- A few lock stories still fail as `unproven` on the harness (frozenGuards 15/40: tray only 2 when the orphans would
  need a fourth slot around a key; chainReaction 20/25/30: no luck step available). The gate has 3 such failures
  (iceLockClock-diamond-30 with hiddenOnWay 3 and spare 3: only 1 luck step on its dig).
- Forced pressure with spare 3: holders must then be 4+ moves deep; 7 of 74 gate trayRoom-0 boards are not forced.
- The way and three targets are met only when the shape allows them; the builder does not lengthen a dig with
  side tiles on purpose (it only picks a clock whose dig is long enough).
- Traps exist only with spare 1 (with more spare a pair costs no more than the spare and is rarely lost).
