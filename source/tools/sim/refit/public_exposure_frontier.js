'use strict';
const { tileVisibility } = require('./human_board_visibility.js');

function createExposureFrontier(tiles, initial) {
  const down = initial.down.slice(), baseline = tileVisibility(tiles, { ...initial, down }, null);
  const targets = initial.alive.flatMap((alive, index) => {
    if (!alive) return [];
    const visible = baseline.tiles[index];
    const orientation = down[index] === null && !visible.orientation;
    const picture = down[index] === 0 && initial.pictures[index] === null && !visible.picture;
    const role = down[index] === 0 && initial.roles?.[index] === null && !visible.role;
    return orientation || picture || role ? [{ index, orientation, picture, role }] : [];
  });
  const indices = targets.map(target => target.index);
  const cache = new Map(), empty = Object.freeze([]);
  return position => {
    if (!targets.length) return empty;
    const signature = position.alive.join('');
    if (cache.has(signature)) return cache.get(signature);
    const projected = tileVisibility(tiles, { alive: position.alive, down, openPeek: -1 }, null, indices);
    const gained = Object.freeze(targets.filter(target => position.alive[target.index]
      && (target.orientation && projected.tiles[target.index].orientation
        || target.picture && projected.tiles[target.index].picture || target.role && projected.tiles[target.index].role)).map(target => target.index));
    cache.set(signature, gained); return gained;
  };
}

function informationInCone(cone, target, newlyReadable = null) {
  return !!cone && (newlyReadable === null ? cone.has(target) : newlyReadable.some(index => cone.has(index)));
}

module.exports = { createExposureFrontier, informationInCone };
