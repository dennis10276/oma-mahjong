'use strict';
const assert = require('assert/strict');
const { tileVisibility, observeBoard } = require('./human_board_visibility.js');

function referenceVisibility(tiles, state, clock, requested = null) {
  const selected = requested === null ? null : new Set(requested), side = Math.max(0.085, 3 / 20);
  const boxes = tiles.map(tile => {
    const left = tile.x / 2 - tile.z * 0.14, top = tile.y / 2 * 1.24 - tile.z * 0.14;
    return { left, top, right: left + 1 + side, bottom: top + 1.24 + side * 1.2,
      order: tile.z * 10000 + tile.y * 100 + tile.x };
  });
  const visible = tiles.map((tile, index) => {
    if (selected && !selected.has(index)) return null;
    const box = boxes[index];
    const exposed = initial => {
      let regions = state.alive[index] ? initial : [];
      for (const [other, cover] of boxes.entries()) {
        if (!regions.length) break;
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
    const orientation = exposed([
      [box.left + 0.15, box.top + 0.05, box.left + 0.85, box.top + 1.24 + 0.085 * 1.2 - 0.03],
      [box.left + 0.05, box.top + 0.15, box.left + 1 + 0.085 - 0.03, box.top + 1.09] ]);
    const overlay = exposed([[box.left + 0.15, box.top + 0.15, box.left + 0.85, box.top + 1.09]]);
    const picture = orientation && (!state.down[index] || state.openPeek === index);
    return { orientation, picture, role: overlay };
  });
  return { tiles: visible, clock: clock && state.alive[clock.i]
    ? { i: clock.i, n: clock.n, remaining: Math.max(0, clock.n - state.moves) } : null };
}

function test() {
  const layouts = [
    [{ x: 0, y: 0, z: 0 }, { x: -1, y: -1, z: 1 }, { x: 1, y: -1, z: 1 },
      { x: -1, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }, { x: 10, y: 0, z: 0 }],
    Array.from({ length: 6 }, (unused, index) => ({ x: index < 3 ? 0 : 8, y: 0, z: index % 3 })),
    Array.from({ length: 6 }, (unused, index) => ({ x: index % 3, y: Math.floor(index / 3), z: 0 })),
  ];
  let cases = 0;
  for (const tiles of layouts) for (let aliveMask = 0; aliveMask < 64; aliveMask++) {
    for (let downMask = 0; downMask < 64; downMask++) for (let peek = -1; peek < 6; peek++) {
      const state = { alive: tiles.map((unused, index) => +(!!(aliveMask & 1 << index))),
        down: tiles.map((unused, index) => index === 5 && (aliveMask + downMask) % 5 === 0 ? null : +(!!(downMask & 1 << index))),
        openPeek: peek, moves: downMask % 12 };
      const requested = (aliveMask + downMask) % 3 === 0 ? null : (aliveMask + downMask) % 3 === 1 ? [0, 2, 4] : [];
      assert.deepEqual(tileVisibility(tiles, state, { i: 0, n: 9 }, requested), referenceVisibility(tiles, state, { i: 0, n: 9 }, requested));
      cases++;
    }
  }
  const mutable = layouts[0].map(tile => ({ ...tile }));
  const state = { alive: mutable.map(() => 1), down: mutable.map(() => 0), openPeek: -1, moves: 3 };
  for (const displacement of [0, 1e-10, -1e-10, 1e-8, 1, -3]) {
    mutable[1].x = -1 + displacement;
    assert.deepEqual(tileVisibility(mutable, state, null), referenceVisibility(mutable, state, null));
  }
  mutable.push({ x: 0, y: 0, z: 3 }); state.alive.push(1); state.down.push(0);
  assert.deepEqual(tileVisibility(mutable, state, null), referenceVisibility(mutable, state, null));
  mutable[1].z = 4; mutable[1].y = 0.25;
  const expected = referenceVisibility(mutable, state, { i: 0, n: 5 });
  Object.defineProperty(mutable[1], 'picture', { get() { throw Error('Geometry cache read a private picture'); } });
  const observed = observeBoard(mutable, state, { i: 0, n: 5 }, {
    picture(index) { assert(expected.tiles[index].picture); return index; },
    role(index) { assert(expected.tiles[index].role); return 'none'; } });
  assert.deepEqual(observed.pictures, expected.tiles.map((visible, index) => visible.picture ? index : null));
  const changed = tileVisibility(mutable, state, null); changed.tiles[0].picture = true;
  assert.deepEqual(tileVisibility(mutable, state, null), referenceVisibility(mutable, state, null));
  for (const value of [NaN, Infinity, undefined]) {
    const unusual = [{ x: value, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }];
    const partial = { alive: [1, 1], down: [0, 1], openPeek: 1, moves: 0 };
    assert.deepEqual(tileVisibility(unusual, partial, null), referenceVisibility(unusual, partial, null));
  }
  console.log(`PASS ${cases} exhaustive renderer-gate comparisons preserve pictures/roles/orientation/clock under compiled public occluders; mutable geometry, subpixel boundaries, requested subsets, returned-value mutation and private-reader guards remain exact`);
}

if (require.main === module) test();
module.exports = test;
