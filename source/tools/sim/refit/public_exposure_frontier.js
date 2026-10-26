'use strict';
const assert = require('assert/strict');
const { tileVisibility } = require('./human_board_visibility.js');

function createExposureFrontier(tiles, initial, mode = 'all', includeBackRoles = false) {
  assert(['all', 'roles'].includes(mode));
  assert.equal(typeof includeBackRoles, 'boolean');
  const down = initial.down.slice(), baseline = tileVisibility(tiles, { ...initial, down }, null);
  const targets = initial.alive.flatMap((alive, index) => {
    if (!alive) return [];
    const visible = baseline.tiles[index];
    const orientation = mode === 'all' && down[index] === null && !visible.orientation;
    const picture = mode === 'all' && down[index] === 0 && initial.pictures[index] === null && !visible.picture;
    const role = down[index] === 0 && initial.roles?.[index] === null && !visible.role;
    const backRole = includeBackRoles && down[index] !== 0 && initial.roles?.[index] === null && !visible.role;
    return orientation || picture || role || backRole ? [{ index, orientation, picture, role, backRole }] : [];
  });
  const indices = targets.map(target => target.index);
  const cache = new Map(), empty = Object.freeze([]);
  return position => {
    if (!targets.length) return empty;
    const signature = position.alive.join('');
    if (cache.has(signature)) return cache.get(signature);
    const projected = tileVisibility(tiles, { alive: position.alive, down, openPeek: -1 }, null, indices);
    const ordinary = targets.filter(target => position.alive[target.index]
      && (target.orientation && projected.tiles[target.index].orientation
        || target.picture && projected.tiles[target.index].picture || target.role && projected.tiles[target.index].role)).map(target => target.index);
    const gained = Object.freeze(includeBackRoles ? [...new Set([...ordinary,
      ...targets.filter(target => target.backRole && position.alive[target.index] && projected.tiles[target.index].role)
        .map(target => target.index)])] : ordinary);
    cache.set(signature, gained); return gained;
  };
}

function informationInCone(cone, target, newlyReadable = null) {
  return !!cone && (newlyReadable === null ? cone.has(target) : newlyReadable.some(index => cone.has(index)));
}

function passiveExposureMode(information, state, clock, minimumClockMoves) {
  if (minimumClockMoves !== undefined) {
    assert.equal(information, 'shortAll');
    assert(Number.isInteger(minimumClockMoves) && minimumClockMoves >= 0);
    if (!clock || !state.alive[clock.i] || clock.n - state.moves < minimumClockMoves) return 'roles';
  }
  return ['roles', 'frontierRoles', 'immediateRoles', 'shortRoles'].includes(information) ? 'roles' : 'all';
}

module.exports = { createExposureFrontier, informationInCone, passiveExposureMode };
