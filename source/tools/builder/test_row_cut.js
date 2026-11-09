'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),E=require('./engine.js'),R=require('./row_cut.js');
function fixture(){return {tiles:R.PATTERN.map(t=>t.slice()).concat([[-10,-10,0]]),faces:[0,1,2,1,3,0,4,3,2,4],down:[],obst:{},clock:null,solution:[]};}
function key(g,s){return Array.from(s.alive).join('')+'/'+s.tray.map(i=>g.faces[i]).sort((a,b)=>a-b).join(',');}
test('closed face projection agrees with unpruned physics on reachable alternative matchings',t=>{
 let checked=0,certified=0,seed=731;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let variant=0;variant<60;variant++){
  const d=fixture();if(variant)for(let i=9;i>0;i--){const j=rand()%(i+1);[d.faces[i],d.faces[j]]=[d.faces[j],d.faces[i]];}
  const g=E.game(d),plain=E.game(d,{reserveCuts:false});assert.ok(g.rowCuts.length);
  const stack=[E.start(g)],seen=new Set();while(stack.length){const s=stack.pop(),k=key(g,s);if(seen.has(k))continue;seen.add(k);checked++;
   if(R.dead(g.rowCuts,s.alive,s.tray.map(i=>g.faces[i]))){const r=E.winnable(plain,s,{nodes:200000,ms:Infinity});assert.equal(r.result,'lose');certified++;}
   for(const a of E.legal(g,s)){const n=E.step(g,s,a);if(n)stack.push(n);}
  }
  assert.equal(E.winnable(g,E.start(g),{nodes:200000,ms:Infinity}).result,E.winnable(plain,E.start(plain),{nodes:200000,ms:Infinity}).result);
 }
 assert.ok(checked>1000&&certified>0);t.diagnostic(`${checked} states, ${certified} independently verified dead projections`);
});
test('unrelated pairs and outside blockers cannot repair a dead closed projection',()=>{
 const d=fixture();d.tiles.push([6,2,3],[20,20,0],[24,20,0],[28,20,0]);d.faces.push(5,5,6,6);
 const g=E.game(d),plain=E.game(d,{reserveCuts:false});let s=E.step(g,E.start(g),9);s=E.step(g,s,5);
 assert.equal(R.dead(g.rowCuts,s.alive,s.tray.map(i=>g.faces[i])),true);
 assert.equal(E.winnable(plain,s,{nodes:200000,ms:Infinity}).result,'lose');
 assert.equal(E.winnable(g,s,{nodes:10,ms:Infinity}).result,'lose');
});
test('live four-copy escapes and hidden local faces disable the projection; control swap restores the bad route',()=>{
 const d=fixture();assert.equal(E.game({...d,down:[0]}).rowCuts.length,0);
 const dup={...d,tiles:d.tiles.concat([[20,20,0],[24,20,0]]),faces:d.faces.concat([0,0])},dg=E.game(dup);
 let ds=E.step(dg,E.start(dg),9);const escaped=E.step(dg,ds,5);
 assert.equal(R.dead(dg.rowCuts,escaped.alive,escaped.tray.map(i=>dg.faces[i])),false);
 assert.equal(E.winnable(dg,escaped,{nodes:200000,ms:Infinity}).result,'win');
 ds=E.step(dg,ds,10);ds=E.step(dg,ds,11);ds=E.step(dg,ds,5);
 assert.equal(R.dead(dg.rowCuts,ds.alive,ds.tray.map(i=>dg.faces[i])),true);
 assert.equal(E.winnable(E.game(dup,{reserveCuts:false}),ds,{nodes:200000,ms:Infinity}).result,'lose');
 const g=E.game(d,{rowCuts:false});assert.equal(g.rowCuts.length,0);
 const control=fixture();[control.faces[3],control.faces[8]]=[control.faces[8],control.faces[3]];
 const cg=E.game(control);let s=E.step(cg,E.start(cg),9);s=E.step(cg,s,5);
 assert.equal(R.dead(cg.rowCuts,s.alive,s.tray.map(i=>cg.faces[i])),false);assert.equal(E.winnable(cg,s,{nodes:200000,ms:Infinity}).result,'win');
});

test('conditional four-copy cuts agree with unpruned physics at every reachable state',t=>{
 let states=0,dead=0;
 for(let face=0;face<5;face++){
  const f=fixture(),d={...f,tiles:f.tiles.concat([[20,20,0],[24,20,0]]),faces:f.faces.concat([face,face])},g=E.game(d),plain=E.game(d,{reserveCuts:false}),stack=[E.start(g)],seen=new Set();
  while(stack.length){const s=stack.pop(),k=key(g,s);if(seen.has(k))continue;seen.add(k);states++;
   if(R.dead(g.rowCuts,s.alive,s.tray.map(i=>g.faces[i]))){assert.equal(E.winnable(plain,s,{nodes:200000,ms:Infinity}).result,'lose');dead++;}
   for(const a of E.legal(g,s)){const next=E.step(g,s,a);if(next)stack.push(next);}
  }
 }
 assert.ok(states>1000&&dead>0);t.diagnostic(`${states} four-copy states; ${dead} independently verified dead projections`);
});

test('projection pruning preserves exact clock minima and witnesses under strict and peek rules',()=>{
 for(const strict of [false,true])for(const down of [[],[0]])for(const tile of [0,5,9]){
  const d={...fixture(),down,clock:{i:tile,n:99}},limits={nodes:200000,totalNodes:700000,ms:Infinity,finishNodes:200000,finishMs:Infinity};
  const a=E.clockShortest(E.game(d,{strict}),limits),b=E.clockShortest(E.game(d,{strict,reserveCuts:false}),limits);
  assert.ok(a&&b&&!a.unsure&&!b.unsure);assert.equal(a.k,b.k);
  assert.equal(E.replay({...d,clock:{i:tile,n:a.k}},E.flatten(a.path),{strict}).ok,true);
 }
});
