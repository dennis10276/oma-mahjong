// how narrow is the way to the clock? per step on the witness prefix: winning moves / legal moves (engine classify)
const path='/home/claude/repo-oma/source/';
const E=require(path+'tools/builder/engine.js');
const boards=JSON.parse(require('fs').readFileSync(path+'analysis/builder/knobs-v1/boards.json','utf8'));
const vis=new Map(JSON.parse(require('fs').readFileSync('vis.json','utf8')).map(r=>[r.id,r]));
function narrow(d){
  const g=E.game(d), ck=d.clock.i, pre=d.solution.slice(0,d.solution.indexOf(ck)+1);
  let s=E.start(g), logp=0, ones=0, minShare=1, steps=0;
  for(const i of pre){ const cl=E.classify(g,s,{nodes:15000,ms:120}); const known=cl.filter(c=>c.result!=='unknown'); const w=cl.filter(c=>c.result==='win').length;
    if(known.length){ const sh=Math.max(w,1)/cl.length; logp+=Math.log(sh); minShare=Math.min(minShare,sh); if(w===1) ones++; }
    steps++; const n=E.step(g,s,i); if(!n) break; s=n; }
  return {logp, ones, minShare, steps};
}
const rows=[];
for(const b of boards){ if(!b.family||!b.design||!b.design.clock) continue; if(/frozenGuards|chainReaction/.test(b.brief.story)) continue;
  try{ rows.push({id:b.id,fam:b.family.exp,sk:b.skilled?.exp,keysVis0:vis.get(b.id)?.keysVis0,...narrow(b.design)}); }catch(e){} }
require('fs').writeFileSync('narrow.json',JSON.stringify(rows));
const rank=a=>{const s=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]);const r=new Array(a.length);s.forEach(([v,i],k)=>r[i]=k);return r;};
const sp=(x,y)=>{const a=rank(x),b=rank(y),n=a.length,ma=a.reduce((s,v)=>s+v,0)/n,mb=b.reduce((s,v)=>s+v,0)/n;let c=0,va=0,vb=0;for(let i=0;i<n;i++){c+=(a[i]-ma)*(b[i]-mb);va+=(a[i]-ma)**2;vb+=(b[i]-mb)**2;}return (c/Math.sqrt(va*vb)).toFixed(2);};
console.log('boards',rows.length);
for(const k of ['logp','ones','minShare','steps']) console.log(k.padEnd(9),'rho family',sp(rows.map(r=>r[k]),rows.map(r=>r.fam)),'skilled',sp(rows.map(r=>r[k]),rows.map(r=>r.sk??0)));
const med=a=>{a=a.slice().sort((x,y)=>x-y);return a.length?a[a.length>>1]:null;};
for(const [lo,hi] of [[-1,0.01],[-3,-1],[-6,-3],[-10,-6],[-99,-10]]){const a=rows.filter(r=>r.logp<=hi&&r.logp>lo).map(r=>r.fam);console.log('log P('+lo+','+hi+']','n',a.length,'family median',med(a)?.toFixed(2),'>=18',(a.filter(v=>v>=18).length/(a.length||1)).toFixed(2));}
