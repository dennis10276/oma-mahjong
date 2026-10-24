'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { searchFilledPosition } = require('./public_filled_search.js');
const { analyzeRecovery } = require('./public_recovery_graph.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = [0, 4, 8, 12].map(horizontal => ({ x: horizontal, y: 0, z: 0 }));
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  let controls = 0;
  for (const down of [[0, 0, 0, 0], [1, 1, 1, 1]]) for (const clock of [null, { i: 3, n: 3 }, { i: 0, n: 1 }]) {
    for (const special of [false, true]) {
      const geometry = { tiles, nb: Layouts.neighbors(tiles), clock, rules: special
        ? { iceNb: Layouts.iceNeighbors(tiles), ice: {}, keys: [0, 1], locks: new Set([2, 3]) } : null };
      const actual = { ...geometry, faces: [1, 2, 1, 2], down }, session = factory(actual, settings);
      const state = { ...session.view().state, pictures: actual.faces.slice() }, before = JSON.stringify(state);
      const planned = searchFilledPosition(geometry, state, { nodeLimit: 4096, deadline: Date.now() + 1000 });
      const oracle = analyzeRecovery(geometry, state, { nodes: 4096 });
      assert(oracle.complete); assert.notEqual(planned.status, 'unresolved');
      assert.equal(planned.status === 'cleared', oracle.knownWinningRoute);
      assert(planned.nodes <= 4096); assert.equal(planned.observedFact, false);
      assert.equal(JSON.stringify(state), before);
      if (planned.status === 'cleared') {
        for (const index of planned.path) session.tap(index);
        assert(session.view().win);
        assert.equal(verifyAttempt(encodeGame(actual), planned.path, settings, session.audit()), planned.path.length);
      } else assert(planned.exhaustive);
      controls++;
    }
  }
  const geometry = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  const state = { alive: [1, 1, 1, 1], pictures: [1, 2, 1, 2], down: [0, 0, 0, 0],
    tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  assert.equal(searchFilledPosition(geometry, state, { nodeLimit: 1, deadline: Date.now() + 1000 }).status, 'unresolved');
  assert.equal(searchFilledPosition(geometry, state, { nodeLimit: 4096, deadline: 0 }).status, 'unresolved');
  assert.throws(() => searchFilledPosition({ ...geometry, faces: state.pictures }, state, { deadline: 1 }));
  factory.verifySource();
  console.log('PASS ' + controls + ' exact filled-position DFS controls agree with exhaustive physical graphs, independently replay wins, retain clock/peek/tray/relief state, preserve input and leave caps/unsupported transitions unresolved');
}

if (require.main === module) test();
module.exports = test;
