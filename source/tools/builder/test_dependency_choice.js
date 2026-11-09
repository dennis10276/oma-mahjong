'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const B=require('./dependency_choice.js'),E=require('./engine.js'),L=require('../../www/layouts.js');
const {tileVisibility}=require('../sim/refit/human_board_visibility.js');

test('clover provides a real three-place dependency, independent of its witness and clock',()=>{
 const b=B.build({targets:{choiceModules:1},seed:1});assert.ok(b.design);
 const m=b.modules[0],proof=B.firstPetalProof(b.design,m,2);
 assert.equal(proof.petalReachable,false);assert.equal(proof.exhaustive,true);
 assert.equal(B.firstPetalProof(b.design,m,3).petalReachable,true);
 const ids=m.heads.concat(m.tails,m.bait.head,m.bait.tail);
 const d={tiles:ids.map(i=>b.design.tiles[i]),faces:ids.map(i=>b.design.faces[i]),down:[],obst:{},clock:null,solution:[]};
 const g=E.game(d),s=E.start(g),bad=E.step(g,s,8);
 assert.ok(bad);assert.equal(E.winnable(g,s,{nodes:100000,ms:Infinity}).result,'win');
 assert.equal(E.winnable(g,bad,{nodes:100000,ms:Infinity}).result,'lose','generic game proof independently confirms the bait trap');
 const calm={...d,faces:[0,0,1,1,2,2,3,3,4,4]},cg=E.game(calm);
 assert.equal(E.winnable(cg,E.step(cg,E.start(cg),8),{nodes:100000,ms:Infinity}).result,'win','the dependency matching causes the loss, not its geometry or clock');
});

test('choice count changes the matching puzzle while preserving its layout, roles and information',()=>{
 const a=B.build({targets:{choiceModules:1},seed:2}),b=B.build({targets:{choiceModules:4},seed:2});
 assert.ok(a.design&&b.design);assert.deepEqual(a.design.tiles,b.design.tiles);assert.deepEqual(a.design.obst,b.design.obst);
 assert.notDeepEqual(a.design.faces,b.design.faces);assert.deepEqual(a.design.down,[]);assert.deepEqual(b.design.down,[]);
 assert.equal(a.card.dependencyChoices.length,1);assert.equal(b.card.dependencyChoices.length,4);
 assert.equal(E.replay(b.design,b.design.solution,{strict:true}).ok,true);
 assert.deepEqual(b.design,B.build({targets:{choiceModules:4},seed:2}).design);
 const thawed=B.build({targets:{choiceModules:4},frame:{thaw:1},seed:2});
 assert.deepEqual(b.design.faces,thawed.design.faces);assert.deepEqual(b.design.tiles,thawed.design.tiles);
 assert.deepEqual(b.design.obst.keys,thawed.design.obst.keys);
 for(const d of [b.design,thawed.design])for(const i of Object.keys(d.obst.ice).map(Number))assert.ok(!d.obst.locks.includes(i)&&!d.obst.keys.includes(i));
});

test('specials and both ends of the designed temptation are visible, and labels cannot leak between modules',()=>{
 const b=B.build({targets:{choiceModules:4}}),d=b.design,tiles=d.tiles.map(([x,y,z])=>({x,y,z}));
 assert.equal(d.tiles.length,72);
 const visibility=tileVisibility(tiles,{alive:new Uint8Array(72).fill(1),down:new Uint8Array(72),openPeek:-1},d.clock).tiles;
 for(const i of [d.clock.i,...d.obst.keys,...d.obst.locks])assert.equal(visibility[i].role,true);
 const counts=d.faces.reduce((m,f)=>(m[f]=(m[f]||0)+1,m),{});assert.equal(Object.keys(counts).length,36);assert.ok(Object.values(counts).every(n=>n===2));
 for(const m of b.modules) {
  for(const i of m.heads.concat(m.tails,[m.bait.head,m.bait.tail]))assert.equal(visibility[i].picture,true);
  assert.equal(L.isFree(m.bait.head,new Uint8Array(72).fill(1),L.neighbors(tiles)),true);
 }
 for(let a=0;a<tiles.length;a++)for(let z=a+1;z<tiles.length;z++)if(tiles[a].z===tiles[z].z)
  assert.ok(Math.abs(tiles[a].x-tiles[z].x)>=2||Math.abs(tiles[a].y-tiles[z].y)>=2,'same-layer tiles do not overlap');
 // Same calculation as board.js boardGeo; board area, not the whole viewport.
 const xx=tiles.map(t=>t.x/2-t.z*.14),yy=tiles.map(t=>t.y/2*1.24-t.z*.14);
 const width=Math.max(...xx)+1-Math.min(...xx),height=Math.max(...yy)+1.24-Math.min(...yy);
 const tileWidth=Math.min(150,(360-8)/(width+.085+.04),(600-8)/(height+.085*1.4+.04));
 assert.ok(tileWidth>=52,`tile width ${tileWidth}`);
});

test('unsupported plans and unproved minima fail explicitly',()=>{
 assert.equal(B.build({targets:{choiceModules:0}}).fail,'incompatibleBrief');
 assert.equal(B.build({shape:'blob'}).fail,'unknownShape');
 assert.equal(B.build({}, {keep:{}}).fail,'unsupportedOption');
 assert.equal(B.build({}, {nodes:0}).fail,'clockMinimum');
 assert.equal(B.build({}, {wallMs:0}).fail,'wallClock');
 assert.equal(B.build({targets:{choiceModules:2,links:2}}).fail,'incompatibleBrief');
 assert.equal(B.build({frame:{way:12}}).fail,'incompatibleBrief');
});

test('linking lobes changes only bridge partners and preserves the exact clock frame',()=>{
 const a=B.build({targets:{choiceModules:4,links:0},seed:1}),b=B.build({targets:{choiceModules:4,links:3},seed:1});
 assert.ok(a.design&&b.design);assert.deepEqual(a.design.tiles,b.design.tiles);assert.deepEqual(a.design.obst,b.design.obst);assert.deepEqual(a.design.clock,b.design.clock);
 const bridgeTiles=new Set(a.modules.map(m=>m.tails[1]));
 for(let i=0;i<a.design.faces.length;i++)if(!bridgeTiles.has(i))assert.equal(a.design.faces[i],b.design.faces[i]);
 assert.notDeepEqual(a.design.faces,b.design.faces);
 assert.deepEqual(a.card.dependencyGroups.map(g=>g.heads.length),[4,4,4,4]);assert.deepEqual(b.card.dependencyGroups.map(g=>g.heads.length),[16]);
 assert.ok(b.card.dependencyChoices.every(p=>p.forcedLose&&p.public&&p.petalReachable===false&&p.petals.length===16));
 const ids=b.card.dependencyGroups[0].heads.concat(b.card.dependencyGroups[0].tails,b.modules[0].bait.head,b.modules[0].bait.tail);
 const d={tiles:ids.map(i=>b.design.tiles[i]),faces:ids.map(i=>b.design.faces[i]),down:[],obst:{},clock:null,solution:[]},g=E.game(d,{reserveCuts:false});
 assert.equal(E.winnable(g,E.step(g,E.start(g),32),{nodes:200000,ms:Infinity}).result,'lose','the unpruned generic solver independently proves the linked reserve trap');
 assert.equal(E.replay(b.design,b.design.solution,{strict:true}).ok,true);
 const publicBuild=require('./builder.js').build({mode:'dependencyChoice',shape:'clover',story:'reserveTray',targets:{choiceModules:4,links:3},seed:1});
 assert.deepEqual(publicBuild.design,b.design);
});

test('inspection caps provide a known safe information action without hiding the specials',()=>{
 const b=B.build({targets:{choiceModules:4,links:3,inspect:[0,3]}});assert.ok(b.design);assert.equal(b.design.tiles.length,76);
 assert.equal(b.card.inspectionPairs.length,2);assert.ok(b.card.inspectionPairs.every(p=>p.concealed&&p.revealed&&p.publicPair));
 assert.deepEqual(b.design.down,[]);assert.equal(E.replay(b.design,b.design.solution,{strict:true}).ok,true);
 const faces=b.design.faces.reduce((m,f)=>(m[f]=(m[f]||0)+1,m),{});assert.ok(Object.keys(faces).length<=36);assert.ok(Object.values(faces).every(n=>n===2||n===4));
});

test('a reward lure supplies a real free pair after its proved premature single',()=>{
 const b=B.build({targets:{choiceModules:4,links:3,baitModules:[2,3],rewardLures:true}});assert.ok(b.design);
 assert.equal(b.design.tiles.length,74);assert.equal(b.card.rewardLures.length,2);
 const g=E.game(b.design),initial=E.start(g);
 for(const p of b.card.rewardLures){
  assert.equal(p.publicReward,true);let s=E.step(g,initial,p.temptation);assert.ok(s);
  s=E.step(g,s,p.released);assert.ok(s);s=E.step(g,s,p.donor);assert.ok(s);assert.equal(s.tray.length,1);
  assert.equal(E.winnable(g,s,{nodes:10000,ms:Infinity}).result,'lose','the payoff does not repair the reserve-space mistake');
 }
 assert.equal(E.replay(b.design,b.design.solution,{strict:true}).ok,true);
});

test('readability refuses a lock hidden behind ice even when the tile is geometrically exposed',()=>{
 const SG=require('./loop/static_gates.js'),b=B.build({targets:{choiceModules:1}}),d=structuredClone(b.design);
 d.obst.locks.push(d.clock.i);
 const g=SG.staticGates(d,{shape:'clover',budget:1000,previous:[]});
 assert.equal(g.gates.A2.pass,false);
 assert.deepEqual(g.gates.A2.detail.roleConflicts,[{tile:d.clock.i,roles:['ice','lock']}]);
});
