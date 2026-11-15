'use strict';
const fs=require('fs'),{Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const P=require('./narrow_proof'),E=require('../engine'),M=require('./narrow_placement_model');
function check(row,snapshot){
  const s=M.validate(row,snapshot),missing=s.positions.map((p,i)=>p?null:i).filter(i=>i!=null);if(missing.length)return {status:'incomplete',ok:false,message:`Place the remaining ${missing.length} tiles first.`,tiles:missing};
  const design={...M.copy(row.base),tiles:s.positions};
  if(!require('./narrow_methods').valid(design.tiles)){
    const bad=new Set();for(let i=0;i<design.tiles.length;i++){if(!M.supported(design.tiles.filter((_,j)=>j!==i),design.tiles[i]))bad.add(i);for(let j=0;j<i;j++)if(design.tiles[i][2]===design.tiles[j][2]&&M.overlap(design.tiles[i],design.tiles[j])){bad.add(i);bad.add(j);}}
    return {status:'failed',ok:false,message:'Some tiles overlap or lack support. Your arrangement is saved.',tiles:[...bad]};
  }
  const before=P.original(row.level),base=P.prepare(before),g=E.game(design,{strict:true}),prefix=before.design.solution.slice(0,base.k);let state=E.start(g);
  const core=[...base.M].sort((a,b)=>a-b),oldLinks=P.relations(E.game(before.design),core),newLinks=P.relations(g,core),changed=new Set();
  for(let i=0;i<oldLinks.length;i++)if(JSON.stringify(oldLinks[i])!==JSON.stringify(newLinks[i])){changed.add(oldLinks[i][0]);changed.add(oldLinks[i][1]);}
  if(changed.size)return {status:'failed',ok:false,message:'Some cover or thaw connections inside the trap changed. Review the marked tiles.',tiles:[...changed],errors:['trapRelations']};
  for(const i of prefix){try{state=E.step(g,state,i)}catch{state=null;}if(!state)break;}
  let route=prefix;
  if(!state){const shortest=E.clockShortest(g,{nodes:1000000,ms:10000});if(!shortest||shortest.unsure)return {status:'unknown',ok:false,message:'A clock route could not be proved within the check budget. Your arrangement is saved.'};route=E.flatten(shortest.path);}
  if(!E.replay(design,design.solution,{strict:true}).ok||JSON.stringify(design.solution.slice(0,route.length))!==JSON.stringify(route)){
    const ordered={...design,solution:route.concat(design.solution.filter(i=>!route.includes(i)))},tail=require('./tail').cappedTail(ordered,3,{peek:false,nodes:1000000,ms:12000});
    if(tail.result!=='win')return {status:tail.result==='unknown'?'unknown':'failed',ok:false,message:tail.result==='unknown'?'The finish needs more checking; no win has been proved.':'No winning finish was found with these pictures and this clock.',detail:tail.result};
    design.solution=tail.solution;
  }
  const certificate=P.certify(before,{design},base);
  if(!certificate.ok){
    const unknown=certificate.baits?.some(p=>!p.before.exact||!p.after.exact)||(certificate.errors.includes('clockMinimum')&&certificate.k==null)||certificate.ablations?.some(p=>p[2]==null)||certificate.errors.some(e=>/unknown|unproven/i.test(e));
    return {status:unknown?'unknown':'failed',ok:false,message:unknown?'Some checks could not be proved within the budget. Your arrangement is saved; this is not a pass.':'This placement does not preserve all trap checks. Your arrangement is saved.',tiles:[...new Set(certificate.errors.flatMap(e=>e.startsWith('badge:')?[Number(e.split(':')[1])]:e.startsWith('baitPrice:')?e.slice(10).split(',').map(Number):[]))],errors:certificate.errors,checks:certificate.checks};
  }
  return {status:'passed',ok:true,message:'Trap checks pass and the complete finish is proven. Pictures, specials and clock are unchanged.',design,certificate};
}
if(!isMainThread){try{parentPort.postMessage(check(workerData.row,workerData.snapshot));}catch(e){parentPort.postMessage({status:'unknown',ok:false,message:'The check could not finish.',error:e.message});}}
if(isMainThread&&require.main===module){
  const [input,output]=process.argv.slice(2),job=JSON.parse(fs.readFileSync(input));let finished=false;const worker=new Worker(__filename,{workerData:job});
  const done=r=>{if(finished)return;finished=true;clearTimeout(timer);worker.terminate();fs.writeFileSync(output,JSON.stringify({...r,level:job.row.level,placementKey:M.key(job.snapshot),checkedAt:new Date().toISOString()},null,2)+'\n');};
  const timer=setTimeout(()=>done({status:'unknown',ok:false,message:'The check reached its time limit; it is not a pass. Your arrangement is saved.'}),45000);
  worker.on('message',done);worker.on('error',e=>done({status:'unknown',ok:false,message:e.message}));worker.on('exit',code=>{if(!finished)done({status:'unknown',ok:false,message:'Checker stopped before proving the arrangement ('+code+').'});});
}
module.exports={check};
