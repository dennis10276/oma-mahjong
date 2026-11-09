'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('./keyed_choice.js'),E=require('./engine.js'),B=require('./builder.js');
const {tileVisibility}=require('../sim/refit/human_board_visibility.js');
const brief={layout:22,stage:'edge',seed:1,frame:{spare:2,keys:[0,40]},targets:{tailPairWidth:2}};
test('explicit key plans change real prerequisites without changing the matching body',()=>{
 const before=JSON.stringify(brief),a=C.build(brief),b=C.build({...brief,frame:{spare:2,keys:[2,41]}});
 assert.ok(a.design,a.fail);assert.ok(b.design,b.fail);
 assert.equal(a.proof.minimum,11);assert.equal(b.proof.minimum,10);
 assert.deepEqual(a.design.tiles,b.design.tiles);assert.deepEqual(a.design.faces,b.design.faces);
 assert.deepEqual(a.design.obst.keys,[0,40]);assert.deepEqual(b.design.obst.keys,[2,41]);
 assert.equal(JSON.stringify(brief),before);assert.ok(E.replay(a.design,a.design.solution,{strict:true}).ok);
 assert.ok(E.replay(b.design,b.design.solution,{strict:true}).ok);
});
test('an authored thaw prerequisite increases the clock minimum and stays visible',()=>{
 const b=C.build({...brief,frame:{...brief.frame,keyIce:{tile:61,h:1}}});assert.ok(b.design,b.fail);
 assert.equal(b.proof.minimum,13);assert.equal(b.proof.keyMinimum,11);assert.equal(b.design.clock.n,15);
 const g=E.game(b.design),v=tileVisibility(g.tiles,{alive:new Uint8Array(g.n).fill(1),down:g.down,openPeek:-1},b.design.clock).tiles;
 assert.ok([g.clock.i,...b.design.obst.keys,...b.design.obst.locks,61].every(i=>v[i].role));
 const limits={nodes:400000,totalNodes:700000,ms:Infinity};
 for(const options of [{},{strict:true}]){const r=E.clockShortest(E.game(b.design,options),limits);assert.ok(r&&!r.unsure);assert.equal(r.k,13);}
 assert.ok(E.replay(b.design,b.design.solution,{strict:true}).ok);
});
test('the explicit cover-lock frame transfers to an arch with a complete strict witness',()=>{
 const b=C.build({layout:0,stage:'edge',seed:1,frame:{spare:2,keys:[7,59],lockTile:0}});assert.ok(b.design,b.fail);
 assert.equal(b.card.shape,'arch');assert.equal(b.proof.minimum,13);assert.deepEqual(b.design.obst.locks,[0]);
 assert.ok(E.replay(b.design,b.design.solution,{strict:true}).ok);
});
test('keyedChoice rejects unsupported plans, implicit targets and budgets rather than substituting',()=>{
 assert.equal(C.build({...brief,target:13}).fail,'unsupportedBrief');
 assert.equal(C.build({...brief,targets:{chokeDelay:3}}).fail,'unsupportedTarget');
 assert.equal(C.build({...brief,shape:'castle'}).fail,'incompatibleShape');
 assert.equal(C.build(brief,{wallMs:0}).fail,'wallClock');assert.equal(C.build(brief,{hardWork:1}).fail,'unsupportedOption');
 assert.equal(C.build({...brief,frame:{spare:2,keys:[0,0]}}).fail,'invalidKeys');
 const bad=C.build({...brief,frame:{spare:2,keys:[0,1]}});assert.equal(bad.fail,'keysNotUniquePair');assert.equal(bad.design,undefined);
});
test('public keyedChoice dispatch is deterministic and spare changes preserve the authored body',()=>{
 const a=B.build({...brief,mode:'keyedChoice'}),b=B.build({...brief,mode:'keyedChoice'});
 assert.ok(a.design,a.fail);assert.deepEqual(a.design,b.design);
 const s=C.build({...brief,frame:{...brief.frame,spare:1}});assert.ok(s.design,s.fail);
 assert.deepEqual(s.design.faces,a.design.faces);assert.deepEqual(s.design.obst,a.design.obst);assert.equal(s.design.clock.n,a.design.clock.n-1);
 assert.ok(a.card.scope.includes('require pipeline checks'));
});
