'use strict';
// node --test source/tools/builder/loop/test_counterfactual.js
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const CF = require('./counterfactual.js'), T = require('./traces.js');

const ROWS = fs.readFileSync(path.join(__dirname, '../../../analysis/builder/data/qualified-200-225.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const ROW = ROWS[1]; // 70bde28d4c0922c5: 76 tiles, ice, locks and keys, clock

// A fake yardstick with the real one's surface (rate, planner, pins, fingerprints). D comes from a function of the design.
function fakeYs({ family, reference = family, planner, se = 0.5, valid = true } = {}) {
  const calls = [];
  return { calls, fingerprint: 'fam', referenceFingerprint: 'ref', pins: { planner: { spare: 2 }, acceptance: { startCampaigns: 160 } },
    rate(d, o) { calls.push({ kind: 'rate', bot: o.bot || 'family', block: o.block, campaigns: o.campaigns, startBlock: o.startBlock, clockN: d.clock?.n ?? null, d });
      return { D: (o.bot === 'reference' ? reference : family)(d), se, n: o.campaigns ?? 80, valid, fingerprint: o.bot === 'reference' ? 'ref' : 'fam' }; },
    planner(d, o = {}) { calls.push({ kind: 'planner', spare: o.spare ?? null, down: (d.down || []).length, clockN: d.clock?.n ?? null });
      return { S: planner(d), styles: null, valid, fingerprint: 'ref' }; } };
}

test('C1: |reference - key memory| within max(2, 25%) on the CURVE block at the shipped spare', () => {
  const ys = fakeYs({ family: () => 6, reference: () => 9 });
  const r = CF.c1(ROW, { spare: 1, ys });
  assert.equal(r.keyMemory, 6); assert.equal(r.reference, 9); assert.equal(r.tolerance, 2); assert.equal(r.pass, false);
  const k = T.atSpare(ROW, 1).minimum;
  assert.deepEqual(ys.calls.map(c => [c.bot, c.block, c.clockN]), [['family', 'CURVE', k + 1], ['reference', 'CURVE', k + 1]]);
  assert.equal(CF.c1(ROW, { spare: 1, ys: fakeYs({ family: () => 12, reference: () => 14.5 }) }).pass, true, 'tolerance 25% of 12 = 3');
  assert.equal(CF.c1(ROW, { spare: 1, ys: fakeYs({ family: () => 12, reference: () => 15.5 }) }).pass, false);
  assert.equal(CF.c1(ROW, { spare: 1, ys: fakeYs({ family: () => 6, reference: () => 6, valid: false }) }).pass, null, 'an invalid rating decides nothing');
  assert.equal(CF.c1(ROW, { spare: -1, ys }).fail, 'invalidSpare');
});

test('C2/C3: face-up is down = [] on the spare-2 design with clock.n kept; skilled credit and the 50% report', () => {
  const ys = fakeYs({ family: () => 0, planner: d => d.down.length ? 4 : 7 });
  const { C2, C3 } = CF.c2c3(ROW, { ys, engineCheck: false });
  assert.equal(C2.asIs, 4); assert.equal(C2.faceUp, 7); assert.equal(C2.pass, false); assert.equal(C2.skilledCredit, false); assert.equal(C2.plannerSpare, 2);
  assert.equal(C3.value, 1.75); assert.equal(C3.pass, true); assert.equal(C3.report, true);
  const k = T.atSpare(ROW, 2).minimum;
  assert.deepEqual(ys.calls.map(c => [c.down, c.clockN, c.spare]), [[ROW.design.down.length, k + 2, null], [0, k + 2, null]]);
  const hidden = CF.c2c3(ROW, { ys: fakeYs({ family: () => 0, planner: d => d.down.length ? 8 : 3 }), engineCheck: false });
  assert.equal(hidden.C2.pass, true); assert.equal(hidden.C3.value, 0.375); assert.equal(hidden.C3.pass, false, 'mostly hidden information');
  assert.equal(CF.c2c3(ROW, { ys: fakeYs({ family: () => 0, planner: () => 5 }), engineCheck: false, plannerSpare: 3 }).C2.clockN, T.atSpare(ROW, 3).design.clock.n);
});

test('C4: each special (factory kinds: ice, locks with keys, clock) must lower D by max(1, 2 SE) on the ACCEPT blocks', () => {
  const v = CF.specialVariants(T.atSpare(ROW, 1).design);
  assert.deepEqual(v.map(x => x.special), ['ice', 'locks', 'clock']);
  assert.deepEqual(v[0].design.obst.ice, {}); assert.deepEqual(v[1].design.obst.locks, []); assert.deepEqual(v[1].design.obst.keys, []); assert.equal(v[2].design.clock, null);
  assert.equal(v[0].design.clock.n, T.atSpare(ROW, 1).design.clock.n, 'clock.n unchanged when a special is removed');
  assert.deepEqual(ROW.design.obst.locks.length > 0 && ROW.design.obst.ice['60'], 1, 'the input design is not mutated');
  const Dof = d => !d.clock ? 3 : !d.obst.locks.length ? 12 : !Object.keys(d.obst.ice).length ? 9.4 : 10;
  const ys = fakeYs({ family: Dof, se: 0.5 });
  const r = CF.c4(ROW, { spare: 1, ys });
  const by = Object.fromEntries(r.specials.map(s => [s.special, s]));
  assert.equal(r.D, 10); assert.equal(by.clock.pass, true); assert.equal(by.clock.drop, 7);
  assert.equal(by.ice.pass, false, 'drop 0.6 < max(1, 2 x 0.71)'); assert.equal(by.ice.need, 1.41);
  assert.equal(by.locks.pass, false); assert.equal(by.locks.raisesD, true, 'removing the locks makes it harder: they show the way');
  assert.equal(r.pass, false);
  assert.ok(ys.calls.every(c => c.block === 'ACCEPT' && c.campaigns === 160 && c.startBlock === 0));
  const reuse = fakeYs({ family: Dof }), r2 = CF.c4(ROW, { spare: 1, ys: reuse, accepted: { D: 10, se: 0.3, n: 160 } });
  assert.equal(reuse.calls.length, 3, 'the value of record is reused, only the 3 variants are rated'); assert.equal(r2.specials.find(s => s.special === 'ice').need, 1.17);
  const tiles = CF.specialVariants(T.atSpare(ROW, 1).design, 'tile').map(x => x.special);
  assert.deepEqual(tiles, ['ice 60', 'ice 61', ...ROW.design.obst.locks.map(i => 'lock ' + i), 'clock']);
});

test('counterfactuals() runs C1-C3 by default, C4 on request, and reports the ruler', () => {
  const ys = fakeYs({ family: () => 6, reference: () => 7, planner: () => 4 });
  const r = CF.counterfactuals(ROW, { spare: 1, ys, engineCheck: false });
  assert.equal(r.C1.pass, true); assert.equal(r.C2.pass, true); assert.equal(r.C3.pass, true); assert.equal(r.C4, undefined);
  assert.deepEqual(r.ruler, { family: 'fam', reference: 'ref' });
  const r4 = CF.counterfactuals(ROW, { spare: 1, ys, engineCheck: false, c4: true, skip: ['C2'] });
  assert.ok(r4.C4 && r4.C2 === undefined && r4.C1);
});

test('the default yardstick uses the pinned fast key-memory ruler (or stands in for a slow pin with zero drift)', () => {
  const ys = CF.rulerYardstick({ cacheDir: false });
  assert.equal(ys.fingerprint, '63be677ee17677754b17e9c835e8a0f757d1d5ec62738950bf2a2f5e4357413a');
  assert.equal(ys.referenceFingerprint, '4cf0b4c7057c2242f27fe529bb1885e4ad06cdf94588b79411cc06c522509e39');
});

test('real smoke run: C1 with 4 campaigns per bot on one qualified board (no cache)', () => {
  const t = Date.now(), ys = CF.rulerYardstick({ cacheDir: false });
  const r = CF.c1(ROW, { spare: ROW.clockSpare, ys, block: 'SCREEN', runs: 4 });
  assert.equal(r.n, 4); assert.ok(Number.isFinite(r.keyMemory) && Number.isFinite(r.reference)); assert.ok(typeof r.pass === 'boolean' || r.pass === null);
  assert.equal(r.fingerprints.keyMemory, ys.fingerprint);
  assert.ok(Date.now() - t < 30000);
});
