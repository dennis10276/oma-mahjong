'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('./engine.js'),R=require('./reserve_cuts.js');
function fixture(){
 // Four heads, their cyclic lower partners, then the loose bait and its
 // partner below a lower petal. Hand-authored, independent of the builder.
 return {tiles:[[-4,-4,3],[-2,-4,3],[-2,-2,3],[-4,-2,3],[-1,-3,2],[-3,-1,2],[-5,-3,2],[-3,-5,2],[-1,7,1],[-3,-6,1]],faces:[0,1,2,3,0,1,2,3,4,4],down:[],obst:{},clock:null,solution:[]};
}
function permutations(a){if(!a.length)return [[]];return a.flatMap((x,i)=>permutations(a.filter((_,j)=>i!==j)).map(t=>[x,...t]));}
test('reserve certificate agrees with the unpruned solver on every reachable tiny state and alternate matching',t=>{
 let checked=0,deadChecked=0;
 for(const perm of permutations([0,1,2,3]))for(const down of [[],[0],[4],[8],[9]]){
  const d={...fixture(),faces:[0,1,2,3,...perm,4,4],down},g=E.game(d),plain=E.game(d,{reserveCuts:false});
  assert.notEqual(g,plain);
  const stack=[E.start(g)],seen=new Set();
  while(stack.length){const s=stack.pop(),key=Array.from(s.alive).join('')+'/'+s.tray.map(i=>g.faces[i]).sort((a,b)=>a-b).join(',');if(seen.has(key))continue;seen.add(key);checked++;
   if(R.dead(g.reserveCuts,s.alive,s.tray.map(i=>g.faces[i]))){
    assert.equal(E.winnable(plain,s,{nodes:200000,ms:Infinity}).result,'lose');deadChecked++;
   }
   for(const a of E.legal(g,s)){const n=E.step(g,s,a);if(n)stack.push(n);}
  }
  const p=E.winnable(plain,E.start(plain),{nodes:200000,ms:Infinity});assert.notEqual(p.result,'unknown');
  assert.equal(E.winnable(g,E.start(g),{nodes:200000,ms:Infinity}).result,p.result);
 }
 t.diagnostic(`${checked} reachable states checked; ${deadChecked} certified dead states independently proved`);
 assert.ok(checked>1000);assert.ok(deadChecked>0);
});
test('a duplicate outside partner disables the closed-pair proof; a petal removed disables its premise',()=>{
 const d=fixture(),g=E.game(d),bad=E.step(g,E.start(g),8);
 assert.ok(g.reserveCuts.length);assert.equal(R.dead(g.reserveCuts,bad.alive,bad.tray.map(i=>g.faces[i])),true);
 const dup={...d,tiles:d.tiles.concat([[20,20,0],[24,20,0]]),faces:d.faces.concat([0,0])},dg=E.game(dup);
 assert.equal(dg.reserveCuts.length,0);
 const changed=bad.alive.slice();changed[4]=0;assert.equal(R.dead(g.reserveCuts,changed,bad.tray.map(i=>g.faces[i])),false);
});
test('clock lower bound and pruning preserve exact minima, including peek and strict games',()=>{
 for(const down of [[],[0],[4],[8],[9]])for(const strict of [false,true]){
  const f=fixture(),d={...f,tiles:f.tiles.concat([[-1,7,0],[20,20,0]]),faces:f.faces.concat([5,5]),down,clock:{i:10,n:99}};
  const g=E.game(d,{strict}),plain=E.game(d,{strict,reserveCuts:false}),budget={nodes:200000,ms:Infinity,finishNodes:200000,finishMs:Infinity,totalNodes:1000000};
  const a=E.clockShortest(g,budget),b=E.clockShortest(plain,budget);
  assert.ok(a&&b&&!a.unsure&&!b.unsure);assert.equal(a.k,b.k);
  const replay={...d,clock:{i:10,n:a.k}};assert.equal(E.replay(replay,E.flatten(a.path),{strict}).ok,true);
  assert.equal(E.clockShortest(g,{...budget,totalNodes:0}),null,'a different total budget has a separate cache entry');
 }
});

test('the reserve clock bound is admissible at every reachable finishable tiny clock state',t=>{
 let checked=0,positive=0;
 for(const down of [[],[0],[4],[8],[9]])for(const strict of [false,true]){
  const f=fixture(),d={...f,tiles:f.tiles.concat([[-1,7,0],[20,20,0]]),faces:f.faces.concat([5,5]),down,clock:{i:10,n:99}};
  const g=E.game(d,{strict}),plain=E.game(d,{strict,reserveCuts:false}),memo=new Map();
  // Exhaustive physical moves and the independent unpruned finishing proof;
  // no reserve pruning, lower bound, stored witness or best-first ordering.
  function exact(s){
   const key=Array.from(s.alive).join('')+'/'+s.tray.map(i=>plain.faces[i]).sort((a,b)=>a-b).join(',');
   if(memo.has(key))return memo.get(key);
   let best=Infinity;
   if(s.clockTaken){const r=E.winnable(plain,s,{nodes:200000,ms:Infinity});assert.notEqual(r.result,'unknown');best=r.result==='win'?0:Infinity;}
   else for(const a of E.legal(plain,s)){const next=E.step(plain,s,a);if(next){const rest=exact(next);if(Number.isFinite(rest))best=Math.min(best,next.clockTaken?1:next.moves-s.moves+rest);}}
   memo.set(key,best);
   if(!s.clockTaken&&Number.isFinite(best)){const lb=R.clockBound(g.reserveClock,s.alive);assert.ok(lb<=best,`${lb} exceeds exact remaining ${best}`);checked++;if(lb>0)positive++;}
   return best;
  }
  exact(E.start(plain));
 }
 assert.ok(checked>100);assert.ok(positive>0);t.diagnostic(`${checked} finishable clock states checked; ${positive} positive reserve bounds`);
});
