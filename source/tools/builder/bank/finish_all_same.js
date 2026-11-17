'use strict';
process.env.FINISH_ALL='1';process.env.MECH='1';process.env.NARROW_TRAP='core';process.env.DEBUG='1';
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const OUT=path.resolve(__dirname,'../../../analysis/builder/finish-all/same');fs.mkdirSync(OUT,{recursive:true});
function one(lv){const P=require('./finish_all_sources'),D=require('./detower'),T=require('./shape_bench_tools'),Q=require('./towers_proof'),F=require(D.CF+'../footprint'),E=require(D.CF+'../engine'),S=require('./shape_bench');
 const before=P.original(lv),a=before.design,base=P.prepare(before),keep=a.tiles.map((_,i)=>i),fit=T.geometry(a),understood={clock:base.k,spare:a.clock.n-base.k,route:S.explainRoute(a),dependencies:S.depTree(a,a.clock.i,4),baits:before.card?.trap?.baits};
 if(lv%10===0)return{level:lv,source:lv,ok:E.replay(a,a.solution,{strict:true}).ok&&D.shape(a.tiles).straight===0&&F.measure(a,{minimum:52}).tilePx>=52,method:'tenth-source',design:a,keep,understood,shape:fit};
 if(fit.ok){const certificate=Q.certify(before,a,keep,base);return{level:lv,source:lv,ok:certificate.ok,method:'already-fits',design:a,keep,certificate,understood,shape:fit};}
 const r=D.bandRun(lv,{relaxed:true,widths:[13,12],trimOptions:12,tries:8,trimOrder:'right'});
 if(r.ok){const certificate=Q.certify(before,r.design,r.keep,base);return{...r,ok:certificate.ok,method:'same-trap-bands',certificate,understood,shape:T.geometry(r.design)};}
 const closest=(r.tried||[]).filter(t=>t.design).sort((a,b)=>(a.errors?.length??99)-(b.errors?.length??99))[0];
 return{level:lv,ok:false,source:lv,method:'same-trap-bands',understood,closest,attempts:(r.tried||[]).map(t=>({W:t.W,errors:t.errors,why:t.why,cut:t.cut}))};
}
if(!isMainThread&&require.main===module){try{parentPort.postMessage(one(workerData));}catch(e){parentPort.postMessage({level:workerData,ok:false,error:e.stack});}}
else if(require.main===module)(async()=>{const levels=process.argv.slice(2).map(Number),list=levels.length?levels:Array.from({length:49},(_,i)=>301+i);let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<list.length){const lv=list[next++],file=path.join(OUT,`level-${lv}.json`);if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file)).ok){console.log(lv,'cached');continue;}const r=await new Promise(resolve=>{const w=new Worker(__filename,{workerData:lv});let done=false;const end=x=>{if(done)return;done=true;clearTimeout(timer);w.terminate();resolve(x);},timer=setTimeout(()=>end({level:lv,ok:false,error:'180-second same-trap stage deadline'}),180000);w.on('message',end);w.on('error',e=>end({level:lv,ok:false,error:e.message}));});fs.writeFileSync(file,JSON.stringify(r,null,1));console.log(JSON.stringify({level:lv,ok:r.ok,method:r.method,px:r.shape?.px,error:r.error?.slice(0,180),why:r.attempts?.slice(0,2)}));}}));})();
module.exports={one,OUT};
