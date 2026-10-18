'use strict';
const assert = require('assert/strict');

function encodeGame(game) {
  const encoded = { tiles: game.tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z })),
    nb: Object.fromEntries(['above', 'left', 'right'].map(name => [name, game.nb[name].map(row => Array.from(row))])),
    faces: Array.from(game.faces), down: Array.from(game.down),
    rules: game.rules ? { ice: { ...game.rules.ice }, iceNb: game.rules.iceNb.map(row => Array.from(row)),
      locks: game.rules.locks ? Array.from(game.rules.locks) : null, keys: Array.from(game.rules.keys || []) } : null,
    clock: game.clock ? { i: game.clock.i, n: game.clock.n } : null };
  decodeGame(encoded);
  return encoded;
}

function decodeGame(encoded) {
  const size = encoded.tiles?.length;
  assert(Number.isInteger(size) && size > 0);
  assert(encoded.tiles.every(tile => ['x', 'y', 'z'].every(name => Number.isFinite(tile[name]))));
  assert(Array.isArray(encoded.faces) && encoded.faces.length === size && encoded.faces.every(face => Number.isInteger(face) && face >= 0 && face <= 101));
  assert(Array.isArray(encoded.down) && encoded.down.length === size && encoded.down.every(value => value === 0 || value === 1),
    'Face-down flags must be explicitly encoded, never recovered from a silently truncated typed array');
  const validRows = rows => Array.isArray(rows) && rows.length === size && rows.every(row => Array.isArray(row)
    && row.every(index => Number.isInteger(index) && index >= 0 && index < size));
  assert(['above', 'left', 'right'].every(name => validRows(encoded.nb?.[name])));
  if (encoded.rules) {
    assert(validRows(encoded.rules.iceNb));
    assert(encoded.rules.locks === null || Array.isArray(encoded.rules.locks), 'Lock sets must be explicitly encoded');
    assert(Array.isArray(encoded.rules.keys));
    assert([...(encoded.rules.locks || []), ...encoded.rules.keys].every(index => Number.isInteger(index) && index >= 0 && index < size));
    assert(Object.entries(encoded.rules.ice || {}).every(([index, count]) => Number.isInteger(+index) && +index >= 0 && +index < size
      && Number.isInteger(count) && count >= 0));
  }
  if (encoded.clock) assert(Number.isInteger(encoded.clock.i) && encoded.clock.i >= 0 && encoded.clock.i < size
    && Number.isInteger(encoded.clock.n) && encoded.clock.n > 0);
  return { tiles: encoded.tiles.map(tile => ({ ...tile })),
    nb: Object.fromEntries(['above', 'left', 'right'].map(name => [name, encoded.nb[name].map(row => row.slice())])),
    faces: encoded.faces.slice(), down: Uint8Array.from(encoded.down),
    rules: encoded.rules ? { ice: { ...encoded.rules.ice }, iceNb: encoded.rules.iceNb.map(row => row.slice()),
      locks: encoded.rules.locks ? new Set(encoded.rules.locks) : null, keys: encoded.rules.keys.slice() } : null,
    clock: encoded.clock ? { ...encoded.clock } : null };
}

module.exports = { encodeGame, decodeGame };
