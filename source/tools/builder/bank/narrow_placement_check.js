'use strict';
const fs=require('fs'),{Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const P=require('./narrow_proof'),E=require('../engine'),M=require('./narrow_placement_model');
function check(row,snapshot,opts={}){
  const s=M.validate(row,snapshot),incomplete=M.incomplete(s.positions);if(incomplete)return incomplete;
  const design={...M.copy(M.designFor(row,s)),tiles:s.positions};
  if(!require('./narrow_methods').valid(design.tiles)){
    const bad=new Set();for(let i=0;i<design.tiles.length;i++){if(!M.supported(design.tiles.filter((_,j)=>j!==i),design.tiles[i]))bad.add(i);for(let j=0;j<i;j++)if(design.tiles[i][2]===design.tiles[j][2]&&M.overlap(design.tiles[i],design.tiles[j])){bad.add(i);bad.add(j);}}
    return {status:'failed',ok:false,message:'Some tiles overlap or lack support. Your arrangement is saved.',tiles:[...bad]};
  }
  const before=opts.prepared?.before||P.original(row.level),base=opts.prepared?.base||P.prepare(before),g=E.game(design,{strict:true}),prefix=before.design.solution.slice(0,before.design.solution.indexOf(before.design.clock.i)+1);let state=E.start(g);
  const core=[...base.M].sort((a,b)=>a-b),oldLinks=P.relations(E.game(before.design),core),newLinks=P.relations(g,core),changed=new Set();
  for(let i=0;i<oldLinks.length;i++)if(JSON.stringify(oldLinks[i])!==JSON.stringify(newLinks[i])){changed.add(oldLinks[i][0]);changed.add(oldLinks[i][1]);}
  if(changed.size){const details=[];for(let i=0;i<oldLinks.length;i++){const a=oldLinks[i],b=newLinks[i];for(const [k,subject,other,verb]of[[2,a[1],a[0],'covers'],[3,a[0],a[1],'covers'],[4,a[1],a[0],'helps thaw'],[5,a[0],a[1],'helps thaw']])if(a[k]!==b[k])details.push(`Tile ${subject} ${b[k]?'now':'no longer'} ${verb} tile ${other}.`);}return {status:'failed',ok:false,message:'Connections used by the trap changed:\n'+details.slice(0,5).join('\n')+(details.length>5?`\nAnd ${details.length-5} more changes.`:''),tiles:[...changed],errors:['trapRelations'],details};}
  for(const i of prefix){try{state=E.step(g,state,i)}catch{state=null;}if(!state)break;}
  let route=prefix;
  if(!state){const shortest=E.clockShortest(g,{nodes:1000000,ms:10000});if(!shortest||shortest.unsure)return {status:'unknown',ok:false,message:'A clock route could not be proved within the check budget. Your arrangement is saved.'};route=E.flatten(shortest.path);}
  // exactRoute can return the shortest route even when it misses this clock's
  // deadline. Do not pass that route to a tail search as a legal boundary.
  const clockAt=route.indexOf(design.clock.i);if(clockAt<0||clockAt+1>design.clock.n)return {status:'failed',ok:false,message:`The earliest proven clock route needs ${clockAt+1} moves; the clock allows ${design.clock.n}.`,errors:['clockDeadline'],tiles:[design.clock.i]};
  route=route.slice(0,clockAt+1);let boundary=E.start(g);
  for(const id of route){try{boundary=E.step(g,boundary,id)}catch{boundary=null;}if(!boundary)break;}
  if(!boundary)return {status:'unknown',ok:false,message:'The clock route could not be replayed. Your arrangement is saved.',errors:['clockRouteReplay']};
  if(!E.replay(design,design.solution,{strict:true}).ok||JSON.stringify(design.solution.slice(0,route.length))!==JSON.stringify(route)){
    const ordered={...design,solution:route.concat(design.solution.filter(i=>!route.includes(i)))},tail=require('./tail').cappedTail(ordered,3,{peek:false,nodes:1000000,ms:opts.tailMs??12000});
    if(tail.result!=='win')return {status:tail.result==='unknown'?'unknown':'failed',ok:false,message:tail.result==='unknown'?'The finish needs more checking; no win has been proved.':'No winning finish was found with these pictures and this clock.',detail:tail.result};
    design.solution=tail.solution;
  }
  // The workshop permits changed side access only after independently
  // rechecking clock cost, special dependencies/effects and authored baits.
  // Automatic/export certification retains its stricter default policy.
  const certificate=P.certify(before,{design},base,{reviewSideChanges:true});
  if(!certificate.ok){
    const unknown=certificate.baits?.some(p=>!p.before.exact||!p.after.exact)||(certificate.errors.includes('clockMinimum')&&certificate.k==null)||certificate.ablations?.some(p=>p[2]==null)||certificate.errors.some(e=>/unknown|unproven/i.test(e));
    const reasons={clockMinimum:`The minimum moves to reach the clock changed: ${base.k} before, ${certificate.k??'not proved'} now.`,specialEffects:'Removing ice or locks no longer has the same effect on the clock route.',specialRoleOrder:'The required order of the special tiles changed.',visibleTwins:'Extra matching pictures are visible beside each other.',footprint:'The layout is below 58 px or exceeds eight rows on the reference phone.'};
    return {status:unknown?'unknown':'failed',ok:false,message:unknown?'Some checks could not be proved within the budget. Your arrangement is saved; this is not a pass.':certificate.errors.map(e=>reasons[e]||(/badge:/.test(e)?'A special badge is hidden.':e.startsWith('baitPrice:')?'A tempting wrong choice no longer has the same cost.':e.startsWith('ownTrapProof:')?'An authored trap dependency changed: '+e.slice(13):e)).join('\n'),tiles:[...new Set(certificate.errors.flatMap(e=>e.startsWith('badge:')?[Number(e.split(':')[1])]:e.startsWith('baitPrice:')?e.slice(10).split(',').map(Number):[]))],errors:certificate.errors,checks:certificate.checks,notices:certificate.notices};
  }
  return {status:'passed',ok:true,message:'Trap behaviour checks pass and the complete finish is proven. Pictures, specials and clock are unchanged.'+(certificate.notices.length?' Side access changed; the clock, special effects and authored bait costs were checked again.':''),design,certificate};
}
if(!isMainThread&&require.main===module){try{parentPort.postMessage(check(workerData.row,workerData.snapshot));}catch(e){parentPort.postMessage({status:'unknown',ok:false,message:'The check could not finish.',error:e.message});}}
if(isMainThread&&require.main===module){
  const [input,output]=process.argv.slice(2),job=JSON.parse(fs.readFileSync(input));let finished=false;const worker=new Worker(__filename,{workerData:job});
  const done=r=>{if(finished)return;finished=true;clearTimeout(timer);worker.terminate();fs.writeFileSync(output,JSON.stringify({...r,checkerVersion:2,level:job.row.level,placementKey:M.key(job.snapshot),checkedAt:new Date().toISOString()},null,2)+'\n');};
  const timer=setTimeout(()=>done({status:'unknown',ok:false,message:'The check reached its time limit; it is not a pass. Your arrangement is saved.'}),45000);
  worker.on('message',done);worker.on('error',e=>done({status:'unknown',ok:false,message:e.message}));worker.on('exit',code=>{if(!finished)done({status:'unknown',ok:false,message:'Checker stopped before proving the arrangement ('+code+').'});});
}
module.exports={check};
