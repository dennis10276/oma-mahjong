'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const I=require('./preserve_intent'),E=require('./engine'),F=require('./footprint'),fixtures=require('./fixtures/footprint60-intent.json');
const clone=x=>JSON.parse(JSON.stringify(x));
test('256: old bait horizons are re-measured against the released deadline',()=>{
  const {before,after}=fixtures.legacy256,proof=I.verify(before,after);
  assert.ok(proof.ok,JSON.stringify(proof));
  assert.ok(proof.prices.some(q=>q.before.result==='win'),'the old extra-budget measurement is retained honestly');
  assert.ok(proof.baitAtDeadline.length);
  for(const q of proof.baitAtDeadline){assert.equal(q.before,'lose');assert.equal(q.after,'lose');}
  for(const q of proof.prices){assert.equal(q.before.exact,true);assert.deepEqual(q.before,q.after);}
});
test('a winning stored route and large tiles do not certify a changed gate dependency',()=>{
  const {before,after}=fixtures.shortcut262;
  assert.ok(F.measure(after.design).ok);
  assert.ok(E.replay(after.design,after.design.solution).ok);
  const proof=I.verify(before,after);
  assert.equal(proof.ok,false);assert.ok(proof.errors.some(e=>e.startsWith('roleCausality:')));
});
test('251: reassembled vertical paths preserve each gate and its causal clock effect',()=>{
  const {before,after}=fixtures.restack251,proof=I.verify(before,after);
  assert.ok(proof.ok,JSON.stringify(proof));assert.equal(proof.clockMinimum,14);assert.equal(proof.spare,2);
  assert.ok(F.measure(after.design).tilePx>63);
  for(const effect of proof.effects)assert.equal(effect.beforeK,effect.afterK);
});
test('298: the mechanism and all three baits survive filler repacking and a lower canopy',()=>{
  const {before,after}=fixtures.repacked298,proof=I.verify(before,after);
  assert.ok(proof.ok,JSON.stringify(proof));assert.ok(F.measure(after.design,{minimum:58}).ok);
  assert.ok(F.measure(after.design).tilePx>59.8);assert.equal(proof.prices.length,3);
  for(const q of proof.prices){assert.deepEqual(q.before,q.after);assert.equal(q.after.result,'lose');}
});
test('changed immutable data and exhausted search budgets never certify',()=>{
  const {before,after}=fixtures.legacy256;
  for(const mutate of [d=>d.clock.n++,d=>d.faces[0]++,d=>d.solution.reverse(),d=>d.obst.ice[0]=1]){
    const changed=clone(after);mutate(changed.design);assert.equal(I.verify(before,changed).ok,false);
  }
  assert.equal(I.verify(before,after,{nodes:0,ms:0,callMs:0}).ok,false);
  const overlap=clone(after);overlap.design.tiles[0]=overlap.design.tiles[1].slice();
  assert.ok(I.verify(before,overlap).errors.some(e=>e.startsWith('overlap:')));
});
test('physical prerequisite cache follows geometry edited in place',()=>{
  const r={design:{tiles:[[0,0,0],[0,0,1],[4,0,0],[6,0,0]],faces:[0,1,1,0],down:[],gold:[],obst:{ice:{},keys:[],locks:[]},clock:{i:0,n:4},solution:[1,2,0,3]}};
  assert.ok(I.causal(r).necessary.includes(1));I.prepare(r);
  r.design.tiles[1]=[8,0,0];
  assert.equal(I.causal(r).necessary.includes(1),false);
  assert.equal(I.prepare(r).causal.necessary.includes(1),false);
});
