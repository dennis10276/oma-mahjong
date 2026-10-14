/* Rebuild normal hard levels, preserving earlier rows. Resume a build from its progress file.
   node tools/sim/build_levels.js [from=80] [to=269] [jobs=4] [output=www/levels-hard.js] */
'use strict';
const { fork } = require('child_process');
const path = require('path'), fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const Hard = require('../../www/hard.js'), L = require('../../www/layouts.js');
const middleFloors=JSON.parse(process.env.MIDDLE_FLOORS||'{}');
function game(d) {
  const tiles = d.tiles.map(([x,y,z]) => ({x,y,z})), nb = L.neighbors(tiles);
  const down = new Uint8Array(tiles.length); d.down.forEach(i => down[i] = 1);
  const ob = d.obst, rules = ob ? { iceNb:L.iceNeighbors(tiles), ice:ob.ice || {}, locks:ob.keys && ob.keys.length ? new Set(ob.locks) : null, keys:ob.keys || [] } : null;
  return {tiles,nb,faces:d.faces,down,rules,clock:d.clock};
}
function check(d, runs = 160, seed = 31337) {
  const g = game(d);
  const xs=g.tiles.map(t=>t.x/2-t.z*0.14),ys=g.tiles.map(t=>t.y/2*1.24-t.z*0.14);
  const px=Math.min(384/(Math.max(...xs)+1-Math.min(...xs)+0.125),592/(Math.max(...ys)+1.24-Math.min(...ys)+0.16));
  if(px<(d.level%10===0?48:54)-0.001)return null;
  if (!Hard.validSolution(g,d.solution) || (d.level >= Hard.cfg().clockFrom && !d.clock)) return null;
  return {q:Hard.rate(g,runs,seed+d.level,Hard.persona('sensible')).rate, st:Hard.rate(g,runs,seed+d.level,Hard.persona('strong')).rate};
}
if (process.argv[2] === '--worker') {
  function assess(d,forbidden=null) {
    let best=null;
    const original=d.clock&&d.clock.n;
    const base=d.clock&&d.solution ? d.solution.indexOf(d.clock.i)+1 : null;
    const budgets=base ? Hard.clockSpare(d.level).map(s=>base+s) : [null];
    for(const budget of budgets) {
      if(budget===forbidden)continue;
      if(d.clock)d.clock.n=budget;
      let m=check(d);
      if(!m)continue;
      let dq=Math.abs(m.q-Hard.target(d.level)),ds=Math.abs(m.st-Hard.target(d.level,'strong'));
      const tolerance=d.level<90 ? 0.10 : 0.12;
      let valid=dq<=tolerance&&ds<=tolerance&&m.st>=m.q-0.05;
      if(valid) {
        m=check(d,300,882001);dq=Math.abs(m.q-Hard.target(d.level));ds=Math.abs(m.st-Hard.target(d.level,'strong'));
        const final=d.level<90 ? 0.08 : 0.10;
        valid=dq<=final&&ds<=final&&m.st>=m.q-0.05;
        if(valid){
          m=check(d,600,1882001);dq=Math.abs(m.q-Hard.target(d.level));ds=Math.abs(m.st-Hard.target(d.level,'strong'));
          const margin=d.level<90?0.06:0.08;
          valid=dq<=margin&&ds<=margin&&m.st>=m.q-0.05&&m.q>=(middleFloors[d.level]??-Infinity);
        }
      }
      const miss=dq+1.5*ds;
      if(!best||valid&&!best.valid||valid===best.valid&&miss<best.miss){
        d.info.rate=m.q;d.info.strong=m.st;
        best={lv:d.level,row:Hard.pack(d),miss,m,valid};
      }
    }
    if(d.clock)d.clock.n=original;
    return best;
  }
  function alternateClocks(d) {
    const g=game(d),alive=new Uint8Array(g.tiles.length).fill(1),cover=Hard.coverOf(g.tiles,g.nb),ob=d.obst||{};
    const bad=new Set([...d.down,...(d.gold||[]),...Object.keys(ob.ice||{}).map(Number),...(ob.locks||[]),...(ob.keys||[])]);
    const pool=g.tiles.map((_,i)=>i).filter(i=>!bad.has(i)&&!cover[i].length&&!L.isFree(i,alive,g.nb)&&(!d.clock||i!==d.clock.i));
    let best=null;
    for(const ci of pool){
      const route=Hard.clockRoute(g,ci),base=route?route.indexOf(ci)+1:Infinity;
      if(!route||base<5||base>(d.level<90?18:d.level<110?16:14))continue;
      const candidate={...d,clock:{i:ci,n:base+Hard.clockSpare(d.level)[0]},solution:route,info:{...d.info}};
      const a=assess(candidate);
      if(a&&(!best||a.valid||a.miss<best.miss))best=a;
      if(best&&best.valid)break;
    }
    return best;
  }
  process.on('message', ({levels,previous}) => {
    try {
      for (const lv of levels) {
        let best=previous[lv]||null;
        const first=best?best.attempts:0;
        if(best&&best.row){const reconsider=assess(Hard.unpack(lv,best.row),best.failedBudget);if(reconsider&&(reconsider.valid||reconsider.miss<best.miss))best={...reconsider,attempts:first};}
        if(best&&!best.valid&&best.row){const alternate=alternateClocks(Hard.unpack(lv,best.row));if(alternate&&(alternate.valid||alternate.miss<best.miss))best={...alternate,attempts:first};}
        if(!best||!best.valid)for(let salt=first;salt<first+24;salt++){
          const d=Hard.makeNow(lv,Hard.ASPECT,1,salt);let a=assess(d);
          if((!a||!a.valid)&&salt%4===0){const alternate=alternateClocks(d);if(alternate&&(alternate.valid||!a||alternate.miss<a.miss))a=alternate;}
          if(a&&(!best||a.valid||a.miss<best.miss))best={...a,attempts:salt+1};
          if(best)best.attempts=salt+1;
          if(best&&best.valid)break;
        }
        process.send(best||{lv,valid:false,attempts:first+24,miss:999});
      }
      process.send({done:true});
    }catch(e){process.send({error:e.stack});process.exit(1);}
  });
} else {
  const from=+(process.argv[2]||80), to=+(process.argv[3]||269), jobs=+(process.argv[4]||4);
  const output=path.resolve(process.argv[5]||path.join(__dirname,'../../www/levels-hard.js'));
  const progress=path.join(__dirname,'../../analysis/build-hard-1.47.progress.json'), source=path.join(__dirname,'../../www/levels-hard.js');
  const signature=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../../www/hard.js'))).update(fs.readFileSync(__filename)).digest('hex');
  let rows={};
  if (fs.existsSync(progress)) { const p=JSON.parse(fs.readFileSync(progress)); if(p.signature===signature) rows=p.rows; }
  const pending=Array.from({length:to-from+1},(_,i)=>from+i).filter(lv=>!rows[lv]||!rows[lv].valid);
  const t0=Date.now(); let left=Math.min(jobs,pending.length);
  if (!left) write();
  for(let j=0;j<Math.min(jobs,pending.length);j++) {
    const w=fork(__filename,['--worker']);
    w.on('message',m=>{
      if(m.error) { console.error(m.error); process.exit(1); }
      if(m.done) { w.kill(); if(--left===0) write(); return; }
      rows[m.lv]=m;
      fs.writeFileSync(progress,JSON.stringify({signature,rows}));
      const count=Object.values(rows).filter(x=>x.lv>=from&&x.lv<=to&&x.valid).length;
      console.log(`${count}/${to-from+1} accepted; level ${m.lv}: strong ${m.m && m.m.st.toFixed(2)}, middle ${m.m && m.m.q.toFixed(2)}, ${m.attempts} attempts${m.valid?'':' NEEDS REVIEW'} (${Math.round((Date.now()-t0)/1000)}s)`);
    });
    w.on('exit',code=>{ if(code) { console.error('Build worker failed:',code); process.exit(1); } });
    w.send({levels:pending.filter((_,i)=>i%jobs===j),previous:rows});
  }
  function write() {
    const failed=Array.from({length:to-from+1},(_,i)=>from+i).filter(lv=>!rows[lv]||!rows[lv].valid);
    if(failed.length) { console.error('Not published; levels need more work:',failed.join(',')); process.exitCode=1; return; }
    const old=vm.runInNewContext(fs.readFileSync(source,'utf8')+'; HARD_LEVELS');
    const tableFrom=Math.min(old.from,from), levels=[];
    for(let lv=tableFrom;lv<=to;lv++) { const row=lv>=from?rows[lv].row:old.levels[lv-old.from]; if(!row) throw Error('Missing preserved level '+lv); levels.push(row); }
    const c=Hard.cfg(), plateau=Math.max(c.endLevel,...(c.strongCurve||[]).map(p=>p[0]));
    const table={v:Hard.GENV,aspect:Hard.ASPECT,from:tableFrom,cycleFrom:plateau,levels};
    fs.writeFileSync(output,'/* Designed levels, with complete solution witnesses; generated '+new Date().toISOString()+'. */\nconst HARD_LEVELS = '+JSON.stringify(table)+';\n');
    console.log('Wrote '+output+'; earlier levels preserved.');
  }
}
