'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./frame_detours.js'),E=require('./engine.js');
function source(){return {tiles:[[0,0,0],[0,4,0],[0,8,0],[8,0,0],[8,4,0],[8,8,0],[0,12,0],[8,12,0]],faces:[0,0,1,1,2,2,3,3],down:[],gold:[],obst:{ice:{},locks:[],keys:[]},clock:{i:0,n:3},solution:[0,1,2,3,4,5,6,7]};}
test('visible pair detours preserve every original tile and restore the source game with two moves spent',()=>{
 const d=source(),saved=structuredClone(d),r=D.build(d,[{face:3,tiles:[[4,4,0],[4,6,0]]}],2);
 assert.ok(r.design);assert.deepEqual(d,saved);assert.deepEqual(r.design.tiles.slice(0,8),d.tiles);assert.deepEqual(r.design.faces.slice(0,8),d.faces);assert.deepEqual(r.design.obst,d.obst);
 assert.equal(r.proof.minimum,1);assert.equal(r.proof.originalMinimum,1);assert.equal(r.proof.detourMovesPerPair,2);assert.equal(r.proof.sourceNeighboursUnchanged,true);
 assert.equal(E.replay(r.design,r.design.solution,{strict:true}).ok,true);assert.equal(r.design.solution.indexOf(0),0);
 const g=E.game(r.design);let s=E.step(g,E.start(g),8);s=E.step(g,s,9);assert.ok(s);assert.equal(s.moves,2);assert.equal(s.tray.length,0);assert.ok(s.alive.slice(0,8).every(Boolean));
 assert.ok(E.step(g,s,0),'the original one-move clock path now takes the third move');
});
test('detours refuse changing the old geometry, expanding the board or overlapping tiles',()=>{
 const d=source();
 assert.equal(D.build(d,[{face:3,tiles:[[2,0,0],[2,4,0]]}],2).fail,'sourceGeometryChanged');
 assert.equal(D.build(d,[{face:3,tiles:[[20,0,0],[20,2,0]]}],2).fail,'boardFootprintWouldGrow');
 assert.equal(D.build(d,[{face:3,tiles:[[4,4,0],[4,4,0]]}],2).fail,'tileOverlap');
 assert.equal(D.build({...d,obst:{keys:[6,7],locks:[0]}},[{face:3,tiles:[[4,4,0],[4,6,0]]}],2).fail,'invalidPair');
 for(const p of [null,{face:'3',tiles:[[4,4,0],[4,6,0]]},{face:3,tiles:[[4,4,.5],[4,6,0]]},{face:3,tiles:[[4,4,-1],[4,6,0]]}])assert.equal(D.build(d,[p],2).fail,'invalidPair');
});

test('staged pairs prove their order and clearing cost without claiming each lower pair is initially free',()=>{
 const d=source(),r=D.build(d,[{face:3,tiles:[[4,4,1],[4,6,1]]},{face:2,tiles:[[4,4,0],[4,6,0]]}],2);
 assert.ok(r.design,r.fail);assert.equal(r.proof.minimum,1);
 assert.deepEqual(r.proof.addedPairs.map(p=>p.initiallyFree),[true,false]);
 assert.equal(r.proof.detourMovesPerPair,null);assert.equal(r.proof.clearingAllPairsCosts,4);
 const g=E.game({...r.design,clock:{...r.design.clock,n:19}});let s=E.start(g);assert.throws(()=>E.step(g,s,10),/illegal move/);
 for(const i of [8,9,10,11]){s=E.step(g,s,i);assert.ok(s);}
 assert.equal(s.moves,4);assert.equal(s.tray.length,0);assert.ok(s.alive.slice(0,8).every(Boolean));
 assert.equal(E.replay(r.design,r.design.solution,{strict:true}).ok,true);
 assert.equal(D.build(d,[{face:2,tiles:[[4,4,0],[4,6,0]]},{face:3,tiles:[[4,4,1],[4,6,1]]}],2).fail,'pairNotFreeInPlanOrder');
});
