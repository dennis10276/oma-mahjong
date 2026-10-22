/* Game tips, step 1: one player's recorded tries (an export of replays/<pid>) as tap-by-tap records:
   the position before each accepted tap and what the tap did. node walk.js <export.json> [walk.json] */
const fs=require('fs');
const {readReplay}=require('../replays.js');
const path=require('path');
const src=process.argv[2], dst=process.argv[3]||path.join(__dirname,'walk.json');
if(!src){ console.error('usage: node walk.js <replays/<pid>.json export> [walk.json]'); process.exit(1); }
const d=JSON.parse(fs.readFileSync(src,'utf8'));
function neighbors(tiles){const n=tiles.length,above=[],left=[],right=[];for(let i=0;i<n;i++){above.push([]);left.push([]);right.push([]);}
 for(let i=0;i<n;i++){const a=tiles[i];for(let j=0;j<n;j++){if(i===j)continue;const b=tiles[j];if(Math.abs(a.y-b.y)>=2)continue;
 if(b.z>a.z&&Math.abs(a.x-b.x)<2)above[i].push(j);else if(b.z===a.z){if(b.x===a.x-2)left[i].push(j);else if(b.x===a.x+2)right[i].push(j);}}}return{above,left,right};}
function isFree(i,alive,nb){if(!alive[i])return false;for(const j of nb.above[i])if(alive[j])return false;let l=true;for(const j of nb.left[i])if(alive[j]){l=false;break;}if(l)return true;for(const j of nb.right[i])if(alive[j])return false;return true;}
const out=[];
for(const aid in d){let r;try{r=readReplay(d[aid]);}catch(e){continue;}
 if(!r.initial||r.initial.partial)continue;
 const I=r.initial, tiles=I.tiles.map(([x,y,z])=>({x,y,z})), nb=neighbors(tiles), n=tiles.length;
 const faces=I.state.f;
 const att={aid, key:I.key, at:I.at, result:r.result, n, clock:I.state.ck||null, ob:I.state.ob?{locks:I.state.ob.locks,keys:I.state.ob.keys,ice:Object.keys(I.state.ob.need||{}).length}:null, down0:I.state.d.reduce((a,b)=>a+b,0), steps:[], t0:null};
 let S=JSON.parse(JSON.stringify(I.state)); const seen=new Set(); // pictures seen by tile index
 const markSeen=()=>{for(let i=0;i<n;i++) if(S.a[i]&&!S.d[i]){ // face-up & not fully covered
     const full=nb.above[i].some(j=>S.a[j]&&tiles[j].x===tiles[i].x&&tiles[j].y===tiles[i].y); if(!full) seen.add(i);} if(S.p>=0) seen.add(S.p);};
 markSeen();
 const fr=r.frames; let pend=null;
 for(let k=0;k<fr.length;k++){const f=fr[k];
  if(f.kind==='tap'){ if(att.t0===null) att.t0=f.ms; pend={tile:f.data[0],why:f.data[2],ms:f.ms,pre:JSON.parse(JSON.stringify(S)),seenPre:new Set(seen)}; 
     if(f.data[2]){ att.steps.push({kind:'blocked',tile:f.data[0],why:f.data[2],ms:f.ms}); pend=null;} continue;}
  if(f.kind==='state'){ const prev=S; S=JSON.parse(JSON.stringify(f.state));
     if(pend){ const P=pend.pre; const gone=[]; for(let i=0;i<n;i++) if(P.a[i]&&!S.a[i]) gone.push(i);
       let kind; const tl0=P.tr.length, tl1=S.tr.length;
       if(!gone.length) kind = (S.p===pend.tile)?'peek':'other';
       else if(gone.length===1) kind = tl1>tl0?'toTray':'trayMatch';
       else kind = (tl1===tl0)?'pair':'multi';
       const free=[]; for(let i=0;i<n;i++) if(isFree(i,P.a,nb)) free.push(i);
       att.steps.push({kind,tile:pend.tile,gone,ms:pend.ms,trayBefore:P.tr.slice(),trayFacesBefore:P.tr.map(t=>faces[t]),trayAfter:S.tr.slice(),m:S.m,mPre:P.m,peekPre:P.p,downPre:P.d.slice(),alivePre:P.a.slice(),free,seenPre:[...pend.seenPre],ob:P.ob?{left:P.ob.left,unlocked:P.ob.unlocked}:null});
       pend=null; }
     markSeen(); continue;}
  if(['end','shuffle','hint','rescue','nudge','auto','autofinish'].includes(f.kind)) att.steps.push({kind:'ev:'+f.kind,data:f.data,ms:f.ms});
 }
 att.faces=faces; att.tiles=tiles; att.nbAbove=nb.above; att.nbL=nb.left; att.nbR=nb.right;
 out.push(att);}
out.sort((a,b)=>(+a.key.slice(1)||0)-(+b.key.slice(1)||0)||a.at-b.at);
fs.writeFileSync(dst,JSON.stringify(out));
const kinds={};for(const a of out)for(const s of a.steps)kinds[s.kind]=(kinds[s.kind]||0)+1;
console.log(out.length,kinds);
console.log(out.map(a=>a.key+'#'+a.at+':'+a.result+(a.clock?'(ck'+a.clock.n+')':'')).join(' '));
