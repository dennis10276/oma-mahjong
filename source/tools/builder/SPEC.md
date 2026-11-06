# Builder v2 — specification (Claude, 2026-11-06)

Dennis (2026-11-06): "We are spending a lot of time making levels in a unique and difficult way when we dont have the
ground work done of designing levels and what makes them unique and difficult. Focus on making the builder better
before letting it learn." Plan: the doc "Level builder plan" (phases 1-4). This folder is phases 1 and 2.

Everything here runs offline (node), never touches `source/www`, the level tables, Firebase or `main`.
No git commands from helpers: Claude commits.

## 1. Board format and rules (the game's own)

A board ("design") is plain JSON:

```
{ tiles: [[x,y,z], ...],          // n tiles, n even (72-96 for levels 200+)
  faces: [f, ...],                 // picture per tile, 0..35; every picture count is even (2 or 4)
  down: [i, ...],                  // face-down tiles; none may be free at the start
  gold: [i, ...],                  // cosmetic (stars), ignore for difficulty
  obst: { ice: {i: h}, locks: [i, ...], keys: [a, b] },
  clock: { i, n },                 // tile i must be taken within the first n moves (move index < n)
  solution: [i, ...] }             // a full legal removal order (the witness)
```

Rules (www/layouts.js, www/hard.js validSolution):
- `L.neighbors(tiles)` -> {above,left,right}; a tile is free when nothing alive is above it and its left OR right side is
  empty (`L.isFree`).
- Ice h: the tile can be taken only after h of its ice-neighbours (`L.iceNeighbors`: same layer within 2 (not both dx and
  dy = 2) or one layer up/down overlapping) have left the board.
- Lock: a locked tile can be taken only once both key tiles have left the board (keys are a normal pair).
- `L.takeable(i, alive, nb, rules, alive0)` = free and not frozen and not locked; rules = {iceNb, ice, locks:Set, keys}.
- Tray: a taken tile waits until a tile with the same picture is taken; at most 3 may wait - a 4th waiting tile loses.
- Clock: losing when move index reaches n with the clock tile still on the board, checked after the whole action.
  A peek pair takes two tiles before this check, so its second tile can save the clock at the deadline.
- Win: every tile taken, tray empty, clock taken in time.
- Face-down tiles show their picture only when free (a free face-down tile can be turned over at no move cost).
- PEEK PAIR (www/js/board.js `peekPair`, Dennis 2026-11-06): a turned-over free face-down tile and its free twin
  (face-up or face-down) can be taken together WITHOUT a tray slot, even with 3 tiles waiting. It is one action of
  two moves (the clock counts both). A pair of two face-up free tiles has no such shortcut: the first one waits in
  the tray. `Hard.validSolution` and `lab/exact.js` do not know this rule (they are stricter than the game); the
  engine must, as an extra action kind {pair:[i, j]} when i or j is face-down and both are free and takeable. Note
  that the face-down tile stays face-down for this purpose until it is taken (peeking does not change `down`).
  The solver may know all pictures (it is a proof tool); the bots do not.

Existing helpers to reuse (do not copy-paste): `source/tools/lab/exact.js` (exactRoute: fewest moves to take a tile,
with a lower bound), `L.solve` (DFS solver used by the hint), `Hard.validSolution`, `source/tools/lab/ideas.js`
(`valid`, `fix` = set the clock to exact route + spare, `ctxOf`, IDEAS = the current trap recipes),
`source/tools/factory/design_traps.js` (`roomProfile` = luck moments and relief).

## 2. engine.js — proofs on a board (helper A)

```
const E = require('./engine.js');
E.game(design)                       -> g  (tiles objects, nb, iceNb, rules, faces, clock; cached per design)
E.start(g)                           -> state {alive:Uint8Array, tray:[tile...], moves:0, clockTaken:bool}
E.legal(g, state)                    -> [i...] takeable tiles (tray/clock legality NOT filtered)
E.step(g, state, i)                  -> state' or null when the move loses at once (4th tile, clock expired)
E.winnable(g, state, {nodes, ms})    -> {result:'win'|'lose'|'unknown', path?, nodes}
E.clockShortest(g, {nodes, ms})      -> {k, path} | null   (fewest moves to take the clock, finishable; wraps exact.js)
E.classify(g, state, {nodes, ms})    -> [{move, result:'win'|'lose'|'unknown', depth?}]  for every legal move
                                        depth = most moves a player can still make after it before the loss is forced
E.traps(g, path, {upTo, nodes, ms})  -> decision points along `path` (default the clock prefix): per step the legal
                                        moves, how many lose, the tempting losing ones (a pair, or a single whose twin
                                        is in sight) and their depth
```
- `winnable` must respect ice, locks, tray and the clock deadline; memoise on (alive, tray faces as a multiset,
  clockTaken, moves when the clock is still on the board); take a tray match first when one is free (always safe);
  `unknown` when the budget runs out - never claim a loss it could not prove.
- Speed target on the 18 qualified boards (`analysis/builder/data/qualified-200-225.jsonl`): `winnable` from the start
  under 200 ms median, `classify` on one state under 2 s with a per-move budget.
- Tests in `test_engine.js` (node:test): tiny hand boards for each rule, and every qualified board winnable along its
  stored solution.

## 3. describe.js — what makes a board hard, without bots (helper B)

`describe(design) -> {...}` with at least:
- frame: clock depth (tiles transitively above it), clock way (exact fewest moves `k`), spare `n - k`, way share
  `k / n_tiles`, clock locked / frozen (h).
- order puzzle: dependency depth (clock <- locks <- keys <- covers, ice <- neighbours; longest chain), number of
  specials on the way.
- tray pressure along the way: on the stored solution prefix up to the clock and on the exact clock path: max and mean
  waiting tiles, steps with 3 waiting, free pairs in sight per step (pictures visible: face-up free tiles), "room"
  (3 - waiting) minimum.
- hidden tiles: face-down tiles on the way to the clock / keys, share of face-down tiles, luck moments (roomProfile).
- where the pressure is: share of the solution at which the tray first reaches its maximum, and whether the rest of the
  level is free cruising (Dennis: no free cruising followed by the main puzzle with high tray pressure at the very end).
- story/stage/shape: shape name if given, tile count, layers, where the clock and keys sit (centre/edge/island,
  top/bottom layer), visible specials at the start.
- (later, from engine.js) decision traps: count, tempting losing moves, their depth.

Then `analyse_descriptors.js` on `analysis/builder/data/training-data.json` (1,989 boards with `design`, `family.exp`
(bot "family" rating, pooled seeds), and for 992 of them `skilled.exp`): which descriptors separate hard from easy
boards - family >= 9 vs <= 4, skilled >= 2.5 vs <= 1.3 - per descriptor: medians per group, rank correlation,
and simple two-way splits. Kinds: `historical` boards are real factory output; `calm-piece-control`, `frame`,
`conditional-*` are controlled experiments (report them separately). Write `analysis/builder/descriptors-report.md`:
plain language, numbers, no model fitting beyond simple splits.

## 4. The brief and builder.js (Claude)

```
brief = { level, shape | tiles, story: '<story id>', stage: 'centre'|'edge'|'island'|'top'|null,
          frame: { depth, share, spare }, targets: { trayRoom, traps, trapDepth, hiddenOnWay, maxDown },
          seed }
build(brief, {ms}) -> { design, card, intents:[{name, proven, detail}], ms } | { fail: '<stage>', detail, ms }
```
Construction runs backwards from the brief: plan the intended way (phases of the story), put the specials where the
plan needs them, place pictures to create the intended tray pressure and decision traps, fill the rest, then prove every
intent with engine.js. A design card says in plain words: story, stage, the traps and why they bite, descriptor values.

Contract clarified by independent review: `trayRoom` 0/1/2 requests a maximum of exactly 3/2/1 waiting tiles on
the witness to the clock. `hiddenOnWay` is a minimum count of hidden dig tiles; `maxDown` is an upper bound on
the rounded total count. Explicit `traps` is a minimum proven count. Incompatible stories return a failure rather
than changing the requested cap. `frame.share` and `targets.trapDepth` currently return `unsupportedTarget`.
`luck` and `three` are separate optional targets, each within one of the requested count.

`knobs.js` starts phase 3 with `clockSpare(design, spare)`: prove the game-rule minimum, change only `clock.n`,
retain and replay the complete original witness. Failure to prove the minimum or preserve that witness is explicit.
Derived decision-trap outcomes can change when the deadline changes. `knob_study.js` preregisters twenty boards,
two distinct layouts for each story, compares spare 1 with 3 on the frozen family and skilled bots, and checkpoints
every measurement. Report the plan's 80% non-increasing direction check separately from the study's additional
80% strict-improvement criterion. Ties count only for direction; invalid and missing measurements never pass.

## 5. Briefs and the gate (helper C)

`briefs-v1.json`: 50 briefs covering every story (`stories.js`) and the shapes in `analysis/builder/data/layouts.json`
(48 original layouts), several frames and targets. `gate.js`: builds every brief (seeds 1..3), reports build rate,
time per build, intents proven, and runs static checks (valid solution, honest clock = exact shortest + spare, no idle
special: removing it changes the exact clock way, a proven trap, or the tray pressure on the way). Phase-2 gate: at least
90% of briefs build, under 5 s each, every intent proven, no idle special.
