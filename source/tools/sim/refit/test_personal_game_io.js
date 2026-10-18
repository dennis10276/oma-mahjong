'use strict';
const assert = require('assert/strict'), L = require('../../../www/layouts.js'), Hard = require('../../../www/hard.js');
const { encodeGame, decodeGame } = require('./personal_game_io.js');
const { boardId } = require('./personal_model.js');
const tiles = Array.from({ length: 6 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
const game = { tiles, nb: L.neighbors(tiles), faces: [0, 0, 1, 1, 2, 2], down: Uint8Array.from([1, 0, 1, 0, 0, 0]),
  rules: { ice: { 4: 1 }, iceNb: L.iceNeighbors(tiles), locks: new Set([5]), keys: [0, 1] }, clock: { i: 4, n: 10 } };
const encoded = encodeGame(game), roundTrip = decodeGame(JSON.parse(JSON.stringify(encoded)));
assert.equal(boardId(roundTrip), boardId(game));
assert.deepEqual(roundTrip.rules.locks, new Set([5]));
assert.deepEqual(Array.from(roundTrip.down), Array.from(game.down));
assert.deepEqual(Hard.play(roundTrip, Hard.persona('strong'), 123), Hard.play(game, Hard.persona('strong'), 123));
assert.throws(() => decodeGame({ ...encoded, down: { ...encoded.down } }));
assert.throws(() => decodeGame({ ...encoded, rules: { ...encoded.rules, locks: {} } }));
assert.throws(() => decodeGame({ ...encoded, faces: [NaN, ...encoded.faces.slice(1)] }));
assert.deepEqual(encoded.rules.locks, [5]);
console.log('PASS board transport retains locks, keys, ice, down flags and exact simulation while rejecting lossy JSON shapes');
