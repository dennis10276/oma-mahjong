'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { encodeGame } = require('./personal_game_io.js');
const { drawSeed } = require('./human_redeal_draws.js');
const { sourceFingerprint, makeManifest } = require('./human_redeal_benchmark.js');
const { selectBoard } = require('./human_redeal_winnable.js');
const { verifySource, mergePrefix } = require('./human_redeal_draw_pool.js');

function test() {
  const source = sourceFingerprint();
  assert.equal(verifySource({ sourceHash: source.hash, sourceFiles: source.files }), source.hash);
  assert.throws(() => verifySource({ sourceHash: 'changed', sourceFiles: source.files }));
  const tiles = [0, 4, 8, 12].map(horizontal => ({ x: horizontal, y: 0, z: 0 }));
  const game = encodeGame({ tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2],
    down: [0, 0, 0, 0], rules: null, clock: null });
  const manifest = makeManifest({ observedAt: 'test', rows: [{ name: 'Dennisisdebeste', lv: 17,
    wonOn: 1, boardSource: 'currentFixedDefinition', game }] });
  const entry = manifest.entries[0], records = [];
  const serial = selectBoard(entry, 'development', { emit: row => records.push(row) });
  const before = JSON.stringify(records);
  const pending = mergePrefix(entry, 'development', records.slice(0, 3).concat(records.slice(8)));
  assert(!pending.complete); assert.equal(pending.nextDraw, 4); assert.equal(pending.wins, 3);
  const mixed = records.slice(8).concat(records.slice(3, 8), records.slice(0, 3), records.slice(2, 5));
  const merged = mergePrefix(entry, 'development', mixed);
  assert(merged.complete); assert.deepEqual(merged.board, serial); assert.equal(merged.excludedAhead, 0);
  assert.equal(JSON.stringify(records), before);
  const extras = [11, 12].map(draw => ({ ...records[0], draw, seed: drawSeed(17, 'development', draw) }));
  const ahead = mergePrefix(entry, 'development', extras.concat(mixed));
  assert(ahead.complete); assert.deepEqual(ahead.board, serial); assert.equal(ahead.excludedAhead, 2);
  const wrong = { ...records[2], nodes: records[2].nodes + 1 };
  assert.throws(() => mergePrefix(entry, 'development', records.concat(wrong)), /Duplicate draw outcomes differ/);
  assert.throws(() => mergePrefix(entry, 'development', [{ ...records[0], seed: records[0].seed + 1 }]));
  assert(!mergePrefix(entry, 'development', records.slice(1)).complete);
  const rejected = [{ level: 17, split: 'development', draw: 1, seed: drawSeed(17, 'development', 1), status: 'lost', nodes: 1 },
    { level: 17, split: 'development', draw: 2, seed: drawSeed(17, 'development', 2), status: 'node_cap', nodes: 200000 }];
  const afterRejects = records.map((row, offset) => ({ ...row, draw: offset + 3, seed: drawSeed(17, 'development', offset + 3) }));
  const selected = mergePrefix(entry, 'development', afterRejects.concat(rejected));
  assert(selected.complete); assert.equal(selected.board.draws, 12);
  assert.equal(selected.board.lost, 1); assert.equal(selected.board.capped, 1);
  console.log('PASS frozen source guards, out-of-order draw ranges, exact prefix-hole refusal, duplicate agreement, immutable first-ten selection and explicit speculative-draw exclusion');
}

if (require.main === module) test();
module.exports = test;
