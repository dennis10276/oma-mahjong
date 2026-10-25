'use strict';
const assert = require('assert/strict');
const { tileVisibility } = require('./human_board_visibility.js');
const { createExposureFrontier } = require('./public_exposure_frontier.js');

function createDrawnRoleFrontier(tiles, initial, mode = 'all') {
  const existing = createExposureFrontier(tiles, initial, mode);
  assert(initial.roles === undefined || Array.isArray(initial.roles) && initial.roles.length === tiles.length);
  const baseline = tileVisibility(tiles, initial, null);
  const targets = initial.alive.flatMap((alive, index) => alive && initial.roles?.[index] === null && !baseline.tiles[index].role ? [index] : []);
  const down = initial.down.slice(), cache = new Map();
  return position => {
    const identity = position.alive.join('');
    if (cache.has(identity)) return cache.get(identity);
    const current = tileVisibility(tiles, { alive: position.alive, down, openPeek: -1 }, null, targets);
    const gained = targets.filter(index => position.alive[index] && current.tiles[index].role);
    const result = Object.freeze([...new Set([...existing(position), ...gained])]);
    cache.set(identity, result); return result;
  };
}

module.exports = { createDrawnRoleFrontier };
