'use strict';
const { test } = require('node:test'), assert = require('assert/strict');
const fs = require('fs'), path = require('path');
const F = require('./piles_for.js');
const O = require('./originality.js');
const { portable } = require('./candidate_pool.js');
const { boardKey, atomicJson } = require('./meter.js');
const { assign } = require('./batch_assign.js');

test('extra candidate layouts are whole, readable and distinct from every kept board and each other', () => {
  const base = path.resolve(__dirname, '../../analysis/factory');
  const plan = JSON.parse(fs.readFileSync(path.join(base, 'batch-200-225-plan.json')));
  const piles = JSON.parse(fs.readFileSync(path.join(base, 'batch-200-225-extra-piles.json')));
  const initial = JSON.parse(fs.readFileSync(path.resolve(base, plan.piles)));
  assert.equal(piles.length - initial.length, 20);
  for (const p of initial) assert.equal(O.layoutKey(p), O.layoutKey(piles.find(x => x.level === p.level)));
  const masks = O.previousBoards(plan.levels, path.resolve(base, plan.levelTable)).map(r => F.spots(r.design.tiles)[0]);
  for (const p of piles) {
    const tiles = p.tiles.map(([x, y, z]) => ({ x, y, z }));
    assert.equal(p.generated, 'fresh-catalogue-pile'); assert.equal(p.n % 2, 0);
    assert(!F.towers(tiles)); assert(F.tilePx(tiles) >= 52);
    assert(O.fitsLayouts(p.tiles, masks), 'Original whole layout: ' + p.level);
    masks.push(F.spots(p.tiles)[0]);
  }
});

test('portable candidates preserve their design identity while allowing curve placement', () => {
  const design = { tiles: [[0, 0, 0], [2, 0, 0]], faces: [0, 0], down: [], obst: { ice: {}, keys: [], locks: [] }, clock: { i: 0, n: 2 } };
  const origin = O.originOf(design, 'fresh/300', 'A new clock puzzle', 81); origin.intendedLevel = 300;
  const row = { level: 300, origin, design }, result = portable(row);
  assert.equal(result.origin.creationSlot, 300); assert.equal(result.origin.intendedLevel, undefined);
  assert.equal(result.origin.creationId, origin.creationId); assert.equal(boardKey(result.design), boardKey(design));
  assert.equal(O.checkOrigin(result), null); assert.equal(row.origin.intendedLevel, 300);
  assert.throws(() => portable({ ...row, origin: { ...origin, parentLevel: 210 } }), /fresh original/);
});

test('partial handback selects only qualified levels and leaves missing slots explicit', t => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'oma-partial-assignment-'));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const base = path.resolve(__dirname, '../../analysis/factory');
  const plan = JSON.parse(fs.readFileSync(path.join(base, 'batch-200-225-plan.json')));
  plan.levelTable = path.resolve(base, plan.levelTable);
  const pile = JSON.parse(fs.readFileSync(path.resolve(base, plan.piles))).find(p => p.level === 200);
  const design = { tiles: pile.tiles, faces: pile.tiles.map((_, i) => Math.floor(i / 2)), down: [],
    obst: { ice: {}, keys: [], locks: [] }, clock: { i: 0, n: 2 }, solution: pile.tiles.map((_, i) => i) };
  const id = boardKey(design).slice(0, 16), origin = O.originOf(design, 'test/200', 'An original route', 18);
  origin.intendedLevel = 200;
  const row = { id, level: 200, shape: pile.shape, n: pile.tiles.length, recipe: ['chainReaction'], design, origin };
  fs.writeFileSync(path.join(dir, id + '.rate.json'), JSON.stringify({ train: { valid: true, exp: 7 }, validation: { valid: true, exp: 7 } }));
  fs.writeFileSync(path.join(dir, id + '.quality.json'), JSON.stringify({ eligible: true, skilled: { exp: 1 }, room: { ok: true }, atTrap: 1, special: {}, lateShare: 0 }));
  assert.equal(assign(plan, [row], dir).rows, null);
  const partial = assign(plan, [row], dir, 10000, false, true);
  assert.equal(partial.complete, false); assert.deepEqual(partial.rows.map(r => r.level), [200]);
  assert.equal(partial.coverage.filter(c => c.selected).length, 1);
  assert.equal(partial.coverage.find(c => c.level === 201).selected, null);
});

test('checkpoint replacement retries transient Windows locks and preserves the old file on permanent failure', t => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'oma-checkpoint-retry-'));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const file = path.join(dir, 'checkpoint.json'), rename = fs.renameSync;
  let calls = 0;
  try {
    fs.renameSync = (...args) => { if (++calls <= 2) { const error = Error('sharing violation'); error.code = 'EPERM'; throw error; } return rename(...args); };
    atomicJson(file, { kept: 1 }); assert.equal(calls, 3);
    assert.deepEqual(JSON.parse(fs.readFileSync(file)), { kept: 1 });
    fs.renameSync = () => { const error = Error('permanent failure'); error.code = 'ENOENT'; throw error; };
    assert.throws(() => atomicJson(file, { kept: 2 }), /permanent failure/);
    assert.deepEqual(JSON.parse(fs.readFileSync(file)), { kept: 1 });
  } finally { fs.renameSync = rename; }
});
