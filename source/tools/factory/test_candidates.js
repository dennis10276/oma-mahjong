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
  const aimed = require('./candidate_pool.js').aim(row, { levels: [
    { level: 200, target: 10, big: false }, { level: 212, target: 11, big: false },
    { level: 220, target: 11.67, big: true }, { level: 225, target: 13, big: false }
  ] }, 11.2);
  assert.equal(aimed.target, 11); assert.equal(aimed.placementTargetLevel, 212);
  assert.equal(aimed.level, 300, 'Keep the creation group, not the aimed output slot, for queue quotas');
  assert.equal(aimed.origin.creationId, row.origin.creationId); assert.equal(boardKey(aimed.design), boardKey(row.design));
});

test('full family feedback supersedes an opposing quick-scout edit direction', t => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'oma-family-feedback-'));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const L = require('../../www/layouts.js');
  const tiles = [[0, 0, 0], [2, 0, 0], [4, 0, 0], [0, 2, 0], [2, 2, 0], [4, 2, 0], [1, 1, 1], [3, 1, 1]];
  const faces = [0, 1, 2, 0, 1, 2, 3, 3], objects = tiles.map(([x, y, z]) => ({ x, y, z }));
  const solution = L.solve(objects, L.neighbors(objects), faces, new Uint8Array(8).fill(1), [], 10000);
  const design = { tiles, faces, down: [0, 2, 4], obst: { ice: {}, keys: [], locks: [] }, solution, clock: { i: solution[0], n: 3 } };
  const id = boardKey(design).slice(0, 16), row = { id, level: 200, target: 7.5, recipe: ['clockRoute'], design,
    origin: O.originOf(design, 'test/200', 'An original clock route', 7) };
  atomicJson(path.join(dir, id + '.screen.json'), { valid: true, exp: 1 });
  atomicJson(path.join(dir, id + '.rate.json'), { train: { valid: true, exp: 10 }, validation: { valid: true, exp: 10 } });
  const edits = require('./original_variants.js').variants([row], dir).filter(r => r.id !== id);
  assert(edits.some(r => r.edit.startsWith('reveal ')));
  assert(edits.every(r => !r.edit.startsWith('hide ')));
  assert(edits.every(r => r.origin.creationId === row.origin.creationId && JSON.stringify(r.design.tiles) === JSON.stringify(tiles)));
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
  const row = { id, level: 200, shape: pile.shape, n: pile.tiles.length, recipe: ['chainReaction'], design, origin, reviewReasons: ['offCurve'] };
  fs.writeFileSync(path.join(dir, id + '.rate.json'), JSON.stringify({ train: { valid: true, exp: 7 }, validation: { valid: true, exp: 7 } }));
  fs.writeFileSync(path.join(dir, id + '.quality.json'), JSON.stringify({ eligible: true, skilled: { exp: 1 }, room: { ok: true }, atTrap: 1, special: {}, lateShare: 0 }));
  assert.equal(assign(plan, [row], dir).rows, null);
  const partial = assign(plan, [row], dir, 10000, false, true);
  assert.equal(partial.complete, false); assert.deepEqual(partial.rows.map(r => r.level), [200]);
  assert.deepEqual(partial.rows[0].reviewReasons, []); assert.deepEqual(partial.rows[0].authoringReviewReasons, ['offCurve']);
  assert.equal(partial.coverage.filter(c => c.selected).length, 1);
  assert.equal(partial.coverage.find(c => c.level === 201).selected, null);
  const edited = { ...row, edit: 'reveal pictures' };
  assert.equal(assign(plan, [edited], dir, 10000, false, true).rows.length, 0);
  atomicJson(path.join(dir, id + '.fresh.json'), { fresh: { valid: true, seed: 29717, exp: 7.6 } });
  assert.equal(assign(plan, [edited], dir, 10000, false, true).rows.length, 0);
  atomicJson(path.join(dir, id + '.fresh.json'), { fresh: { valid: true, seed: 29717, exp: 7.4 } });
  const checked = assign(plan, [edited], dir, 10000, false, true).rows[0];
  assert.equal(checked.family.fresh, 7.4); assert.equal(checked.family.freshSeed, 29717);
  const twoSlots = { ...plan, levels: plan.levels.slice(0, 2).map(s => ({ ...s, target: 7 })) };
  const shared = portable(row), impossible = assign(twoSlots, [shared], dir);
  assert(impossible.coverage.every(c => c.choices === 1));
  assert.equal(impossible.capacity, 1); assert.equal(impossible.nodes, 0);
});

test('a kept player-approved board is mandatory even in a partial assignment', t => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'oma-kept-board-'));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const base = path.resolve(__dirname, '../../analysis/factory');
  const plan = JSON.parse(fs.readFileSync(path.join(base, 'batch-200-225-plan.json')));
  plan.levelTable = path.resolve(base, plan.levelTable);
  const pile = JSON.parse(fs.readFileSync(path.resolve(base, plan.piles))).find(p => p.level === 200);
  const design = { tiles: pile.tiles, faces: pile.tiles.map((_,i) => i>>1), down: [],
    obst: { ice: {}, keys: [], locks: [] }, clock: { i: 0, n: 2 }, solution: pile.tiles.map((_,i)=>i) };
  const rows = [2,3].map((n,k) => {
    const d = { ...design, faces:design.faces.map(f=>f+k), clock: { i: 0, n } }, id = boardKey(d).slice(0,16);
    atomicJson(path.join(dir,id+'.rate.json'),{train:{valid:true,exp:k?7.3:7},validation:{valid:true,exp:k?7.3:7}});
    atomicJson(path.join(dir,id+'.quality.json'),{eligible:true,skilled:{exp:1},room:{ok:true},atTrap:1,special:{}});
    return { id, level:200, shape:pile.shape, n:pile.tiles.length, recipe:['chainReaction'], design:d,
      origin:O.originOf(d,'kept-test/'+k,'Fresh route',18+k) };
  });
  plan.levels=[{level:200,target:7.3,big:false,keepId:rows[0].id}];
  const selected=assign(plan,rows,dir,1000,false,true);
  assert.equal(selected.rows[0].id,rows[0].id,'Cheaper or newer candidates cannot replace a kept board');
  const unavailable=assign(plan,[rows[1]],dir,1000,false,true);
  assert.equal(unavailable.rows,null); assert.deepEqual(unavailable.preservedFailure,[{level:200,id:rows[0].id}]);
  const P=require('./placement_score.js');
  plan.levels=[{level:200,target:7.3,big:false,keepPattern:P.patternKey(rows[0].design)}];
  assert.equal(assign(plan,rows,dir,1000,false,true).rows[0].id,rows[0].id);
  assert.equal(P.patternKey(rows[0].design),P.patternKey({...rows[0].design,clock:{i:0,n:9}}),'A fair timer repair keeps the same pattern');
  assert(!P.slotAllows({...rows[0],reservedOutputLevel:225},{level:223,big:false}));
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

test('stage records are read once and worker results replace cached missing values', t => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'oma-stage-store-'));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  atomicJson(path.join(dir, 'board.rate.json'), { exp: 7 });
  const store = require('./stage_store.js').createStageStore(dir), read = fs.readFileSync;
  let reads = 0;
  try {
    fs.readFileSync = (...args) => { reads++; return read(...args); };
    assert.equal(store.read('board', 'rate').exp, 7); assert.equal(store.read('board', 'rate').exp, 7);
    assert.equal(reads, 1);
    assert.equal(store.read('board', 'quality'), null);
    store.write('board', 'quality', { eligible: true });
    assert.equal(store.read('board', 'quality').eligible, true); assert.equal(reads, 1);
    store.write('board', 'rate', { exp: 8 }); assert.equal(store.read('board', 'rate').exp, 8);
  } finally { fs.readFileSync = read; }
});

test('unique-pair locked-partner puzzles leave one tray slot for the key pair', () => {
  const I = require('../lab/ideas.js'), L = require('../../www/layouts.js');
  const tiles = [[0, 0, 0], [2, 0, 0], [4, 0, 0], [6, 0, 0], [1, 0, 1], [3, 0, 1], [5, 0, 1], [2, 4, 0], [4, 4, 0], [6, 4, 0]];
  const objects = tiles.map(([x, y, z]) => ({ x, y, z })), faces = [4, 3, 3, 4, 0, 1, 2, 0, 1, 2], nb = L.neighbors(objects);
  const rules = { ice: {}, iceNb: L.iceNeighbors(objects), keys: [1, 2], locks: new Set([7, 8, 9]) };
  assert.equal(L.solve(objects, nb, faces, new Uint8Array(10).fill(1), [], 100000, rules), null);
  const solution = L.solve(objects, nb, faces, new Uint8Array(10).fill(1), [], 100000);
  const base = { tiles, faces, solution, down: [], gold: [], obst: { ice: {}, keys: [], locks: [] }, clock: null };
  I.setExact(true, { nodes: 20000, milliseconds: 1000 });
  const designed = I.IDEAS.lockedPartners.make(base, I.ctxOf(base), I.rngOf(7));
  assert(designed); assert.equal(designed.obst.locks.length, 2); assert(I.valid(designed));
});

test('authoritative cloud measurements supersede matching log imports without deleting the journal', t => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'oma-moves-import-'));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const file = path.join(dir, 'moves.jsonl'), Moves = require('./moves.js');
  const measured = { level: 201, target: 7, n: 76, what: 'one ice softer', before: 8, after: 7, recipe: ['iceChain'] };
  const rows = [measured, { ...measured, source: 'claude-cloud-log' }, { ...measured, after: 6, source: 'claude-cloud-log' }];
  fs.writeFileSync(file, rows.map(r => JSON.stringify(r)).join('\n'));
  assert.equal(Moves.load([file]).length, 2);
  assert.equal(fs.readFileSync(file, 'utf8').split('\n').length, 3);
});

test('new production keeps the harder curve, whole layouts above 70 tiles, and the two-island concept', () => {
  const base = path.resolve(__dirname, '../../analysis/factory'), p = JSON.parse(fs.readFileSync(path.join(base, 'batch-200-225-v10-plan.json')));
  const piles = JSON.parse(fs.readFileSync(path.resolve(base, p.piles)));
  assert.deepEqual(p.curve, [[200, 10], [224, 12], [225, 13]]); assert.equal(p.skilledMin, 2.5);
  assert(piles.every(x => x.tiles.length >= 72));
  assert(p.levels.every(s => piles.find(x => x.level === s.level).base !== 'block'));
  assert.match(piles.find(x => x.level === 212).shape, /two islands/);
  assert.deepEqual(p.levels.find(s => s.level === 212).recipe, ['iceLockClock']);
  const masks = O.previousBoards(p.levels, path.resolve(base, p.levelTable)).map(r => F.spots(r.design.tiles)[0]);
  for (const x of piles) { assert(O.fitsLayouts(x.tiles, masks)); masks.push(F.spots(x.tiles)[0]); }
  const extras = JSON.parse(fs.readFileSync(path.join(base, 'batch-200-225-v10-extra-piles.json')));
  assert.equal(extras.filter(x => x.level >= 300).length, 20);
  const allMasks = O.previousBoards(p.levels, path.resolve(base, p.levelTable)).map(r => F.spots(r.design.tiles)[0]);
  for (const x of extras) {
    assert(x.tiles.length >= 72); assert(O.fitsLayouts(x.tiles, allMasks));
    const objects = x.tiles.map(([x, y, z]) => ({ x, y, z })); assert(!F.towers(objects)); assert(F.tilePx(objects) >= 52);
    allMasks.push(F.spots(x.tiles)[0]);
  }
});

test('block shapes remain fallback choices and do not outrank other qualified shapes', t => {
  const Preferences = require('./shape_preferences.js');
  assert.deepEqual(Preferences.order([{ name: 'block' }, { name: 'vase' }, { name: 'block · two islands' }, { name: 'arch' }]).map(s => s.name),
    ['vase', 'arch', 'block', 'block · two islands']);
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'oma-shape-preference-')); t.after(() => fs.rmSync(dir, { recursive: true }));
  const base = path.resolve(__dirname, '../../analysis/factory'), plan = JSON.parse(fs.readFileSync(path.join(base, 'batch-200-225-plan.json')));
  plan.levelTable = path.resolve(base, plan.levelTable);
  const piles = JSON.parse(fs.readFileSync(path.resolve(base, plan.piles)));
  const rows = [211, 201].map((lv, k) => {
    const p = piles.find(p => p.level === lv), design = { tiles: p.tiles, faces: p.tiles.map((_, i) => i >> 1), down: [],
      obst: { ice: {}, keys: [], locks: [] }, clock: { i: 0, n: 2 }, solution: p.tiles.map((_, i) => i) };
    const id = boardKey(design).slice(0, 16), origin = O.originOf(design, 'preference/' + lv, 'Original puzzle', lv); origin.intendedLevel = 200;
    atomicJson(path.join(dir, id + '.rate.json'), { train: { valid: true, exp: 7 + .3 * k }, validation: { valid: true, exp: 7 + .3 * k } });
    atomicJson(path.join(dir, id + '.quality.json'), { eligible: true, skilled: { exp: 3 }, room: { ok: true }, atTrap: 1, special: {}, lateShare: 0 });
    return { id, level: 200, target: 7, n: p.n, shape: p.shape, recipe: ['chainReaction'], design, origin };
  });
  assert.equal(assign(plan, rows, dir, 10000, false, true).rows[0].shape, 'arch');
  assert.equal(assign(plan, [rows[0]], dir, 10000, false, true).rows[0].shape, 'block');
  const short = { ...rows[1], design: { ...rows[1].design, tiles: rows[1].design.tiles.slice(0, 70) } };
  const { validatePiles } = require('./build.js');
  assert.throws(() => validatePiles([{ level: 200 }], [{ level: 200, shape: 'arch', tiles: short.design.tiles }]), /at least 72/);
});

test('candidate alternatives defer shape spacing to actual campaign slots', () => {
  const { shapeChoices } = require('./original_layouts.js'), L = require('../../www/layouts.js');
  const made = [{ level: 307, base: 'vase' }], spec = { level: 308 };
  assert(shapeChoices({ outputLevels: [{ level: 200 }] }, made, spec, L.rng(1)).some(s => s.shape === 'vase'));
  assert(!shapeChoices({}, made, spec, L.rng(1)).some(s => s.shape === 'vase'));
  const piles = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../analysis/factory/batch-200-225-v10-piles.json')));
  const a = piles.find(p => p.level === 205), b = piles.find(p => p.level === 216);
  assert.throws(() => require('./build.js').validatePiles([{ level: 200, pile: 205 }, { level: 201, pile: 216 }], [a, b],
    { bigLevels: [210, 220] }), /repeat a shape/);
});

test('known tuned boards get full checks even when a noisy scout rejects them', async t => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'oma-known-tuned-')); t.after(() => fs.rmSync(dir, { recursive: true }));
  const planFile = path.join(dir, 'plan.json'), poolFile = path.join(dir, 'pool.json');
  atomicJson(planFile, { levels: [{ level: 200, target: 10, big: false }], tolerance: .5, maxSeedGap: 2 });
  atomicJson(poolFile, [{ id: 'good', level: 300, tuning: { measuredId: 'good', pooledFamily: 10 }, design: { tiles: Array(76).fill([0, 0, 0]) } },
    { id: 'gap', level: 301, tuning: { measuredId: 'gap', pooledFamily: 10 }, design: { tiles: Array(76).fill([0, 0, 0]) } },
    { id: 'sibling', level: 302, tuning: { measuredId: 'parent', pooledFamily: 10 }, edit: 'clock spare 3', design: { tiles: Array(76).fill([0, 0, 0]) } }]);
  atomicJson(path.join(dir, 'good.screen.json'), { exp: 20, eligible: false });
  const calls = [];
  const result = await require('./qualify_tuned.js').run(planFile, poolFile, dir, 1, { async evaluate(file, out, mode, jobs, force) {
    const rows = JSON.parse(fs.readFileSync(file)); calls.push({ mode, ids: rows.map(r => r.id), force });
    assert(rows.every(r => r.forcePlanner));
    if (mode === 'rate') for (const r of rows) atomicJson(path.join(out, r.id + '.rate.json'), {
      train: { valid: true, exp: r.id === 'gap' ? 8 : 10 }, validation: { valid: true, exp: r.id === 'gap' ? 12 : 10 } });
    else for (const r of rows) atomicJson(path.join(out, r.id + '.quality.json'), { eligible: true });
  } });
  assert.deepEqual(result, { rated: 2, quality: 1 });
  assert.deepEqual(calls, [{ mode: 'rate', ids: ['good', 'gap'], force: true }, { mode: 'quality', ids: ['good'], force: true }]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'good.quality.json'))).eligible, true);
});
