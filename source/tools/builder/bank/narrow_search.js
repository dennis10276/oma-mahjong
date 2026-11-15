'use strict';
// Task 19 bounded search. Accepted boards only enter narrow/ after all proofs.
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const P=require('./narrow_proof'),N=require('./narrow'),G=require('./narrow_methods'),E=require('../engine'),F=require('../footprint'),SEP=require('./separate');
const clone=x=>JSON.parse(JSON.stringify(x)),arg=(n,d)=>{const i=process.argv.indexOf('--'+n);return i<0?d:process.argv[i+1];};
const REPORT=path.join(P.DIR,'task19-search.jsonl');
function geoPrep(before){const d=before.design;return {g:E.game(d),roles:[...new Set([d.clock.i,...d.obst.keys,...d.obst.locks,...Object.keys(d.obst.ice).map(Number),...(before.card?.trap?.mechanism?.originalClock!=null?[before.card.trap.mechanism.originalClock]:[])])]};}
function repairCandidates(before,cand,base){
  const d=cand.design,coreFaces=new Set([...base.M].map(i=>d.faces[i])),eligible=d.faces.map((f,i)=>!base.M.has(i)&&!coreFaces.has(f)?i:null).filter(i=>i!=null),geo=SEP.geometry(d),ct=SEP.closeTwins(d,geo),out=[];
  // One exchange preserves face multiplicities; only ordinary pictures outside
  // the trap and every copy of its pictures are eligible.
  for(const a of eligible)for(const b of eligible){if(b<=a||d.faces[a]===d.faces[b])continue;
    const q=clone(d);[q.faces[a],q.faces[b]]=[q.faces[b],q.faces[a]];
    const twins=SEP.closeTwins(q,geo);if(twins.visible<=base.twins&&twins.visible<ct.visible)out.push({...cand,design:q,pictureExchange:[a,b]});
  }
  return out.slice(0,100);
}
function one(level,opts={}){
  if(level%10===0)throw Error('Tenth levels are frozen');
  const start=Date.now(),until=start+(opts.ms??120000),before=P.original(level),a=before.design,fp=F.measure(a,{minimum:58}),file=path.join(P.DIR,`level-${level}.json`);
  if(fp.ok)return {level,outcome:'untouched',before:fp.tilePx,after:fp.tilePx,reason:'Already at least 58 px and at most eight rows',movedCount:0,facePairsChanged:0};
  if(fs.existsSync(file)){const old=JSON.parse(fs.readFileSync(file));if(old.certificate?.ok&&old.certificate.beforeHash===P.hash(a)&&old.certificate.afterHash===P.hash(old.design))return {level,outcome:'narrowed',method:old.method||(old.hop?'hop '+old.hop:'column/row out'),before:fp.tilePx,after:old.footprint.tilePx,movedCount:old.moved.length,facePairsChanged:old.facePairsChanged,proof:'certified existing draft'};}
  const prep=geoPrep(before),proposals=G.candidates(before,prep),fails={},note=(key)=>fails[key]=(fails[key]||0)+1;
  if(!proposals.out.length)return {level,outcome:'released',before:fp.tilePx,after:fp.tilePx,reason:'No supported tidy geometry reaches 58 px',geometry:proposals.why,movedCount:0,facePairsChanged:0};
  let base;try{base=P.prepare(before);}catch(e){return {level,outcome:'released',before:fp.tilePx,after:fp.tilePx,reason:'Baseline proof unresolved: '+e.message,geometry:proposals.why,movedCount:0,facePairsChanged:0};}
  let tested=0;
  const tryOne=cand=>{
    if(Date.now()>until)return null;
    // Reject changed trap relations before spending time on a full route/proof.
    const core=[...base.M].sort((x,y)=>x-y);
    if(JSON.stringify(P.relations(E.game(a),core))!==JSON.stringify(P.relations(E.game(cand.design),core))){note('trapRelations');return null;}
    const SR=require('../chained_special_readability'),old=SR.measure(a),fresh=SR.measure(cand.design);
    if(old.rows.filter(q=>q.clear).some(r=>!fresh.rows.some(q=>q.tile===r.tile&&q.kind===r.kind&&q.clear))){note('readableBadge');return null;}
    tested++;
    const r=N.finish(before,cand,base,{ms:Math.min(3500,until-Date.now()),seed:level+tested});
    if(!r.design){note(r.why);return r.why==='twins'?{repair:true}:null;}
    const q={...cand,...r};const cert=P.certify(before,q,base);
    if(!cert.ok){for(const e of cert.errors)note(e);return null;}
    const moved=a.tiles.map((t,i)=>t.some((v,k)=>v!==q.design.tiles[i][k])?i:null).filter(i=>i!=null);
    const record={level,design:q.design,method:cand.method,moved,movedCount:moved.length,relocated:cand.moved,operations:cand.operations,column:cand.col??cand.column??null,row:cand.row??null,hop:cand.hop||null,footprint:F.measure(q.design,{minimum:58}),before:fp.tilePx,facePairsChanged:r.facePairsChanged,storedRoutePlays:r.storedRoutePlays,proof:base.ctx?'own trap proof holds':'older board: recovered special contract holds',certificate:cert};
    fs.writeFileSync(file,JSON.stringify(record,null,1)+'\n');
    return {level,outcome:'narrowed',method:record.method,before:fp.tilePx,after:record.footprint.tilePx,movedCount:moved.length,relocatedCount:cand.moved.length,facePairsChanged:r.facePairsChanged,proof:record.proof,proposals:proposals.out.length,tested,ms:Date.now()-start};
  };
  const repairs=[];
  for(const cand of proposals.out){if(Date.now()>until)break;const r=tryOne(cand);if(r?.outcome)return r;if(r?.repair)repairs.push(cand);}
  for(const cand of repairs){if(Date.now()>until)break;for(const q of repairCandidates(before,cand,base)){if(Date.now()>until)break;const r=tryOne(q);if(r?.outcome)return r;}}
  return {level,outcome:'released',before:fp.tilePx,after:fp.tilePx,reason:Date.now()>until?'Bounded tidy search exhausted its time; no certified replacement':'All tested tidy proposals fail the unchanged trap checks',fails,geometry:proposals.why,proposals:proposals.out.length,tested,ms:Date.now()-start,movedCount:0,facePairsChanged:0};
}
if(!isMainThread){try{parentPort.postMessage(one(workerData.level,workerData));}catch(e){parentPort.postMessage({level:workerData.level,outcome:'released',reason:e.stack});}}
async function main(){
  const levels=arg('levels',Array.from({length:49},(_,i)=>251+i).filter(n=>n%10).join(',')).split(',').map(Number);
  if(process.argv.includes('--recover')){for(const level of levels){const b=P.original(level);if(!b.card?.poolId)continue;try{P.context(b);console.log('Recovered exact historical roles',level);}catch(e){console.log('Recovery failed',level,e.message);}}return;}
  fs.mkdirSync(P.DIR,{recursive:true});let next=0;
  await Promise.all(Array.from({length:+arg('workers',4)},async()=>{while(next<levels.length){const level=levels[next++],ms=+arg('ms',120000);
    const r=await new Promise(resolve=>{const w=new Worker(__filename,{workerData:{level,ms}});let done=false;const end=x=>{if(done)return;done=true;clearTimeout(timer);w.terminate();resolve(x);};const timer=setTimeout(()=>end({level,outcome:'released',reason:'Hard wall exceeded; retain release'}),ms+180000);w.on('message',end);w.on('error',e=>end({level,outcome:'released',reason:e.stack}));w.on('exit',c=>end({level,outcome:'released',reason:'Worker exit '+c}));});
    console.log(JSON.stringify(r));fs.appendFileSync(REPORT,JSON.stringify(r)+'\n');
  }}));
}
if(isMainThread&&require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={one,geoPrep,repairCandidates};
