'use strict';
const assert = require('assert/strict');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const { pairFollowThroughSamples } = require('./personal_pair_followthrough.js');
const actor = { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, peek: 0, end: 0, plan: 0, forceMatches: false };
const replay = changes => {
  const tiles = Array.from({ length: 4 }, (_, index) => ({ x: index * 8, y: 0, z: 0 }));
  const game = { tiles, nb: L.neighbors(tiles), faces: [0, 0, 1, 1], down: [1, 0, 1, 0], follow: [-1, -3, -1, 1],
    log: [], policyLog: [], physicalLog: [], logMatches: true, ...changes };
  Hard.play(game, actor, 1);
  return game;
};
const samples = game => pairFollowThroughSamples(game, game.physicalLog, game.policyLog);
const completed = replay({});
assert.deepEqual(samples(completed), [{ tray: 0, followed: true, completed: true }]);
assert.deepEqual(samples(replay({ follow: [-1, -3, -1, 0, 1] })), [{ tray: 0, followed: true, completed: false }]);
assert.deepEqual(samples(replay({ follow: [-1, -3, -1, 3] })), [{ tray: 0, followed: false, completed: false }]);
assert.deepEqual(samples(replay({ down: [1, 1, 1, 0] })), []);
assert.deepEqual(samples(replay({ clock: { i: 0, n: 8 } })), []);
assert.deepEqual(pairFollowThroughSamples(completed, completed.physicalLog.slice(0, 3), completed.policyLog.slice(0, 3)), []);
assert.deepEqual(pairFollowThroughSamples(completed, completed.physicalLog.slice(0, 3), completed.policyLog), []);
const tiles = [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 8, y: 0, z: 1 }, { x: 16, y: 0, z: 0 }];
assert.deepEqual(samples(replay({ tiles, nb: L.neighbors(tiles) })), []);
assert.deepEqual(samples(replay({ rules: { ice: {}, iceNb: [], keys: [3], locks: new Set([1]) } })), []);
assert.deepEqual(samples(replay({ rules: { ice: { 1: 1 }, iceNb: [[], [3], [], []], keys: [], locks: new Set() } })), []);
assert.deepEqual(samples(replay({ faces: [0, 0, 101, 101] })), []);
assert.deepEqual(samples(replay({ follow: [-1, 1] })), []);
const policy = { ...actor, kinds: { t0n: { flip: 1 }, 't0p-': { pair: 1 } } };
const autonomous = (probability, changes = {}, player = policy, seed = 1) => {
  const tiles = Array.from({ length: 4 }, (_, index) => ({ x: index * 8, y: 0, z: 0 }));
  const game = { tiles, nb: L.neighbors(tiles), faces: [0, 0, 1, 1], down: [1, 0, 0, 0], memory: [1, 1, 1, 1], physicalLog: [], ...changes };
  const trace = [];
  const result = Hard.play(game, { ...player, physicalPairFollowThrough: probability }, seed, trace);
  return { game, trace, result };
};
const followed = autonomous(1);
assert.equal(followed.game.physicalLog[0].kind, 'flip');
assert.equal(followed.game.physicalLog[1].index, 1);
assert(followed.trace.some(row => row.physicalPairFollowThrough && row.following));
const declined = autonomous([0, 0, 0, 0]);
assert(declined.game.physicalLog[1].index >= 2);
const selfTaken = autonomous(1, {}, { ...policy, kinds: { t0n: { flip: 1 }, 't0p-': { single: 1 } } });
assert.equal(selfTaken.game.physicalLog[1].index, 0);
assert(selfTaken.trace.some(row => row.physicalPairFollowThrough && row.following));
const fullTiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 8, y: 0, z: 0 }));
const full = autonomous(1, { tiles: fullTiles, nb: L.neighbors(fullTiles), faces: [0, 0, 1, 2, 3, 1, 2, 3],
  down: [1, 0, 0, 0, 0, 0, 0, 0], memory: Array(8).fill(1), start: [2, 3, 4] },
  { ...policy, kinds: { t3n: { flip: 1 }, 't3p-': { fatal: 1 } } });
assert.equal(full.result.why, 'tray');
assert.equal(full.game.physicalLog[4].index, 0);
assert(full.trace.some(row => row.physicalPairFollowThrough && row.following));
const twoTiles = [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }];
assert.equal(autonomous([0, 0, 0, 0], { tiles: twoTiles, nb: L.neighbors(twoTiles), faces: [0, 0], down: [1, 0], memory: [1, 1] }).result.win, true);
assert.equal(autonomous(1, { memory: [0, 1, 1, 1] }).trace.some(row => row.physicalPairFollowThrough), false);
for (let seed = 1; seed <= 100; seed++) {
  const random = L.rng(seed); random(); random();
  const current = autonomous(0.7, {}, policy, seed);
  assert.equal(current.trace.find(row => row.physicalPairFollowThrough).following, random() < 0.7);
}
const followedAgain = replay({});
const unchanged = { ...followedAgain, log: [], policyLog: [], physicalLog: [] };
assert.deepEqual(Hard.play(unchanged, { ...actor, physicalPairFollowThrough: 1 }, 1), Hard.play(replay({}), actor, 1));
console.log('PASS pair follow-through samples: actual known setup, consecutive completion, censoring, clock and legal frozen knowledge');
