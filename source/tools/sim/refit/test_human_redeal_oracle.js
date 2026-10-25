'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { solveRedeal, replayOraclePath, oracleStep } = require('./human_redeal_oracle.js');
const { createSessionFactory } = require('./production_physical_session.js');

function productionOracle(game, factory) {
  const queue = [[]], visited = new Set();
  let transitions = 0, win = false;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const prefix = queue[cursor], actual = replayOraclePath(game, prefix, factory).view;
    if (actual.win) { win = true; continue; }
    if (actual.type === 'productionPhysicalEnd-v1') continue;
    const key = JSON.stringify([actual.state.alive, actual.state.tray, actual.state.openPeek,
      actual.state.relieved, game.clock && actual.state.alive[game.clock.i] ? actual.state.moves : 0, actual.state.arriving]);
    if (visited.has(key)) continue;
    visited.add(key); assert(visited.size < 4096);
    const known = { ...actual.state, pictures: game.faces };
    for (const index of actual.legalTiles) {
      const expected = replayOraclePath(game, prefix.concat(index), factory).view;
      const moved = oracleStep(game, known, index, prefix, factory);
      for (const field of ['alive', 'tray', 'moves', 'openPeek', 'relieved']) assert.deepEqual(moved.state[field], expected.state[field],
        JSON.stringify({ field, faces: game.faces, down: game.down, clock: game.clock, prefix, index }));
      assert.equal(!!moved.win, !!expected.win);
      assert.equal(!!moved.lost, expected.type === 'productionPhysicalEnd-v1' && !expected.win);
      transitions++; queue.push(prefix.concat(index));
    }
  }
  return { win, transitions };
}

function test() {
  const factory = createSessionFactory();
  const tiles = [0, 4, 8, 12].map(horizontal => ({ x: horizontal, y: 0, z: 0 }));
  let controls = 0, transitions = 0, jokerReplays = 0;
  for (const faces of [[1, 1, 2, 2], [101, 101, 2, 2], [101, 1, 1, 101]]) {
    for (const down of [[0, 0, 0, 0], [1, 1, 1, 1], [1, 0, 1, 0]]) {
      for (const clock of [null, { i: 3, n: 2 }, { i: 0, n: 1 }]) for (const obstacles of [false, true]) {
        const game = { tiles, nb: Layouts.neighbors(tiles), faces, down, clock,
          rules: obstacles ? { iceNb: Layouts.iceNeighbors(tiles), ice: { 2: 1 }, keys: [0, 1], locks: new Set([3]) } : null };
        const before = JSON.stringify(game), expected = productionOracle(game, factory);
        const result = solveRedeal(game, { nodeLimit: 4096 });
        assert.notEqual(result.status, 'node_cap');
        assert.equal(result.status === 'cleared', expected.win);
        assert.equal(JSON.stringify(game), before);
        assert.equal(result.productionVerified, expected.win);
        assert.equal(result.exhaustive, !expected.win);
        if (expected.win) assert.equal(result.verifiedTaps, result.path.length);
        controls++; transitions += expected.transitions; jokerReplays += result.jokerReplays;
      }
    }
  }
  const buried = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }];
  const impossible = { tiles: buried, nb: Layouts.neighbors(buried), faces: [1, 1], down: [0, 1],
    rules: null, clock: { i: 0, n: 1 } };
  assert.equal(solveRedeal(impossible).status, 'lost');
  const stackedTiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 },
    { x: 4, y: 0, z: 0 }, { x: 4, y: 0, z: 1 }];
  for (const clock of [null, { i: 0, n: 2 }]) {
    const stacked = { tiles: stackedTiles, nb: Layouts.neighbors(stackedTiles), faces: [2, 101, 2, 101],
      down: [1, 1, 0, 0], rules: null, clock };
    const expected = productionOracle(stacked, factory), result = solveRedeal(stacked);
    assert.equal(result.status === 'cleared', expected.win); transitions += expected.transitions; controls++;
  }
  const flat = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2], down: [0, 0, 0, 0], rules: null, clock: null };
  assert.equal(solveRedeal(flat, { nodeLimit: 1 }).status, 'node_cap');
  assert(jokerReplays > 0);
  factory.verifySource();
  console.log('PASS ' + controls + ' full-information oracle controls and ' + transitions
    + ' transitions agree with original production, including Jokers, clocks, inspections, ice/locks/keys, caps and independently replayed winning witnesses');
}

if (require.main === module) test();
module.exports = test;
