'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { createSession } = require('./production_physical_session.js');

function test() {
  const tiles = [0, 4, 8, 12, 16, 20].map(horizontal => ({ x: horizontal, y: 0, z: 0 }));
  const actualGame = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 8, 8, 9, 9],
    down: [0, 0, 0, 1, 0, 1], rules: null, clock: null };
  const session = createSession(actualGame);
  session.tap(2); session.tap(4);
  const state = { ...session.view().state, pictures: [1, 1, null, null, null, null] };
  const game = { tiles, nb: actualGame.nb, rules: null, clock: null };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const planned = search(game, state, [{ index: 0 }], { ...REFERENCE_PARAMETERS, nodes: 32, beam: 16,
    taps: 3, pruneDead: false, knownPairMacros: true });
  assert.deepEqual(planned.path.slice(0, 2), [0, 1], 'With the same unresolved carries, completing a known pair must outrank carrying it to another information frontier');
  assert.equal(planned.knownProgress, 2);
  assert(planned.information); assert(!planned.knownWin); assert(!planned.knownDead);
  session.tap(planned.path[0]); session.tap(planned.path[1]);
  assert.deepEqual(session.view().state.tray, [8, 9]);
  assert.equal(session.view().state.alive[0], 0); assert.equal(session.view().state.alive[1], 0);
  console.log('PASS recovery ordering prefers consuming an available pair over retaining an extra immediately matchable carry, without changing the unresolved carries or reading the next reveal');
}

if (require.main === module) test();
module.exports = test;
