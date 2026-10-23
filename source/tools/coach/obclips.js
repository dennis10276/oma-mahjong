/* Game tips, the tile explanations: a real moment with ice (thick ice cracks, melts, the tile is taken) and
   one with lock & key (both keys, then a tile that was locked), from walk.json (see walk.js). */
const {A}=require('./lib.js');
const K=['peek','toTray','trayMatch','pair'];
const st=att=>att.steps.filter(s=>K.includes(s.kind));
const get=(lv,at)=>A.find(x=>x.key===lv&&x.at===at);
const actOf=s=>s.kind==='peek'?['peek',s.tile]:s.kind==='toTray'?['take',s.tile]:s.kind==='trayMatch'?['match',s.tile]:['pair',s.tile,s.gone.find(g=>g!==s.tile)];
function seg(att,i0,i1){ const S=st(att); const out=[]; let last=S[i0].peekPre;
  for(let i=i0;i<=i1;i++){ const s=S[i];
    if(s.kind==='peek'){ let nx=null; for(let j=i+1;j<=i1;j++) if(S[j].kind!=='peek'){nx=S[j];break;} if(!(nx&&nx.gone.includes(s.tile))) continue; let lastRun=true; for(let j=i+1;j<=i1;j++){ if(S[j].kind!=='peek')break; if(S[j].tile===s.tile) lastRun=false;} if(!lastRun||s.tile===last) continue; last=s.tile; } else last=-1;
    out.push(actOf(s)); }
  const s0=S[i0]; return {start:{a:s0.alivePre.join(''), d:s0.downPre.join(''), p:s0.peekPre, tray:s0.trayFacesBefore, ck: att.clock&&s0.alivePre[att.clock.i]?{i:att.clock.i,left:att.clock.n-s0.mPre}:null}, acts:out.concat([['end','ok']])}; }
const ob=att=>({need:att.ob.need, locks:att.ob.locks, keys:att.ob.keys, unlocked:false});
const out={};
// lock: both keys, then a tile that was locked
{ const a=get('L92',6); const s=seg(a,2,4); out.lock={tiles:a.tiles.map(t=>[t.x,t.y,t.z]), faces:a.faces, ob:ob(a), segs:[s], keys:a.ob.keys, locks:a.ob.locks};
  console.log('lock', JSON.stringify(s.acts), 'keys', a.ob.keys, 'locks', a.ob.locks, 'clock', JSON.stringify(s.start.ck)); }
// ice: thick ice cracks, thaws, then is taken
{ const pick=[]; for (const [lv,at,t] of [['L99',6,76],['L103',1,36],['L108',2,82],['L110',1,63],['L122',4,10],['L104',1,67]]) { const a=get(lv,at); const S=st(a);
    let crack=-1, thaw=-1, take=-1;
    for(let i=0;i<S.length;i++){ const s=S[i]; if(!s.ob) continue; const l=s.ob.left[t]; const nx=S.slice(i+1).find(x=>x.ob); if(!nx) continue; const l2=nx.ob.left[t];
      if(l===2&&l2===1&&crack<0) crack=i; if(l>0&&l2===0&&thaw<0) thaw=i; if(S[i].gone&&S[i].gone.includes(t)) take=i; }
    if(take<0) for(let i=0;i<S.length;i++) if(S[i].kind!=='peek'&&S[i].gone.includes(t)) take=i;
    pick.push({lv,at,t,crack,thaw,take,span:take-crack}); }
  console.log(JSON.stringify(pick));
  const best=pick.filter(p=>p.crack>=0&&p.take>p.thaw).sort((x,y)=>x.span-y.span)[0]; const a=get(best.lv,best.at);
  const s=seg(a,best.crack,best.take); out.ice={tiles:a.tiles.map(t=>[t.x,t.y,t.z]), faces:a.faces, ob:ob(a), segs:[s], tile:best.t};
  console.log('ice', best.lv, best.at, best.t, JSON.stringify(s.acts), JSON.stringify(s.start.ck)); }
require('fs').writeFileSync(require('path').join(__dirname,'obclips.json'), JSON.stringify(out));   // merged into www/coach-clips.js (ice, lock)
