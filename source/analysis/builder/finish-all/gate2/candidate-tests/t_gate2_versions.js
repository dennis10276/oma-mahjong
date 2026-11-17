'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),H=require('../www/hard'),L=require('../www/layouts'),manifest=require('../analysis/refit-301-349.json');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function strictWin(d){const tiles=d.tiles.map(([x,y,z])=>({x,y,z})),nb=L.neighbors(tiles),o=d.obst;return H.validSolution({tiles,nb,faces:d.faces,clock:d.clock,rules:o?{iceNb:L.iceNeighbors(tiles),ice:o.ice,locks:new Set(o.locks),keys:o.keys}:null},d.solution);}
module.exports=[{name:'gate 2: all 49 authored rows round-trip; released rows stay fixed; new repeat span has a fresh save revision',cpu:true,async run(t){
 const T=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../www/levels-hard.js'),'utf8')+';HARD_LEVELS'),previous=global.HARD_LEVELS;global.HARD_LEVELS=T;
 try{
  t.eq([manifest.scope,T.from+T.levels.length-1,T.repeatVersion],[[301,349],349,12],'scope and repeat generation');
  t.eq(manifest.rows.map(r=>r.level),Array.from({length:49},(_,i)=>301+i),'every authored destination exactly once');
  t.eq(hash(T.levels.slice(0,301-T.from)),manifest.earlierPackedHash,'all released packed rows through 300 unchanged');
  t.eq(Object.fromEntries(Object.entries(T.boardVersions).filter(([n])=>+n<=300)),manifest.earlierRevisions,'released save revisions unchanged');
  for(const r of manifest.rows){const d=H.get(r.level),xs=d.tiles.map(p=>p[0]),ys=d.tiles.map(p=>p[1]),positions=new Set(d.tiles.map(p=>p.join()));
   t.eq(hash(T.levels[r.level-T.from]),r.packedHash,'reviewed packed row '+r.level);t.eq(H.designVersion(r.level),12,'new authored save '+r.level);t.ok(strictWin(d),'strict complete witness '+r.level);
   t.ok(!d.tiles.some(([x,y,z])=>z&&positions.has([x,y,z-1].join())),'no straight towers '+r.level);
   if(r.level%10)t.ok(d.tiles.length>=72&&d.tiles.length<=88&&Math.max(...xs)-Math.min(...xs)+2<=13&&Math.max(...ys)-Math.min(...ys)+2<=16,'ordinary frame '+r.level);
   else t.eq(d.tiles.length,96,'tenth stays large '+r.level);
  }
  const last=349,span=200;t.eq(last-T.cycleFrom+1,span,'repeat span retains tenth-level alignment');
  for(let n=350;n<=549;n++){const base=T.cycleFrom+(n-T.cycleFrom)%span,d=H.get(n),a=H.get(base),w=Math.max(...a.tiles.map(p=>p[0]));
   t.eq(H.designVersion(n),12,'changed repeat revision '+n);t.eq(d.tiles,a.tiles.map(([x,y,z])=>[w-x,y,z]),'repeat mirrors the selected source '+n);t.ok(strictWin(d),'repeat retains its complete witness '+n);t.eq(n%10,base%10,'tenth alignment '+n);
  }
  for(const n of[550,749,750,1000])t.eq(H.designVersion(n),12,'later repeat revision '+n);
 }finally{global.HARD_LEVELS=previous;}
}},{name:'gate 2: old authored and repeat saves restart; current and released saves resume without changing progress',async run(t,{startLevel}){
 const p=await t.phone({state:{name:'Gate 2 QA',pid:'test-gate2-save',level:750,stars:{251:2,300:3},seenSp:{clock:true,clockMoves:true,ice:true,lock:true}}});
 for(const n of[301,349,350,501,550]){
  await startLevel(p,n);await p.evaluate(n=>{G.mv=2;saveCur();const c=JSON.parse(localStorage.getItem(CUR));c.hv=9;localStorage.setItem(CUR,JSON.stringify(c));__mj.startLevel(n);},n);
  t.eq(await p.evaluate(()=>[G.mv,JSON.parse(localStorage.getItem(CUR)).hv]),[0,12],'old saved board restarts '+n);
  await p.evaluate(n=>{G.mv=2;saveCur();__mj.startLevel(n);},n);t.eq(await p.evaluate(()=>G.mv),2,'current saved board resumes '+n);
 }
 await startLevel(p,270);await p.evaluate(()=>{G.mv=2;saveCur();__mj.startLevel(270);});t.eq(await p.evaluate(()=>[G.mv,JSON.parse(localStorage.getItem(CUR)).hv]),[2,9],'released unchanged board resumes');
 t.eq(await p.evaluate(()=>[S.level,S.stars[251],S.stars[300]]),[750,2,3],'progress and stars preserved');
}}];
