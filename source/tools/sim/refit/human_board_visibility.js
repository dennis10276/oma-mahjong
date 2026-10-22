'use strict';
const assert = require('assert/strict');

function tileVisibility(tiles, state, clock) {
  const tilesVisible = tiles.map((tile, index) => {
    const exposed = !!state.alive[index] && !tiles.some((above, other) => state.alive[other]
      && above.z > tile.z && above.x === tile.x && above.y === tile.y);
    const faceUp = exposed && (!state.down[index] || state.openPeek === index);
    return { orientation: exposed, picture: faceUp, role: faceUp };
  });
  return { tiles: tilesVisible, clock: clock && state.alive[clock.i]
    ? { i: clock.i, n: clock.n, remaining: Math.max(0, clock.n - state.moves) } : null };
}

function observeBoard(tiles, state, clock, readers) {
  const visibility = tileVisibility(tiles, state, clock);
  const pictures = visibility.tiles.map((visible, index) => visible.picture ? readers.picture(index) : null);
  const roles = visibility.tiles.map((visible, index) => visible.role ? readers.role(index) : null);
  assert(pictures.every(picture => picture === null || Number.isInteger(picture) && picture >= 0 && picture <= 101));
  assert(roles.every(role => role === null || ['none', 'ice', 'ice2', 'lock', 'key'].includes(role)));
  return { pictures, roles, clock: visibility.clock,
    down: visibility.tiles.map((visible, index) => visible.orientation ? state.down[index] : null) };
}

module.exports = { tileVisibility, observeBoard };
