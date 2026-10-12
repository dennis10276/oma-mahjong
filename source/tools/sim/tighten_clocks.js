/* Change countdowns only. Usage: node tools/sim/tighten_clocks.js SOURCE OUTPUT REPORT */
'use strict';
const fs = require('fs'), vm = require('vm');
const H = require('../../www/hard'), L = require('../../www/layouts');
const C = require('./clock_routes');
const {fork}=require('child_process');
function game(d) {
  const tiles = d.tiles.map(([x,y,z]) => ({x,y,z})), ob = d.obst;
  const down = new Uint8Array(tiles.length); d.down.forEach(i => down[i] = 1);
  return {tiles,nb:L.neighbors(tiles),faces:d.faces,down,clock:d.clock,
    rules:ob ? {iceNb:L.iceNeighbors(tiles),ice:ob.ice,locks:ob.keys.length ? new Set(ob.locks) : null,keys:ob.keys} : null};
}
module.exports = {game};
function tune(lv,d) {
  const g=game(d),ci=d.clock.i,spares=C.clockSpare(lv),spare=Math.max(...spares);
  let earlyRoute=C.clockRoute(g,ci);
  if(!earlyRoute)earlyRoute=C.clockRoute(g,ci,{width:512,nodes:1000000,depth:g.tiles.length});
  if(!earlyRoute)throw Error('No complete route at '+lv);
  const earlyMoves=earlyRoute.indexOf(ci)+1,p={...H.persona('strong'),clockFocus:4};
  const baseline=Math.min(H.rate({...g,clock:null},160,23133+lv,p).rate,H.rate(g,160,23133+lv,p).rate);
  const floor=baseline*0.65; // a clock may challenge deliberate play without making most otherwise won games fail
  const sample=(budget,runs,seed)=>{
    let wins=0,route=null,best=-1,losses=0;
    for(let k=0;k<runs;k++){
      const r=H.play({...g,clock:{i:ci,n:budget}},p,seed+lv*1009+k*104729);
      if(r.why==='clock')losses++;
      if(!r.win)continue;wins++;
      const used=r.at[ci]+1;
      if(used<=budget-Math.min(...spares)&&used>best){best=used;route=Array.from(r.at,(_,i)=>i).sort((a,b)=>r.at[a]-r.at[b]);}
    }
    return {rate:wins/runs,clockLoss:losses/runs,route};
  };
  let lo=Math.min(d.clock.n,earlyMoves+spare),hi=d.clock.n;
  // Locate a useful deadline, then confirm it on separate games. Clock urgency is not monotonic,
  // so the final independent check, not the binary search, determines acceptance.
  while(lo<hi){const mid=Math.floor((lo+hi)/2);if(sample(mid,160,710113).rate>=floor+0.025)hi=mid;else lo=mid+1;}
  let budget=lo,m;
  for(;;){m=sample(budget,300,991331);if(m.rate>=floor||budget===d.clock.n)break;budget++;}
  if(m.rate<floor)throw Error('Clock fairness needs review at '+lv);
  const route=m.route||earlyRoute,base=route.indexOf(ci)+1;
  if(!C.validSolution({...g,clock:{i:ci,n:budget}},route))throw Error('Invalid proof at '+lv);
  return {lv,i:ci,old:d.clock.n,budget,routeMoves:base,spare:budget-base,earlyRouteMoves:earlyMoves,
    focusedBaseline:baseline,focusedFloor:floor,focusedRate:m.rate,clockLoss:m.clockLoss,solution:route};
}
if(process.argv[2]==='--worker')process.on('message',({rows})=>{try{for(const {lv,d} of rows)process.send(tune(lv,d));process.send({done:true});}catch(e){process.send({error:e.stack});process.exit(1);}});
else if (require.main === module) {
  const [source,output,report] = process.argv.slice(2);
  if (!report) throw Error('Provide SOURCE OUTPUT REPORT; existing boards will be preserved.');
  const original = vm.runInNewContext(fs.readFileSync(source,'utf8')+';HARD_LEVELS');
  const table = JSON.parse(JSON.stringify(original)), rows = [], absent = [],pending=[];
  for(let lv=Math.max(80,table.from);lv<table.from+table.levels.length;lv++) {
    const row=table.levels[lv-table.from], d=H.unpack(lv,row);
    if (!d.clock) { absent.push(lv); continue; }
    pending.push({lv,d});
  }
  let left=4;
  for(let j=0;j<4;j++){
    const w=fork(__filename,['--worker']);
    w.on('message',m=>{if(m.error){console.error(m.error);process.exit(1);}if(m.done){w.kill();if(--left===0)write();return;}rows.push(m);if(rows.length%20===0)console.log(rows.length+'/'+pending.length+' clocks verified');});
    w.on('exit',code=>{if(code){console.error('Clock worker failed',code);process.exit(1);}});
    w.send({rows:pending.filter((_,i)=>i%4===j)});
  }
  function write(){
  rows.sort((a,b)=>a.lv-b.lv);
  rows.forEach(r=>table.levels[r.lv-table.from][7][1]=r.budget);
  // Every field other than the countdown must match, including the repeat pool and measurements.
  const restored=JSON.parse(JSON.stringify(table));
  rows.forEach(r=>restored.levels[r.lv-table.from][7][1]=r.old);
  if(JSON.stringify(restored)!==JSON.stringify(original))throw Error('Non-clock content changed.');
  fs.writeFileSync(output,'/* Version 1.45 boards; only clock countdowns from 80 tightened. */\nconst HARD_LEVELS = '+JSON.stringify(table)+';\n');
  fs.writeFileSync(report,JSON.stringify({from:80,unchangedWithoutClock:absent,rows},null,2)+'\n');
  console.log(`${rows.length} clocks verified; ${rows.filter(r=>r.budget<r.old).length} shortened. Boards, clock positions and difficulty targets preserved.`);
  }
}
