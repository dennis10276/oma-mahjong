'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { tileVisibility, observeBoard } = require('./human_board_visibility.js');

function test() {
  const renderer = fs.readFileSync(path.resolve(__dirname, '../../../www/js/board.js'), 'utf8');
  const css = fs.readFileSync(path.resolve(__dirname, '../../../www/style.css'), 'utf8');
  assert.match(renderer, /const ratio = 1\.24, dF = 0\.14/);
  assert.match(renderer, /const depthF = 0\.085/);
  assert.match(renderer, /Math\.max\(3, tw \* depthF\)/);
  assert.match(css, /\.tile \.face \{ position: absolute; inset: 5% 6%/);
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: -1, y: -1, z: 1 }, { x: 1, y: -1, z: 1 },
    { x: -1, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }, { x: 10, y: 0, z: 0 }];
  const state = { alive: tiles.map(() => 1), down: tiles.map(() => 0), openPeek: -1, moves: 2 };
  const observed = observeBoard(tiles, state, { i: 0, n: 8 }, {
    picture(index) { assert.notEqual(index, 0, 'Union-covered pictures cannot be read'); return 7; },
    role(index) { assert.notEqual(index, 0, 'Union-covered roles cannot be read'); return 'none'; },
  });
  assert.equal(observed.pictures[0], null); assert.equal(observed.roles[0], null); assert.equal(observed.down[0], null);
  assert.deepEqual(observed.clock, { i: 0, n: 8, remaining: 6 });
  const near = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }];
  const borderOnly = tileVisibility(near, { ...state, alive: [1, 1], down: [0, 0] }, null).tiles[0];
  assert(borderOnly.picture, 'Dennis explicitly recognizes a face-up picture from an exposed physical border');
  assert(!borderOnly.role, 'Recognizing a border is not permission to read a covered obstacle overlay');
  assert(!tileVisibility(near, { ...state, alive: [1, 1], down: [1, 0] }, null).tiles[0].picture);
  const separated = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 3 }];
  assert(tileVisibility(separated, { ...state, alive: [1, 1], down: [0, 0] }, null).tiles[0].picture);
  assert(!tileVisibility(separated, { ...state, alive: [1, 1], down: [1, 0] }, null).tiles[0].picture);
  assert(tileVisibility(separated, { ...state, alive: [1, 1], down: [1, 0] }, null).tiles[0].orientation);
  console.log('PASS renderer-anchored geometry permits declared border-based picture recognition without revealing covered obstacle overlays; closed/fully covered pictures remain unread and clock badges stay public');
}

if (require.main === module) test();
module.exports = test;
