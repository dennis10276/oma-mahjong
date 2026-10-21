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

// Validated observation process: covered face-up pictures are NOT known, recognizable exposed edges become known when uncovered
const { createSession } = require('./production_physical_session.js');

const obsTiles = [
  { x: 0, y: 0, z: 0 }, // Tile 0: covered by Tile 1
  { x: 0, y: 0, z: 1 }, // Tile 1: covers Tile 0
  { x: 8, y: 0, z: 0 }, // Tile 2: face-down, exposed
  { x: 16, y: 0, z: 0 } // Tile 3: face-up, exposed
];
const obsGame = {
  tiles: obsTiles,
  nb: Layouts.neighbors(obsTiles),
  faces: [5, 6, 7, 8],
  down: [0, 0, 1, 0], // 0 is face-up (covered), 1 is face-up (covers 0), 2 is face-down, 3 is face-up (exposed)
  rules: null,
  clock: null
};

// Test session public view contains zero concealed pictures or private engine state
const obsSession = createSession(obsGame);
const viewJson = JSON.stringify(obsSession.view());
assert(!viewJson.match(/faces|pictures|known|scores|inspect|decision|\bF\b/), 'Public frame must not expose concealed pictures or internal scores');

// Validated observation extraction:
const getObservation = (f, g) => {
  return f.state.alive.map((alive, index) => {
    if (!alive) return null;
    if (index === f.state.openPeek) return g.faces[index];
    if (!g.down[index]) {
      const aboveList = (g.nb && g.nb.above && g.nb.above[index]) || [];
      if (aboveList.every(a => !f.state.alive[a])) return g.faces[index];
    }
    return null;
  });
};

// Initial frame: Tile 1 covers Tile 0. Tile 0 face-up picture (5) must NOT be known!
const initialFrame = obsSession.view();
const initialObs = getObservation(initialFrame, obsGame);
assert.equal(initialObs[0], null, 'Covered face-up tile 0 must NOT be observed while tile 1 is alive');
assert.equal(initialObs[1], 6, 'Exposed face-up tile 1 must be observed');
assert.equal(initialObs[2], null, 'Face-down tile 2 must NOT be observed before inspection');
assert.equal(initialObs[3], 8, 'Exposed face-up tile 3 must be observed');

// Now remove Tile 1: Tile 0's edge/face becomes exposed
obsSession.tap(1);
const frameAfterTap = obsSession.view();
const obsAfterTap = getObservation(frameAfterTap, obsGame);
assert.equal(obsAfterTap[0], 5, 'Now-exposed face-up tile 0 must be observed after tile 1 is removed');
assert.equal(obsAfterTap[1], null, 'Removed tile 1 must be null');
assert.equal(obsAfterTap[2], null, 'Face-down tile 2 remains null');
assert.equal(obsAfterTap[3], 8, 'Exposed face-up tile 3 remains observed');

// Hypothetical search must not reveal the real hidden outcome
const publicGeom = { tiles: obsTiles, nb: Layouts.neighbors(obsTiles), rules: null, clock: null };
Object.defineProperty(publicGeom, 'faces', { get() { throw new Error('Search must not access private faces'); } });
const searchState = {
  pictures: initialObs,
  down: obsGame.down.slice(),
  alive: [1, 1, 1, 1],
  tray: [],
  moves: 0,
  openPeek: -1,
  relieved: false,
  arriving: []
};
const searchRes = originalSearch(publicGeom, searchState, [{ index: 1, inspect: false }, { index: 2, inspect: true }]);
assert(!searchRes.knownWin, 'Search with unrevealed tiles must not declare known win');
assert(searchRes.unknownTransitions > 0 || searchRes.information, 'Search must track unknown transitions rather than revealing real hidden outcome');

console.log('PASS: concealed-prefix seed invariance, private-deal exclusion, and exactly one search forgetting draw');
