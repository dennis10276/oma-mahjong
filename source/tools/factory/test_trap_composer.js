'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const I = require('../lab/ideas.js'), L = global.Layouts;
const C = require('./trap_composer.js'), { boardKey } = require('./meter.js');
const Supports = require('./trap_supports.js');
function small({ thaw = false } = {}) {
  const tiles = [[0,0,0],[4,0,0],[14,0,0],[14,4,0],[0,4,0],[4,4,0],
    [0,8,0],[4,8,0],[1,0,1],[3,0,1],[-1,0,1],[5,0,1]];
  const objects = tiles.map(([x,y,z]) => ({x,y,z})), faces = [0,0,1,1,2,2,3,3,4,4,5,5];
  const obst = thaw ? { ice: {8:2}, locks: [], keys: [] } : { ice: {}, locks: [2], keys: [0,1] };
  const rules = { ...obst, locks: new Set(obst.locks), iceNb: L.iceNeighbors(objects) };
  const solution = L.solve(objects, L.neighbors(objects), faces, new Uint8Array(12).fill(1), [], 100000, rules);
  assert(solution);
  I.setExact(true, { nodes: 100000, milliseconds: 1000 });
  const board = I.fix({ tiles, faces, down: [], gold: [], obst, solution, clock: { i: thaw ? 8 : 2, n: 999 } }, 2);
  assert(board && I.valid(board)); return board;
}

test('combinations retain the previous clock, key pair, locks, ice and role pictures', () => {
  const b = small(); b.obst.ice = {8:1}; b.clockMate = 3;
  for (const [change, reason] of [
    [x => x.clock.i = 4, /clock/], [x => x.clockMate = 5, /partner/],
    [x => x.obst.keys = [4,5], /key pair/], [x => x.obst.locks = [], /lock/],
    [x => x.obst.ice = {}, /ice/], [x => x.faces[0] = 9, /picture/],
  ]) { const x = I.clone(b); change(x); assert.match(C.preserves(b, x), reason); }
  const added = I.clone(b); added.obst.ice[9] = 1; added.obst.locks.push(4);
  assert.equal(C.preserves(b, added), null);
});

test('an ice guard is placed on the actual existing key dig and has a legal exact route', () => {
  const b = small(), before = JSON.stringify(b);
  const result = C.compose(b, ['keyGuardIce'], I.rngOf(71), { milliseconds: 3000 });
  assert(result); assert(I.valid(result.design)); assert.equal(JSON.stringify(b), before);
  assert.deepEqual(result.design.obst.keys, b.obst.keys); assert.equal(result.design.clock.i, b.clock.i);
  const needed = new Set(C.analyze(b).needed);
  assert(Object.keys(result.design.obst.ice).every(i => needed.has(+i)));
  assert(result.plan.analysis.edges.some(e => e.kind === 'unlock'));
  assert(result.plan.analysis.edges.some(e => e.kind === 'thaw'));
  const row = { design: result.design, trapPlan: result.plan };
  assert(C.authored(row));
  const edited = I.clone(row); edited.design.clock.n++;
  assert(!C.authored(edited), 'A steered sibling cannot borrow the initial placement proof');
  assert(!C.authored({ design: result.design }), 'Warm historical rows are not silently stamped as composed');
});

test('a thaw relay extends the existing frozen objective instead of moving the clock', () => {
  const b = small({ thaw: true });
  const result = C.compose(b, ['thawRelay'], I.rngOf(17), { milliseconds: 3000 });
  assert(result); assert(I.valid(result.design)); assert.equal(result.design.clock.i, 8);
  assert.equal(result.design.obst.ice[8], 2); assert(Object.keys(result.design.obst.ice).length > 1);
  assert(result.plan.steps[0].connections.some(e => e.kind === 'thaw'));
});

test('partner ice is attached to a carried single in a real 88-tile clock puzzle', () => {
  const b = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/partner-relay.json')));
  assert(I.valid(b)); I.setExact(true, { nodes: 40000, milliseconds: 1000 });
  const result = C.compose(b, ['partnerRelay'], I.rngOf(103), { milliseconds: 4000 });
  assert(result); assert(I.valid(result.design)); assert.equal(C.preserves(b, result.design), null);
  assert(result.plan.steps[0].connections.some(e => e.kind === 'partner'));
  assert.equal(result.plan.authoredBoard, boardKey(result.design));
});

test('an incompatible overwrite cannot survive as a supposedly combined recipe', () => {
  const b = small(), diagnostic = {};
  const result = C.compose(b, ['lockedClock'], I.rngOf(7), { probes: 1, diagnostic,
    make(x) { return { ...I.clone(x), clock: { i: 4, n: 999 } }; },
    fix() { throw Error('An erased role reached route search'); } });
  assert.equal(result, null); assert.equal(diagnostic.rejected['replaced the existing clock'], 1);
});

test('later recipes cannot silently reveal an earlier memory trap', () => {
  const b = small(), diagnostic = {}; let call = 0;
  const result = C.compose(b, ['blindDig', 'lockedClock'], I.rngOf(3), { probes: 1, beam: 1, diagnostic, milliseconds: 3000,
    make(x) { const y = I.clone(x); y.down = ++call === 1 ? [0] : []; return y; } });
  assert.equal(result, null); assert.equal(diagnostic.rejected['revealed an earlier memory trap'], 1);
});

test('a no-op is not counted as another trap and invalid placement budgets fail early', () => {
  const b = small(), diagnostic = {};
  assert.equal(C.compose(b, ['lockedClock'], I.rngOf(7), { probes: 1, diagnostic, make: I.clone }), null);
  assert.equal(diagnostic.rejected['no new puzzle role'], 1);
  assert.throws(() => C.compose(b, ['lockedClock'], I.rngOf(7), { probes: 0 }), /probes/);
  assert.throws(() => C.compose(b, ['lockedClock'], I.rngOf(7), { milliseconds: 0 }), /budget/);
});

test('a shared search deadline restores outer settings and only reuses proved routes for the same board', () => {
  const b = small(), cache = new Map();
  const fixed = I.withSearchBudget(Date.now() + 2000, () => I.fix(b, 2), cache);
  assert(fixed); assert(cache.size);
  assert.equal(I.withSearchBudget(Date.now() - 1, () => I.fix(b, 3), cache).clock.n, fixed.clock.n + 1);
  const changed = I.clone(b); changed.obst.ice[8] = 2;
  assert.equal(I.withSearchBudget(Date.now() - 1, () => I.fix(changed, 2), cache), null);
  assert.throws(() => I.withSearchBudget(Date.now() - 1, () => { throw Error('interrupted'); }), /interrupted/);
  assert(I.fix(b, 2), 'An interrupted composition must not poison the next build');
});

test('seeded placement explores different locations on the same whole board and repeats reproducibly', () => {
  const b = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/partner-relay.json')));
  b.clock = null; b.obst = { ice: {}, locks: [], keys: [] }; delete b.clockMate;
  const before = JSON.stringify(b); I.setExact(true, { nodes: 40000, milliseconds: 1000 });
  const build = seed => C.compose(b, ['frozenGuards'], I.rngOf(seed), { milliseconds: 5000 });
  const a = build(11), q = build(23), repeat = build(23);
  assert(a && q && repeat); assert(I.valid(a.design) && I.valid(q.design));
  assert.notEqual(a.design.clock.i, q.design.clock.i); assert.notEqual(boardKey(a.design), boardKey(q.design));
  assert.equal(boardKey(q.design), boardKey(repeat.design));
  assert.equal(JSON.stringify(b), before); assert.deepEqual(a.design.tiles, q.design.tiles);
});

function supported() {
  const design = small(); design.obst.ice = {8:1,9:1};
  const fixed = I.fix(design, 2); assert(fixed && I.valid(fixed));
  return { design: fixed, recipe: ['lockedClock','keyGuardIce'], trapPlan: { steps: [
    { recipe: 'lockedClock', placement: 'place new roles', addedSpecials: [2,0,1,8] },
    { recipe: 'keyGuardIce', placement: 'extend existing roles', addedSpecials: [9] },
  ] } };
}

test('component ablation retains the main trap and rejects an idle support before planner work', () => {
  const row = supported(), seen = [];
  const meter = { measure(d, opts) {
    assert.equal(opts.setting, 'family', 'An idle support must not spend skilled-planner time');
    assert(d.obst.ice[8], 'The primary ice stays on');
    seen.push(d.obst.ice[9] || 0);
    return { valid: true, expectedTries: 7, firstTryRate: .2, version: 'test',
      results: [{ attempts: [{ why: 'clock', win: false, left: 5 }] }] };
  } };
  const q = require('./batch_evaluate.js').evaluate(row, 'quality', meter);
  assert.equal(q.eligible, false); assert.equal(q.reason, 'idleSupport'); assert.deepEqual(seen, [1,0]);
  assert.equal(q.supports['keyGuardIce@1'].without, 7);
});

test('support evidence belongs to the exact role manifest and missing edited roles cannot pass', () => {
  const row = supported(), baseline = { valid: true, expectedTries: 8, firstTryRate: .2 };
  const evidence = Supports.measure(row, baseline, { measure: () => ({ valid: true, expectedTries: 6, firstTryRate: .4 }) }, {});
  assert(evidence.supports['keyGuardIce@1'].matters); assert(Supports.compatible(row, evidence));
  assert(!Supports.compatible(row, { eligible: true }), 'Old group-only quality data is insufficient');
  const reassigned = I.clone(row); reassigned.trapPlan.steps[1].addedSpecials = [8];
  assert(!Supports.compatible(reassigned, evidence));
  const edited = I.clone(row); delete edited.design.obst.ice[9];
  const missing = Supports.measure(edited, baseline, { measure() { throw Error('Missing motif must fail without a bot call'); } }, {});
  assert.equal(missing.supports['keyGuardIce@1'].present, false);
  assert.equal(missing.supports['keyGuardIce@1'].matters, false);
  assert(Supports.checks({ recipe: ['keyGuardIce'], design: row.design })[0].indices.length === 0);
});
