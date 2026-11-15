'use strict';
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort,workerData}=require('worker_threads'),P=require('./narrow_proof'),PD=require('./peel_drop'),G=require('./narrow_methods'),Q=require('./finish_ten_proof'),F=require('../footprint');
const OUT=path.resolve(P.DIR,'../../finish-ten'),copy=x=>structuredClone(x);
function search(level,ms=240000){const start=Date.now(),before=P.original(level),a=before.design,base=P.prepare(before),special=new Set([a.clock.i,...a.obst.keys,...a.obst.locks,...Object.keys(a.obst.ice).map(Number)]),M=new Set([...special,...(before.card?.trap?.baits||[]).flatMap(b=>b.tiles)]),faces=new Set([...M].map(i=>a.faces[i])),seeds=[],failures={},input=JSON.parse(fs.readFileSync(path.join(OUT,'user-input.json'))).users[level];let tested=0;
  if(input)seeds.push({name:'Dennis’s saved silhouette and selected finish tiles',tiles:input.positions.map((p,i)=>p||a.tiles[i]),drop:input.erased||[]});
  if(level===251){const T=copy(a.tiles),drop=[3,10,33,40,49];for(let i=0;i<T.length;i++){const [x,y,z]=a.tiles[i];if(z===0){if([0,2,12,14].includes(y)&&x>6)T[i][0]-=2;if(y>=4&&y<=10&&x>=10)T[i][0]-=2;}else if(x>=9)T[i][0]-=2;if(z===1&&y===1)T[i][0]=x-1;}
    seeds.push({name:'Keep the six-tile clock bar, shorten the four supporting rows, use the middle for the finish',tiles:T,drop});
  }
  for(const v of [...PD.variantsRigid(a,M,special),...PD.variantsShift(a,M,new Set(),special),...PD.variantsCut(a,M,special),...PD.variants(a,M,new Set(),special)])seeds.push(v);
  for(const v of seeds){if(Date.now()-start>ms)break;const T=v.tiles||a.tiles,live=T.filter((_,i)=>!v.drop.includes(i));if(!G.valid(live)||!F.measure(live,{minimum:58}).ok)continue;
    for(let seed=0;seed<20&&Date.now()-start<ms;seed++){tested++;let r;try{r=PD.attempt(before,v,{...base,M},faces,special,seed,{keepNearMiss:true});}catch(e){r={why:e.message};}
      if(r.why==='visibleTwins'&&r.nearMiss){const near=r.nearMiss,nearDir=path.join(OUT,'near-miss');fs.mkdirSync(nearDir,{recursive:true});const nearFile=path.join(nearDir,'level-'+level+'.json');if(!fs.existsSync(nearFile))fs.writeFileSync(nearFile,JSON.stringify({level,how:v.name,seed,...near},null,2));const freeze=near.keep.flatMap((old,i)=>faces.has(a.faces[old])?[i]:[]),sep=require('./separate').separate(near.design,{seed:seed+1,wallMs:12000,k:base.k,freeze,validate:d=>{const c=Q.certify(before,d,near.keep,base);return {ok:c.ok,why:c.errors.join(',')};}});if(sep.validated)r={...near,design:sep.design,map:near.keep};}
      if(r.design){const keep=r.map||r.keep||a.tiles.flatMap((_,i)=>r.dropped.includes(i)?[]:[i]),cert=Q.certify(before,r.design,keep,base);if(cert.ok)return {level,ok:true,how:v.name,design:r.design,keep,dropped:r.dropped,certificate:cert,tested,ms:Date.now()-start};r={why:cert.errors.join(',')};}
      if(r.why==='clock route unproven'&&seed<2){const pending=path.join(OUT,'pending');fs.mkdirSync(pending,{recursive:true});fs.writeFileSync(path.join(pending,`level-${level}-${seeds.indexOf(v)}-${seed}.json`),JSON.stringify({level,variant:v,seed}));}
      failures[r.why]=(failures[r.why]||0)+1;
      if(/trap tile|wider|nine|footprint|overlap|nothing/.test(r.why))break;
    }
  }
  return {level,ok:false,tested,seedCount:seeds.length,failures,ms:Date.now()-start};
}
if(!isMainThread&&require.main===module){try{parentPort.postMessage(search(workerData.level,workerData.ms));}catch(e){parentPort.postMessage({level:workerData.level,ok:false,error:e.stack});}}
async function run(){fs.mkdirSync(path.join(OUT,'candidates'),{recursive:true});const arg=process.argv.indexOf('--levels'),levels=(arg>=0?process.argv[arg+1]:'251,267,278,279,288,291,298').split(',').map(Number);let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<levels.length){const level=levels[next++],r=await new Promise(resolve=>{const w=new Worker(__filename,{workerData:{level,ms:240000}});let done=false;const end=x=>{if(done)return;done=true;clearTimeout(timer);w.terminate();resolve(x);};const timer=setTimeout(()=>end({level,ok:false,timeout:true}),300000);w.on('message',end);w.on('error',e=>end({level,ok:false,error:e.message}));});fs.writeFileSync(path.join(OUT,'candidates','level-'+level+'.json'),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({...r,design:undefined,certificate:undefined,keep:undefined}));}}));}
if(isMainThread&&require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});module.exports={search};
