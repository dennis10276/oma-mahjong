'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),B=require('./row_choice.js'),E=require('./engine.js');
const {tileVisibility}=require('../sim/refit/human_board_visibility.js');
test('one authored row choice transfers to nine layouts with an exact paired easy control',()=>{
 for(const layout of [8,19,22,25,28,34,40,41,44]){
  const a=B.build({layout}),b=B.build({layout,targets:{control:true}});assert.ok(a.design,a.fail);assert.ok(b.design,b.fail);
  assert.deepEqual(a.design.tiles,b.design.tiles);assert.deepEqual(a.card.choice.prefix,b.card.choice.prefix);
  assert.equal(a.card.choice.before,'win');assert.equal(a.card.choice.after,'lose');assert.equal(b.card.choice.after,'win');
  assert.equal(a.design.faces.filter((f,i)=>f!==b.design.faces[i]).length,2);
  assert.equal(E.replay(a.design,a.design.solution,{strict:true}).ok,true);assert.equal(a.design.solution[0],a.design.clock.i);
  const g=E.game(a.design);let s=E.start(g);for(const i of a.card.choice.prefix)s=E.step(g,s,i);
  assert.equal(s.tray.length,1);assert.deepEqual(Array.from(s.alive),a.card.choice.alive);
  const v=tileVisibility(g.tiles,{alive:s.alive,down:g.down,openPeek:-1},null).tiles;assert.ok(a.card.choice.tiles.every(i=>v[i].picture));
  const lost=E.step(g,s,a.card.choice.bad);assert.equal(E.winnable(g,lost,{nodes:10,ms:Infinity}).result,'lose');
 }
});
test('interleaving and picture echoes preserve the reserve checkpoint, counts and deterministic construction',()=>{
 const brief={layout:22,targets:{outsideWidth:2,echoPairs:2},seed:3},a=B.build(brief);assert.ok(a.design,a.fail);
 assert.deepEqual(a.design,B.build(brief).design);assert.deepEqual(a.design.down,[]);
 const counts=a.design.faces.reduce((m,f)=>(m[f]=(m[f]||0)+1,m),{});assert.ok(Object.values(counts).every(n=>n===2||n===4));assert.ok(Object.keys(counts).length<=36);
 assert.equal(counts[a.design.faces[a.card.choice.tiles[1]]],4);assert.equal(counts[a.design.faces[a.card.choice.tiles[2]]],4);
 assert.equal(a.card.choice.tray.length,1);assert.equal(E.replay(a.design,a.design.solution,{strict:true}).ok,true);
 const api=require('./builder.js').build({...brief,mode:'rowChoice'});assert.deepEqual(api.design,a.design);
});
test('unsupported widths, absent motifs and unproved construction fail explicitly',()=>{
 assert.equal(B.build({layout:22,targets:{outsideWidth:3}}).fail,'invalidPlan');
 assert.equal(B.build({layout:22,targets:{trapDepth:7}}).fail,'unsupportedTarget');
 assert.equal(B.build({layout:0}).fail,'motifNotFound');assert.equal(B.build({layout:-1}).fail,'invalidLayout');
 assert.equal(B.build({layout:22},{keep:{}}).fail,'unsupportedOption');assert.equal(B.build({layout:22},{wallMs:0}).fail,'wallClock');
 assert.equal(B.build({layout:22},{nodes:0}).fail,'choiceUnproven');
});
