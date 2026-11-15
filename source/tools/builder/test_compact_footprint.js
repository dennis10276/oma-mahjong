'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('./compact_footprint'),P=require('./preserve_trap'),F=require('./footprint');
const clone=x=>JSON.parse(JSON.stringify(x));
for(const lv of [266,281,300])test('compact '+lv+': real trap, unchanged intended chain, at least 60 px',()=>{
  const {before,expectedPx}=require('./fixtures/footprint60-'+lv+'.json'),snapshot=JSON.stringify(before);
  const r=C.compact(before,{seeds:4,wallMs:10000});
  assert.ok(r.design,JSON.stringify(r));assert.ok(r.footprint.changed);
  assert.ok(F.measure(r.design).tilePx>=60);assert.ok(F.measure(r.design).rows<=8);
  assert.ok(Math.abs(r.footprint.tilePx-expectedPx)<.01);
  assert.equal(r.design.tiles.length,before.design.tiles.length);
  assert.ok(P.verify(before,r).ok);assert.equal(JSON.stringify(before),snapshot,'source is immutable');
  assert.ok(r.preservation.checks.includes('sameDeclaredChainStructure'));
  assert.ok(r.preservation.prices.length>0);
  for(const p of r.preservation.prices){assert.equal(p.before.exact,true);assert.equal(p.after.exact,true);assert.equal(p.before.result,p.after.result);assert.equal(p.before.cost,p.after.cost);}
});
test('preservation refuses a changed clock, face, thaw relation, route, or unproven search',()=>{
  const {before}=require('./fixtures/footprint60-266.json'),good=C.compact(before,{seeds:4});
  for(const mutate of [r=>r.design.clock.n++,r=>r.design.faces[0]++,r=>r.design.solution.reverse(),r=>{const i=+Object.keys(r.design.obst.ice)[0];r.design.tiles[i][0]+=20;}]){
    const bad=clone(good);mutate(bad);assert.equal(P.verify(before,bad).ok,false);
  }
  assert.equal(P.verify(before,good,{nodes:0,ms:0,callMs:0}).ok,false);
});
test('the live chain builder repairs its output instead of rejecting its small-tile host',()=>{
  const M=require('./trap_mixes');
  const r=M.build('waitThawWay',{layout:11,seed:11,frame:{spare:1},targets:{trayRoom:0,maxDown:.2,hiddenOnWay:0,tailPairWidth:2}},
    {tries:150,wallMs:20000,footprint:{wallMs:5000,seeds:4}});
  assert.ok(r.design,JSON.stringify(r));assert.ok(r.footprint.beforePx<60);assert.ok(r.footprint.tilePx>=60);assert.ok(r.preservation.ok);
});
