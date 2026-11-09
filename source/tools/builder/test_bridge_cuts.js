'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),N=require('./reserve_note.js'),E=require('./engine.js'),B=require('./bridge_cuts.js');
const {tileVisibility}=require('../sim/refit/human_board_visibility.js');
function key(g,s){return Array.from(s.alive).join('')+'/'+s.tray.map(i=>g.faces[i]).sort((a,b)=>a-b).join(',');}
function brute(g){const memo=new Map();return function rec(s){const k=key(g,s);if(memo.has(k))return memo.get(k);if(E.won(g,s))return true;for(const a of E.legal(g,s)){const n=E.step(g,s,a);if(n&&rec(n)){memo.set(k,true);return true;}}memo.set(k,false);return false;};}
function core(q){const b=N.build({targets:{bridges:q}});assert.ok(b.design,b.fail);const n=10+6*q;return {...b.design,tiles:b.design.tiles.slice(0,n),faces:b.design.faces.slice(0,n),clock:null,solution:b.design.solution.filter(i=>i<n)};}
test('bridge certificates agree with complete enumeration on reachable reserve cores and reordered tile indices',t=>{
 let checked=0,certified=0;
 for(const q of [1,2])for(const reverse of [false,true]){
  let d=core(q);if(reverse){const n=d.tiles.length;d={...d,tiles:d.tiles.slice().reverse(),faces:d.faces.slice().reverse(),solution:d.solution.map(i=>n-1-i)};}
  const g=E.game(d),plain=E.game(d,{reserveCuts:false}),reference=brute(plain),stack=[E.start(g)],seen=new Set();assert.ok(g.bridgeCuts.length);
  while(stack.length){const s=stack.pop(),k=key(g,s);if(seen.has(k))continue;seen.add(k);checked++;const truth=reference(s);
   if(B.dead(g.bridgeCuts,s.alive)){assert.equal(truth,false);certified++;}assert.equal(E.winnable(g,s,{nodes:200000,ms:Infinity}).result,truth?'win':'lose');
   for(const a of E.legal(g,s)){const next=E.step(g,s,a);if(next)stack.push(next);}
  }
 }
 assert.ok(checked>100&&certified>0);t.diagnostic(`${checked} bridge-core states, ${certified} independently verified certificates`);
});
test('orphan matching escapes and missing spacer dependencies disable reserve certificates',()=>{
 const d=core(1),g=E.game(d),cut=g.bridgeCuts[0],face=g.faces[cut.orphans[0][0]],extra={...d,tiles:d.tiles.concat([[-20,-20,0],[-16,-20,0]]),faces:d.faces.concat([face,face])};assert.equal(E.game(extra).bridgeCuts.length,0);
 const changed=structuredClone(d);changed.tiles[cut.spacer[0]]=[-20,-20,0];assert.equal(E.game(changed).bridgeCuts.length,0);
 const hidden={...d,down:[cut.spacer[0]]};assert.equal(E.game(hidden).bridgeCuts.length,0);
});
test('the note has a minimum nine-move clock, legal counts, visible spine and tiles at least 52 pixels',()=>{
 for(const [bridges,relief] of [[1,'none'],[2,'none'],[2,'open'],[2,'covered'],[2,'covered2']]){const brief={targets:{bridges,relief}},b=N.build(brief);assert.ok(b.design,b.fail);const d=b.design;assert.equal(d.tiles.length,72);assert.ok(b.card.px>=52);assert.equal(E.replay(d,d.solution,{strict:true}).ok,true);assert.equal(d.solution.indexOf(d.clock.i)+1,9);
  const limits={nodes:200000,totalNodes:700000,ms:Infinity,finishNodes:200000,finishMs:Infinity},a=E.clockShortest(E.game(d),limits),s=E.clockShortest(E.game(d,{strict:true}),limits);assert.ok(a&&s&&!a.unsure&&!s.unsure);assert.equal(a.k,9);assert.equal(s.k,9);
  const counts=d.faces.reduce((m,f)=>(m[f]=(m[f]||0)+1,m),{});assert.ok(Object.values(counts).every(n=>n===2||n===4));assert.ok(Object.keys(counts).length<=36);
  const g=E.game(d),vis=tileVisibility(g.tiles,{alive:new Uint8Array(72).fill(1),down:g.down,openPeek:-1},d.clock).tiles;
  const critical=Array.from({length:10+4*bridges},(_,i)=>i).concat(b.card.heads.flat(),b.card.reliefPairs.flatMap(p=>[p.cover,p.mate]),[b.card.reliefTile].filter(Number.isInteger));
  assert.ok(critical.every(i=>vis[i].picture));assert.deepEqual(d,N.build(brief).design);
  assert.deepEqual(d,require('./builder.js').build({...brief,mode:'reserveNote'}).design);
 }
 assert.equal(N.build({targets:{bridges:1,relief:'covered'}}).fail,'invalidPlan');
 assert.equal(N.build({targets:{bridges:2,relief:'unknown'}}).fail,'invalidPlan');
 assert.equal(N.build({targets:{bridges:3}}).fail,'invalidPlan');assert.equal(N.build({targets:{traps:1}}).fail,'unsupportedTarget');assert.equal(N.build({},{wallMs:0}).fail,'wallClock');
});
