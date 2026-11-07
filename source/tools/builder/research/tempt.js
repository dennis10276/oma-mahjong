// temptation steps along the witness way to the clock: a free face-up off-way pair that LOSES while the way's move is a single
const path='/home/claude/repo-oma/source/';
const E=require(path+'tools/builder/engine.js');
const boards=JSON.parse(require('fs').readFileSync(path+'analysis/builder/knobs-v1/boards.json','utf8'));
function profile(d){
  const g=E.game(d), ck=d.clock.i, F=d.faces, sol=d.solution, pre=sol.slice(0,sol.indexOf(ck)+1);
  let s=E.start(g), T=0, P=0, M=0, singles=0, losingPairs=0, steps=0;
  for(const i of pre){
    const L=E.legal(g,s).filter(x=>typeof x==='number');
    const trayHas=f=>s.tray.some(t=>F[t]===f);
    const isMatch=trayHas(F[i]), isPair=!isMatch && L.some(j=>j!==i&&F[j]===F[i]);
    const offPairs=[]; for(const a of L) for(const b of L) if(a<b&&F[a]===F[b]&&!trayHas(F[a])&&!d.down.includes(a)&&!d.down.includes(b)&&a!==i&&b!==i) offPairs.push(a);
    let lose=0; if(offPairs.length){ const cl=E.classify(g,s,{nodes:20000,ms:150}); lose=offPairs.filter(a=>cl.find(c=>c.move===a)?.result==='lose').length; }
    steps++; if(isMatch) M++; else if(isPair) P++; else singles++;
    if(!isMatch && lose>0) T++; losingPairs+=lose;
    const n=E.step(g,s,i); if(!n) break; s=n;
  }
  return {steps,M,P,singles,T,losingPairs,spare:d.clock.n-pre.length};
}
const pick=boards.filter(b=>b.family&&b.design&&b.brief.story!=='frozenGuards'&&b.brief.story!=='chainReaction');
const rows=[];
for(const b of pick){ try{ const p=profile(b.design); rows.push({id:b.id,fam:b.family.exp,sk:b.skilled?.exp,...p}); }catch(e){} }
require('fs').writeFileSync('tempt.json',JSON.stringify(rows));
const rank=a=>{const s=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]);const r=new Array(a.length);s.forEach(([v,i],k)=>r[i]=k);return r;};
const sp=(x,y)=>{const a=rank(x),b=rank(y),n=a.length,ma=a.reduce((s,v)=>s+v,0)/n,mb=b.reduce((s,v)=>s+v,0)/n;let c=0,va=0,vb=0;for(let i=0;i<n;i++){c+=(a[i]-ma)*(b[i]-mb);va+=(a[i]-ma)**2;vb+=(b[i]-mb)**2;}return (c/Math.sqrt(va*vb)).toFixed(2);};
console.log('boards',rows.length);
for(const k of ['steps','T','losingPairs','singles','P','M']) console.log(k.padEnd(12),'rho family',sp(rows.map(r=>r[k]),rows.map(r=>r.fam)),'skilled',sp(rows.map(r=>r[k]),rows.map(r=>r.sk??0)));
const by={};for(const r of rows){const k=Math.min(r.T,8);(by[k]=by[k]||[]).push(r.fam);}
for(const k of Object.keys(by).sort((a,b)=>a-b)){const a=by[k].sort((x,y)=>x-y);console.log('T='+k,'n',a.length,'family median',a[a.length>>1].toFixed(2),'share>=18',(a.filter(v=>v>=18).length/a.length).toFixed(2));}
