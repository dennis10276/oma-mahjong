// Dennis: "I think mostly [I am] playing to the most possible outs always." From the recordings: for every take,
// the "outs" left after it (visible free matches for the tray + visible free pairs on the board), for the tile taken
// and for every other tile that could have been taken. Does the player take the tile that leaves the most outs?
const fs=require('fs'),vm=require('vm');const {readReplay}=require('/home/claude/repo-oma/source/tools/replays.js');
const L=require('/home/claude/repo-oma/source/www/layouts.js');global.Layouts=L;
global.HARD_LEVELS=vm.runInNewContext(fs.readFileSync(process.argv[4],'utf8')+';HARD_LEVELS');
const H=require('/home/claude/repo-oma/source/www/hard.js');
const [dir,out]=process.argv.slice(2);const NAME={pmuy78xu6tsths9:'Dennis',pmv6yhzz3x9oxs8:'Gerda',pmv16kj3jr35750:'MrsD'};
const boards={};const B=lv=>{if(!boards[lv]){const d=H.get(lv),tiles=d.tiles.map(t=>Array.isArray(t)?{x:t[0],y:t[1],z:t[2]}:t),o=d.obst||{};boards[lv]={d,tiles,nb:L.neighbors(tiles),rules:{iceNb:L.iceNeighbors(tiles),ice:o.ice||{},locks:new Set(o.locks||[]),keys:o.keys||[]}};}return boards[lv];};
function outs(b,alive,tray,down,alive0){const f=b.d.faces;const free=[];for(let k=0;k<alive.length;k++)if(alive[k]&&!down[k]&&L.takeable(k,alive,b.nb,b.rules,alive0))free.push(k);
 const trayF=new Set(tray.map(j=>f[j]));let n=0;const cnt={};for(const k of free){if(trayF.has(f[k]))n++;cnt[f[k]]=(cnt[f[k]]||0)+1;}for(const c of Object.values(cnt))if(c>=2)n++;return n;}
const tries=[];
for(const fn of fs.readdirSync(dir)){const who=NAME[fn.replace('.json','')];if(!who)continue;
 for(const rec of Object.values(JSON.parse(fs.readFileSync(dir+'/'+fn)))){let r;try{r=readReplay(rec)}catch(e){continue}
  if(!r.initial||!/^L\d+$/.test(r.initial.key)||r.initial.partial)continue;const lv=+r.initial.key.slice(1);if(lv<85||lv>174)continue;tries.push({who,lv,at:r.initial.at,r});}}
const g={};for(const t of tries)(g[t.lv+' '+t.who]=g[t.lv+' '+t.who]||[]).push(t);
const rows=[];
for(const a of Object.values(g)){a.sort((p,q)=>p.at-q.at);const w=a.findIndex(t=>t.r.result==='win');
 for(const t of (w<0?a:a.slice(0,w+1))){const b=B(t.lv);if(b.d.tiles.length!==t.r.initial.state.a.length)continue;const f=b.d.faces,alive0=Uint8Array.from(t.r.initial.state.a);
  let prev=t.r.initial.state,move=0;
  for(const fr of t.r.frames){if(fr.kind!=='state'||!fr.data.a)continue;const gone=fr.data.a.filter(([i,v])=>v===0).map(([i])=>i);
   if(gone.length===1&&prev){const i=gone[0],alive=Uint8Array.from(prev.a),tray=prev.tr||[],down=prev.d;
    const legal=[];for(let k=0;k<alive.length;k++)if(alive[k]&&L.takeable(k,alive,b.nb,b.rules,alive0))legal.push(k);
    if(legal.length>1&&legal.includes(i)){
     const after=k=>{if(down[k])return null;const al=alive.slice();al[k]=0;const q=tray.findIndex(j=>f[j]===f[k]);const tr=q>=0?tray.filter((_,x)=>x!==q):tray.concat(k);if(tr.length>=4)return -1;return outs(b,al,tr,down,alive0);};
     const vals=legal.map(k=>[k,after(k)]).filter(([,v])=>v!==null);const mine=after(i);
     if(mine!==null&&vals.length>1){const best=Math.max(...vals.map(([,v])=>v));const worse=vals.filter(([,v])=>v>mine).length;
      rows.push({who:t.who,lv:t.lv,move,clockOn:!!(b.d.clock&&alive[b.d.clock.i]),tray:tray.length,mine,best,isBest:mine===best,lost:best-mine,options:vals.length,distinct:new Set(vals.map(([,v])=>v)).size});}}
    move++;}
   prev=fr.state;}}}
fs.writeFileSync(out,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');console.log(rows.length,'takes with a choice');
