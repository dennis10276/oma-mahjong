/* Independent checks of shipped levels. node tools/sim/validate_levels.js [table] [runs=300] [jobs=4] [report] */
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm'), {fork}=require('child_process'),crypto=require('crypto');
const L=require('../../www/layouts');
const file=path.resolve(process.argv[2]==='--worker'?process.argv[3]:(process.argv[2]||path.join(__dirname,'../../www/levels-hard.js')));
global.HARD_LEVELS=vm.runInNewContext(fs.readFileSync(file,'utf8')+';HARD_LEVELS');
const H=require('../../www/hard');
const measureSeed=+(process.env.MEASURE_SEED||991331);
const rowHash=lv=>crypto.createHash('sha256').update(JSON.stringify(global.HARD_LEVELS.levels[lv-global.HARD_LEVELS.from])).digest('hex');
function measure(lv,runs) {
 const d=H.get(lv), tiles=d.tiles.map(([x,y,z])=>({x,y,z})), nb=L.neighbors(tiles), down=new Uint8Array(tiles.length); d.down.forEach(i=>down[i]=1);
 const ob=d.obst, rules=ob?{iceNb:L.iceNeighbors(tiles),ice:ob.ice||{},locks:ob.keys&&ob.keys.length?new Set(ob.locks):null,keys:ob.keys||[]}:null;
 const g={tiles,nb,faces:d.faces,down,rules,clock:d.clock};
 const xs=tiles.map(t=>t.x/2-t.z*0.14),ys=tiles.map(t=>t.y/2*1.24-t.z*0.14);
 const tilePx=Math.min(384/(Math.max(...xs)+1-Math.min(...xs)+0.125),592/(Math.max(...ys)+1.24-Math.min(...ys)+0.16));
 const q=p=>H.rate(g,runs,measureSeed+lv,p).rate;
 const row={lv,hash:rowHash(lv),target:H.target(lv),targetStrong:H.target(lv,'strong'),strong:q(H.persona('strong')),sensible:q(H.persona('sensible')),average:q(H.persona('average')),n:tiles.length,
  tilePx,minTile:lv%10===0?48:54,clock:d.clock?d.clock.n:null,proof:lv<H.cfg().rebuildFrom||H.validSolution(g,d.solution),spare:d.clock?d.clock.n-d.solution.indexOf(d.clock.i)-1:null};
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
 const runs=+(process.argv[3]||300),jobs=+(process.argv[4]||4), report=path.resolve(process.argv[5]||path.join(__dirname,'../../analysis/validation-1.47.json'));
 const T=global.HARD_LEVELS, rows=[], from=Math.max(H.cfg().rebuildFrom,T.from),to=T.from+T.levels.length-1;let left=jobs;
 let selected=Array.from({length:to-from+1},(_,i)=>from+i);
 if(process.env.ONLY_LEVELS){const allow=new Set(JSON.parse(process.env.ONLY_LEVELS));selected=selected.filter(lv=>allow.has(lv));}
 if(fs.existsSync(report)){
  const previous=JSON.parse(fs.readFileSync(report,'utf8'));
  if(previous.runs===runs&&previous.seed===measureSeed)rows.push(...previous.rows.filter(r=>selected.includes(r.lv)&&r.hash===rowHash(r.lv)));
 }
 const pending=selected.filter(lv=>!rows.some(r=>r.lv===lv));
 console.log(`${rows.length} unchanged measurements reused; ${pending.length} levels to measure on fresh games`);
 for(let j=0;j<jobs;j++) {
  const w=fork(__filename,['--worker',file]);
  w.on('message',m=>{if(m.error){console.error(m.error);process.exit(1);}if(m.done){w.kill();if(--left===0)done();return;}rows.push(m);if(rows.length%15===0)console.log(`${rows.length}/${to-from+1} independently measured`);});
  w.on('exit',c=>{if(c){console.error('Measurement worker failed',c);process.exit(1);}});
  w.send({runs,levels:pending.filter((_,i)=>i%jobs===j)});
 }
 function done(){
  rows.sort((a,b)=>a.lv-b.lv);fs.writeFileSync(report,JSON.stringify({runs,rows},null,2));
  for(const [lo,hi] of [[80,89],[90,104],[105,119],[120,149],[150,to]]) {
   const r=rows.filter(x=>x.lv>=lo&&x.lv<=hi);if(!r.length)continue;const avg=k=>r.reduce((s,x)=>s+(x[k]||0),0)/r.length;
   console.log(`${lo}-${Math.min(hi,to)} strong ${avg('strong').toFixed(3)} target ${avg('targetStrong').toFixed(3)}; middle ${avg('sensible').toFixed(3)} target ${avg('target').toFixed(3)}`);
  }
  const bad=rows.filter(x=>Math.abs(x.strong-x.targetStrong)>(x.lv<90?0.08:0.10)||Math.abs(x.sensible-x.target)>(x.lv<90?0.08:0.10));
  console.log('Outside per-level tolerance:',bad.map(x=>x.lv).join(',')||'none');
  console.log('Invalid complete solution proofs:',rows.filter(x=>!x.proof).map(x=>x.lv));
  console.log('Report:',report);
  const bands=[[80,89],[90,104],[105,119],[120,149],[150,to]].map(([lo,hi])=>{
   const r=rows.filter(x=>x.lv>=lo&&x.lv<=hi),avg=k=>r.reduce((s,x)=>s+x[k],0)/r.length;
   return {from:lo,to:hi,strong:avg('strong'),targetStrong:avg('targetStrong'),sensible:avg('sensible'),target:avg('target')};
  });
  const drifting=bands.filter(b=>Math.abs(b.strong-b.targetStrong)>0.03||Math.abs(b.sensible-b.target)>0.03);
  console.log('Bands outside 3 percentage points:',drifting.map(b=>b.from+'-'+b.to).join(',')||'none');
  fs.writeFileSync(report,JSON.stringify({runs,seed:measureSeed,bands,rows},null,2));
  const small=rows.filter(x=>x.tilePx<x.minTile-0.001);console.log('Tiles below minimum:',small.map(x=>x.lv).join(',')||'none');
  if(rows.some(x=>!x.proof)||bad.length||drifting.length||small.length)process.exitCode=1;
 }
}
