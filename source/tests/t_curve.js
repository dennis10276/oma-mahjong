'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const H = require('../www/hard');
module.exports = [
  {
    name: 'curve: clock-focused targets are met by changing the board, with clocks and their routes preserved',
    cpu: true,
    async run(t) {
      const crypto=require('crypto'),report=require('../analysis/validation-1.48.json');
      const table=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../www/levels-hard.js'),'utf8')+';HARD_LEVELS');
      const old=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../analysis/levels-1.47.js'),'utf8')+';HARD_LEVELS');
      t.ok(report.runs>=300,'at least 300 independent games per persona');
      t.eq(report.rows.length,190,'all rebuilt levels measured');
      t.eq(report.profile,H.REF.focused,'the user-approved clock-focused player is the calibration model');
      // 1.52: levels 90-269 hold the same boards in a new order (each at least as hard as the one
      // before); their stored chance is the combined fresh measurement (analysis/reorder-1.52.json)
      const reorder=require('../analysis/reorder-1.52.json'),hash=row=>crypto.createHash('sha256').update(JSON.stringify(row.slice(0,9).concat([row[10]]))).digest('hex');
      const shipped=new Map(reorder.moves.map(m=>[m.was,m.lv]));
      for(const r of report.rows){
        const now=r.lv<90?r.lv:shipped.get(r.lv),row=table.levels[now-table.from],before=old.levels[r.lv-old.from],margin=r.lv<90?0.08:0.10;
        if(r.lv<90){t.eq(crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex'),r.hash,'measured board is shipped '+r.lv);t.eq([row[8],row[9]],[r.sensible,r.focused],'table logs the new measurements '+r.lv);}
        else t.eq(row[8],r.sensible,'board '+r.lv+' is shipped at level '+now);
        t.ok(Math.abs(r.focused-H.target(r.lv,'strong'))<=margin,'focused target '+r.lv);
        t.ok(r.reach>=r.baseline.reach-.03&&r.clockLoss<=r.baseline.clockLoss+.03,'clock difficulty did not increase beyond sampling tolerance '+r.lv);
        t.ok(r.tilePx>=r.minTile-0.001,'readable tiles '+r.lv);
        for(const index of [0,2,3,4,5,6,7,10])t.eq(row[index],before[index],'only the face arrangement can change '+r.lv+' field '+index);
        const d=H.unpack(now,row),prev=H.unpack(r.lv,before),fixed=new Set([...prev.solution.slice(0,prev.solution.indexOf(prev.clock.i)+1),...(prev.gold||[]),...((prev.obst||{}).keys||[])]);
        for(const i of fixed)t.eq(d.faces[i],prev.faces[i],'clock route and special pairs retain their faces '+r.lv+' tile '+i);
      }
      const ch=reorder.moves.map(m=>m.chance);
      reorder.moves.forEach((m,k)=>{ if(k&&ch[k]>ch[k-1]) t.ok((m.lv%10===0||(m.lv-1)%10===0)&&ch[k]-ch[k-1]<=0.03,'always at least as hard, except a little around a big board at level '+m.lv); });
      for(const b of report.bands){
        t.ok(Math.abs(b.focused-b.targetStrong)<=0.03,'focused band '+b.from);
        t.ok(b.reach>=b.baselineReach-.01&&b.clockLoss<=b.baselineClockLoss+.01,'clock difficulty unchanged within band sampling tolerance '+b.from);
      }
    },
  },
  {
    name: 'curve: approved strong checkpoints, interpolation and plateau agree in browser and builder',
    cpu: true,
    async run(t) {
      const points = [[75,0.7],[85,0.6],[100,0.45],[120,0.35],[150,0.3],[300,0.3]];
      points.forEach(([lv,q]) => t.eq(H.target(lv,'strong'),q,'strong target at '+lv));
      t.ok(Math.abs(H.target(80,'strong')-0.65)<1e-10,'interpolate between checkpoints');
      t.eq(H.target(74,'strong'),0.88,'earlier target preserved');
      const rules = vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../www/js/rules.js'),'utf8')+';RULES.hard');
      t.eq(JSON.parse(JSON.stringify(rules.strongCurve)),H.cfg().strongCurve,'browser and build use the approved curve');
      t.eq([rules.start,rules.end,rules.endLevel],[H.cfg().start,H.cfg().end,H.cfg().endLevel],'middle curve agrees too');
    },
  },
  {
    name: 'hard saves: old designs start fresh while the current design resumes',
    async run(t, {startLevel,sleep}) {
      const p=await t.phone({state:{name:'Dennis',pid:'test-save-curve',level:83,seenSp:{clock:1,ice:1,lock:1,gold:1,joker:1}}});
      await startLevel(p,83);
      t.eq(p.db.plays('test-save-curve').find(e=>e.k==='start').pm,'focused','new level telemetry identifies the calibrated player');
      t.eq(p.db.plays('test-save-curve').find(e=>e.k==='start').pr,await p.evaluate(()=>G.o.spec.made.info.strong),'logged win chance belongs to the focused player');
      await p.evaluate(()=>{G.mv=2;saveCur();});
      await p.evaluate(()=>__mj.startLevel(83));
      t.eq(await p.evaluate(()=>G.mv),2,'same design resumes the move count');
      await p.evaluate(()=>{const c=JSON.parse(localStorage.getItem(CUR));c.hv=Hard.GENV-1;localStorage.setItem(CUR,JSON.stringify(c));__mj.startLevel(83);});
      t.eq(await p.evaluate(()=>G.mv),0,'previous design cannot restore an old clock');
      await p.evaluate(()=>__mj.startLevel(79));
      await p.evaluate(()=>{G.mv=2;saveCur();const c=JSON.parse(localStorage.getItem(CUR));delete c.hv;localStorage.setItem(CUR,JSON.stringify(c));__mj.startLevel(79);});
      t.eq(await p.evaluate(()=>G.mv),2,'legacy saved game below 80 still resumes');
      t.eq(await p.evaluate(()=>S.level),83,'design migration does not reset player progress');
      const grandma=await t.phone({state:{name:'OmaHanny',pid:'test-grandma-save',level:85}});
      await startLevel(grandma,85);
      await grandma.evaluate(()=>{G.mv=2;saveCur();const c=JSON.parse(localStorage.getItem(CUR));delete c.hv;localStorage.setItem(CUR,JSON.stringify(c));__mj.startLevel(85);});
      t.eq(await grandma.evaluate(()=>[G.mv,G.o.track]),[2,'care'],'grandma saved boards are preserved');
      await p.evaluate(()=>{HELP.normal.gentle=1;localStorage.removeItem(CUR);__mj.startLevel(83);});
      t.eq(await p.evaluate(()=>[!!G.o.spec.made,G.ez]),[false,1],'separate optional help still supplies an easier board');
      await p.evaluate(()=>{G.mv=2;saveCur();__mj.startLevel(83);});
      t.eq(await p.evaluate(()=>G.mv),2,'current easier fallback boards also resume');
    },
  },
];
