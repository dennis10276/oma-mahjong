'use strict';
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort}=require('worker_threads');
const I=require('../lab/ideas.js'),P=require('./pieces.js'),F=require('./pressure_frame.js'),M=require('./meter.js');
const read=f=>JSON.parse(fs.readFileSync(f)),VERSION='framed-piece-experiment-v1';
function grid(){return [.1,.2,.3].flatMap(share=>[0,2,4].map(depth=>({share,depth,spare:1})));}
function settings(common){const singles=Object.entries(P.CATALOGUE).flatMap(([name,s])=>[...new Map([...s.grid,s.defaults].map(params=>[JSON.stringify(params),params])).values()].map(params=>({kind:'conditional-single',pieces:[{name,params}]})));
 const pairs=common.flatMap((a,i)=>common.slice(i+1).map(b=>({kind:'conditional-pair',pieces:[a,b].sort((x,y)=>x==='clock'?-1:y==='clock'?1:common.indexOf(x)-common.indexOf(y)).map(name=>({name,params:P.CATALOGUE[name].defaults}))})));
 return [...singles,...pairs];}
function apply(base,framed,op,seed,options={}){
 if(op.name==='wrongClock'){const neutral=I.clone(framed);neutral.clock=null;delete neutral.clockMate;delete neutral.pieceInstances;return P.place(op.name,neutral,P.wayFor(neutral),op.params,I.rngOf(seed));}
 if(['clock','clockWay'].includes(op.name)){
  const old=framed.pressureFrame.requested,requested={...old,spare:op.params.spare??old.spare,...(op.name==='clock'?{depth:op.params.depth}:op.name==='clockWay'?{share:op.params.share}:{depth:0})};
  const out=F.construct(base,requested,seed,{milliseconds:1500,...options});if(!out)return null;
  const patch=P.diff(framed,out);if(!patch.length)return null;
  out.pieceInstances=[{id:M.digest([op,seed,patch]).slice(0,16),name:op.name,params:op.params,owned:[...new Set(patch.flatMap(p=>p.path.length===2?[p.path[1]]:p.path[0]==='clock'?[p.before?.i,p.after?.i].filter(Number.isInteger):p.path[0]==='clockMate'?[p.before,p.after].filter(Number.isInteger):[]))],patch,frameReplacement:true}];return out;
 }
 return P.place(op.name,framed,P.wayFor(framed),op.params,I.rngOf(seed));
}
function construct(job){
 if(job.mode==='frame'){
  const board=F.construct(job.base.design,job.requested,job.seed,job.options);if(!board)return{rows:[],failure:{base:job.base.id,requested:job.requested,reason:'No proven route within exact depth/share and construction budget'}};
  return{rows:[1,2,3].map(spare=>{const design=F.grade(board,spare),requested={...job.requested,spare};return{id:M.digest([job.base.id,requested]).slice(0,20),kind:'frame',base:job.base.id,shape:job.base.shape,layout:job.base.layout,requested,realized:F.describe(design),design,pieces:[]};})};
 }
 let design=I.clone(job.frame.design);for(const op of job.spec.pieces){const seed=parseInt(M.digest([job.frame.id,op]).slice(0,7),16)+1;design=apply(job.base.design,design,op,seed);if(!design)return{rows:[],failure:{frame:job.frame.id,spec:job.spec,failed:op.name}};}
 return{rows:[{id:M.digest([job.frame.id,job.spec]).slice(0,20),kind:job.spec.kind,base:job.frame.id,calibrationFrame:job.frame.id,shape:job.frame.shape,layout:job.frame.layout,pieces:job.spec.pieces,design,realizedFrame:F.describe(design)}]};
}
if(!isMainThread&&require.main===module)parentPort.on('message',job=>{const started=Date.now();try{parentPort.postMessage({...construct(job),job:job.key,seconds:(Date.now()-started)/1000});}catch(e){parentPort.postMessage({job:job.key,error:e.stack});}});
else{
 async function build(jobs,dir,workers=4){fs.mkdirSync(dir,{recursive:true});const config=M.digest({version:VERSION,jobs,source:M.sourceHash(__filename)}),file=path.join(dir,'construction.json'),state=fs.existsSync(file)?read(file):{config,done:[],rows:[],failures:[]};if(state.config!==config)throw Error('Frame construction changed; use a new directory');const queue=jobs.filter(j=>!state.done.includes(j.key));
  console.log('Frame construction',queue.length,'jobs remaining');await Promise.all(Array.from({length:Math.min(workers,queue.length)},()=>new Promise((resolve,reject)=>{const w=new Worker(__filename);w.on('error',reject);const next=()=>{const j=queue.shift();if(j)w.postMessage(j);else w.terminate().then(resolve,reject);};w.on('message',r=>{if(r.error){w.terminate();reject(Error(r.error));return;}state.done.push(r.job);state.rows.push(...r.rows);if(r.failure)state.failures.push(r.failure);M.atomicJson(file,state);console.log('frame construction',state.done.length,r.rows.length,r.seconds+'s');next();});next();})));
  M.atomicJson(path.join(dir,'input.json'),state.rows);return state;
 }
 function frameJobs(bases){return bases.flatMap(base=>grid().map(requested=>({mode:'frame',key:M.digest([base.id,requested]),base,requested,seed:parseInt(M.digest([base.id,requested.share,requested.depth]).slice(0,7),16)+1})));}
 function conditionalJobs(bases,frames,common){return frames.flatMap(frame=>settings(common).map(spec=>({mode:'conditional',key:M.digest([frame.id,spec]),base:bases.find(b=>b.id===frame.base),frame,spec})));}
 module.exports={VERSION,grid,settings,apply,construct,build,frameJobs,conditionalJobs};
}
