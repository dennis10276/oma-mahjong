'use strict';
// The same acceptance rules, ordered to avoid planning boards whose mechanisms
// already fail. A skipped skilled measurement is null, never a fabricated score.
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort}=require('worker_threads'),M=require('./meter.js'),B=require('./batch_evaluate.js'),Supports=require('./trap_supports.js'),Evidence=require('./skilled_evidence.js'),Confirm=require('./piece_confirm.js');
const SCHEMA='empirical-confirmation-v1',read=f=>JSON.parse(fs.readFileSync(f));
function confirm(row,meter){
 const key=M.boardKey(row.design),opts={setting:'family',runs:20,seeds:2,seed:4711},base=B.evaluate(row,'rate',meter);
 if(!base.train)return{schema:SCHEMA,id:row.id,key,bot:meter.fingerprint,valid:false,family:null,skilledBot:null,rate:{id:row.id,key,bot:meter.fingerprint,mode:'rate',...base},quality:{id:row.id,key,bot:meter.fingerprint,mode:'quality',...base,supportFingerprint:Supports.fingerprint(row),skilledEvidenceFingerprint:Evidence.fingerprint(row)}};
 const v=base.validation||(()=>{const m=meter.measure(row.design,{...opts,seed:18427});return{exp:m.expectedTries,first:m.firstTryRate,valid:m.valid,seed:18427};})(),rate={id:row.id,key,bot:meter.fingerprint,mode:'rate',...base,validation:v},family=(base.train.exp+v.exp)/2;
 const rejected=(reason,extra={})=>({schema:SCHEMA,id:row.id,key,bot:meter.fingerprint,stage:'family-and-mechanisms',valid:!!base.train.valid&&v.valid,family,skilledBot:null,skilledEffective:null,rate,
  quality:{id:row.id,key,bot:meter.fingerprint,mode:'quality',room:base.room,train:base.train,atTrap:base.atTrap,lateShare:base.lateShare,eligible:false,reason,supportFingerprint:Supports.fingerprint(row),skilledEvidenceFingerprint:Evidence.fingerprint(row),...extra}});
 if(!base.train.valid||!v.valid)return rejected('invalidFamily');
 if(!base.room?.ok||base.room.unrelieved>1||base.atTrap<.6)return rejected('roomOrAttribution');
 const m=meter.measure(row.design,{...opts,capture:'tail'}),support=Supports.measure(row,m,meter,opts),idleSupport=Object.values(support.supports||{}).some(s=>!s.matters);
 if(idleSupport)return rejected('idleSupport',support);
 const special={},d=row.design,ob=d.obst;
 for(const [kind,board] of [
  ...(Object.keys(ob.ice).length?[['ice',{...d,obst:{...ob,ice:{}}}]]:[]),
  ...(ob.locks.length?[['locks',{...d,obst:{...ob,locks:[],keys:[]}}]]:[]),
  ...(d.clock?[['clock',{...d,clock:null}]]:[])]){const x=meter.measure(board,opts);special[kind]={without:x.expectedTries,first:x.firstTryRate,valid:x.valid,matters:x.valid&&(Math.abs(m.expectedTries-x.expectedTries)>=.3||Math.abs(m.firstTryRate-x.firstTryRate)>=.15)};}
 const idle=Object.entries(special).filter(([,s])=>!s.matters).map(([k])=>k);if(idle.length)return rejected('idleSpecial',{...support,special,idle});
 if(row.recipe.some(k=>k==='dontGrab'||k==='keyToEscape')){const forced=meter.measure({...d,clock:{...d.clock,n:1}},opts);if(!forced.valid||forced.expectedTries<m.expectedTries+1)return rejected('clockFirstNotWorse',{...support,special,idle,grabFirst:forced.expectedTries});}
 return{...Confirm.confirm(row,meter),schema:SCHEMA,mechanismPrecheck:true};
}
if(!isMainThread&&require.main===module){const meter=M.createMeter();parentPort.on('message',({row,config})=>{const start=Date.now();try{parentPort.postMessage({...confirm(row,meter),config,seconds:(Date.now()-start)/1000});}catch(e){parentPort.postMessage({id:row.id,config,error:e.stack});}});}
else{
 async function run(rows,dir,jobs=4){if(typeof rows==='string')rows=read(rows);fs.mkdirSync(dir,{recursive:true});const bot=M.createMeter().fingerprint,source=M.sourceHash(__filename),queue=[],results=[];
  for(const row of rows){const config=M.digest({schema:SCHEMA,row,bot,source}),file=path.join(dir,row.id+'.confirm.json'),saved=fs.existsSync(file)?read(file):null;if(saved?.config===config){results.push(saved);}else queue.push({row,config});}
  console.log('Empirical confirmations',queue.length,'new,',results.length,'cached');await Promise.all(Array.from({length:Math.min(jobs,queue.length)},()=>new Promise((resolve,reject)=>{const w=new Worker(__filename);w.on('error',reject);const next=()=>{const job=queue.shift();if(job)w.postMessage(job);else w.terminate().then(resolve,reject);};w.on('message',r=>{M.atomicJson(path.join(dir,r.id+'.confirm.json'),r);if(r.error){w.terminate();reject(Error(r.error));return;}for(const mode of['rate','quality'])M.atomicJson(path.join(dir,r.id+'.'+mode+'.json'),r[mode]);results.push(r);console.log('empirical confirmation',r.id,JSON.stringify({family:r.family,skilled:r.skilledBot,quality:r.quality.eligible,reason:r.quality.reason,seconds:r.seconds}));next();});next();})));
  return results;
 }
 module.exports={SCHEMA,confirm,run};
}
