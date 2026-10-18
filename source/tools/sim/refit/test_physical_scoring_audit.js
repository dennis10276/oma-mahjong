'use strict';
const assert = require('assert/strict');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const { compareFrame } = require('./physical_scoring_audit.js');
const tiles = Array.from({ length: 4 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
const game = { tiles, nb: L.neighbors(tiles), faces: [0, 1, 0, 1], down: Array(4).fill(0), start: [0], follow: [1],
  log: [], policyLog: [], logMatches: true, physicalLog: [], clock: { i: 2, n: 5 } };
Hard.play(game, { ...Hard.P, physicalFlips: true, peek: 0, end: 0, plan: 0, forceMatches: false }, 1);
const decision = game.policyLog[0], feature = decision.F[decision.k].concat(decision.goals[decision.k]);
const result = compareFrame(game, game.physicalLog[0], game.physicalLog[1], feature);
assert.equal(result.actualTray, 2);
assert.equal(result.scoredTray, 0);
assert.equal(result.trayDifferent, true);
assert.equal(result.actualClock, 0);
assert.equal(result.scoredClock, 1);
console.log('PASS scoring audit identifies anticipated followup credit without mislabeling the actual physical tap');
