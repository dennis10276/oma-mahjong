# Level builder: the first gate run (2026-11-06)

Builder v2, phase 2 (SPEC.md section 5). We gave the builder 50 written requests ("briefs") and let it build each one
three times (seeds 1, 2, 3): 150 boards. Then we checked every board ourselves, without trusting what the builder
says about it.

**Verdict: not passed yet.** The builder makes a board for almost every request, and every board is fair (the
solution works, the clock is honest). It fails the gate on three points: some boards carry a lock or ice that does
nothing, some boards do not reach the tray pressure they promise, and two builds take more than 5 seconds. Also, the
boards are clearly calmer than the real levels 200-225 (see "How hard are the boards").

Numbers: `gate/summary-v1.md` (all tables), `gate/results-v1.json` (every board, with its design).

## The gate

| test (SPEC phase 2) | result | |
|---|---|---|
| at least 90% of builds succeed | 146 of 150 (97%) | passed |
| at least 90% of requests build (any seed) | 49 of 50 (98%) | passed |
| every build under 5 s | 2 builds over 5 s of computing time (7 over 5 s on the clock, machine busy) | **failed** |
| every promise ("intent") proven | 132 of 146 boards | **failed** |
| no lock or ice that does nothing | 55 useless ones, in 30 boards | **failed** |

## What is good

- **Fair boards.** All 146 solutions replay. 145 of 146 also pass the game's own strict test (`Hard.validSolution`);
  the last one uses a peek pair, which the game allows.
- **Honest clock.** On every board the clock = fewest moves + the requested spare. We proved each board can be won
  with exactly the fewest moves on the clock, and (145 of 146) cannot with one move less. One stayed undecided
  within the search budget (frozenGuards-house-13 seed 1).
- **No hidden tile free at the start**, pictures all fine (0-35, each 2 or 4 times, 72-96 tiles).
- **Requests are followed**: spare exactly as asked on all boards; the share of face-down tiles exactly as asked;
  the pinned clock depth on all 27 boards that asked for one.
- **Fast**: half the builds need under 0.1 s of computing time; 9 in 10 under 1 s.

## The main problems (for whoever owns builder.js)

### 1. Locks and ice on "partner" tiles that hold nothing (55 cases, every board of the two "room in the tray" stories)

The stories "Room in the tray: locked partners" and "... frozen partners" lock or freeze 3 tiles ("holders") so that
the twins of the tiles on the clock's way cannot be reached. But the picture step then uses only one or two of them.
The others are locked or frozen for nothing: their twin is taken after the clock.
Of 90 holder locks/ice, only 35 hold a twin of a tile taken on the way. All 30 boards of these two stories have at
least one useless one.

- Example: roomInTrayFrozen-pyramid-15, seed 1. Ice on tiles 17, 34, 35. Only 35 holds a twin of a tile on the way
  (tile 67, taken at move 6). The twins of 17 and 34 (tiles 46 and 11) are taken at moves 53 and 49.
- Example: roomInTrayLocked-cross-8, seeds 1-3: two of the three locks hold nothing on each seed.
- The builder's own check ("partners held back at the clock: 3 of 3 holders out of reach") only asks whether the
  holders are out of reach, not whether they hold anything.
- Fix idea: after the pictures are placed, take the lock/ice off every holder whose twin is not waiting (or not taken
  on the way) when the clock goes; ask for at least 2 holders that do hold one.

### 2. The board is delivered even when the tray promise is not met (14 boards)

The promise "the tray reaches 3 on the fewest way to the clock" was not proven on 14 boards (trayRoom 0 requests),
but the builder returned them anyway. It should try again instead. Two causes:

- **The planned way reaches 3, the stored solution does not.** The solution is a different order of the same tiles
  (also fewest moves) in which the tray only reaches 2. A careful player can do the same. Example: frozenGuards-hourglass-42
  seed 1: planned order 73,67,60,61,... (tray 1-2-3-2-3-...), stored solution 60,48,61,73,... (tray 1-0-1-0-1-...).
  Also keysFarSide-arch-0 seeds 1 and 3, roomInTrayLocked-steps-27 seeds 1-3.
- **The way is too short to reach 3.** keysOnIsland-hourglass-41 seed 1: the way is 4 tiles, two of them the keys
  (one pair), so the tray can only reach 2. The plan's own maximum was 2 already; nothing stops the build there.
- Related: on trayRoom 0 requests the 3-tile tray is **forced** (no order in time avoids it) on only 24 of 74 boards.

### 3. "No useless lock" is claimed even when the check ran out of time

When the builder checks whether a lock or ice matters, its search can run out of time. It then keeps the lock and
still says "no idle lock or ice: proven". On a busy machine this left a useless lock on a board:
iceLockClock-arch-28 seed 2, lock 25 (first run, machine load 7 on 2 cores).
Reproducer that does not depend on the machine: `B.build({...brief 'iceLockClock-arch-28', seed: 2}, {budget: {nodes: 20000, ms: 3000}})`
says "none idle", but locks 25, 26, 32 and 33 all do nothing (with the normal budget the builder removes them).
Place: builder.js `prune()`, line 290: `if (w && w.k >= k0)` treats "no answer" (`w` null) as "this lock works".
It should retry with more budget or mark the promise unproven. The same time budgets make a build depend on how
busy the machine is.

### 4. The first key arrives with a full tray (4 failed builds)

clockInSight-vase-40 seeds 1-3 and iceLockClock-diamond-30 seed 1 fail with "trayOverflow" on most tries. With
trayRoom 0 the picture step fills the tray to 3 during the dig, then the first key comes and has no place
(builder.js line 223). Fix idea: keep one slot free just before the first key.

### 5. Problems found in the first run (requests since corrected, the builder issues remain)

The first run (`gate/summary-v1-unscreened.md`) built only 133 of 150 (89%). Two causes were in the requests, two in
the builder:

- **"Keys on the other island" on shapes with no real islands.** `B.fits` says yes when a shape has two "peaks",
  but on hourglass layouts 36 and 23 those peaks are 4-6 loose top tiles with nothing on top of them, so no key can
  be buried 1-3 deep there (all 16 tries "noClockPlace", every seed). `fits()` should ask the same as `placeRoles`.
  The request maker now tests that the story's roles can be placed at all.
- **A pinned clock depth that the story could not use** (chainReaction-castle-20, depth 2: no frozen clock possible
  at that depth). The request maker now checks this too.
- **Builder: two frozen keys next to each other wait for each other.** chainReaction-twins-32 (first run), seeds
  1-3, all 16 tries "dig": keys 75 and 76 are both frozen (ice 1) and each other's ice neighbour. `needSet()` counts
  the other key as the one that will thaw it (`planned`), so it never adds a real neighbour, and the dig gets stuck.
  Fix idea: do not count a frozen planned neighbour that itself waits for this tile; or keep frozen keys apart.
- **Builder: keys buried in a long bottom row.** clockInSight-frame-38 seed 2 (first run): deep keys at the bottom
  layer (6 tiles on top) with tiles left and right; the dig finds no side it can open within its limit (8 tiles,
  `planDig`), so it gives up. `placeRoles` could skip such key spots.

### 6. Speed

Computing time per build: median 0.06 s, 9 in 10 under 0.9 s, slowest 6.2 s. Two builds use more than 5 s:
frozenGuards-house-13 seed 1 (6.2 s, 96 tiles) and iceLockClock-pyramid-47 seed 2 (5.7 s, 96 tiles). Both spend it on
the "is this lock useful" searches. On the clock the times were longer (7 builds over 5 s, slowest 15.7 s), because
other jobs were using the machine at the same time.

## How hard are the boards

The descriptors report says what makes a board hard: for the family, moves with 3 tiles waiting on the way to the
clock; for the skilled player, "luck moments" (a face-down tile uncovered while 2 or more wait). The same values on
the built boards and on the 18 real boards made for levels 200-225 (family 9.6-12.7 tries):

| value | built (146 boards) | real 200-225 (18 boards) |
|---|---|---|
| fewest moves to the clock | median 8 (4-19) | median 14 (3-32) |
| moves with 3 waiting on the way | median 1 (0-7); 3 or more on 34 boards (23%) | median 5 (1-12); 3 or more on 17 of 18 |
| luck moments | median 0 (0-2); 1 or more on 49 boards (34%) | median 1 (0-3); 1 or more on 14 of 18 |
| tray full (3) on the way | 106 boards (73%) | 18 of 18 |
| tray 3 forced on every way in time | 24 boards | (not measured) |
| decision traps on the way (moves where a choice loses) | median 4 (0-19) | (not measured) |
| tempting losing moves | median 4 (0-135); none on 50 boards | (not measured) |

So the boards are much calmer than the real levels. Per request setting:

- trayRoom 0 (fill the tray to 3): median 2 moves with 3 waiting; trayRoom 1: 1; trayRoom 2: 1. The knob works,
  but weakly, mostly because of problem 2.
- hiddenOnWay (face-down tiles on the dig): they are placed as asked (on 120 of 146 boards; the rest have too few
  covered tiles on the dig), but they rarely come up while 2 tiles wait: average luck moments 0.25 / 0.36 / 0.47 /
  0.46 for 0 / 1 / 2 / 3 asked. The face-down tiles need to go where the tray is at 2, not just on the dig.
- Per story (medians): "A lock beside the clock" is the toughest (16 moves, 3 moves with 3 waiting, 16 trap points);
  "Keys on the other island" and both "room in the tray" stories the calmest (6 moves, 0-1 with 3 waiting).

## The requests (briefs-v1.json)

50 requests, 5 per story, all 48 layouts (two used twice). Spare 1/2/3 (17/16/17), trayRoom 0/1/2 (26/16/8),
face-down on the dig 0-3 (about 12 each), face-down share 0.2-0.4 (10 each), clock stage centre/edge/top/none
(13/13/12/12); 9 requests pin the clock depth. Each has an `id` and a `why`. They are made by
`node tools/builder/gate.js --make-briefs` (always the same result). It now also checks that the story's roles fit the
shape at all; the first, unchecked set is kept as `gate/briefs-v1-unscreened.json`.

## How to run

- `node tools/builder/gate.js` (seeds 1,2,3, 2 jobs): 150 builds in about 2 minutes, about 2 minutes of computing time.
- `node tools/builder/gate.js --summary results-v1.json`: remake the summary from saved results.
- `node --test tools/builder/test_gate.js`: 6 requests at seed 1 through the same checks, about 1 s. The useless
  holder lock (problem 1) is marked "todo" there until it is fixed.
