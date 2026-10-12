/* Tune the board to the clock-focused player, preserving every 1.47 clock and its legal route.
   node tools/sim/tune_boards.js [from=80] [to=269] [jobs=8] [output=www/levels-hard.js] */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),{fork}=require('child_process');
const H=require('../../www/hard'),L=require('../../www/layouts'),{game}=require('./tighten_clocks');
const root=path.resolve(__dirname,'../..'),baseline=path.join(root,'analysis/levels-1.47.js');
const T=vm.runInNewContext(fs.readFileSync(baseline,'utf8')+';HARD_LEVELS');
const profile=H.persona('focused');
const policyFile=path.join(root,'analysis/refinement-policy-1.48.json');
const policy=fs.existsSync(policyFile)?JSON.parse(fs.readFileSync(policyFile)):{};
function sample(d,runs,seed){
 const g=game(d);let wins=0,reached=0,clockLoss=0;
 for(let k=0;k<runs;k++){const r=H.play(g,profile,(seed+d.level)*7919+k*104729);wins+=+r.win;reached+=+(r.at[d.clock.i]>=0);clockLoss+=+(r.why==='clock');}
 return {win:wins/runs,reach:reached/runs,clockLoss:clockLoss/runs,afterClock:reached?wins/reached:0};
}
function frozen(d){return new Set([...d.solution.slice(0,d.solution.indexOf(d.clock.i)+1),...(d.gold||[]),...((d.obst||{}).keys||[])]);}
function checkClockUnchanged(d,old){
 if(JSON.stringify(d.clock)!==JSON.stringify(old.clock)||JSON.stringify(d.tiles)!==JSON.stringify(old.tiles)||JSON.stringify(d.solution)!==JSON.stringify(old.solution))return false;
 for(const i of frozen(old))if(d.faces[i]!==old.faces[i])return false;
 return H.validSolution(game(d),d.solution);
}
module.exports={sample,frozen,checkClockUnchanged};
if(require.main===module&&process.argv[2]==='--worker'){
 process.on('message',({levels,previous})=>{try{
  for(const lv of levels){
   const old=H.unpack(lv,T.levels[lv-T.from]),locked=frozen(old),free=old.faces.map((_,i)=>i).filter(i=>!locked.has(i));
   const buffer=policy[lv]?.clockBuffer||0,margin=policy[lv]?.margin??(lv<90?.05:.07);
   const base64=sample(old,128,731113),base300=sample(old,300,1731113),base600=sample(old,600,2731113),target=H.target(lv,'strong');
   const first=previous[lv]?.attempts||0,rng=L.rng(lv*7919+first*100003+9481);
   const initial=previous[lv]?.row?H.unpack(lv,previous[lv].row):old;
   let current=initial,cm=sample(current,128,731113),best=previous[lv]||null;
   const score=m=>Math.abs(m.win-target)+6*Math.max(0,Math.min(1,base64.reach+buffer)-m.reach-.025)+4*Math.max(0,m.clockLoss-Math.max(0,base64.clockLoss-buffer)-.025);
   let cs=score(cm),closest={d:current,m:cm,score:cs};
   const rejected=new Set(previous[lv]?.rejected||[]),hash=d=>crypto.createHash('sha256').update(JSON.stringify(d.faces)).digest('hex');
   function assess(d,m){
    if(Math.abs(m.win-target)>.11||m.reach<base64.reach-.06||m.clockLoss>base64.clockLoss+.06||rejected.has(hash(d)))return null;
    const mid=sample(d,300,1731113);
    if(Math.abs(mid.win-target)>(lv<90?.07:.09)||mid.reach<base300.reach-.03||mid.clockLoss>base300.clockLoss+.03){rejected.add(hash(d));return null;}
    const final=sample(d,600,2731113);
    if(Math.abs(final.win-target)>margin||final.reach<Math.min(1,base600.reach+buffer)-.02||final.clockLoss>Math.max(0,base600.clockLoss-buffer)+.02){rejected.add(hash(d));return null;}
    d.info.strong=final.win;d.info.rate=H.rate(game(d),600,2731113+lv,H.persona('sensible')).rate;
    return {lv,row:H.pack(d),valid:true,m:final,baseline:base600};
   }
   let accepted=assess(current,cm),attempt=first;
   for(;!accepted&&attempt<first+1200;attempt++){
    let candidate=null;
    for(let tries=0;tries<80;tries++){
     const faces=current.faces.slice(),swaps=1+(rng()<.25?Math.floor(rng()*4):0);
     for(let k=0;k<swaps;k++){const a=free[Math.floor(rng()*free.length)],b=free[Math.floor(rng()*free.length)];[faces[a],faces[b]]=[faces[b],faces[a]];}
     if(faces.every((x,i)=>x===current.faces[i]))continue;
     const d={...old,faces,info:{...old.info}};
     if(H.validSolution(game(d),d.solution)){candidate=d;break;}
    }
    if(!candidate)continue;
    const m=sample(candidate,128,731113),s=score(m);
    if(s<closest.score)closest={d:candidate,m,score:s};
    accepted=assess(candidate,m);
    if(s<cs||rng()<.18*Math.exp((cs-s)/.07)){current=candidate;cm=m;cs=s;}
    if(attempt%100===99){current=closest.d;cm=closest.m;cs=closest.score;}
   }
   if(accepted){if(!checkClockUnchanged(H.unpack(lv,accepted.row),old))throw Error('Clock protection failed '+lv);best={...accepted,attempts:attempt,rejected:[...rejected]};}
   else{closest.d.info.strong=closest.m.win;best={lv,row:H.pack(closest.d),valid:false,m:closest.m,baseline:base600,attempts:attempt,rejected:[...rejected]};}
   process.send(best);
  }
  process.send({done:true});
 }catch(e){process.send({error:e.stack});process.exit(1);}});
}else if(require.main===module){
 const from=+(process.argv[2]||80),to=+(process.argv[3]||269),jobs=+(process.argv[4]||8),output=path.resolve(process.argv[5]||path.join(root,'www/levels-hard.js'));
 const file=path.join(root,'analysis/build-hard-1.48.progress.json');
 const signature=crypto.createHash('sha256').update(fs.readFileSync(__filename)).update(fs.readFileSync(path.join(root,'www/hard.js'))).update(fs.readFileSync(baseline)).update(JSON.stringify(policy)).digest('hex');
 let rows={};if(fs.existsSync(file)){const p=JSON.parse(fs.readFileSync(file));if(p.signature===signature)rows=p.rows;}
 const pending=Array.from({length:to-from+1},(_,i)=>from+i).filter(lv=>!rows[lv]?.valid),started=Date.now();let left=Math.min(jobs,pending.length);
 if(!left)write();
 for(let j=0;j<Math.min(jobs,pending.length);j++){
  const w=fork(__filename,['--worker']);
  w.on('message',m=>{if(m.error){console.error(m.error);process.exit(1);}if(m.done){w.kill();if(--left===0)write();return;}rows[m.lv]=m;fs.writeFileSync(file,JSON.stringify({signature,rows}));console.log(`${Object.values(rows).filter(r=>r.valid&&r.lv>=from&&r.lv<=to).length}/${to-from+1}; level ${m.lv}: focused ${m.m.win.toFixed(3)}, clock reach ${m.m.reach.toFixed(3)} (was ${m.baseline.reach.toFixed(3)}), ${m.attempts} attempts${m.valid?'':' NEEDS REVIEW'}; ${Math.round((Date.now()-started)/1000)}s`);});
  w.on('exit',c=>{if(c){console.error('Tuning worker failed',c);process.exit(1);}});
  w.send({levels:pending.filter((_,i)=>i%jobs===j),previous:rows});
 }
 function write(){
  const bad=Array.from({length:to-from+1},(_,i)=>from+i).filter(lv=>!rows[lv]?.valid);if(bad.length){console.error('Not written; unresolved:',bad.join(','));process.exitCode=1;return;}
  const levels=T.levels.map((row,i)=>i+T.from>=from&&i+T.from<=to?rows[i+T.from].row:row);
  fs.writeFileSync(output,'/* Clock-focused board tuning; 1.47 clock routes and budgets preserved. */\nconst HARD_LEVELS = '+JSON.stringify({...T,v:4,levels})+';\n');
  console.log('Wrote '+output);
 }
}
