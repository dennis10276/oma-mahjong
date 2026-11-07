'use strict';
const assert = require('assert/strict');
const Layouts = require('./physics/layouts.js');
const geometryCache = new WeakMap();
const signatureCache = new Map();
const MAX_SIGNATURE_CACHE = 512;

function coordsMatch(tiles, coords) {
  if (coords.length !== tiles.length * 3) return false;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i], base = i * 3;
    if (!Object.is(t.x, coords[base]) || !Object.is(t.y, coords[base + 1]) || !Object.is(t.z, coords[base + 2])) {
      return false;
    }
  }
  return true;
}

function visibilityGeometry(tiles) {
  const previous = geometryCache.get(tiles);
  if (previous && coordsMatch(tiles, previous.coords)) return previous;

  const n = tiles.length;
  const coords = new Float64Array(n * 3);
  let finiteCoords = true;
  for (let i = 0; i < n; i++) {
    const t = tiles[i], base = i * 3;
    coords[base] = t.x;
    coords[base + 1] = t.y;
    coords[base + 2] = t.z;
    if (!Number.isFinite(t.x) || !Number.isFinite(t.y) || !Number.isFinite(t.z)) finiteCoords = false;
  }

  const signature = tiles.map(tile => tile.x + ',' + tile.y + ',' + tile.z).join(';');
  if (previous?.signature === signature) return previous;

  if (finiteCoords) {
    const bySig = signatureCache.get(signature);
    if (bySig) {
      geometryCache.set(tiles, bySig);
      return bySig;
    }
  }

  const side = Math.max(0.085, 3 / 20);
  const boxes = tiles.map(tile => {
    const left = tile.x / 2 - tile.z * 0.14, top = tile.y / 2 * 1.24 - tile.z * 0.14;
    return { left, top, right: left + 1 + side, bottom: top + 1.24 + side * 1.2, order: tile.z * 10000 + tile.y * 100 + tile.x };
  });
  const finite = boxes.every(box => Object.values(box).every(Number.isFinite));
  const occluders = boxes.map(box => Int32Array.from(boxes.flatMap((cover, index) => !finite
    || cover.order > box.order && cover.left < box.right && cover.right > box.left
      && cover.top < box.bottom && cover.bottom > box.top ? [index] : [])));
  const exposedInit = boxes.map(box => [
    [box.left + 0.15, box.top + 0.05, box.left + 0.85, box.top + 1.24 + 0.085 * 1.2 - 0.03],
    [box.left + 0.05, box.top + 0.15, box.left + 1 + 0.085 - 0.03, box.top + 1.09],
  ]);
  const overlayInit = boxes.map(box => [
    [box.left + 0.15, box.top + 0.15, box.left + 0.85, box.top + 1.09],
  ]);
  const compiled = { signature, coords, boxes, occluders, exposedInit, overlayInit, neighbors: Layouts.neighbors(tiles) };
  geometryCache.set(tiles, compiled);
  if (finite) {
    if (signatureCache.size >= MAX_SIGNATURE_CACHE) {
      signatureCache.delete(signatureCache.keys().next().value);
    }
    signatureCache.set(signature, compiled);
  }
  return compiled;
}

function checkRegionsExposed(initialRegions, occ, boxes, boxOrder, alive) {
  const m = occ.length;
  if (m === 0) return true;
  let firstActive = -1;
  for (let k = 0; k < m; k++) {
    const other = occ[k];
    if (alive[other] && boxes[other].order > boxOrder) {
      firstActive = k;
      break;
    }
  }
  if (firstActive < 0) return true;

  let regions = initialRegions;
  for (let k = firstActive; k < m; k++) {
    const other = occ[k];
    if (!alive[other]) continue;
    const cover = boxes[other];
    if (cover.order <= boxOrder) continue;
    const next = [];
    const cLeft = cover.left, cTop = cover.top, cRight = cover.right, cBottom = cover.bottom;
    for (let r = 0; r < regions.length; r++) {
      const reg = regions[r];
      const left = reg[0], top = reg[1], right = reg[2], bottom = reg[3];
      const cutLeft = Math.max(left, cLeft), cutTop = Math.max(top, cTop);
      const cutRight = Math.min(right, cRight), cutBottom = Math.min(bottom, cBottom);
      if (cutLeft >= cutRight || cutTop >= cutBottom) {
        next.push(reg);
        continue;
      }
      const fullH = bottom - top > 1e-9;
      if (cutLeft - left > 1e-9 && fullH) next.push([left, top, cutLeft, bottom]);
      if (right - cutRight > 1e-9 && fullH) next.push([cutRight, top, right, bottom]);
      const midW = cutRight - cutLeft > 1e-9;
      if (midW && cutTop - top > 1e-9) next.push([cutLeft, top, cutRight, cutTop]);
      if (midW && bottom - cutBottom > 1e-9) next.push([cutLeft, cutBottom, cutRight, bottom]);
    }
    regions = next;
    if (regions.length === 0) return false;
  }
  return regions.length > 0;
}

function tileVisibility(tiles, state, clock, requested = null) {
  assert(requested === null || Array.isArray(requested) && requested.every(index => Number.isInteger(index) && index >= 0 && index < tiles.length));
  const selected = requested === null ? null : new Set(requested);
  const { boxes, occluders, exposedInit, overlayInit } = visibilityGeometry(tiles);
  const alive = state.alive, down = state.down, openPeek = state.openPeek;
  const n = tiles.length;
  const tilesVisible = new Array(n);
  for (let index = 0; index < n; index++) {
    if (selected && !selected.has(index)) {
      tilesVisible[index] = null;
      continue;
    }
    if (!alive[index]) {
      tilesVisible[index] = { orientation: false, picture: false, role: false };
      continue;
    }
    const order = boxes[index].order, occ = occluders[index];
    const exposed = checkRegionsExposed(exposedInit[index], occ, boxes, order, alive);
    const overlayExposed = checkRegionsExposed(overlayInit[index], occ, boxes, order, alive);
    const faceUp = exposed && (!down[index] || openPeek === index);
    tilesVisible[index] = { orientation: exposed, picture: faceUp, role: overlayExposed };
  }
  return { tiles: tilesVisible, clock: clock && alive[clock.i]
    ? { i: clock.i, n: clock.n, remaining: Math.max(0, clock.n - state.moves) } : null };
}

function observeBoard(tiles, state, clock, readers) {
  const geom = visibilityGeometry(tiles);
  const visibility = tileVisibility(tiles, state, clock);
  const pictures = visibility.tiles.map((visible, index) => visible.picture ? readers.picture(index) : null);
  const roles = visibility.tiles.map((visible, index) => visible.role ? readers.role(index) : null);
  assert(pictures.every(picture => picture === null || Number.isInteger(picture) && picture >= 0 && picture <= 101));
  assert(roles.every(role => role === null || ['none', 'ice', 'ice2', 'lock', 'key'].includes(role)));
  const neighbors = readers.takeable ? geom.neighbors : null;
  const takeable = readers.takeable ? tiles.map((tile, index) => state.alive[index]
    && Layouts.isFree(index, state.alive, neighbors) ? readers.takeable(index) : null) : null;
  assert(takeable === null || takeable.every(value => value === null || typeof value === 'boolean'));
  return { pictures, roles, clock: visibility.clock, ...(takeable ? { takeable } : {}),
    down: visibility.tiles.map((visible, index) => visible.orientation ? state.down[index] : null) };
}

/**
 * Single-pass zero-drift observer used by the fast measurement path.
 * Produces the exact same `{ pictures, roles, clock, takeable, down }` object as `observeBoard`.
 */
function observeBoardFast(geom, game, alive, stateDown, openPeek, moves, relieved, legalMask) {
  const { boxes, occluders, exposedInit, overlayInit, neighbors } = geom;
  const faces = game.faces, rules = game.rules, clock = game.clock;
  const n = faces.length;
  const pictures = new Array(n);
  const roles = new Array(n);
  const down = new Array(n);
  const takeable = new Array(n);

  const activeRules = !!(rules && !relieved);
  let keysLeft = false;
  if (activeRules && rules.keys) {
    for (let k = 0; k < rules.keys.length; k++) {
      if (alive[rules.keys[k]]) { keysLeft = true; break; }
    }
  }

  for (let i = 0; i < n; i++) {
    if (!alive[i]) {
      pictures[i] = null;
      roles[i] = null;
      down[i] = null;
      takeable[i] = null;
      continue;
    }
    const order = boxes[i].order, occ = occluders[i];
    const exposed = checkRegionsExposed(exposedInit[i], occ, boxes, order, alive);
    const overlayExposed = checkRegionsExposed(overlayInit[i], occ, boxes, order, alive);

    down[i] = exposed ? stateDown[i] : null;
    pictures[i] = (exposed && (!stateDown[i] || openPeek === i)) ? faces[i] : null;

    if (!overlayExposed) {
      roles[i] = null;
    } else if (!activeRules) {
      roles[i] = 'none';
    } else {
      const iceReq = rules.ice[i] || 0;
      let remIce = 0;
      if (iceReq > 0) {
        const iceRow = rules.iceNb[i];
        let gone = 0;
        for (let m = 0; m < iceRow.length; m++) if (!alive[iceRow[m]]) gone++;
        remIce = iceReq > gone ? iceReq - gone : 0;
      }
      if (remIce > 0) {
        roles[i] = remIce > 1 ? 'ice2' : 'ice';
      } else if (keysLeft && rules.locks?.has(i)) {
        roles[i] = 'lock';
      } else if (keysLeft && rules.keys.includes(i)) {
        roles[i] = 'key';
      } else {
        roles[i] = 'none';
      }
    }

    if (Layouts.isFree(i, alive, neighbors)) {
      takeable[i] = legalMask !== null ? legalMask[i] === 1 : false;
    } else {
      takeable[i] = null;
    }
  }

  return {
    pictures,
    roles,
    clock: clock && alive[clock.i] ? { i: clock.i, n: clock.n, remaining: Math.max(0, clock.n - moves) } : null,
    takeable,
    down,
  };
}

module.exports = { visibilityGeometry, tileVisibility, observeBoard, observeBoardFast };
