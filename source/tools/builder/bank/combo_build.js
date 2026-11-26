'use strict';
/* 350-370: chains that combine several wrong ideas (Dennis 2026-11-16: "combine all the ideas together in chains from 350+ and you
   can add the gemini layouts if they feel good"). Base chain (one wrong idea of its own: lookalike / waiting twin / clock roof) plus
   two or more Task 18 link kinds (three of a kind, the melter's twin under the ice, count the clock), on Gemini's six-wide layouts
   (data/layouts-6wide.json, wip/gemini-six-wide 106be26f) placed after the old catalogue (layout index 1000 + i).
     node source/tools/builder/bank/combo_build.js --jobs <jobs.json> [--workers 3] [--ms 60000] [--minutes 20]
   jobs: [{ base, links:[..], layout, seed, idea:'existing' }]; use --output <dir> for a fresh run.
   Build -> finish (3-5 pressure parks for known ideas, 2 when the job marks the idea as new) -> independent verify (verify_chained_v2.js); only verified boards go to checked/. */
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const OUT=path.resolve(__dirname,'../../../analysis/builder/bank/combo-350');
const DATA=path.resolve(__dirname,'../../../analysis/builder/data');
const EXTRA=[['layouts-6wide.json',1000,'six-'],['layouts-6wide-extra-72plus.json',2000,'extra-']];   // Gemini G14 (48) and Antigravity's extra (31 with 72+ tiles), 2026-11-16
const nameOf=j=>(j.base||'')+(j.lookalike?'+look':'')+(j.newIdea?'+'+j.newIdea:'')+(j.links.length?(j.base?'_':'')+j.links.join('_'):'');
// Dennis 2026-11-16: "We should chain the 37 together in different ways." A mix = one base chain (its gates and its own wrong
// idea: waiting twin / clock roof / lookalike / two fronts / inner ice) + optionally the lookalike key pair on top (repeat),
// + optionally one of the approved new ideas (pairedFalseMelt, sharedThawDetour, roofBeforeSide, twinChase, splitPreparation),
// + any Task 18 links. The constructor already applies repeat, newIdea and sixIdeas as independent stages; the proof checks each.
function registerMix(M,j,name){
  if(M.FAMILIES[name])return;
  const SH=require('../chained_shapes.js').SHAPES,old=SH[j.base];if(!old)throw Error('unknown base '+j.base);
  let f=j.links.length?require('../chained_six_specs.js').compose(name,j.base,j.links,old):{...old,name,trapType:'chained:'+name};
  const look=j.lookalike&&old.mode!=='repeatKeys'&&!old.repeat;
  f={...f,name,repeat:f.repeat||look,signature:f.signature+(look?'; keyPair<lookalikeChoice':'')+(j.newIdea?'; route<'+j.newIdea:''),
     links:(f.links||0)+(look?1:0)+(j.newIdea?1:0),...(j.newIdea?{newIdea:j.newIdea}:{}),mixOf:{base:j.base,lookalike:!!look,newIdea:j.newIdea||null,links:j.links}};
  SH[name]=M.FAMILIES[name]=f;
  M.STORIES[name]={title:name,sentence:f.see,spec:{},place:(c,b,r)=>M.place(name,c,b,r),prove:(d,r,c)=>M.prove(name,d,r,c),profile:'traps-v1'};
  require('../builder.js').STORIES[name]=M.STORIES[name];
}
function setup(){
  const B=require('../builder.js');
  for(const [f,at,pre] of EXTRA)if(!B.LAYOUTS[at])JSON.parse(fs.readFileSync(path.join(DATA,f),'utf8')).forEach((l,i)=>{B.LAYOUTS[at+i]={...l,shape:pre+l.shape};});
  return {B,M:require('../trap_mixes.js')};
}
if(!isMainThread){
  try{
    const j=workerData,{M}=setup(),name=nameOf(j),out=j.out??OUT;
    if(j.base&&!j.lookalike&&!j.newIdea&&!j.links.length){}else if(j.base&&(j.lookalike||j.newIdea))registerMix(M,j,name);
    else try{M.registerChain(name,{base:j.base||null,links:j.links});}catch(e){if(!/already registered/.test(e.message))throw e;}
    const targets = { digBefore:[2,8], maxDown:.2, ...j.targets,
      ordinaryTileFloor:true, bigTileFloor:true, requireSupportedLayout:true, allowCoveredSpecials:true, rejectOpeningSweep:true, finishAfterTrap:true };
    let r=M.build(name,{layout:j.layout,seed:j.seed,narrowSelfLock:true,obviousnessDial:2,frame:{spare:1},targets},{tries:250,wallMs:j.ms-500,onAttempt:x=>parentPort.postMessage({progress:x})});
    if(r.design){
      r.roles.locks=[...r.roles.locks];r.roles.holderSpecials=[...r.roles.holderSpecials];
      fs.writeFileSync(path.join(out,'raw',`${name}-L${j.layout}-s${j.seed}.json`),JSON.stringify(r));
      const tow=require('./detower.js').shape(r.design.tiles).straight;
      if(tow){parentPort.postMessage({result:{fail:'towers:'+tow}});return;}
      const DT=require('./detower.js'),T=r.design.tiles,hang=T.filter((p,i)=>!DT.supportedAt(T,p,i)).length;   // every corner must rest on a tile one layer down (released boards always do)
      if(hang){parentPort.postMessage({result:{fail:'hanging:'+hang}});return;}
      const raw=JSON.parse(JSON.stringify(r));
      const f=require('../chained_v2_finish.js').finish(raw,{seed:j.seed,tuneMs:30000,repairMs:20000,idea:j.idea??'existing'});
      if(!f.design)r={fail:'finish:'+(f.fail||'?')};
      else{const v=require('../verify_chained_v2.js').verify(f);r=v.ok?f:{fail:'verify',errors:v.errors};if(v.ok)f.verification=v;}
    }
    parentPort.postMessage({result:r});
  }catch(e){parentPort.postMessage({result:{fail:'exception',detail:e.stack}});}
}
function job(j){return new Promise(res=>{let done=false,progress;const w=new Worker(__filename,{workerData:j});
  const end=r=>{if(done)return;done=true;clearTimeout(t);w.terminate();res({...r,progress});};
  const t=setTimeout(()=>end({fail:'hardWall'}),j.ms+90000);
  w.on('message',m=>m.progress?progress=m.progress:end(m.result));w.on('error',e=>end({fail:'exception',detail:e.stack}));w.on('exit',c=>end({fail:'exit:'+c}));});}
async function main(){
  const a=process.argv.slice(2),arg=(n,d)=>{const i=a.indexOf('--'+n);return i<0?d:a[i+1];};
  const out=path.resolve(arg('output',OUT));
  for(const p of ['raw','checked','runs'])fs.mkdirSync(path.join(out,p),{recursive:true});
  const jobs=JSON.parse(fs.readFileSync(arg('jobs'),'utf8')),workers=+arg('workers',3),ms=+arg('ms',60000),until=Date.now()+ +arg('minutes',20)*60000;
  const log=path.join(out,'runs',`build-${Date.now()}.jsonl`);let cur=0;
  await Promise.all(Array.from({length:workers},async()=>{while(cur<jobs.length&&Date.now()<until){
    const j={seed:1,...jobs[cur++],ms,out},name=nameOf(j),file=`${name}-L${j.layout}-s${j.seed}.json`;
    const checked=path.join(out,'checked',file);
    if(fs.existsSync(checked)){
      const prior=JSON.parse(fs.readFileSync(checked,'utf8'));
      const targets=prior.brief?.targets;
      if(prior.card?.finishProfile===(j.idea??'existing')+'-idea'&&targets?.finishAfterTrap&&targets?.rejectOpeningSweep&&targets?.requireSupportedLayout&&targets?.allowCoveredSpecials&&targets?.bigTileFloor
          && Object.entries(j.targets??{}).every(([key,value])=>JSON.stringify(targets[key])===JSON.stringify(value)))continue;
    }
    const r=await job(j),row={name,layout:j.layout,seed:j.seed,ok:!!r.design,fail:r.fail,errors:r.errors,detail:r.detail&&r.detail.slice(0,300),fails:r.progress&&(r.progress.fails||r.progress),wall:r.wall};
    if(r.design)fs.writeFileSync(checked,JSON.stringify(r));
    fs.appendFileSync(log,JSON.stringify(row)+'\n');console.log(JSON.stringify(row));
  }}));
}
if(isMainThread&&require.main===module)main();
module.exports={setup,nameOf};
