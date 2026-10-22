/* Game tips, step 2: cut the films for www/coach-clips.js out of walk.json (see walk.js).
   The moments are fixed below by level, try and tap number; tiles in COACH_TIPS (js/coach.js) refer to them. */
const {A,acts}=require('./lib.js');
const get=(lv,at)=>A.find(x=>x.key===lv&&x.at===at);
const K=['peek','toTray','trayMatch','pair'];
const st=att=>att.steps.filter(s=>K.includes(s.kind));
// index in st() of the k-th removal
const posOf=(att,k)=>{const S=st(att); let n=-1; for(let i=0;i<S.length;i++){ if(S[i].kind!=='peek'){ n++; if(n===k) return i;}} return -1;};
function state(att,s){ return {a:s.alivePre.slice(), d:s.downPre.slice(), p:s.peekPre, tray:s.trayFacesBefore.slice(), ck: att.clock && s.alivePre[att.clock.i] ? {i:att.clock.i, left:att.clock.n-s.mPre} : null}; }
function actOf(att,s){ if(s.kind==='peek') return ['peek',s.tile]; if(s.kind==='toTray') return ['take',s.tile]; if(s.kind==='trayMatch') return ['match',s.tile];
  const other=s.gone.find(g=>g!==s.tile); return ['pair',s.tile,other]; }
// segment: steps i0..i1 inclusive (indexes in st()); peeks kept only when that tile is used later in the segment or listed in keep
function seg(att,i0,i1,{keep=[],end=null,caps={},marks={}}={}){ const S=st(att); const used=new Set(); for(let i=i0;i<=i1;i++) if(S[i].kind!=='peek') S[i].gone.forEach(g=>used.add(g));
  const out=[]; let lastPeek=S[i0].peekPre;
  for(let i=i0;i<=i1;i++){ const s=S[i]; if(caps[i-i0]) out.push(['cap',caps[i-i0]]); if(marks[i-i0]) out.push(['mark',...marks[i-i0]]);
    if(s.kind==='peek'){ let nx=null; for(let j=i+1;j<=i1;j++) if(S[j].kind!=='peek'){ nx=S[j]; break; }
      const usedNext = nx && nx.gone.includes(s.tile);
      let lastOfRun=true; for(let j=i+1;j<=i1;j++){ if(S[j].kind!=='peek') break; if(S[j].tile===s.tile) lastOfRun=false; }
      if(!((usedNext&&lastOfRun)||keep.includes(s.tile))) continue; if(s.tile===lastPeek) continue; lastPeek=s.tile; }
    else lastPeek=-1;
    out.push(actOf(att,s)); }
  if(end) out.push(['end',end]);
  return {start:state(att,S[i0]), acts:out}; }
const board=att=>({tiles:att.tiles.map(t=>[t.x,t.y,t.z]), faces:att.faces});
const C={};
// 1. three in the tray: three face-down pairs in a row (L102#2 removals 25..27)
{ const a=get('L102',2); const S=st(a); const p25=posOf(a,25), p24=posOf(a,24), p27=posOf(a,27);
  C.three={...board(a), segs:[seg(a,p24+1,p27,{end:'ok'})]}; }
// 2. peek twin (L116#1): last pair, peek, fatal second tap; then the better tap
{ const a=get('L116',1); const S=st(a); const pf=posOf(a,50), p49=posOf(a,49);
  const A1=seg(a,posOf(a,48)+1,pf,{keep:[39],end:'lose'}); const B=seg(a,pf,pf); B.acts=[['pair',43,39],['end','ok']];
  C.twin={...board(a), segs:[A1,B]}; }
// 3. uncover (L92#6 removals 23..27)
{ const a=get('L92',6); const p=posOf(a,23), pe=posOf(a,27);
  C.uncover={...board(a), segs:[seg(a,posOf(a,22)+1,pe,{end:'ok'})], star:64, freed:[42,48,49]}; }
// 4. clock first (L91: attempt 2 lost, attempt 6 won)
{ const a=get('L91',2), b=get('L91',6); const sa=st(a), sb=st(b);
  C.clockFirst={...board(a), segs:[seg(a,0,posOf(a,6),{end:'clock'}), seg(b,0,posOf(b,5),{end:'ok'})], cone:[65,75,79,73]}; }
// 5. clock slot (L132: attempt 1 lost with the clock as 4th tile, attempt 4 won)
{ const a=get('L132',1), b=get('L132',4);
  C.clockSlot={...board(a), segs:[seg(a,0,posOf(a,5),{end:'lose'}), seg(b,0,posOf(b,5),{end:'ok'})]}; }
// 6. look at the tray (L109#2 fatal)
{ const a=get('L109',2); const pf=posOf(a,15); const A1=seg(a,pf,pf,{end:'lose'}); const B=seg(a,pf,pf); B.acts=[['match',38],['end','ok']];
  C.lookTray={...board(a), segs:[A1,B]}; }
// 7. remember (L109#1): the peeks of 27 and 63 before the fatal tap
{ const a=get('L109',1); const S=st(a); const pf=posOf(a,18);
  let i0=pf; let seen27=0,seen63=0; for(let i=pf-1;i>=0;i--){ if(S[i].kind!=='peek'){ if(seen27&&seen63) break; continue;} if(S[i].tile===27) seen27=1; if(S[i].tile===63) seen63=1; i0=i; if(seen27&&seen63&&S[i].tile===63) break; }
  const A1=seg(a,i0,pf,{keep:[27,63],end:'lose'}); const B=seg(a,pf,pf); B.acts=[['pair',63,27],['end','ok']];
  C.remember={...board(a), segs:[A1,B], pair:[27,63]}; }
// 8. retry: same board (L122: attempt 3 lost, attempt 4 won)
{ const a=get('L122',3), b=get('L122',4);
  C.retry={...board(a), segs:[seg(a,0,posOf(a,5),{end:'lose'}), seg(b,0,posOf(b,5),{end:'ok'})], pair:[51,61]}; }
for(const k in C){ C[k].segs.forEach((s,n)=>console.log(k,n,JSON.stringify(s.start.tray),s.start.p,s.start.ck,JSON.stringify(s.acts))); }
for(const k in C) for(const s of C[k].segs){ s.start.a=s.start.a.join(''); s.start.d=s.start.d.join(''); }
const head="/* Oma's Mahjong — the game tips (js/coach.js): short moments from real recorded games, without names.\n   Per tip: the pile (tiles [x, y, z], faces) and one or two parts: the starting position (a: on the board,\n   d: face down, as strings of 0/1; p: the peeked tile; tray: the pictures waiting; ck: the clock) and the taps\n   that follow. Made with source/tools/coach/clips.js from the replays. */\n'use strict';\nconst COACH_CLIPS = ";
require('fs').writeFileSync(require('path').join(__dirname,'../../www/coach-clips.js'),head+JSON.stringify(C)+";\n");
// same board check for multi-attempt clips
for(const [x,y] of [[['L91',2],['L91',6]],[['L132',1],['L132',4]],[['L122',3],['L122',4]]]){ const a=get(...x), b=get(...y); console.log(x[0], JSON.stringify(a.faces)===JSON.stringify(b.faces)); }
