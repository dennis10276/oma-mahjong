'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { legal } = require('./known_tray_plan.js');
const { createKnownLegalCache } = require('./public_known_legal_cache.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 2, z: 0 },
    { x: 6, y: 0, z: 0 }, { x: 6, y: 2, z: 0 }, { x: 10, y: 0, z: 0 }];
  const nb = Layouts.neighbors(tiles), iceNb = Layouts.iceNeighbors(tiles);
  let controls = 0, reused = 0;
  for (const hits of [0, 1, 2]) for (const locked of [false, true]) {
    const game = { tiles, nb, clock: null, rules: { iceNb, ice: hits ? { 0: hits } : {},
      locks: new Set(locked ? [0, 3] : []), keys: [4, 5] } };
    for (const field of ['faces', 'down', 'seed', 'deck']) Object.defineProperty(game, field,
      { get() { throw Error('Legality cache read private ' + field); } });
    const cached = createKnownLegalCache(game);
    for (let mask = 0; mask < 64; mask++) {
      const alive = tiles.map((unused, index) => +(!!(mask & 2 ** index)));
      for (const relieved of [false, true]) for (let slots = 0; slots <= 4; slots++) {
        const state = { alive, tray: Array(slots).fill(9), relieved };
        Object.defineProperty(state, 'pictures', { get() { throw Error('Legality depends on structure, not picture guesses'); } });
        assert.deepEqual(legal(cached.geometry, state), legal(game, state));
        assert.deepEqual(legal(cached.geometry, { alive: alive.slice(), tray: state.tray, relieved }), legal(game, state));
        controls++;
      }
    }
    assert(cached.stats().hits > 0 && cached.stats().misses > 0); reused += cached.stats().hits;
  }
  const flat = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const state = { alive: flat.map(() => 1), pictures: [0, 1, 0, 1, 2, 2, 3, 3], down: [1, 1, 1, 1, 0, 0, 0, 0],
    tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  for (const clock of [null, { i: 1, n: 4 }]) {
    const geometry = { tiles: flat, nb: Layouts.neighbors(flat), rules: null, clock };
    const cached = createKnownLegalCache(geometry), options = { ...REFERENCE_PARAMETERS, nodes: 256, beam: 4,
      knownPairMacros: true, progressiveReopens: true, cachePublicAnalysis: true };
    const actions = flat.map((unused, index) => ({ index }));
    const plain = search(geometry, structuredClone(state), actions, options);
    const accelerated = search(cached.geometry, structuredClone(state), actions, options);
    for (const field of ['index', 'path', 'goal', 'knownWin', 'knownDead', 'knownProgress', 'nodes', 'boundary']) {
      assert.deepEqual(accelerated[field], plain[field]);
    }
    assert(cached.stats().hits > 0);
    const allowed = legal(cached.geometry, structuredClone(state));
    assert.throws(() => allowed.free.push(99));
  }
  assert.throws(() => createKnownLegalCache({ tiles, nb, rules: null, clock: null, faces: [] }));
  const mutable = { alive: tiles.map(() => 1), tray: [], relieved: false };
  const geometry = { tiles, nb, rules: null, clock: null }, cached = createKnownLegalCache(geometry);
  legal(cached.geometry, mutable);
  assert.equal(Object.isFrozen(mutable.alive), false);
  mutable.alive[0] = 0;
  assert.deepEqual(legal(cached.geometry, mutable), legal(geometry, mutable));
  Object.freeze(mutable.alive);
  assert.deepEqual(legal(cached.geometry, mutable), legal(geometry, mutable));
  assert.deepEqual(legal(cached.geometry, mutable), legal(geometry, mutable));
  console.log('PASS ' + controls + ' exhaustive structural/ice/lock/relief/slot comparisons and ' + reused
    + ' cache hits preserve original legality, frozen results and clock/nonclock fixed-node paths without reading pictures or a seed');
}

if (require.main === module) test();
module.exports = test;
