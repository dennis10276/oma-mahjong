'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const searchModule = require('./public_witness_search.js');
const simulationFile = require.resolve('./personal_witness_simulation.js');
const originalSearch = searchModule.search;

// Exercise default campaign and memory RNG with equivalent public prefixes.
// The forced action fixture tests seed/memory plumbing, not full human vision.
function prefix(faces, seed) {
  const steps = [];
  searchModule.search = (geometry, state) => {
    assert.equal('faces' in geometry, false, 'Private deal must not be passed to policy');
    assert.equal('down' in geometry, false, 'Initial private game must not be passed wholesale');
    steps.push({ pictures: state.pictures.slice(), openPeek: state.openPeek, moves: state.moves });
    if (steps.length === 5) throw Error('PUBLIC_PREFIX_COMPLETE');
    return { path: [steps.length - 1] };
  };
  delete require.cache[simulationFile];
  const { simulatePersonalCampaign } = require(simulationFile);
  const tiles = faces.map((_, index) => ({ x: index * 8, y: 0, z: 0 }));
  assert.throws(() => simulatePersonalCampaign({ tiles, nb: Layouts.neighbors(tiles), faces,
    down: faces.map(() => 1), rules: null, clock: null }, 'Dennisisdebeste', {
    maxAttempts: 1, cutoffTime: 1, ...(seed === undefined ? {} : { seed }),
    customParams: { depth: 20, trayBuffer: 2, clockPatience: .5, memoryDecay: .5, retryLearning: 1 }
  }), /PUBLIC_PREFIX_COMPLETE/);
  assert.equal(steps.length, 5);
  return steps;
}

try {
  const a = [1, 2, 3, 4, 1, 2, 3, 4], b = [1, 2, 3, 4, 2, 1, 3, 4];
  assert.deepEqual(prefix(a), prefix(b));
  assert.deepEqual(prefix(a, 17), prefix(b, 17));
} finally {
  searchModule.search = originalSearch;
  delete require.cache[simulationFile];
}

const tiles = [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }];
const state = { pictures: [1, 1], down: [1, 0], alive: [1, 1], tray: [], moves: 0,
  openPeek: -1, relieved: false, arriving: [] };
let draws = 0;
const values = [.9, .1];
const result = originalSearch({ tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null },
  state, [{ index: 1 }], { memoryDecay: .5, rng: () => values[draws++] ?? .9 });
assert.equal(draws, 1, 'Search probes must not duplicate a forgetting draw');
assert.equal(result.initialKnown, 2);
console.log('PASS: concealed-prefix seed invariance, private-deal exclusion, and exactly one search forgetting draw');
