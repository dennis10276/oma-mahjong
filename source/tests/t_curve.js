'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const H = require('../www/hard');
module.exports = [
  {
    name: 'curve: shipped levels match accepted independent measurements, targets and tile sizes',
    cpu: true,
    async run(t) {
      const crypto=require('crypto'),report=require('../analysis/validation-1.47.json');
      const table=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../www/levels-hard.js'),'utf8')+';HARD_LEVELS');
      t.ok(report.runs>=300,'at least 300 independent games per persona');
      t.eq(report.rows.length,190,'all rebuilt levels measured');
      for(const r of report.rows){
        const row=table.levels[r.lv-table.from],margin=r.lv<90?0.08:0.10;
        t.eq(crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex'),r.hash,'measured board is shipped '+r.lv);
        t.eq([row[8],row[9]],[r.sensible,r.strong],'table logs the new measurements '+r.lv);
        t.ok(Math.abs(r.strong-H.target(r.lv,'strong'))<=margin,'strong target '+r.lv);
        t.ok(Math.abs(r.sensible-H.target(r.lv))<=margin,'middle target '+r.lv);
        t.ok(r.tilePx>=r.minTile-0.001,'readable tiles '+r.lv);
      }
      for(const b of report.bands){
        t.ok(Math.abs(b.strong-b.targetStrong)<=0.03,'strong band '+b.from);
        t.ok(Math.abs(b.sensible-b.target)<=0.03,'middle band '+b.from);
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
