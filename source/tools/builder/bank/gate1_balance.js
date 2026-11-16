'use strict';
process.env.MECH='1';process.env.NARROW_TRAP='core';
const fs=require('fs'),path=require('path'),D=require('./detower'),P=require('./finish_all_sources'),Q=require('./towers_proof'),E=require(D.CF+'../engine'),H=require(D.CF+'finish_ten_human_pressure'),Feel=require(D.CF+'feel'),SEP=require(D.CF+'separate');
const OUT=path.resolve(__dirname,'../../../analysis/builder/finish-all/gate1');
const clone=x=>structuredClone(x);
function meter(input,playouts=4){const d=H.canonical(input),samples=[3,71,977].map(seed=>Feel.expert(d,{seed,playouts,nodes:150000,ms:250,wrong:process.argv.includes('--wrong'),requireProof:true})),avg=k=>samples.reduce((s,r)=>s+r[k],0)/samples.length;return{mean:avg('mean'),twoPlus:avg('twoPlus'),parks:avg('parks'),wrongPark:avg('wrongPark'),danger:avg('danger'),games:avg('games'),unknown:avg('unresolvedChecks')};}
function distance(a,b){return Math.abs(a.mean-b.mean)*2+Math.abs(a.twoPlus-b.twoPlus)*3+Math.abs(a.parks-b.parks)*.18+Math.abs(a.wrongPark-b.wrongPark)*3;}
function run(lv,opts={}){
 const file=path.join(OUT,`level-${lv}.json`),record=JSON.parse(fs.readFileSync(file)),before=P.original(record.source||lv),a=before.design,base=P.prepare(before),keep=record.keep,src=new Map(keep.map((id,i)=>[id,i])),d0=H.canonical(record.design),target=meter(H.canonical(a),6),start=meter(d0,6),began=Date.now(),attempts=[];
 console.log(lv,'target',target,'start',start);
 const fixed=new Set([d0.clock.i,...d0.obst.keys,...d0.obst.locks,...Object.keys(d0.obst.ice).map(Number),...d0.solution.slice(0,d0.solution.indexOf(d0.clock.i)+1),...(before.card?.trap?.baits||[]).flatMap(b=>b.tiles).map(i=>src.get(i))]);
 const faces=new Set([d0.clock.i,...d0.obst.keys,...d0.obst.locks,...Object.keys(d0.obst.ice).map(Number),...(before.card?.trap?.baits||[]).flatMap(b=>b.tiles).map(i=>src.get(i))].map(i=>d0.faces[i]));d0.faces.forEach((f,i)=>{if(faces.has(f))fixed.add(i);});
 const movable=d0.tiles.map((_,i)=>i).filter(i=>!fixed.has(i)),plans=[{d:d0,actions:d0.solution.slice(0,d0.solution.indexOf(d0.clock.i)+1),partial:true}];
 if(opts.counter)for(const id of Object.keys(d0.obst.ice).map(Number)){const b=clone(d0);delete b.obst.ice[id];const r=E.clockShortest(E.game(b),{nodes:1000000,ms:10000});if(r&&!r.unsure)plans.push({ice:id,k:r.k,actions:r.path});}
 const retains=d=>{for(const p of plans){const b=clone(d);if(p.ice!=null){delete b.obst.ice[p.ice];b.clock.n=p.k;}const g=E.game(b,{strict:p.ice==null});let s=E.start(g);try{for(const act of p.actions){s=E.step(g,s,act);if(!s)return false;}if(!p.partial&&!E.won(g,s))return false;}catch{return false;}}return true;};
 const initialGame=E.game(d0),allowedFreeDown=new Set(E.legal(initialGame,E.start(initialGame)).filter(i=>Number.isInteger(i)&&d0.down.includes(i)));
 const downFree=d=>{const g=E.game(d);return E.legal(g,E.start(g)).some(i=>Number.isInteger(i)&&d.down.includes(i)&&!allowedFreeDown.has(i));};
 let current=d0,bestMeter=start,bestDistance=distance(target,start),edits=[],trials=0;
 const rand=Feel.rngOf||(()=>{let v=lv;return()=>((v=Math.imul(1664525,v)+1013904223)>>>0)/4294967296;})();
 for(let round=0;round<8&&bestDistance>.14;round++){
  let best=null;const seen=new Set();
  for(let it=0;it<350;it++){
   if(Date.now()-began>(opts.ms||240000))break;
   const i=movable[Math.floor(rand()*movable.length)],j=movable[Math.floor(rand()*movable.length)];if(i===j||current.faces[i]===current.faces[j])continue;const id=[Math.min(i,j),Math.max(i,j)].join();if(seen.has(id))continue;seen.add(id);
   const d=clone(current);[d.tiles[i],d.tiles[j]]=[d.tiles[j],d.tiles[i]];
   if(d.tiles.some((p,k)=>p[2]>2&&p[2]>a.tiles[keep[k]][2])||SEP.closeTwins(d).visible>base.twins||downFree(d)||!retains(d))continue;
   trials++;let m;try{if(!E.replay(d,d.solution,{strict:true}).ok){const route=D.route(d);if(!route)continue;d.solution=route;}const canonical=H.canonical(d);if(canonical.solution.indexOf(d.clock.i)+1!==base.k)continue;m=meter(d);}catch{continue;}const dist=distance(target,m);if(dist>=bestDistance-.04||best&&dist>=best.dist)continue;
   const certificate=Q.certify(before,d,keep,base);attempts.push({swap:[keep[i],keep[j]],m,dist,ok:certificate.ok,errors:certificate.errors});console.log(lv,'trial',trials,[keep[i],keep[j]],m,dist,certificate.errors);
   if(certificate.ok){best={d,m,dist,i,j,certificate};if(dist<.14)break;}
  }
  if(!best)break;current=best.d;bestMeter=best.m;bestDistance=best.dist;edits.push([keep[best.i],keep[best.j]]);
  const r={...record,design:current,certificate:best.certificate,balance:{target,start,training:bestMeter,distance:bestDistance,edits,trials,ms:Date.now()-began},method:record.method+'; ordinary whole-tile position exchanges to retain finish pressure'};
  fs.writeFileSync(path.join(OUT,`balance-${lv}.json`),JSON.stringify(r,null,1));
  if(Date.now()-began>(opts.ms||240000))break;
 }
 console.log(lv,'balanced',bestDistance,edits,'trials',trials);
 if(edits.length){fs.copyFileSync(file,path.join(OUT,`prebalance-${lv}.json`));fs.copyFileSync(path.join(OUT,`balance-${lv}.json`),file);}
 fs.writeFileSync(path.join(OUT,`balance-attempts-${lv}.json`),JSON.stringify({target,start,bestMeter,bestDistance,edits,trials,attempts},null,2));
}
if(require.main===module)for(const lv of process.argv.slice(2).filter(x=>/^\d+$/.test(x)).map(Number))run(lv);module.exports={run};
