'use strict';
const assert = require('assert/strict');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const actor = { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, peek: 0, end: 0, plan: 0, forceMatches: false };
const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 4, y: 0, z: 0 },
  { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 },
  { x: 20, y: 0, z: 0 }, { x: 24, y: 0, z: 0 }];
const make = (changes = {}) => ({ tiles, nb: L.neighbors(tiles), faces: [4, 3, 0, 1, 2, 0, 1, 2],
  down: tiles.map(() => 0), ...changes });
const trayGame = make({ follow: [2, 3, 4, 1], log: [], logMatches: true, physicalLog: [] });
const trayResult = Hard.play(trayGame, actor, 1);
assert.equal(trayResult.why, 'tray');
assert.equal(trayResult.seen[0], 5);
assert.equal(trayResult.moves, 4);
assert.equal(trayGame.physicalLog.at(-1).alive[0], 1);
const clockGame = make({ follow: [1], log: [], logMatches: true, clock: { i: 7, n: 1 } });
const clockResult = Hard.play(clockGame, actor, 1);
assert.equal(clockResult.why, 'clock');
assert.equal(clockResult.seen[0], 2);
const stopped = Hard.play(make({ follow: [1], log: [], logMatches: true }), actor, 1);
assert.equal(stopped.why, 'stopped');
assert.equal(stopped.seen[0], 2);
const stillCovered = Hard.play(make({ follow: [], log: [], logMatches: true }), actor, 1);
assert.equal(stillCovered.seen[0], 0);
const hidden = Hard.play(make({ follow: [1], log: [], logMatches: true,
  down: [1, 0, 0, 0, 0, 0, 0, 0] }), { ...actor, peek: 1 }, 1);
assert.equal(hidden.seen[0], 0);
const remembered = Hard.remembered(trayResult.seen, trayResult.moves, 1, L.rng(9));
assert.equal(remembered[0], 1);
const hiddenRemembered = Hard.remembered(hidden.seen, hidden.moves, 1, L.rng(9));
assert.equal(hiddenRemembered[0], 0);
const changedFaces = [99, 3, 0, 1, 2, 0, 1, 2];
const stillHidden = Hard.play(make({ faces: changedFaces, follow: [1], log: [], logMatches: true,
  down: [1, 0, 0, 0, 0, 0, 0, 0] }), actor, 1);
assert.deepEqual(stillHidden.seen, hidden.seen);
assert.deepEqual(stillHidden.at, hidden.at);
console.log('PASS terminal retry memory records exposed face-up pictures without peeking at unseen or covered tiles');
