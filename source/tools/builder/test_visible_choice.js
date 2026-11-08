'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const B = require('./builder.js');
const VC = require('./visible_choice.js');
const E = require('./engine.js');
const SG = require('./loop/static_gates.js');
const PS = require('../factory/placement_score.js');
const L = require('../../www/layouts.js');

test('visibleChoice is opt-in and does not alter default builder behavior', () => {
  const brief = { story: 'keysFarSide', shape: 'hourglass', seed: 42 };
  const base1 = B.build(brief);
  const base2 = B.build(brief);
  assert.deepEqual(base1.design, base2.design, 'default build is deterministic');
  assert.equal(base1.card.traps?.tempting !== undefined, true);

  const vc = B.build(brief, { mode: 'visibleChoice' });
  assert.ok(vc.design, 'opt-in build succeeds');
  assert.equal(vc.intents.some(i => i.name.includes('consequential visible choice')), true);
});

test('visibleChoice builds deterministically across seeds', () => {
  const brief = { story: 'keysFarSide', shape: 'hourglass', seed: 101, mode: 'visibleChoice' };
  const b1 = B.build(brief);
  const b2 = B.build(brief);
  assert.deepEqual(b1.design, b2.design, 'visibleChoice produces deterministic output');
});

test('visibleChoice guarantees readable intent (A2) and visible specials', () => {
  const brief = { story: 'keysFarSide', shape: 'hourglass', seed: 7, mode: 'visibleChoice' };
  const b = B.build(brief);
  assert.ok(b.design);
  const d = b.design;
  assert.equal(PS.readable(d), true, 'readable by placement_score');
  assert.ok(!d.down.includes(d.clock.i), 'clock is face-up');
  for (const k of d.obst.keys) assert.ok(!d.down.includes(k), 'keys are face-up');
  for (const lock of d.obst.locks) assert.ok(!d.down.includes(lock), 'locks are face-up');
  for (const ice of Object.keys(d.obst.ice).map(Number)) assert.ok(!d.down.includes(ice), 'ice is face-up');
});

test('visibleChoice constructs an early tempting pair with consequence', () => {
  const brief = { story: 'keysFarSide', shape: 'hourglass', seed: 1, mode: 'visibleChoice' };
  const b = B.build(brief);
  assert.ok(b.design);
  const d = b.design;
  assert.ok(b.card.traps && b.card.traps.length > 0, 'has tempting traps');
  const [x, y] = b.card.traps[0];
  assert.equal(d.faces[x], d.faces[y], 'trap tiles have the same face');
  assert.ok(!d.down.includes(x) && !d.down.includes(y), 'trap tiles are face up');

  // Verify that the pair becomes takeable during early play and has proven consequence
  const sg = SG.staticGates(d, { story: brief.story });
  assert.ok(sg.k >= 5, 'valid clock shortest');
  const hasFork = (sg.forks || []).some(f => (f.tempting || []).some(t => t.cost != null || t.result === 'lose'));
  assert.ok(hasFork, 'proven decision trap / priced fork');
});

test('visibleChoice passes static gates A1-A9 on qualified designs', () => {
  const brief = { story: 'keysFarSide', shape: 'hourglass', seed: 1, mode: 'visibleChoice' };
  const b = B.build(brief);
  assert.ok(b.design);
  const sg = SG.staticGates(b.design, { story: brief.story });
  assert.ok(sg.k >= 5, 'valid clock shortest');
  assert.equal(sg.gates.A1.pass, true, 'A1 passes');
  assert.equal(sg.gates.A2.pass, true, 'A2 readability passes');
  assert.equal(sg.gates.A3.pass, true, 'A3 clock witness passes');
  assert.equal(sg.gates.A4.pass, true, 'A4 holds');
  assert.equal(sg.gates.A9.pass, true, 'A9 passes');
});

test('visibleChoice preserves legitimate engine play and peek pairs', () => {
  const brief = { story: 'keysFarSide', shape: 'hourglass', seed: 1, mode: 'visibleChoice' };
  const b = B.build(brief);
  assert.ok(b.design);
  const d = b.design;
  const g = E.game(d);
  assert.ok(g);
  assert.ok(g.clock);
  assert.equal(g.clock.i, d.clock.i);
  const s = E.start(g);
  assert.ok(s);
  assert.equal(s.tray.length, 0);
  const legal = E.legal(g, s);
  assert.ok(Array.isArray(legal) && legal.length > 0);
});

test('visibleChoice prunes idle specials ensuring meaningful obstacles (A1)', () => {
  const brief = { story: 'roomInTrayLocked', shape: 'steps', seed: 1, mode: 'visibleChoice' };
  const b = B.build(brief);
  assert.ok(b.design);
  const sg = SG.staticGates(b.design, { story: brief.story });
  assert.equal(sg.gates.A1.pass, true, 'A1 passes with no idle locks or ice');
});

test('no mutation of frozen designs during gate and engine evaluation', () => {
  const brief = { story: 'keysFarSide', shape: 'hourglass', seed: 1, mode: 'visibleChoice' };
  const b = B.build(brief);
  const d = b.design;
  function deepFreeze(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    Object.freeze(obj);
    for (const key of Object.keys(obj)) deepFreeze(obj[key]);
    return obj;
  }
  deepFreeze(d);
  assert.doesNotThrow(() => {
    SG.staticGates(d, { story: brief.story });
  }, 'evaluating static gates on frozen design does not mutate it');
});
