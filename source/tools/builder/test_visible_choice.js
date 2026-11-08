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

test('choice proofs reject free, unrelated, unfair and unresolved temptations', () => {
  const authored=[[2,3]], row=t=>({forks:[{step:1,moves:1,winning:[0],tempting:[{move:[2,3],...t}]}]});
  assert.equal(VC.choiceProofs(row({cost:0,result:'win'}),authored).length,0);
  assert.equal(VC.choiceProofs(row({cost:null,result:'unknown'}),authored).length,0);
  assert.equal(VC.choiceProofs(row({cost:null,result:'lose',fair:false}),authored).length,0);
  assert.equal(VC.choiceProofs(row({move:[4,5],cost:2,result:'win'}),authored).length,0);
  assert.equal(VC.choiceProofs(row({cost:2,result:'win'}),authored).length,1);
  assert.equal(VC.choiceProofs(row({cost:null,result:'lose',fair:true}),authored).length,1);
  const noAlternative=row({cost:2,result:'win'});noAlternative.forks[0].winning=[];
  assert.equal(VC.choiceProofs(noAlternative,authored).length,0);
});

test('tail information is measured on the witness and is not a proven pacing guarantee', () => {
  const d={tiles:Array.from({length:8},(_,i)=>[i*4,0,0]),faces:[0,0,1,1,2,2,3,3],down:[],obst:{},clock:{i:0,n:3},solution:[0,1,2,3,4,5,6,7]};
  const r=VC.witnessTail(d);assert.equal(r.valid,true);assert.equal(r.maxTray,1);
  assert.equal(VC.witnessTail({...d,solution:[0]}).valid,false);
  assert.equal(B.build({story:'keysFarSide',shape:'hourglass',seed:1,mode:'visibleChoice'}).intents.some(i=>i.name.includes('calm tail')),false);
});

test('visibleChoice reports unsupported budgets honestly and its deadline fails instead of picking another board', () => {
  const brief={story:'keysFarSide',shape:'hourglass',seed:1,mode:'visibleChoice'};
  assert.equal(B.build(brief,{wallMs:0}).fail,'wallClock');
  assert.equal(B.build(brief,{hardWork:1}).fail,'unsupportedOption');
  assert.equal(B.build(brief,{keep:{}}).fail,'unsupportedOption');
  const b=B.build(brief);assert.equal(b.work,null);assert(b.card.choiceProofs.length>0);
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
  assert.equal(B.build({...brief,targets:{keysShown:0}}).fail,'incompatibleBrief');
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

test('visibleChoice passes the required E5 static gates on its proved designs', () => {
  const brief = { story: 'keysFarSide', shape: 'hourglass', seed: 1, mode: 'visibleChoice' };
  const b = B.build(brief);
  assert.ok(b.design);
  const sg = SG.staticGates(b.design, { story: brief.story });
  assert.ok(sg.k >= 5, 'valid clock shortest');
  assert.equal(sg.gates.A1.pass, true, 'A1 passes');
  assert.equal(sg.gates.A2.pass, true, 'A2 readability passes');
  assert.equal(sg.gates.A3.pass, true, 'A3 clock witness passes');
  assert.equal(sg.gates.A4.pass, true, 'A4 holds');
  assert.equal(sg.gates.A6.pass, true, 'A6 holds');
  assert.equal(sg.gates.A9.pass, true, 'A9 passes');
});

test('visibleChoice has legal opening actions and a complete valid engine replay', () => {
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
  assert.equal(E.replay(d,d.solution).ok,true);
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
