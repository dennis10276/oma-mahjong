/* Rebuild normal hard levels, preserving earlier rows. Resume a build from its progress file.
   node tools/sim/build_levels.js [from=80] [to=269] [jobs=4] [output=www/levels-hard.js] */
'use strict';
const { fork } = require('child_process');
const path = require('path'), fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const Hard = require('../../www/hard.js'), L = require('../../www/layouts.js');
function game(d) {
  const tiles = d.tiles.map(([x,y,z]) => ({x,y,z})), nb = L.neighbors(tiles);
  const down = new Uint8Array(tiles.length); d.down.forEach(i => down[i] = 1);
  const ob = d.obst, rules = ob ? { iceNb:L.iceNeighbors(tiles), ice:ob.ice || {}, locks:ob.keys && ob.keys.length ? new Set(ob.locks) : null, keys:ob.keys || [] } : null;
  return {tiles,nb,faces:d.faces,down,rules,clock:d.clock};
}
function check(d, runs = 160, seed = 31337) {
  const g = game(d);
  if (!Hard.validSolution(g,d.solution) || (d.level >= Hard.cfg().clockFrom && !d.clock)) return null;
  return {q:Hard.rate(g,runs,seed+d.level,Hard.persona('sensible')).rate, st:Hard.rate(g,runs,seed+d.level,Hard.persona('strong')).rate};
}
if (process.argv[2] === '--worker') {
  process.on('message', ({levels,previous}) => {
    try {
      for (const lv of levels) {
        let best = previous[lv] || null;
        const first = best ? best.attempts : 0;
        for (let salt=first; salt<first+24; salt++) {
          const d=Hard.makeNow(lv,Hard.ASPECT,1,salt); let m=check(d);
          if (m) {
            let dq=Math.abs(m.q-Hard.target(lv)), ds=Math.abs(m.st-Hard.target(lv,'strong'));
            const tolerance=lv<90 ? 0.10 : 0.12;
            let valid=dq<=tolerance && ds<=tolerance && m.st>=m.q-0.05;
            if (valid) {
              m=check(d,300,882001);
              dq=Math.abs(m.q-Hard.target(lv)); ds=Math.abs(m.st-Hard.target(lv,'strong'));
              const tighter=lv<90 ? 0.08 : 0.10;
              valid=dq<=tighter && ds<=tighter && m.st>=m.q-0.05;
            }
            const miss=dq+1.5*ds;
            if (!best || miss<best.miss) { d.info.rate=m.q; d.info.strong=m.st; best={lv,row:Hard.pack(d),miss,m,valid,attempts:salt+1}; }
            best.attempts=salt+1;
            if (valid) { best={lv,row:Hard.pack(d),miss,m,valid,attempts:salt+1}; break; }
          } else if (best) best.attempts=salt+1;
        }
        process.send(best || {lv,valid:false,attempts:first+24,miss:999});
      }
      process.send({done:true});
    } catch(e) { process.send({error:e.stack}); process.exit(1); }
  });
} else {
  const from=+(process.argv[2]||80), to=+(process.argv[3]||269), jobs=+(process.argv[4]||4);
  const output=path.resolve(process.argv[5]||path.join(__dirname,'../../www/levels-hard.js'));
  const progress=output+'.progress.json', source=path.join(__dirname,'../../www/levels-hard.js');
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
