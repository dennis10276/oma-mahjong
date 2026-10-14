/* Independent checks of shipped levels. node tools/sim/validate_levels.js [table] [runs=300] [jobs=4] [report] */
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm'), {fork}=require('child_process');
const L=require('../../www/layouts');
const file=path.resolve(process.argv[2]==='--worker'?process.argv[3]:(process.argv[2]||path.join(__dirname,'../../www/levels-hard.js')));
global.HARD_LEVELS=vm.runInNewContext(fs.readFileSync(file,'utf8')+';HARD_LEVELS');
const H=require('../../www/hard');
const measureSeed=+(process.env.MEASURE_SEED||991331);
function measure(lv,runs) {
 const d=H.get(lv), tiles=d.tiles.map(([x,y,z])=>({x,y,z})), nb=L.neighbors(tiles), down=new Uint8Array(tiles.length); d.down.forEach(i=>down[i]=1);
 const ob=d.obst, rules=ob?{iceNb:L.iceNeighbors(tiles),ice:ob.ice||{},locks:ob.keys&&ob.keys.length?new Set(ob.locks):null,keys:ob.keys||[]}:null;
 const g={tiles,nb,faces:d.faces,down,rules,clock:d.clock};
 const q=p=>H.rate(g,runs,measureSeed+lv,p).rate;
 const row={lv,target:H.target(lv),targetStrong:H.target(lv,'strong'),strong:q(H.persona('strong')),sensible:q(H.persona('sensible')),average:q(H.persona('average')),n:tiles.length,
  clock:d.clock?d.clock.n:null,proof:lv<H.cfg().rebuildFrom||H.validSolution(g,d.solution),spare:d.clock?d.clock.n-d.solution.indexOf(d.clock.i)-1:null};
 if(d.clock) {
  const p={...H.persona('strong'),temp:0.7,clockFocus:4};
  row.focused=q(p); row.noClock=H.rate({...g,clock:null},runs,measureSeed+lv,H.persona('strong')).rate;
  let fails=0; for(let k=0;k<100;k++) if(H.play(g,H.persona('strong'),912301+lv*1009+k).why==='clock') fails++;
  row.clockFail=fails/100;
 }
 return row;
}
if(process.argv[2]==='--worker') process.on('message',({levels,runs})=>{try{for(const lv of levels)process.send(measure(lv,runs));process.send({done:true});}catch(e){process.send({error:e.stack});process.exit(1);}});
else {
 const runs=+(process.argv[3]||300),jobs=+(process.argv[4]||4), report=path.resolve(process.argv[5]||path.join(__dirname,'../../analysis/validation-1.46.json'));
 const T=global.HARD_LEVELS, rows=[], from=Math.max(H.cfg().rebuildFrom,T.from),to=T.from+T.levels.length-1;let left=jobs;
 for(let j=0;j<jobs;j++) {
  const w=fork(__filename,['--worker',file]);
  w.on('message',m=>{if(m.error){console.error(m.error);process.exit(1);}if(m.done){w.kill();if(--left===0)done();return;}rows.push(m);if(rows.length%15===0)console.log(`${rows.length}/${to-from+1} independently measured`);});
  w.on('exit',c=>{if(c){console.error('Measurement worker failed',c);process.exit(1);}});
  w.send({runs,levels:Array.from({length:to-from+1},(_,i)=>from+i).filter((_,i)=>i%jobs===j)});
 }
 function done(){
  rows.sort((a,b)=>a.lv-b.lv);fs.writeFileSync(report,JSON.stringify({runs,rows},null,2));
  for(const [lo,hi] of [[80,84],[85,99],[100,119],[120,149],[150,to]]) {
   const r=rows.filter(x=>x.lv>=lo&&x.lv<=hi);if(!r.length)continue;const avg=k=>r.reduce((s,x)=>s+(x[k]||0),0)/r.length;
   console.log(`${lo}-${Math.min(hi,to)} strong ${avg('strong').toFixed(3)} target ${avg('targetStrong').toFixed(3)}; middle ${avg('sensible').toFixed(3)} target ${avg('target').toFixed(3)}`);
  }
  const bad=rows.filter(x=>Math.abs(x.strong-x.targetStrong)>(x.lv<90?0.08:0.10)||Math.abs(x.sensible-x.target)>(x.lv<90?0.08:0.10));
  console.log('Outside per-level tolerance:',bad.map(x=>x.lv).join(',')||'none');
  console.log('Invalid complete solution proofs:',rows.filter(x=>!x.proof).map(x=>x.lv));
  console.log('Report:',report);
  if(rows.some(x=>!x.proof))process.exitCode=1;
 }
}
