'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),E=require('./engine.js'),R=require('./row_cut.js'),Hard=require('../../www/hard.js');
const {finish}=require('../lab/finish.js'),{exactRoute}=require('../lab/exact.js');
function fixture(clock=null){return {tiles:[[-20,-20,0],[-16,-20,0],...R.PATTERN.map(t=>t.slice()),[-10,-10,0]],faces:[1,1,0,1,2,1,3,0,4,3,2,4],down:[],obst:{},clock,solution:[11,7,1,3,10,4,5,2,6,9,8,0]};}
function prefix(g){return [11,7,1].reduce((s,i)=>E.step(g,s,i),E.start(g));}
function key(g,s){return Array.from(s.alive).join('')+'/'+s.tray.map(i=>g.faces[i]).sort((a,b)=>a-b).join(',');}
function brute(g){const memo=new Map();return function solve(s){const k=key(g,s);if(memo.has(k))return memo.get(k);if(E.won(g,s))return true;for(const a of E.legal(g,s)){const next=E.step(g,s,a);if(next&&solve(next)){memo.set(k,true);return true;}}memo.set(k,false);return false;};}
test('which matching copy is taken can decide the puzzle, including a free matching clock',()=>{
 for(const clock of [null,{i:0,n:12}])for(const options of [{},{reserveCuts:false},{strict:true}]){
  const d=fixture(clock),g=E.game(d,options),s=prefix(g);
  assert.equal(Hard.validSolution(g,d.solution),true);assert.equal(E.replay(d,d.solution,{strict:true}).ok,true);
  assert.equal(E.winnable(g,s,{nodes:200000,ms:Infinity}).result,'win');
  const choices=E.classify(g,s,{nodes:200000,ms:Infinity});assert.equal(choices.find(x=>x.move===0).result,'lose');assert.equal(choices.find(x=>x.move===3).result,'win');
  const solved=E.winnable(g,s,{nodes:200000,ms:Infinity});assert.equal(E.replay(d,[11,7,1,...E.flatten(solved.path)],{strict:options.strict}).ok,true);
 }
 const d=fixture(),g=E.game(d),s=prefix(g),r=finish(g.tiles,g.nb,g.faces,s.alive,s.tray,200000);
 assert.equal(r.result,'win');assert.equal(E.replay(d,[11,7,1,...r.path],{strict:true}).ok,true);
 assert.equal(finish(g.tiles,g.nb,g.faces,s.alive,s.tray,0).result,'unknown');
});
test('four-copy proofs agree with complete physical enumeration at every reachable tiny state',t=>{
 let checked=0;
 for(const down of [[],[0],[3],[0,3]])for(const options of [{},{strict:true},{reserveCuts:false}]){
  const d={...fixture(),down},g=E.game(d,options),reference=brute(g),stack=[E.start(g)],seen=new Set();
  while(stack.length){const s=stack.pop(),k=key(g,s);if(seen.has(k))continue;seen.add(k);checked++;
   assert.equal(E.winnable(g,s,{nodes:200000,ms:Infinity}).result,reference(s)?'win':'lose',k);
   for(const a of E.legal(g,s)){const next=E.step(g,s,a);if(next)stack.push(next);}
  }
 }
 assert.ok(checked>1000);t.diagnostic(`${checked} four-copy states checked against complete physical enumeration`);
});
test('the offline strict finishing solver agrees with exhaustive enumeration and certifies clock minima',()=>{
 const d=fixture(),g=E.game(d,{strict:true,reserveCuts:false}),reference=brute(g),stack=[E.start(g)],seen=new Set();
 while(stack.length){const s=stack.pop(),k=key(g,s);if(seen.has(k))continue;seen.add(k);const r=finish(g.tiles,g.nb,g.faces,s.alive,s.tray,200000);assert.equal(r.result,reference(s)?'win':'lose');
  for(const a of E.legal(g,s)){const next=E.step(g,s,a);if(next)stack.push(next);}
 }
 for(const tile of [0,1,2,3,10,11]){
  const x=fixture({i:tile,n:99}),gx=E.game(x,{strict:true}),a=E.clockShortest(gx,{nodes:200000,totalNodes:1000000,ms:Infinity}),b=exactRoute(gx,tile,200000,Infinity);
  assert.ok(a&&b&&!a.unsure);assert.equal(a.k,b.k);assert.equal(E.replay(x,b.path,{strict:true}).ok,true);
 }
});
