'use strict';
// Cheap, independent geometry and dependency checks run before expensive proofs.
const fs = require('fs'), D = require('./detower'), CF = D.CF;
const E = require(CF + '../engine'), F = require(CF + '../footprint'), G = require(CF + 'narrow_methods');
const clone = x => structuredClone(x), same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
function geometry(d, opts={}) {
  const T=d.tiles, xs=T.map(t=>t[0]), ys=T.map(t=>t[1]), shape=D.strip(D.shape(T)), fp=F.measure(d,{minimum:opts.tenth?53.5:58});
  const width=(Math.max(...xs)-Math.min(...xs)+2)/2, rows=(Math.max(...ys)-Math.min(...ys)+2)/2, errors=[];
  if(T.some(t=>t.length!==3||t.some(x=>!Number.isInteger(x)||x<0)))errors.push('grid');
  if(!G.valid(T))errors.push('supportOrOverlap');
  if(shape.straight)errors.push('towers');
  // Mixed brick parities can be deliberate (including released boards). Keep
  // this diagnostic visible; integer coordinates and support are hard gates.
  if((!opts.tenth&&(width>6.5||rows>8))||!fp.ok)errors.push('footprint');
  if(opts.tenth?T.length!==96:T.length<72||T.length>88||T.length%2)errors.push('tileCount');
  return {ok:!errors.length,errors,tiles:T.length,width,rows,px:fp.tilePx,...shape};
}
function relations(d,keep=d.tiles.map((_,i)=>i)) {
  const S=require('./shape_bench'), g=E.game(clone(d)), h=S.holds(d), map=a=>a.map(i=>keep[i]).sort((a,b)=>a-b);
  return {free:map(E.legal(g,E.start(g)).filter(Number.isInteger)), holds:Object.fromEntries(h.map((v,i)=>[keep[i],{on:map(v.on),left:map(v.left),right:map(v.right),ice:v.ice?{need:v.ice.need,of:map(v.ice.of)}:null,keys:v.keys?map(v.keys):null}]))};
}
function invariants(B, o={}) {
  const {d,keep}=B.design(), before=relations(o.reference||B.a,o.referenceKeep), after=relations(d,keep);
  const ids=o.ids||keep, changed=ids.filter(i=>!same(before.holds[i],after.holds[i]));
  return {ok:!changed.length&&same(before.free,after.free),changed,freed:after.free.filter(i=>!before.free.includes(i)),held:before.free.filter(i=>!after.free.includes(i))};
}
// Move a whole small module as a unit. Reject changed holds, including finish tiles,
// before spending a proof. Time-bounded; restores the board when nothing qualifies.
function heldSpots(B, ids, o={}) {
  const initial=clone(B.st.T), {d,keep}=B.design(), ref=relations(o.reference||B.a,o.referenceKeep), start=Date.now(), out=[];
  const selected=new Set(ids), others=initial.filter((_,i)=>!selected.has(i)&&!B.st.dropped.has(i));
  for(let dz=-(Math.min(...ids.map(i=>initial[i][2])));dz<=(o.zmax??5)-Math.max(...ids.map(i=>initial[i][2]));dz++)
    for(let dy=-16;dy<=16;dy++)for(let dx=-14;dx<=14;dx++) {
      if(Date.now()-start>(o.ms||10000)){B.st.T=initial;return out;}
      ids.forEach(i=>B.st.T[i]=[initial[i][0]+dx,initial[i][1]+dy,initial[i][2]+dz]);
      const q=B.design(); if(!geometry(q.d).ok)continue;
      const r=relations(q.d,q.keep), watch=o.all?keep:ids;
      if(watch.some(i=>!same(ref.holds[i],r.holds[i])))continue;
      if(o.free!==false&&!same(ref.free,r.free))continue;
      const v={delta:[dx,dy,dz],mirror:D.shape(q.d.tiles).mirror,positions:ids.map(i=>B.st.T[i].slice())};out.push(v);
    }
  B.st.T=initial; return out.sort((a,b)=>b.mirror-a.mirror);
}
// Exact clock/opening and forced tray capacity. Unknown searches remain unknown.
function pressure(d,o={}) {
  const g=E.game(clone(d),{strict:true}), k=E.clockShortest(g,{nodes:1000000,ms:o.ms||10000}), Tail=require(CF+'tail');
  const boundary=clone(d); if(k&&!k.unsure)boundary.solution=E.flatten(k.path);
  const g2=E.game(boundary);let state=E.start(g2);for(const i of boundary.solution.slice(0,boundary.solution.indexOf(d.clock.i)+1))state=E.step(g2,state,i);
  const actions=E.legal(g2,state).filter(Number.isInteger),opening={win:0,lose:0,unknown:0,actions:[]},start=Date.now();
  for(const i of actions){let result='unknown';if(Date.now()-start<15000){const s=E.step(g2,state,i);result=s?E.winnable(g2,s,{nodes:150000,ms:300}).result:'lose';}opening[result]++;opening.actions.push({tile:i,result});}
  return {clock:k&&!k.unsure?k.k:null,spare:k&&!k.unsure?d.clock.n-k.k:null,free:E.legal(g,E.start(g)).filter(Number.isInteger).length,
    atClock:{waiting:state.tray.length,free:actions.length,opening},
    cap1:Tail.cappedTail(boundary,1,{peek:true,nodes:300000,ms:1500}).result,cap2:Tail.cappedTail(boundary,2,{peek:true,nodes:500000,ms:2000}).result};
}
function picture(B,file) {
  const {d,keep}=B.design(), T=d.tiles, scale=34, margin=30, w=(Math.max(...T.map(t=>t[0]))+3)*scale/2+margin, h=(Math.max(...T.map(t=>t[1]))+3)*scale*.62+margin;
  const colors={C:'#ffdc63',K:'#b5e4a7',L:'#e6b4ff',I:'#b3edff',B:'#ffb4a8',R:'#ffe8a8'};
  const tiles=T.map((t,i)=>({t,i})).sort((a,b)=>a.t[2]-b.t[2]||a.t[1]-b.t[1]||a.t[0]-b.t[0]).map(({t,i})=>{
    const x=margin+t[0]*scale/2-t[2]*scale*.14,y=margin+t[1]*scale*.62-t[2]*scale*.14, id=keep[i],role=B.role[id];
    return `<g><rect x="${x}" y="${y}" width="${scale}" height="${scale*1.24}" rx="4" fill="${colors[role]||'#fff9df'}" stroke="#55765c"/><text x="${x+3}" y="${y+13}" font-size="11">${role}${id}</text><text x="${x+3}" y="${y+29}" font-size="10">f${d.faces[i]} z${t[2]}</text></g>`;}).join('');
  fs.writeFileSync(file,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#13755b"/>${tiles}</svg>`);return file;
}
module.exports={geometry,relations,invariants,heldSpots,pressure,picture};
