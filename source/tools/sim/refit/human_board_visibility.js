'use strict';
const assert = require('assert/strict');
const Layouts = require('./physics/layouts.js');
const geometryCache = new WeakMap();

function visibilityGeometry(tiles) {
  const signature = tiles.map(tile => tile.x + ',' + tile.y + ',' + tile.z).join(';');
  const previous = geometryCache.get(tiles);
  if (previous?.signature === signature) return previous;
  const side = Math.max(0.085, 3 / 20);
  const boxes = tiles.map(tile => {
    const left = tile.x / 2 - tile.z * 0.14, top = tile.y / 2 * 1.24 - tile.z * 0.14;
    return { left, top, right: left + 1 + side, bottom: top + 1.24 + side * 1.2, order: tile.z * 10000 + tile.y * 100 + tile.x };
  });
  const finite = boxes.every(box => Object.values(box).every(Number.isFinite));
  const occluders = boxes.map(box => boxes.flatMap((cover, index) => !finite
    || cover.order > box.order && cover.left < box.right && cover.right > box.left
      && cover.top < box.bottom && cover.bottom > box.top ? [index] : []));
  const compiled = { signature, boxes, occluders, neighbors: Layouts.neighbors(tiles) };
  geometryCache.set(tiles, compiled); return compiled;
}

function tileVisibility(tiles, state, clock, requested = null) {
  assert(requested === null || Array.isArray(requested) && requested.every(index => Number.isInteger(index) && index >= 0 && index < tiles.length));
  const selected = requested === null ? null : new Set(requested);
  const { boxes, occluders } = visibilityGeometry(tiles);
  const tilesVisible = tiles.map((tile, index) => {
    if (selected && !selected.has(index)) return null;
    const box = boxes[index];
    const exposedRegion = initial => {
      let regions = state.alive[index] ? initial : [];
      for (const other of occluders[index]) {
        if (!regions.length) break;
        const cover = boxes[other];
        if (!state.alive[other] || cover.order <= box.order) continue;
        regions = regions.flatMap(region => {
          const [left, top, right, bottom] = region;
          const cutLeft = Math.max(left, cover.left), cutTop = Math.max(top, cover.top);
          const cutRight = Math.min(right, cover.right), cutBottom = Math.min(bottom, cover.bottom);
          if (cutLeft >= cutRight || cutTop >= cutBottom) return [region];
          return [[left, top, cutLeft, bottom], [cutRight, top, right, bottom],
            [cutLeft, top, cutRight, cutTop], [cutLeft, cutBottom, cutRight, bottom]]
            .filter(([start, upper, end, lower]) => end - start > 1e-9 && lower - upper > 1e-9);
        });
      }
      return regions.length > 0;
    };
    const exposed = exposedRegion([
      [box.left + 0.15, box.top + 0.05, box.left + 0.85, box.top + 1.24 + 0.085 * 1.2 - 0.03],
      [box.left + 0.05, box.top + 0.15, box.left + 1 + 0.085 - 0.03, box.top + 1.09],
    ]);
    const overlayExposed = exposedRegion([[box.left + 0.15, box.top + 0.15, box.left + 0.85, box.top + 1.09]]);
    const faceUp = exposed && (!state.down[index] || state.openPeek === index);
    return { orientation: exposed, picture: faceUp, role: overlayExposed };
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
  const neighbors = readers.takeable ? visibilityGeometry(tiles).neighbors : null;
  const takeable = readers.takeable ? tiles.map((tile, index) => state.alive[index]
    && Layouts.isFree(index, state.alive, neighbors) ? readers.takeable(index) : null) : null;
  assert(takeable === null || takeable.every(value => value === null || typeof value === 'boolean'));
  return { pictures, roles, clock: visibility.clock, ...(takeable ? { takeable } : {}),
    down: visibility.tiles.map((visible, index) => visible.orientation ? state.down[index] : null) };
}

module.exports = { tileVisibility, observeBoard };
