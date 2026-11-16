'use strict';
process.env.MECH='1';process.env.NARROW_TRAP='core';
const fs=require('fs'),path=require('path'),D=require('./detower'),P=require('./finish_all_sources'),E=require(D.CF+'../engine'),Q=require('./towers_proof'),SEP=require(D.CF+'separate'),O=require(D.CF+'../chained_obviousness');
const OUT=path.resolve(__dirname,'../../../analysis/builder/finish-all/gate1');
function offer(lv,file){const record=JSON.parse(fs.readFileSync(file)),d0=record.design,keep=record.keep,before=P.original(record.source||lv),base=P.prepare(before),a=before.design,src=new Map(keep.map((id,i)=>[id,i])),g=E.game(d0),free=E.legal(g,E.start(g)).filter(Number.isInteger),down=new Set(d0.down),fixed=new Set([d0.clock.i,...d0.obst.keys,...d0.obst.locks,...Object.keys(d0.obst.ice).map(Number),...d0.solution.slice(0,d0.solution.indexOf(d0.clock.i)+1),...(before.card?.trap?.baits||[]).flatMap(b=>b.tiles).map(i=>src.get(i))]);
 const protectedFaces=new Set([...fixed].map(i=>d0.faces[i]));d0.faces.forEach((f,i)=>{if(protectedFaces.has(f))fixed.add(i);});const movable=d0.tiles.map((_,i)=>i).filter(i=>!fixed.has(i)&&!down.has(i)),began=Date.now(),attempts=[];console.log(lv,'opening',O.measure(d0));
 for(const i of movable.filter(i=>!free.includes(i)&&free.some(j=>!down.has(j)&&d0.faces[i]===d0.faces[j])))for(const j of movable.filter(j=>free.includes(j))){
  if(Date.now()-began>180000)return;const d=structuredClone(d0);[d.tiles[i],d.tiles[j]]=[d.tiles[j],d.tiles[i]];
  if(d.tiles.some((p,k)=>p[2]>2&&p[2]>a.tiles[keep[k]][2])||SEP.closeTwins(d).visible>base.twins||!O.measure(d).ok)continue;
  if(!E.replay(d,d.solution,{strict:true}).ok){const route=D.route(d);if(!route)continue;d.solution=route;}
  const certificate=Q.certify(before,d,keep,base);console.log(lv,'offer swap',keep[i],keep[j],certificate.errors);attempts.push({swap:[keep[i],keep[j]],errors:certificate.errors});if(certificate.ok){const r={...record,ok:true,design:d,certificate,offer:{swap:[keep[i],keep[j]],opening:O.measure(d),attempts},method:record.method+'; retain a separate visible finish pair as an opening choice'};fs.writeFileSync(path.join(OUT,`level-${lv}.json`),JSON.stringify(r,null,1));return r;}
 }
 fs.writeFileSync(path.join(OUT,`offer-${lv}.json`),JSON.stringify({ok:false,attempts},null,2));
}
if(require.main===module)offer(+process.argv[2],process.argv[3]);module.exports={offer};
