'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const H = require('../www/hard');
module.exports = [
  {
    name: 'curve: every measured neighbor is harder, with observer-safe data and protected clock routes',
    cpu: true,
    async run(t) {
      const check=require('../tools/sim/check_ordered');
      t.eq(check(),[],'complete measured progression passes the release gate');
      const report=require('../analysis/validation-ordered.json'),P=require('../tools/sim/ordered_policy');
      const table=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../www/levels-hard.js'),'utf8')+';HARD_LEVELS');
      // Replay measurements rather than trusting the stored percentages alone.
      for(const lv of [80,86,150,269]){
        const r=report.rows.find(r=>r.lv===lv),d=H.unpack(lv,table.levels[lv-table.from]);
        t.eq(P.sample(d,report.runs,report.seed),{
          win:r.win,reach:r.reach,clockLoss:r.clockLoss,afterClock:r.afterClock,
          blindRate:r.blindRate,forcedPerGame:r.forcedPerGame,unknownShare:r.unknownShare,risky:r.risky
        },'fresh measurement is reproducible '+lv);
      }
    },
  },
  {
    name: 'curve: approved checkpoints and the continuing difficulty increase agree in browser and builder',
    cpu: true,
    async run(t) {
      const points = [[75,0.7],[85,0.6],[100,0.45],[120,0.35],[150,0.3],[269,0.18],[300,0.18]];
      points.forEach(([lv,q]) => t.eq(H.target(lv,'strong'),q,'strong target at '+lv));
      t.ok(Math.abs(H.target(80,'strong')-0.65)<1e-10,'interpolate between checkpoints');
      t.eq(H.target(74,'strong'),0.88,'earlier target preserved');
      const rules = vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../www/js/rules.js'),'utf8')+';RULES.hard');
      t.eq(JSON.parse(JSON.stringify(rules.strongCurve)),H.cfg().strongCurve,'browser and build use the same curve');
      t.eq([rules.maxDown,H.cfg().maxDown],[0.20,0.20],'runtime and offline boards use the same information cap');
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
