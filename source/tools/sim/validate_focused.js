/* Independent clock-focused validation, comparing each board with its 1.47 clock challenge.
   node tools/sim/validate_focused.js [table=www/levels-hard.js] [runs=600] [jobs=8] [report] */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),{fork}=require('child_process');
const H=require('../../www/hard'),{game}=require('./tighten_clocks'),{sample,checkClockUnchanged}=require('./tune_boards');
const file=path.resolve(process.argv[2]==='--worker'?process.argv[3]:(process.argv[2]||path.join(__dirname,'../../www/levels-hard.js')));
const T=vm.runInNewContext(fs.readFileSync(file,'utf8')+';HARD_LEVELS');
const old=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../analysis/levels-1.47.js'),'utf8')+';HARD_LEVELS');
const seed=991331,hash=row=>crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex');
function measure(lv,runs){
 const raw=T.levels[lv-T.from],d=H.unpack(lv,raw),before=H.unpack(lv,old.levels[lv-old.from]),m=sample(d,runs,seed),baseline=sample(before,runs,seed),g=game(d);
 const xs=g.tiles.map(t=>t.x/2-t.z*.14),ys=g.tiles.map(t=>t.y/2*1.24-t.z*.14);
 return {lv,hash:hash(raw),targetStrong:H.target(lv,'strong'),focused:m.win,reach:m.reach,clockLoss:m.clockLoss,afterClock:m.afterClock,baseline,
  sensible:H.rate(g,runs,seed+lv,H.persona('sensible')).rate,average:H.rate(g,runs,seed+lv,H.persona('average')).rate,
  clock:d.clock.n,routeMoves:d.solution.indexOf(d.clock.i)+1,clockUnchanged:checkClockUnchanged(d,before),proof:H.validSolution(g,d.solution),
  tilePx:Math.min(384/(Math.max(...xs)+1-Math.min(...xs)+.125),592/(Math.max(...ys)+1.24-Math.min(...ys)+.16)),minTile:lv%10===0?48:54};
}
if(require.main===module&&process.argv[2]==='--worker')process.on('message',({levels,runs})=>{try{for(const lv of levels)process.send(measure(lv,runs));process.send({done:true});}catch(e){process.send({error:e.stack});process.exit(1);}});
else if(require.main===module){
 const runs=+(process.argv[3]||600),jobs=+(process.argv[4]||8),report=path.resolve(process.argv[5]||path.join(__dirname,'../../analysis/validation-1.48.json'));
 let selected=Array.from({length:T.levels.length},(_,i)=>T.from+i).filter(lv=>lv>=80);if(process.env.ONLY_LEVELS){const wanted=new Set(JSON.parse(process.env.ONLY_LEVELS));selected=selected.filter(lv=>wanted.has(lv));}
 const rows=[];
 if(fs.existsSync(report)){const p=JSON.parse(fs.readFileSync(report));if(p.runs===runs&&p.seed===seed)rows.push(...p.rows.filter(r=>selected.includes(r.lv)&&r.hash===hash(T.levels[r.lv-T.from])));}
 const pending=selected.filter(lv=>!rows.some(r=>r.lv===lv));console.log(`${rows.length} measurements reused; ${pending.length} to measure`);let left=jobs;
 for(let j=0;j<jobs;j++){
  const w=fork(__filename,['--worker',file]);w.on('message',m=>{if(m.error){console.error(m.error);process.exit(1);}if(m.done){w.kill();if(--left===0)done();return;}rows.push(m);if(rows.length%15===0)console.log(rows.length+'/'+selected.length);});
  w.on('exit',c=>{if(c){console.error('Validation worker failed',c);process.exit(1);}});w.send({levels:pending.filter((_,i)=>i%jobs===j),runs});
 }
 function done(){
  rows.sort((a,b)=>a.lv-b.lv);const avg=(rs,k)=>rs.reduce((s,r)=>s+r[k],0)/rs.length;
  const bands=[[80,89],[90,104],[105,119],[120,149],[150,269]].map(([from,to])=>{const rs=rows.filter(r=>r.lv>=from&&r.lv<=to);return rs.length?{from,to,focused:avg(rs,'focused'),targetStrong:avg(rs,'targetStrong'),reach:avg(rs,'reach'),baselineReach:rs.reduce((s,r)=>s+r.baseline.reach,0)/rs.length,clockLoss:avg(rs,'clockLoss'),baselineClockLoss:rs.reduce((s,r)=>s+r.baseline.clockLoss,0)/rs.length,sensible:avg(rs,'sensible'),average:avg(rs,'average')}:null;}).filter(Boolean);
  const bad=rows.filter(r=>Math.abs(r.focused-r.targetStrong)>(r.lv<90?.08:.10)||!r.proof||!r.clockUnchanged||r.tilePx<r.minTile-.001||r.reach<r.baseline.reach-.03||r.clockLoss>r.baseline.clockLoss+.03);
  const drifting=bands.filter(b=>Math.abs(b.focused-b.targetStrong)>.03||b.reach<b.baselineReach-.01||b.clockLoss>b.baselineClockLoss+.01);
  fs.writeFileSync(report,JSON.stringify({runs,seed,profile:H.REF.focused,bands,rows},null,2)+'\n');
  for(const b of bands)console.log(`${b.from}-${b.to}: focused ${b.focused.toFixed(3)} target ${b.targetStrong.toFixed(3)}; clock reached ${b.reach.toFixed(3)} before ${b.baselineReach.toFixed(3)}`);
  console.log('Per-level misses:',bad.map(r=>r.lv).join(',')||'none');console.log('Band misses:',drifting.map(b=>b.from).join(',')||'none');
  if(bad.length||drifting.length)process.exitCode=1;
 }
}
