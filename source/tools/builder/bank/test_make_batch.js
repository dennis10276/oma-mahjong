'use strict';
/* Tests for the assignment rules of bank/make_batch.js, on a synthetic pool (no building, no engine).   node --test source/tools/builder/bank/test_make_batch.js */
const test = require('node:test'), assert = require('node:assert/strict');
const MB = require('./make_batch.js');
const rngOf = seed => { let a = seed >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; };

function pool(n, seed = 5) {
  const r = rngOf(seed), cands = [], BIGL = [13, 21, 27, 29, 47];
  for (let i = 0; i < n; i++) {
    const big = r() < 0.12, layout = big ? BIGL[Math.floor(r() * 5)] : Math.floor(r() * 48), shapeIndex = Math.floor(r() * 14), links = shapeIndex < 4 ? 2 : shapeIndex < 11 ? 3 : 4;
    const score = +(2.8 + r() * 5.4).toFixed(2), tail = +(0.06 + r() * 0.34).toFixed(2), tiles = big ? 96 : 72 + 4 * Math.floor(r() * 5);
    cands.push({ id: 'c' + i, shapeIndex, shape: 'shape' + shapeIndex, links, layout, seed: 1, tiles, score, needle: r() < 0.15, tail, spare: 1, down: 0.2, tier: 'std',
      sig: { layout, trap: 'shape' + shapeIndex, clock: Math.floor(r() * 9) + ',0,low', key: Math.floor(r() * 9) + ',1,low', ice: Math.floor(r() * 9) + ',2,low', cells: ['L' + layout + '-' + Math.floor(r() * 5)] },
      rec: { design: {}, card: { difficulty: { score, needle: false, parts: {}, facts: {} }, firstMoves: { winning: 3, legal: 9 }, pressure: {}, baits: [], faceDownShare: 0.2, see: 's', layoutName: 'x', tiles, spare: 1 } } });
  }
  return { cands, fails: {}, jobs: n };
}

test('assign: every hard rule holds on a synthetic pool and the score ramp rises without dips over 0.5', () => {
  const A = MB.assign({ pool: pool(900), dfsMs: 3000, saMs: 20000, rounds: 3 }), seq = A.seq, filled = seq.filter(Boolean);
  assert.equal(seq.length, 40); assert.ok(filled.length >= 30, 'filled ' + filled.length);
  seq.forEach((c, i) => {
    if (!c) return; const lv = 250 + i;
    assert.equal(c.tiles === 96, [250, 260, 270, 280].includes(lv), 'level ' + lv + ' tiles ' + c.tiles);
    if (!(c.tiles === 96)) assert.ok(c.tiles >= 72 && c.tiles <= 88);
    if (lv >= 256) assert.ok(c.links >= 3, 'links at ' + lv);
    if (lv < 276) assert.ok(!c.needle && c.tail >= 0.15, 'needle/low tail only in the hardest third: ' + lv);
    for (let j = Math.max(0, i - 12); j < i; j++) if (seq[j]) assert.notEqual(seq[j].layout, c.layout, `layout ${c.layout} twice within 12 (${250 + j} and ${lv})`);
    for (let j = Math.max(0, i - 2); j < i; j++) if (seq[j]) assert.notEqual(seq[j].shape, c.shape, `shape twice within 2 (${250 + j} and ${lv})`);
    if (i && seq[i - 1]) assert.ok(c.score >= seq[i - 1].score - 0.5, `dip at ${lv}: ${seq[i - 1].score} -> ${c.score}`);
  });
  const counts = {}; for (const c of filled) counts[c.shape] = (counts[c.shape] || 0) + 1; for (const v of Object.values(counts)) assert.ok(v <= 3, 'a shape at most 3 times');
  const pairs = new Set(); for (const c of filled) { const k = c.layout + '/' + c.shape; assert.ok(!pairs.has(k), 'layout+shape twice'); pairs.add(k); }
  assert.ok(filled[filled.length - 1].score > filled[0].score + 2.5, 'ramp rises: ' + filled[0].score + ' -> ' + filled[filled.length - 1].score);
  assert.ok(new Set(filled.map(c => c.id)).size === filled.length, 'a board is used once');
});
test('assign: a pool with only 2-link boards fills 250-255 and leaves the rest as holes (rule named, nothing relaxed)', () => {
  const p = pool(500, 9); for (const c of p.cands) { c.links = 2; c.needle = false; c.tail = 0.3; }
  const A = MB.assign({ pool: p, dfsMs: 1000, saMs: 6000, rounds: 2 });
  A.seq.forEach((c, i) => { if (250 + i >= 256) assert.equal(c, null, 'hole at ' + (250 + i)); });
  assert.ok(A.seq.slice(0, 6).filter(Boolean).length >= 3);
});
test('assign: a needle board is never placed before level 276', () => {
  const p = pool(500, 3); for (const c of p.cands) { c.needle = true; }
  const A = MB.assign({ pool: p, dfsMs: 1000, saMs: 6000, rounds: 2 }); A.seq.forEach((c, i) => { if (c) assert.ok(250 + i >= 276, 'needle at ' + (250 + i)); });
});
test('jobName is stable', () => { assert.equal(MB.jobName({ si: 12, layout: 41, seed: 2, dial: [5, 3] }), '12-41-2-d5_3.json'); });

// ---- a second batch: any range, earlier placed levels excluded and looked back at, breathers, needle gap, shape max 4
const CFG2 = { first: 303, last: 342, ramp: '7,8.5', breather: 5, 'two-link-to': 0, 'hardest-from': 303, 'needle-gap': 5, 'shape-max': 4 };
test('config: ranges, big levels, breathers and ramp', () => {
  const c = MB.config(CFG2);
  assert.equal(c.NL, 40); assert.deepEqual([303, 310, 320, 330, 340].map(c.isBig), [false, true, true, true, true]);
  assert.deepEqual([...Array(40).keys()].map(i => 303 + i).filter(c.isBreather).slice(0, 4), [306, 311, 316, 321]);
  assert.equal(c.target(303), 7); assert.equal(c.target(342), 8.5); assert.ok(Math.abs(c.target(311) - (7 + 8 * 1.5 / 39 - 1.25)) < 1e-9);
  const d = MB.config({}); assert.equal(d.first, 250); assert.equal(d.last, 289); assert.equal(d.hardestFrom, 276); assert.equal(d.shapeMax, 3); assert.equal(d.breather, 0); assert.deepEqual([250, 260, 270, 280, 255].map(d.isBig), [true, true, true, true, false]);
});
test('assign 303-342: earlier hosts and boards are out, the windows look back into the earlier levels, breather dips and needle gaps hold', () => {
  const p = pool(1500, 11), L = require('./ledger.js');
  for (const c of p.cands) { c.links = Math.max(c.links, 3); c.tail = Math.max(c.tail, 0.1); }
  const hosts = new Set(['3/3', '5/5']); const boards = new Set();
  // earlier levels 300-302: layout 7 / shape7 at 302, layout 9 at 301, layout 11 at 300
  const pre = [[300, 11, 'shape1'], [301, 9, 'shape3'], [302, 7, 'shape7']].map(([level, layout, shape]) => ({ level, layout, shape, score: 7, sig: { layout, trap: shape, clock: '9,9,x', key: '9,9,x', ice: '9,9,x', cells: ['L' + layout + '-0', 'L' + layout + '-1', 'L' + layout + '-2'] } }));
  p.cands.forEach(c => { c.sig.cells = ['L' + c.layout + '-0', 'L' + c.layout + '-1', 'L' + c.layout + '-2']; });
  const A = MB.assign({ pool: p, cfg: CFG2, earlier: { hosts, boards, pre }, dfsMs: 3000, saMs: 15000, rounds: 3 }), seq = A.seq, C = MB.config(CFG2);
  assert.equal(seq.length, 40); assert.ok(seq.filter(Boolean).length >= 20, 'filled ' + seq.filter(Boolean).length);
  const counts = {}, needles = [];
  seq.forEach((c, i) => {
    if (!c) return; const lv = 303 + i;
    assert.ok(!hosts.has(c.layout + '/' + c.shapeIndex), 'earlier host used at ' + lv);
    assert.equal(c.tiles === 96, C.isBig(lv), 'tiles at ' + lv); assert.ok(c.links >= 3, 'links at ' + lv);
    for (const x of pre) { if (lv - x.level <= 12) assert.notEqual(c.layout, x.layout, `layout of earlier level ${x.level} within 12 of ${lv}`); if (lv - x.level <= 2) assert.notEqual(c.shape, x.shape, `shape of earlier level ${x.level} within 2 of ${lv}`); }
    for (let j = Math.max(0, i - 12); j < i; j++) if (seq[j]) assert.notEqual(seq[j].layout, c.layout, `layout twice within 12 (${303 + j} and ${lv})`);
    if (i && seq[i - 1]) assert.ok(c.score >= seq[i - 1].score - (C.isBreather(lv) ? 1.75 : 0.5) - 1e-9, `dip at ${lv}: ${seq[i - 1].score} -> ${c.score}`);
    counts[c.shape] = (counts[c.shape] || 0) + 1; if (c.needle) needles.push(lv);
  });
  for (const v of Object.values(counts)) assert.ok(v <= 4, 'a shape at most 4 times');
  for (let i = 1; i < needles.length; i++) assert.ok(needles[i] - needles[i - 1] >= 5, 'needles at least 5 apart: ' + needles);
});
test('jobName: a targets variant and a repair job get their own marker names', () => {
  assert.equal(MB.jobName({ si: 12, layout: 41, seed: 2, dial: [8, 4], repair: true }), '12-41-2-d8_4-rp.json');
  assert.equal(MB.jobName({ si: 12, layout: 41, seed: 2, dial: [8, 4], v: 'A', repair: true }), '12-41-2-d8_4-vA-rp.json');
});

// ---- the last-twin repair (trap_stories.js repairTwins, job.repair): shape 12 on layout 36 (seed 1) ends the separation with ONE visible close twin; the repair swaps a role-free picture, takes a new proven route
test('runJob with repair: a board that ends with one visible close twin comes out with none, replays strictly, keeps its clock minimum and story proof', { timeout: 900000 }, () => {
  const E = require('../engine.js'), SEP = require('./separate.js'), T = require('../trap_stories.js');
  const out = MB.runJob({ si: 12, layout: 36, seed: 1, dial: [5, 3], repair: true, tiers: ['hard'] });
  assert.ok(out.repair && out.repair.before >= 1, 'this host needs the repair: ' + JSON.stringify(out.repair) + ' ' + out.why);
  assert.ok(out.ok, 'the repair clears the last visible twin: ' + out.why); assert.equal(out.repair.after, 0); assert.ok(out.repair.swaps >= 1);
  const v = out.variants.find(x => x.ok); assert.ok(v, 'a tail tier came out'); const d = v.design;
  assert.equal(SEP.closeTwins(d).visible, 0); assert.ok(E.replay(d, d.solution, { strict: true }).ok);
  assert.equal(E.clockShortest(E.game(JSON.parse(JSON.stringify(d))), { nodes: 300000, ms: Infinity, finishNodes: 100000, finishMs: Infinity }).k, v.card.clock.k);
  assert.equal(d.clock.n, v.card.clock.k + v.card.clock.spare); assert.ok(v.card.trap && v.card.baits.length >= 1, 'the proven baits are still in the card');
});
