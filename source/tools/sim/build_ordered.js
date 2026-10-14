/* Build local candidates with an honest observer. Never writes the live or staged app.
   node tools/sim/build_ordered.js [jobs=8] [lanes=2] */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),{fork}=require('child_process');
const H=require('../../www/hard'),L=require('../../www/layouts'),{game}=require('./tighten_clocks'),P=require('./ordered_policy');
const root=path.resolve(__dirname,'../..'),baseline=path.join(root,'analysis/levels-1.49.js'),T=vm.runInNewContext(fs.readFileSync(baseline,'utf8')+';HARD_LEVELS');
const hash=d=>crypto.createHash('sha256').update(JSON.stringify([d.tiles,d.faces,d.down,d.clock])).digest('hex');
if(require.main===module&&process.argv[2]==='--worker')process.on('message',({jobs,sources})=>{try{
 for(const job of jobs){
  const goal=P.target(job.goalLevel),rng=L.rng(job.id*99371+18573),seed=P.POLICY.selectionSeed;
  const pool=sources.filter(lv=>P.clockFits(H.unpack(lv,T.levels[lv-T.from]),job.goalLevel));
  if(!pool.length)throw Error('No unchanged clock fits level '+job.goalLevel);
  let result=null,best=null;
  for(let sourceTry=0;sourceTry<12&&!result;sourceTry++){
   const source=pool[(job.id*17+sourceTry*31)%pool.length],old=H.unpack(source,T.levels[source-T.from]),base=P.prepare(old),locked=P.frozen(old),free=base.faces.map((_,i)=>i).filter(i=>!locked.has(i));
   let current=base,cm=P.sample(current,64,seed),score=m=>Math.abs(m.win-goal)+12*Math.max(0,.995-m.reach)+8*Math.max(0,m.clockLoss-.003)+3*Math.max(0,m.blindRate-P.POLICY.maxBlind)+3*Math.max(0,m.unknownShare-P.POLICY.maxUnknown),cs=score(cm),closest={d:current,m:cm,s:cs};
   const assess=(d,m)=>{
    if(Math.abs(m.win-goal)>.08||m.reach<.98||m.clockLoss>.015||m.blindRate>.16||m.unknownShare>.33)return null;
    const measured=P.sample(d,P.POLICY.selectionRuns,seed+7717);
    if(Math.abs(measured.win-goal)>.06||!P.quality(measured))return null;
    if(!P.protectedBoard(d,old))throw Error('Board protection failed');
    return {id:job.id,goalLevel:job.goalLevel,sourceLevel:source,goal,row:H.pack(d),m:measured,hash:hash(d),valid:true};
   };
   result=assess(current,cm);
   for(let attempt=0;attempt<450&&!result;attempt++){
    let candidate=null;
    for(let tries=0;tries<90;tries++){
     const faces=current.faces.slice(),swaps=1+(rng()<.3?Math.floor(rng()*4):0);
     for(let k=0;k<swaps;k++){const a=free[Math.floor(rng()*free.length)],b=free[Math.floor(rng()*free.length)];[faces[a],faces[b]]=[faces[b],faces[a]];}
     if(faces.every((x,i)=>x===current.faces[i]))continue;
     const d={...base,faces};if(H.validSolution(game(d),d.solution)){candidate=d;break;}
    }
    if(!candidate)continue;
    const m=P.sample(candidate,64,seed),s=score(m);
    if(s<closest.s)closest={d:candidate,m,s};
    result=assess(candidate,m);
    if(s<cs||rng()<.15*Math.exp((cs-s)/.055)){current=candidate;cm=m;cs=s;}
    if(attempt%80===79){current=closest.d;cm=closest.m;cs=closest.s;}
   }
   if(!best||closest.s<best.s)best={s:closest.s,m:closest.m,source};
  }
  process.send(result||{id:job.id,goalLevel:job.goalLevel,valid:false,best});
 }
 process.send({done:true});
}catch(e){process.send({error:e.stack});process.exit(1);}});
else if(require.main===module){
 const jobs=+(process.argv[2]||8),lanes=+(process.argv[3]||P.POLICY.lanes),progress=path.join(root,'analysis/build-ordered.progress.json');
 const signature=crypto.createHash('sha256').update(fs.readFileSync(__filename)).update(fs.readFileSync(path.join(__dirname,'ordered_policy.js'))).update(fs.readFileSync(path.join(root,'www/hard.js'))).update(fs.readFileSync(baseline)).update(String(lanes)).digest('hex');
 let rows={};if(fs.existsSync(progress)){const p=JSON.parse(fs.readFileSync(progress));if(p.signature===signature)rows=p.rows;}
 const tasks=Array.from({length:(P.POLICY.to-P.POLICY.from+1)*lanes},(_,id)=>({id,goalLevel:P.POLICY.from+id%(P.POLICY.to-P.POLICY.from+1)})).filter(j=>!rows[j.id]?.valid);
 const sources=[];for(let lv=P.POLICY.from;lv<=P.POLICY.to;lv++){const d=P.prepare(H.unpack(lv,T.levels[lv-T.from]));if(P.tilePx(d)<54)continue;const m=P.sample(d,64,P.POLICY.selectionSeed);if(m.reach>=.98&&m.clockLoss<=.015)sources.push(lv);}
 console.log(`${sources.length} clock-safe source boards; ${Object.values(rows).filter(r=>r.valid).length} reused, ${tasks.length} candidate jobs`);
 let left=Math.min(jobs,tasks.length),start=Date.now();if(!left)done();
 for(let j=0;j<Math.min(jobs,tasks.length);j++){
  const w=fork(__filename,['--worker']);w.on('message',m=>{if(m.error){console.error(m.error);process.exit(1);}if(m.done){w.kill();if(--left===0)done();return;}rows[m.id]=m;fs.writeFileSync(progress,JSON.stringify({signature,rows}));console.log(`${Object.values(rows).filter(r=>r.valid).length}/${(P.POLICY.to-P.POLICY.from+1)*lanes}: goal level ${m.goalLevel}, source ${m.sourceLevel??m.best?.source}, win ${(m.m?.win??m.best?.m?.win).toFixed(3)}${m.valid?'':' UNRESOLVED'}; ${Math.round((Date.now()-start)/1000)}s`);});
  w.on('exit',c=>{if(c){console.error('Candidate worker failed',c);process.exit(1);}});w.send({jobs:tasks.filter((_,i)=>i%jobs===j),sources});
 }
 function done(){const valid=Object.values(rows).filter(r=>r.valid);fs.writeFileSync(path.join(root,'analysis/ordered-candidates.json'),JSON.stringify({signature,modelVersion:H.MODEL_VERSION,policy:P.POLICY,rows:valid},null,2));console.log(`Saved ${valid.length} local candidates; no app table or deployment changed`);}
}
