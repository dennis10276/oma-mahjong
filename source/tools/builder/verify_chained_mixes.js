'use strict';
// Independent TASK 15 audit: imports only declarative shapes and the previous
// engine verifier, never trap_mixes, trap_stories, or their proof functions.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const V=require('./verify_trap_mixes.js'),E=require('./engine.js'),B=require('./builder.js');
const Tail=require('./bank/tail.js'),O=require('./chained_obviousness.js'),{SHAPES}=require('./chained_shapes.js');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const OUT=path.resolve(__dirname,'../../analysis/builder/bank/chained-v1');
function fingerprint(d){return crypto.createHash('sha256').update(JSON.stringify([d.tiles,d.clock.i,d.obst.ice,d.obst.locks.slice().sort((a,b)=>a-b),d.obst.keys.slice().sort((a,b)=>a-b)])).digest('hex');}
function history(){
  const root=path.resolve(OUT,'..'),files=[];
  // All lab-7 candidates, including the unplayed siblings, are excluded.
  for(const dir of ['variety-v1/examples','placed-250']){
    const full=path.join(root,dir);if(fs.existsSync(full))for(const f of fs.readdirSync(full).filter(f=>f.endsWith('.json')))files.push(path.join(full,f));
  }
  return files.flatMap(file=>{const r=JSON.parse(fs.readFileSync(file,'utf8')),d=r.design;if(!d)return [];return [{source:path.relative(root,file),fingerprint:fingerprint(d),layout:r.card?.layout??B.LAYOUTS.findIndex(l=>same(l.tiles,d.tiles)),signature:r.card?.trap?.signature||r.card?.trap?.shape||r.card?.trapType||r.card?.trap?.type||null}];});
}
function chainStructure(r,f){
  const d=r.design,ob=d.obst,c=B.context(d.tiles),b=r.roles.bait,gate=f.mode==='earlyClock'?b.mix.originalClock:d.clock.i;
  const ice=i=>ob.ice[i]>0,locked=i=>ob.locks.includes(i),flags=b.def;
  const matches=(i,kind)=>kind==='lock'?locked(i):kind==='ice'?ice(i):kind==='lockIce'?locked(i)&&ice(i):true;
  const failures=[];
  if(!matches(gate,flags.ck))failures.push('clockGate');
  if(flags.cover&&(!c.above[gate].has(b.clockCover)||!matches(b.clockCover,flags.cover)))failures.push('clockCover');
  const host=flags.cover?b.clockCover:gate;
  if(flags.nb&&(!E.game(d).iceNb[host].includes(b.special)||!matches(b.special,flags.nb)))failures.push('thawLink');
  for(const [idx,kind]of[[0,flags.keyA],[1,flags.keyB]])if(kind){
    const key=ob.keys[idx];
    if(kind==='frozen'?!ice(key):![...c.above[key]].some(i=>ice(i)))failures.push('keyGuard'+idx);
  }
  const parts=[flags.ck==='lock'?'clock<lock':flags.ck==='ice'?'clock<ice':flags.ck==='lockIce'?'clock<lockIce':null,
    flags.cover?'clock<cover:'+flags.cover:null,flags.nb?((flags.ck==='ice'||flags.ck==='lockIce')?'thaw<':'coverThaw<')+flags.nb:null,
    flags.keyA?'keyA<'+(flags.keyA==='frozen'?'frozen':flags.keyA+':ice'):null,
    flags.keyB?'keyB<'+(flags.keyB==='frozen'?'frozen':flags.keyB+':ice'):null].filter(Boolean).join('; ');
  if(parts!==f.baseSignature)failures.push('baseSignature');
  if(f.mode==='dualMelt'&&(!ice(b.mix.added)||!c.above[ob.keys.find(k=>k!==b.keyEarly)].has(b.mix.added)||b.wrong.length<2))failures.push('twoThawFronts');
  if(f.mode==='freezeRight'&&(!ice(b.mix.added)||!Object.keys(ob.ice).some(i=>+i!==b.mix.added&&E.game(d).iceNb[+i].includes(b.mix.added))))failures.push('innerIce');
  // Actual needs graph: cover -> tile below, ice neighbour -> host, both keys
  // -> each lock, plus the waiting clock's twin and ordinary lookalike choice.
  const adj=Array.from({length:c.n},()=>new Set()),add=(a,b)=>{adj[a].add(b);adj[b].add(a);};
  for(let i=0;i<c.n;i++)for(const j of c.above[i])add(i,j);
  for(const i of Object.keys(ob.ice).map(Number))for(const j of E.game(d).iceNb[i])add(i,j);
  for(const l of ob.locks)for(const k of ob.keys)add(l,k);
  if(f.mode==='earlyClock')add(d.clock.i,gate);
  const seen=new Set([d.clock.i]),todo=[d.clock.i];while(todo.length)for(const j of adj[todo.pop()])if(!seen.has(j)){seen.add(j);todo.push(j);}
  if([d.clock.i,...ob.keys,...ob.locks,...Object.keys(ob.ice).map(Number)].some(i=>!seen.has(i)))failures.push('disconnectedSpecial');
  return failures;
}
function verify(r,opts={}){
  const f=SHAPES[r.card?.trap?.type];if(!f)return {ok:false,errors:['unknownChainedShape']};
  const v=V.verify(r,{...opts,tailBand:[.10,.28]}),errors=v.errors.slice(),d=r.design,c=r.card,t=c.trap;
  errors.push(...chainStructure(r,f).map(x=>'chain:'+x));
  if(t.signature!==f.signature||t.links!==f.links||f.links<3)errors.push('signatureOrLinks');
  const o=O.measure(d,{baits:t.baits,dial:r.brief.obviousnessDial??0});
  if(!o.ok||!same(o,t.obviousness))errors.push('obviousness');
  const independent=t.baits.some((p,i)=>t.baits.some((q,j)=>i!==j&&p.tiles.every(x=>!q.tiles.includes(x))));
  const medium=require('./chained_facts.js').mediumEvidence(d,r.roles,t.baits);
  if(!independent||t.twoTraps?.hardLinks<3||t.twoTraps?.mediumLinks<2||medium.length<2||!same(medium,t.twoTraps.mediumEvidence))errors.push('twoMeaningfulTraps');
  for(const q of t.twoFronts||[]){const c=B.context(d.tiles);if(!d.obst.ice[q.host]||!E.game(d).iceNb[q.host].includes(q.lone)||d.faces[q.lone]!==d.faces[q.twin]||c.above[q.twin].size<2||d.down.includes(q.lone)||d.down.includes(q.twin)||!t.baits.some(p=>p.tiles.length===1&&p.tiles[0]===q.lone))errors.push('twoFrontEvidence');}
  if(t.twoFronts&&new Set(t.twoFronts.map(q=>q.host)).size<2)errors.push('twoFrontHosts');
  const layers=Math.max(...d.tiles.map(t=>t[2]))+1;if(c.layers!==layers)errors.push('layerCard');
  const occ=Tail.occupancy(d);if(!same(occ,c.tailOccupancy)||occ.share[1]<.40||occ.share[2]>.20||occ.share[3]>.05||occ.longest2plus>6)errors.push('tailOccupancy');
  const mech=new Set([...V.mechanism(d),...r.roles.bait.tiles,r.roles.bait.mix.originalClock]),route=new Set(d.solution.slice(0,c.clock.fewestMoves));
  if(d.down.length/d.tiles.length<.23||d.down.some(i=>mech.has(i)||route.has(i)))errors.push('faceDownTargetOrProtectedTile');
  const old=opts.history||history(),fp=fingerprint(d);
  if(old.some(h=>h.fingerprint===fp||(h.layout===c.layout&&h.signature===t.signature)))errors.push('reuse');
  return {...v,ok:errors.length===0,errors,signature:f.signature,layers,obviousness:o,tailOccupancy:occ,fingerprint:fp,historyBoards:old.length};
}
module.exports={verify,storedPressure:V.storedPressure,history,fingerprint,chainStructure,OUT};
