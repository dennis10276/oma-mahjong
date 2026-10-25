'use strict';
const assert = require('assert/strict');
const { tileVisibility } = require('./human_board_visibility.js');
const { createExposureFrontier } = require('./public_exposure_frontier.js');
const { createDrawnRoleFrontier } = require('./public_drawn_role_frontier.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 },
    ...Array.from({ length: 6 }, (value, index) => ({ x: 8 + index * 4, y: 0, z: 0 }))];
  for (const tile of tiles) Object.defineProperty(tile, 'face', { get() { throw Error('Private picture'); } });
  const initial = { alive: tiles.map(() => 1), down: tiles.map((tile, index) => +(index === 0)),
    pictures: tiles.map(() => null), roles: tiles.map((tile, index) => index === 0 ? null : 'none'), openPeek: -1 };
  const after = { ...initial, alive: initial.alive.map((alive, index) => index === 1 ? 0 : alive) };
  assert(tileVisibility(tiles, initial, null).tiles[0].orientation);
  assert(!tileVisibility(tiles, initial, null).tiles[0].role);
  const visibleAfter = tileVisibility(tiles, after, null).tiles[0];
  assert(visibleAfter.role && !visibleAfter.picture);
  assert.deepEqual(createExposureFrontier(tiles, initial, 'roles')(after), []);
  const snapshot = JSON.stringify(initial), frontier = createDrawnRoleFrontier(tiles, initial, 'roles');
  assert.deepEqual(frontier(initial), []); assert.deepEqual(frontier(after), [0]);
  assert(Object.isFrozen(frontier(after))); assert.equal(initial.pictures[0], null);
  assert.equal(JSON.stringify(initial), snapshot);
  assert.deepEqual(frontier({ ...after, alive: after.alive.map((alive, index) => index === 0 ? 0 : alive) }), []);
  assert.deepEqual(createDrawnRoleFrontier(tiles, { ...initial, roles: ['key', ...initial.roles.slice(1)] }, 'roles')(after), []);
  const fullyCovered = tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z }));
  fullyCovered[1] = { x: 0.28, y: 0.28 / 1.24, z: 1 };
  const unknownOrientation = { ...initial, down: [null, ...initial.down.slice(1)] };
  assert(!tileVisibility(fullyCovered, unknownOrientation, null).tiles[0].orientation);
  assert.deepEqual(createDrawnRoleFrontier(fullyCovered, unknownOrientation, 'roles')(after), [0]);
  assert.equal(unknownOrientation.down[0], null); assert.equal(unknownOrientation.pictures[0], null);
  const combinedTiles = tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z }));
  combinedTiles[3] = { x: 8.28, y: 0.28 / 1.24, z: 1 };
  const combinedInitial = { ...initial, down: initial.down.map((value, index) => index === 2 ? null : value),
    roles: initial.roles.map((value, index) => index === 2 ? null : value) };
  const combinedAfter = { ...combinedInitial, alive: combinedInitial.alive.map((alive, index) => index === 1 || index === 3 ? 0 : alive) };
  assert.deepEqual(createExposureFrontier(combinedTiles, combinedInitial, 'all')(combinedAfter), [2]);
  assert.deepEqual(createDrawnRoleFrontier(combinedTiles, combinedInitial, 'all')(combinedAfter), [2, 0],
    'Legacy orientation targets keep their order; a newly readable back role is appended once');
  assert.throws(() => createDrawnRoleFrontier(tiles, initial, 'private'));
  console.log('PASS future drawn-role targets include closed and unknown-orientation tiles through the ONE geometry gate, never disclose pictures or role values, retain immutable public state and ignore already-known/dead targets');
}

if (require.main === module) test();
module.exports = test;
