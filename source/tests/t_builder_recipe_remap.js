'use strict';
function run(){
const assert=require('assert/strict'),P=require('../tools/builder/bank/finish_all_sources'),D=require('../tools/builder/bank/detower'),Q=require('../tools/builder/bank/finish_all_mechanics'),Six=require(D.CF+'../chained_six_facts'),E=require(D.CF+'../engine');
const frozen=require(D.CF+'finish_ten_proof');
for(let level=301;level<=349;level++){const before=P.original(level),d=before.design,keep=d.tiles.map((_,i)=>i);assert.deepEqual(Q.remapRoles(before.roles,keep,d),frozen.remapRoles(before.roles,keep,d),'identity map changed '+level);}
for(const level of[322,338]){
 const before=P.original(level),a=before.design,n=a.tiles.length,keep=[n-1,...Array.from({length:n-1},(_,i)=>i)],mp=i=>keep.indexOf(i),d={...structuredClone(a),tiles:keep.map(i=>a.tiles[i]),faces:keep.map(i=>a.faces[i]),down:a.down.map(mp),gold:(a.gold||[]).map(mp),clock:{...a.clock,i:mp(a.clock.i)},obst:{ice:Object.fromEntries(Object.entries(a.obst.ice).map(([i,v])=>[mp(+i),v])),keys:a.obst.keys.map(mp),locks:a.obst.locks.map(mp)},solution:a.solution.map(mp)};
 assert.equal(E.replay(d,d.solution,{strict:true}).ok,true);
 const roles=Q.remapRoles(before.roles,keep,d);
 for(const [k,link]of before.roles.bait.sixLinks.entries()){
  const old=Six.evidence(link.kind,a,link),next=Six.evidence(link.kind,d,roles.bait.sixLinks[k]);
  assert.equal(old.ok,true,level+' source '+old.why);
  assert.equal(next.ok,true,level+' renumbered '+next.why);
  for(const name of['take','free','visible','side','orphans'])if(link[name])assert.deepEqual(roles.bait.sixLinks[k][name],link[name].map(mp));
 }
 console.log(level,'two-idea evidence survives identity-only renumbering');
}
}
if(require.main===module)run();
module.exports=[{name:"builder bench: two-idea identity remapping",cpu:true,run}];
