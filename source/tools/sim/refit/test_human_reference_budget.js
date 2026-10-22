'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search } = require('./public_witness_search.js');
const { analyze, analyzeContinuation } = require('./public_dead_end.js');

function test() {
  const tiles = [0, 4, 8, 12].map(horizontal => ({ x: horizontal, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  const state = { alive: [1, 1, 1, 1], pictures: [1, 2, 3, 4], down: [1, 1, 1, 1],
    tray: [5, 6, 7], moves: 3, openPeek: -1, relieved: false, arriving: [] };
  const actions = tiles.map((tile, index) => ({ index })), now = Date.now;
  try {
    let ticks = 0;
    Date.now = () => ++ticks;
    const limited = search(game, state, actions, { decisionMs: 1, nodes: 4096 });
    assert(limited.boundary); assert(!limited.knownDead); assert(!limited.knownWin);
    assert(actions.some(action => action.index === limited.index));
    for (const proof of [analyze, analyzeContinuation]) {
      const expired = proof(game, state, actions, 128, 0);
      assert.equal(expired.reason, 'bounded'); assert(!expired.knownDead);
    }
  } finally { Date.now = now; }
  assert.throws(() => search(game, state, actions, { decisionMs: 0 }));
  assert.throws(() => search(game, state, actions, { decisionMs: 3000 }));
  console.log('PASS decision deadline covers search, alternative roots and death proofs; time exhaustion stays bounded rather than becoming a loss or impossibility certificate');
}

if (require.main === module) test();
module.exports = test;
