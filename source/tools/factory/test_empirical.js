'use strict';const {test}=require('node:test'),assert=require('assert/strict');
test('an explicit empirical recipe cannot be replaced by a legacy fallback brief',()=>{
 const {explicitBrief}=require('./empirical_construct.js'),spec={level:210,target:10.83,recipe:['deepKeys','frozenGuards'],alternatives:[{recipe:['dontGrab']}]},brief=explicitBrief(spec);
 assert.deepEqual(brief.recipe,['deepKeys','frozenGuards']);assert(!Object.hasOwn(brief,'alternatives'));assert.equal(spec.alternatives.length,1);
});
test('journal steering protects accepted creations and never changes the spare or adds a trap',()=>{
 const M=require('./meter.js'),P=require('./pieces.js'),E=require('./empirical_moves.js'),d={tiles:[[0,0,0],[4,0,0],[8,0,0],[12,0,0]],faces:[0,0,1,1],down:[2],obst:{ice:{},locks:[],keys:[]},clock:{i:1,n:3},solution:[0,1,2,3]},row={id:M.boardKey(d).slice(0,16),origin:{creationId:'test'},recipe:['clockRoute'],shape:'vase',design:d,trapPlan:{components:[]}};
 const score={family:13,skilled:4},slot={level:214,target:11.17,productionAim:11.17,productionBand:[10.8,12.17]};
 assert.deepEqual(E.propose(row,score,slot,{protectedCreations:new Set(['test'])}),[]);
 const moves=E.propose(row,score,slot,{allowClock:false});assert(moves.length);for(const move of moves){assert.equal(P.spareOf(move.design),P.spareOf(d));assert.deepEqual(move.design.tiles,d.tiles);assert(!move.empiricalChange.what.includes('spare'));assert(Object.keys(move.design.obst.ice).every(i=>d.obst.ice[i]));assert.deepEqual(move.design.obst.locks,d.obst.locks);}
});
