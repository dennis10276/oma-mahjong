// Tiny boards, one game rule each, for checking the rules in the real game (scratchpad/mech). Writes mech-ideas.js.
// Each test: tiles [x,y,z], faces, down, obst, clock, and the taps + the expected game state (checked by run_mech.js).
const fs = require('fs'), path = require('path');
const T = [];
const add = (name, tiles, faces, extra, steps) => T.push({ name, tiles, faces, ...extra, steps });
// 1. relief, ice: X free, Y alone and frozen (no ice neighbour at all). Take X: nothing takeable is left -> all ice melts.
add('relief-ice', [[0, 0, 0], [6, 4, 0]], [1, 1], { obst: { ice: { 1: 1 } } },
  [{ tap: 0 }, { expect: 'G.ob.left[1] === 0', why: 'the sun melted Y without a move' }, { expect: 'G.mv === 1' }]);
// 2. relief, lock: the keys lie under the locked tile Y; take X -> only Y is free and it is locked -> the gold locks open.
add('relief-lock', [[0, 0, 0], [4, 4, 0], [6, 4, 0], [5, 4, 1]], [1, 2, 2, 1], { obst: { ice: {}, locks: [3], keys: [1, 2] } },
  [{ tap: 0 }, { expect: 'G.ob.unlocked === true', why: 'locks gave way with both keys still on the board' }, { expect: 'G.alive[1] === 1 && G.alive[2] === 1' }]);
// 3. an open (turned-over) tile grabs its twin: peek F, tap its twin D with an empty tray -> both go (2 moves), nothing waits.
add('peek-grabs-twin', [[0, 0, 0], [4, 0, 0], [8, 0, 0], [8, 4, 0]], [1, 1, 2, 2], { down: [0] },
  [{ tap: 0 }, { expect: 'G.peek === 0 && G.alive[0] === 1' }, { tap: 1 }, { expect: 'G.alive[0] === 0 && G.alive[1] === 0 && G.mv === 2 && G.tray.length === 0', why: 'D could not be taken alone' }]);
// 4. turning another face-down tile closes the first: peek F, peek G, tap D -> D goes alone into the tray (1 move).
add('peek-switch', [[0, 0, 0], [4, 0, 0], [8, 0, 0], [8, 4, 0]], [1, 1, 2, 2], { down: [0, 2] },
  [{ tap: 0 }, { tap: 2 }, { expect: 'G.peek === 2' }, { tap: 1 }, { expect: 'G.alive[0] === 1 && G.mv === 1 && G.tray.length === 1' }]);
// 5. a face-down tile whose twin waits in the tray is taken on the first tap (no peek): D, then one tap on F.
add('facedown-matches-at-once', [[0, 0, 0], [4, 0, 0], [8, 0, 0], [8, 4, 0]], [1, 1, 2, 2], { down: [1], clock: { i: 3, n: 20 } },   // (a clock keeps auto-finish off)
  [{ tap: 0 }, { tap: 1, once: true }, { expect: 'G.alive[1] === 0 && G.mv === 2 && G.tray.length === 0', why: 'the first tap took it' }]);
// 6. both face-down: peek F1, one tap on F2 (its twin) -> both go at once, F2 never shown on its own.
add('both-facedown-blind-pair', [[0, 0, 0], [4, 0, 0], [8, 0, 0], [8, 4, 0]], [1, 1, 2, 2], { down: [0, 1] },
  [{ tap: 0 }, { tap: 1, once: true }, { expect: 'G.alive[0] === 0 && G.alive[1] === 0 && G.mv === 2' }]);
// 6b. both face-down, not twins: the second tap only turns the second over (the first turns back), no move.
add('facedown-test-no-cost', [[0, 0, 0], [4, 0, 0], [8, 0, 0], [8, 4, 0]], [1, 2, 1, 2], { down: [0, 1] },
  [{ tap: 0 }, { tap: 1, once: true }, { expect: 'G.alive[0] === 1 && G.alive[1] === 1 && G.mv === 0 && G.peek === 1' }]);
// 7. the clock inside a face-down pair may end one move past its number: clock 2, take A (1 left), peek C, tap T -> 3 moves, saved.
add('clock-pair-one-late', [[0, 0, 0], [4, 0, 0], [8, 0, 0], [0, 4, 0]], [2, 1, 1, 2], { down: [1], clock: { i: 1, n: 2 } },
  [{ tap: 0 }, { tap: 1 }, { tap: 2 }, { wait: 500 }, { expect: 'G.alive[1] === 0 && G.mv === 3 && !G.overShown', why: 'clock taken as the 3rd tile with number 2' }]);
// 7b. control: the same clock with two single moves first -> lost.
add('clock-control', [[0, 0, 0], [4, 0, 0], [8, 0, 0], [0, 4, 0]], [2, 1, 1, 2], { down: [1], clock: { i: 1, n: 2 } },
  [{ tap: 0 }, { tap: 3 }, { wait: 500 }, { expect: 'G.overShown === true', why: 'number reached with the clock still there' }]);
// 8. only the layer right on top melts: F (frozen 2) under R (z1) under T (z2, straight on R for this test). Take T: no melt; take R: one.
add('top-of-stack-no-melt', [[2, 2, 0], [4, 2, 0], [2, 4, 0], [4, 4, 0], [3, 3, 1], [3, 3, 2]], [1, 3, 3, 1, 2, 2], { obst: { ice: { 0: 2 } } },
  [{ tap: 5 }, { expect: 'G.ob.left[0] === 2', why: 'the z2 tile does not count' }, { tap: 4 }, { expect: 'G.ob.left[0] === 1' }]);
// 9. a tile in the next row, half a tile over (dx 1, dy 2), melts without blocking: F frozen 1, N its only neighbour.
add('next-row-melts', [[0, 0, 0], [1, 2, 0], [6, 0, 0], [6, 4, 0]], [1, 2, 1, 2], { obst: { ice: { 0: 1 } } },
  [{ expect: 'G.ob.left[0] === 1' }, { tap: 1 }, { expect: 'G.ob.left[0] === 0' }]);
// 10. the keys open the locks when they leave the board, matched or not: two keys with different pictures, both waiting.
add('keys-open-from-the-tray', [[0, 0, 0], [4, 0, 0], [8, 0, 0], [0, 4, 0], [4, 4, 0], [8, 4, 0]], [1, 2, 3, 1, 2, 3], { obst: { ice: {}, locks: [2, 5], keys: [0, 1] } },
  [{ tap: 0 }, { tap: 1 }, { expect: 'G.tray.length === 2 && G.ob.unlocked === true', why: 'both locks open, keys still waiting' }]);
// 11. tapping a buried tile makes the tiles on it see-through (its picture shows), no move.
add('xray', [[2, 2, 0], [4, 2, 0], [2, 4, 0], [4, 4, 0], [3, 3, 1], [0, 0, 0]], [1, 2, 2, 1, 3, 3], {},
  [{ tap: 0 }, { expect: "G.tiles[4].el.classList.contains('xray') && G.mv === 0", why: 'the roof turns see-through' }]);
// 12. a fourth tile without a partner ends the level.
add('fourth-tile', [[0, 0, 0], [0, 4, 0], [0, 8, 0], [0, 12, 0], [8, 0, 0], [8, 4, 0], [8, 8, 0], [8, 12, 0]], [1, 2, 3, 4, 1, 2, 3, 4], {},
  [{ tap: 0 }, { tap: 1 }, { tap: 2 }, { tap: 3 }, { wait: 800 }, { expect: 'G.overShown === true || G.busy === true' }]);
const ideas = T.map((t, k) => ({ id: 970000 + k, lv: 900 + k, title: t.name, kind: 'hand', idea: t.name, tiles: t.tiles.length,
  board: { tiles: t.tiles, faces: t.faces, down: t.down || [], gold: [], obst: t.obst || null, clock: t.clock || null, solution: [] }, steps: t.steps }));
fs.writeFileSync(path.join(__dirname, 'mech-ideas.js'), 'const LAB_IDEAS = ' + JSON.stringify({ made: new Date().toISOString(), heading: 'Mechanics check', factory: true, ideas }) + ';');
console.log(ideas.length, 'tests');
