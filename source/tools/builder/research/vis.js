const path='/home/claude/repo-oma/source/';
const E=require(path+'tools/builder/engine.js');
const {tileVisibility}=require(path+'tools/sim/refit/human_board_visibility.js');
const boards=JSON.parse(require('fs').readFileSync(path+'analysis/builder/knobs-v1/boards.json','utf8'));
const rows=[];
for(const b of boards){ if(!b.family||!b.design) continue; const d=b.design; if(!d.obst.keys||!d.obst.keys.length) continue;
  const tiles=d.tiles.map(([x,y,z])=>({x,y,z})); const g=E.game(d); const ck=d.clock.i, pre=d.solution.slice(0,d.solution.indexOf(ck)+1);
  let s=E.start(g); const st=()=>({alive:s.alive,down:Uint8Array.from(d.tiles.map((_,i)=>d.down.includes(i)?1:0)),openPeek:-1});
  const v0=tileVisibility(tiles,st(),d.clock).tiles; const keysVis0=d.obst.keys.filter(k=>v0[k].role).length;
  let reveal=null; for(let k=0;k<pre.length;k++){ const v=tileVisibility(tiles,st(),d.clock).tiles; if(d.obst.keys.every(x=>!s.alive[x]||v[x].role)){reveal=k;break;} const n=E.step(g,s,pre[k]); if(!n)break; s=n; }
  const keyCover=d.obst.keys.map(k=>g.nb?0:0);
  rows.push({id:b.id,story:b.brief.story,fam:b.family.exp,sk:b.skilled?.exp,keysVis0,reveal,way:pre.length,spare:d.clock.n-pre.length});
}
const med=a=>{a=a.slice().sort((x,y)=>x-y);return a.length?a[a.length>>1]:null;};
console.log('boards with keys',rows.length);
for(const kv of [0,1,2]){const a=rows.filter(r=>r.keysVis0===kv).map(r=>r.fam);console.log('keys visible at start',kv,'n',a.length,'family median',med(a)?.toFixed(2),'share>=18',(a.filter(v=>v>=18).length/(a.length||1)).toFixed(2));}
for(const [lo,hi] of [[0,0],[1,3],[4,6],[7,9],[10,99]]){const a=rows.filter(r=>r.reveal!=null&&r.reveal>=lo&&r.reveal<=hi).map(r=>r.fam);console.log('keys revealed after',lo+'-'+hi,'moves: n',a.length,'family median',med(a)?.toFixed(2),'share>=18',(a.filter(v=>v>=18).length/(a.length||1)).toFixed(2));}
require('fs').writeFileSync('vis.json',JSON.stringify(rows));
