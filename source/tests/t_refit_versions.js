'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),H=require('../www/hard'),manifest=require('../analysis/refit-251-299.json');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
module.exports=[{name:'tower-free refits: reviewed rows change; held boards, swap pairs and save revisions stay intact',cpu:true,async run(t){
 const T=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../www/levels-hard.js'),'utf8')+';HARD_LEVELS'),previous=global.HARD_LEVELS;global.HARD_LEVELS=T;
 try{t.eq(manifest.changedLevels.length,26,'26 accepted refits');t.eq(manifest.heldLevels.length,16,'16 earlier proposals held at released rows');t.eq(manifest.approvedSwaps,[],'no half-applied swap');t.eq(manifest.deferredSwaps,[[262,260],[277,280]],'both pairs recorded together');t.eq(Object.keys(T.boardVersions).map(Number),manifest.changedLevels,'exact revision scope');
 for(const row of manifest.rows){t.eq(hash(T.levels[row.level-T.from]),row.afterHash,'reviewed packed board '+row.level);t.eq(H.designVersion(row.level),10,'refit save revision '+row.level);const d=H.get(row.level),tiles=d.tiles.map(([x,y,z])=>({x,y,z})),L=require('../www/layouts'),nb=L.neighbors(tiles);t.ok(H.validSolution({tiles,nb,faces:d.faces,clock:d.clock,rules:d.obst?{iceNb:L.iceNeighbors(tiles),ice:d.obst.ice,locks:new Set(d.obst.locks),keys:d.obst.keys}:null},d.solution),'decoded full strict witness '+row.level);}
 for(const row of manifest.heldRows){t.eq(hash(T.levels[row.level-T.from]),row.hash,'held live row '+row.level);t.eq(H.designVersion(row.level),9,'held save resumes '+row.level);}
 for(let n=250;n<=300;n++){const tiles=H.get(n).tiles,positions=new Set(tiles.map(p=>p.join(',')));t.ok(!tiles.some(([x,y,z])=>z>0&&positions.has([x,y,z-1].join(','))),'no straight-on tower at any layer '+n);}
 for(const n of[250,260,270,280,290,300])t.eq(H.designVersion(n),9,'unchanged tenth revision '+n);for(const n of[91,92,249])t.eq(H.designVersion(n),n<92?7:8,'earlier save revision '+n);
 const last=T.from+T.levels.length-1;for(let n=last+1;n<=last+250;n++){const base=T.cycleFrom+(n-T.cycleFrom)%(last-T.cycleFrom+1);t.eq(H.designVersion(n),T.boardVersions[base]||9,'repeated board revision '+n);}
 }finally{global.HARD_LEVELS=previous;}
}},{name:'tower-free refits: changed layout restarts, held and unchanged layouts resume, progress stays',async run(t,{startLevel}){
 const p=await t.phone({state:{name:'Refit QA',pid:'test-refit-save',level:301,stars:{251:2,270:3},seenSp:{clock:true,clockMoves:true,ice:true,lock:true}}});await startLevel(p,251);
 await p.evaluate(()=>{G.mv=2;saveCur();const c=JSON.parse(localStorage.getItem(CUR));c.hv=9;localStorage.setItem(CUR,JSON.stringify(c));__mj.startLevel(251);});t.eq(await p.evaluate(()=>[G.mv,JSON.parse(localStorage.getItem(CUR)).hv]),[0,10],'old refit layout restarts');
 await p.evaluate(()=>{G.mv=2;saveCur();__mj.startLevel(251);});t.eq(await p.evaluate(()=>G.mv),2,'current refit resumes');
 for(const n of[255,260,262,270,277,280]){await startLevel(p,n);await p.evaluate(n=>{G.mv=2;saveCur();__mj.startLevel(n);},n);t.eq(await p.evaluate(()=>[G.mv,JSON.parse(localStorage.getItem(CUR)).hv]),[2,9],'held/unchanged '+n+' resumes');}
 t.eq(await p.evaluate(()=>[S.level,S.stars[251],S.stars[270]]),[301,2,3],'progress and stars preserved');
}}];
