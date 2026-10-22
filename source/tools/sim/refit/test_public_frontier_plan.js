'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createSession } = require('./production_physical_session.js');
const { createObstacleFrontier } = require('./public_obstacle_frontier.js');
const { advanceObserved } = require('./known_tray_plan.js');
const { planObservedPrefix } = require('./public_frontier_plan.js');

function test() {
  const tiles = Array.from({ length: 4 }, (value, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 2, 1, 2], down: [0, 0, 0, 0], rules: null, clock: null };
  const geometry = { tiles, nb: game.nb, clock: null };
  for (const key of ['rules', 'faces', 'down']) Object.defineProperty(geometry, key, { get() { throw Error('Observed planner read private ' + key); } });
  const frontier = createObstacleFrontier(tiles), frame = createSession(game).view();
  frontier.observe({ alive: frame.state.alive, physicalTaps: 0 }, tiles.map((tile, index) => ({ index, observation: { roles: ['none'], knownRole: 'none' } })));
  const state = { ...frame.state, pictures: [1, 2, 1, 2] }, plan = planObservedPrefix(geometry, state, frontier);
  assert(plan.witnessedWin); assert.equal(plan.path.length, 4); assert.equal(plan.unsupported, 0); assert.equal(plan.boundary, null);
  const session = createSession(game);
  let predicted = state;
  for (const index of plan.path) {
    const next = advanceObserved(geometry, predicted, index, frontier); assert(!next.uncertain);
    const actual = session.tap(index);
    for (const field of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(next.state[field], actual.state[field]);
    predicted = next.state;
  }
  assert(session.view().win);
  const narrow = planObservedPrefix(geometry, state, frontier, { beam: 1 }); assert(narrow.bounded); assert(narrow.witnessedWin);
  const uncertain = createObstacleFrontier(tiles);
  uncertain.observe({ alive: state.alive, physicalTaps: 0 }, tiles.map((tile, index) => ({ index, observation: { roles: ['none', 'ice', 'ice2', 'lock', 'key'], knownRole: null } })));
  const stopped = planObservedPrefix(geometry, state, uncertain); assert.equal(stopped.index, null); assert(!stopped.witnessedWin);
  assert.equal(stopped.boundary, 'obstacleObservationRequired'); assert(!stopped.note.includes('proven impossible'));
  assert.equal(advanceObserved(geometry, { ...state, down: [null, 0, 0, 0] }, 0, frontier).reason, 'unobservedOrientation');
  const unknownPictures = { ...state, pictures: [null, null, null, null] }, exploration = planObservedPrefix(geometry, unknownPictures, frontier);
  assert.equal(exploration.boundary, 'unseenPicture'); assert.equal(exploration.path.length, 1); assert(!exploration.witnessedWin);
  assert(exploration.pictureBoundaries > 0);
  const cap = planObservedPrefix(geometry, state, frontier, { nodes: 1 }); assert(cap.bounded); assert(!cap.witnessedWin);
  const locked = createObstacleFrontier(tiles);
  locked.observe({ alive: state.alive, physicalTaps: 0 }, tiles.map((tile, index) => ({ index, observation: { roles: [index === 0 ? 'lock' : 'none'], knownRole: index === 0 ? 'lock' : 'none' } })));
  assert(!planObservedPrefix(geometry, state, locked).path.includes(0), 'A removal does not certify that an unobserved lock has opened');
  console.log('PASS observed-only route planning executes a production winning prefix, stops at unknown roles/pictures/orientation, refuses hidden-rule/deck access and keeps capped or missing routes unresolved');
}

if (require.main === module) test();
module.exports = test;
