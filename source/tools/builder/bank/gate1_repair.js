'use strict';
process.env.MECH='1';process.env.NARROW_TRAP='core';
const fs=require('fs'),path=require('path'),D=require('./detower'),P=require('./finish_all_sources'),Q=require('./towers_proof'),T=require('./shape_bench_tools'),E=require(D.CF+'../engine'),SEP=require(D.CF+'separate'),SR=require(D.CF+'../chained_special_readability');
const OUT=path.resolve(__dirname,'../../../analysis/builder/finish-all/gate1');
function repair(lv,record,o={}){const before=P.original(record.source||lv),a=before.design,base=P.prepare(before),seed=record.design,keep=record.keep||a.tiles.map((_,i)=>i),idn=new Map(keep.map((id,i)=>[id,i])),fixed=new Set([a.clock.i,...a.obst.keys,...a.obst.locks,...Object.keys(a.obst.ice).map(Number),...(before.card?.trap?.baits||[]).flatMap(b=>b.tiles),...a.solution.slice(0,a.solution.indexOf(a.clock.i)+1),...(record.fixed||[])].map(i=>idn.get(i))),start=Date.now(),attempts=[];
 const readable=d=>SR.measure(a).rows.filter(r=>r.clear).every(r=>SR.measure(d).rows.some(q=>q.tile===idn.get(r.tile)&&q.kind===r.kind&&q.clear));
 let counter=null;if(record.config?.abl!=null){const d=structuredClone(a);delete d.obst.ice[record.config.abl];counter=E.clockShortest(E.game(d),{nodes:1000000,ms:10000});}
 const retainsCounter=d=>{if(!counter)return true;const c=structuredClone(d);delete c.obst.ice[idn.get(record.config.abl)];c.clock.n=counter.k;const g=E.game(c);let s=E.start(g);try{for(const act of counter.path){s=E.step(g,s,act);if(!s)return false;}return E.won(g,s);}catch{return false;}};
 console.log('seed',lv,'twins',SEP.closeTwins(seed).visible,'readable',readable(seed),'counter',counter?.k,retainsCounter(seed));
 const check=(d,edit)=>{if(Date.now()-start>(o.ms||180000))return null;if(!T.geometry(d).ok||SEP.closeTwins(d).visible>base.twins||!readable(d)||!retainsCounter(d))return null;const route=D.route(d);if(!route)return null;d.solution=route;const certificate=Q.certify(before,d,keep,base);attempts.push({edit,ok:certificate.ok,errors:certificate.errors});console.log(lv,edit,certificate.ok,certificate.errors);if(certificate.ok)return{level:lv,source:record.source||lv,ok:true,method:'same trap; reshape its own pyramid and reposition ordinary tiles',design:d,keep,certificate,shape:T.geometry(d),edit,attempts};return null;};
 const close=SEP.closeTwins(seed).closeVisible||[];
 // A board can have more than one close pair. Keep intermediate improvements
 // that retain the counterfactual win rather than demanding all pairs vanish
 // after the first move.
 const downFree=d=>{const g=E.game(d);return E.legal(g,E.start(g)).filter(i=>Number.isInteger(i)&&d.down.includes(i));};
 const score=d=>Math.max(0,SEP.closeTwins(d).visible-base.twins)*10+downFree(d).length*5;
 let beam=[{d:seed,edits:[]}];
 for(let depth=0;depth<8&&beam.length;depth++){
  const next=[],seen=new Set();for(const node of beam){const count=score(node.d);
   if(!count){const r=check(structuredClone(node.d),node.edits);if(r)return r;continue;}
   const pair=SEP.closeTwins(node.d).closeVisible.find(p=>p.some(i=>Number.isInteger(i)&&!fixed.has(i)))||downFree(node.d);if(!pair)continue;
   for(const i of pair.filter(i=>Number.isInteger(i)&&!fixed.has(i)))for(let j=0;j<seed.tiles.length;j++){
    if(Date.now()-start>(o.ms||180000))return{level:lv,ok:false,attempts,why:'deadline'};
    if(fixed.has(j)||i===j||seed.faces[i]===seed.faces[j])continue;
    const d=structuredClone(node.d);[d.tiles[i],d.tiles[j]]=[d.tiles[j],d.tiles[i]];
    if(d.tiles.some((p,k)=>p[2]>2&&p[2]>a.tiles[keep[k]][2]))continue;
    const c=score(d);if(c>=count||!readable(d)||!retainsCounter(d))continue;
    const key=JSON.stringify(d.tiles);if(seen.has(key))continue;seen.add(key);next.push({d,edits:node.edits.concat([['swapPositions',keep[i],keep[j]]]),count:c});
   }
  }beam=next.sort((a,b)=>a.count-b.count).slice(0,30);
 }
 for(const pair of close)for(const i of pair.filter(i=>Number.isInteger(i)&&!fixed.has(i)))for(let j=0;j<seed.tiles.length;j++){if(fixed.has(j)||i===j||seed.faces[i]===seed.faces[j])continue;const d=structuredClone(seed);[d.tiles[i],d.tiles[j]]=[d.tiles[j],d.tiles[i]];const r=check(d,['swapPositions',keep[i],keep[j]]);if(r)return r;if(Date.now()-start>(o.ms||180000))return{level:lv,ok:false,attempts,why:'deadline'};}
 // Locate the ordinary tile masking a formerly readable badge. Move it to a
 // supported brick spot; no picture exchanges and no tolerance reduction.
 const blockers=[...new Set(close.flatMap(p=>p.filter(i=>Number.isInteger(i)&&!fixed.has(i))))];for(let i=0;i<seed.tiles.length;i++){if(fixed.has(i))continue;const d=structuredClone(seed);d.tiles[i]=[100,100,0];if(!readable(seed)&&readable(d)&&!blockers.includes(i))blockers.push(i);}
 for(const i of blockers){const cur=seed.tiles.filter((_,j)=>j!==i);for(let z=0;z<=2;z++)for(let y=0;y<=14;y++)for(let x=0;x<=11;x++){const p=[x,y,z];if(!D.brickSpot(cur,p))continue;const d=structuredClone(seed);d.tiles[i]=p;const r=check(d,['move',keep[i],p]);if(r)return r;if(Date.now()-start>(o.ms||180000))return{level:lv,ok:false,attempts,why:'deadline'};}}
 return{level:lv,ok:false,attempts,blockers,ms:Date.now()-start};
}
if(require.main===module){const lv=+process.argv[2];for(const f of process.argv.slice(3)){const r=repair(lv,JSON.parse(fs.readFileSync(f)));fs.writeFileSync(path.join(OUT,`repair-${lv}.json`),JSON.stringify(r,null,2));if(r.ok){fs.writeFileSync(path.join(OUT,`level-${lv}.json`),JSON.stringify(r,null,1));break;}}}module.exports={repair};
