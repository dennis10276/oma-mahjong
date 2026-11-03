// From the recordings: every tile a player took off the board, with what the board looked like just before
// (face-down tiles left, tray), whether it went into the tray unmatched although a visible free match for a tray
// tile was there ("missed match"). Tries up to the first win only. Writes one row per take.
const fs=require('fs'),vm=require('vm');const {readReplay}=require('/home/claude/repo-oma/source/tools/replays.js');
const L=require('/home/claude/repo-oma/source/www/layouts.js');global.Layouts=L;
global.HARD_LEVELS=vm.runInNewContext(require('child_process').execSync('git -C /home/claude/repo-oma show origin/main:source/www/levels-hard.js').toString()+';HARD_LEVELS');
const H=require('/home/claude/repo-oma/source/www/hard.js');
const [dir,out]=process.argv.slice(2);const NAME={pmuy78xu6tsths9:'Dennis',pmv6yhzz3x9oxs8:'Gerda',pmv16kj3jr35750:'MrsD'};
const boards={};const B=lv=>{if(!boards[lv]){const d=H.get(lv),tiles=d.tiles.map(t=>Array.isArray(t)?{x:t[0],y:t[1],z:t[2]}:t),o=d.obst||{};boards[lv]={d,tiles,nb:L.neighbors(tiles),rules:{iceNb:L.iceNeighbors(tiles),ice:o.ice||{},locks:new Set(o.locks||[]),keys:o.keys||[]}};}return boards[lv];};
const tries=[];
for(const f of fs.readdirSync(dir)){const who=NAME[f.replace('.json','')];if(!who)continue;
 for(const rec of Object.values(JSON.parse(fs.readFileSync(dir+'/'+f)))){let r;try{r=readReplay(rec)}catch(e){continue}
  if(!r.initial||!/^L\d+$/.test(r.initial.key)||r.initial.partial)continue;const lv=+r.initial.key.slice(1);if(lv<85||lv>174)continue;
  tries.push({who,lv,at:r.initial.at,r});}}
// up to the first win
const g={};for(const t of tries)(g[t.lv+' '+t.who]=g[t.lv+' '+t.who]||[]).push(t);
const rows=[];
for(const a of Object.values(g)){a.sort((p,q)=>p.at-q.at);const w=a.findIndex(t=>t.r.result==='win');
 for(const t of (w<0?a:a.slice(0,w+1))){const b=B(t.lv);if(b.d.tiles.length!==t.r.initial.state.a.length)continue;const faces=b.d.faces,alive0=Uint8Array.from(t.r.initial.state.a);
  let prev=t.r.initial.state,move=0;
  for(const fr of t.r.frames){if(fr.kind!=='state'||!fr.data.a)continue;const s=fr.state;
   const gone=fr.data.a.filter(([i,v])=>v===0).map(([i])=>i);
   if(gone.length===1&&prev){const i=gone[0],alive=Uint8Array.from(prev.a),tray=prev.tr||[],down=prev.d;
    const fog=down.reduce((c,d,k)=>c+(d&&alive[k]?1:0),0);
    const matched=tray.some(j=>faces[j]===faces[i]);
    let avail=false;if(!matched&&tray.length)for(let k=0;k<alive.length&&!avail;k++){if(!alive[k]||down[k]||k===i)continue;if(tray.some(j=>faces[j]===faces[k])&&L.takeable(k,alive,b.nb,b.rules,alive0))avail=true;}
    const twinFree=(()=>{for(let k=0;k<alive.length;k++)if(k!==i&&alive[k]&&!down[k]&&b.d.faces[k]===b.d.faces[i]&&L.takeable(k,alive,b.nb,b.rules,alive0))return true;return false;})();rows.push({who:t.who,lv:t.lv,at:t.at,move:move++,twinFree,clockOn:!!(b.d.clock&&alive[b.d.clock.i]),n:alive.length,left:alive.reduce((c,v)=>c+v,0),fog,tray:tray.length,matched,missed:!matched&&avail,wasDown:!!down[i],result:t.r.result});}
   prev=s;}}}
fs.writeFileSync(out,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');console.log(rows.length,'takes');
