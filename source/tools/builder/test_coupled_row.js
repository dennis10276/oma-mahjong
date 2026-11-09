'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('./coupled_row.js'),Rows=require('./row_choice.js'),E=require('./engine.js'),Hard=require('../../www/hard.js');
test('a safe setup leads to a visible choice between winning and losing identical matching copies',()=>{
 for(const layout of [22,25,34,40,41,44]){const r=C.build({layout,targets:{pairChoice:0}});assert.ok(r.design,r.fail);const {design:d,proof:p}=r,g=E.game(d);let s=E.start(g);for(const i of p.prefix)s=E.step(g,s,i);s=E.step(g,s,p.setup);s=E.step(g,s,p.anchor);
  assert.equal(g.faces[p.correctMate],g.faces[p.wrongMate]);assert.equal(s.tray.length,3);assert.equal(p.allMatchingChoicesVisible,true);assert.equal(Hard.validSolution(g,d.solution),true);
  const cls=E.classify(g,s,{nodes:200000,ms:Infinity});assert.equal(cls.find(x=>x.move===p.correctMate).result,'win');assert.equal(cls.find(x=>x.move===p.wrongMate).result,'lose');assert.equal(E.winnable(g,s,{nodes:200000,ms:Infinity}).result,'win');
 }
});
test('coupling preserves the source geometry, changes only declared future pictures and keeps legal counts',()=>{
 const base=Rows.build({layout:22}),saved=structuredClone(base.design),r=C.couple(base.design,base.card.choice);assert.ok(r.design,r.fail);assert.deepEqual(base.design,saved);
 for(const field of ['tiles','down','gold','obst','clock'])assert.deepEqual(r.design[field],base.design[field]);
 const changed=base.design.faces.flatMap((f,i)=>f!==r.design.faces[i]?[i]:[]);assert.deepEqual(changed,r.proof.changed);assert.ok(changed.every(i=>!base.card.choice.prefix.includes(i)));assert.equal(r.proof.rewiredTiles.length,4);
 const counts=r.design.faces.reduce((m,f)=>(m[f]=(m[f]||0)+1,m),{});assert.ok(Object.values(counts).every(n=>n===2||n===4));assert.equal(counts[r.proof.picture],4);
 const api=require('./builder.js').build({mode:'coupledRowChoice',layout:22});assert.deepEqual(api.design,r.design);
});
test('unavailable or incompatible coupling plans fail without selecting another pair',()=>{
 assert.equal(C.build({layout:8}).fail,'couplingNotFound');assert.equal(C.build({layout:22,targets:{pairChoice:999}}).fail,'couplingNotFound');
 assert.equal(C.build({layout:22,targets:{echoPairs:1}}).fail,'incompatibleCouplingPlan');assert.equal(C.build({layout:22,story:'other'}).fail,'incompatibleStory');
 assert.equal(C.build({layout:22},{wallMs:0}).fail,'wallClock');assert.equal(C.build({layout:22},{nodes:0}).fail,'choiceUnproven');
});
