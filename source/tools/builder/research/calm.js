// experiment: take a board, remove (or keep) the off-way free face-up pairs along the witness way to the clock by swapping
// faces with buried tiles; same tiles, specials, clock, way. Then rate with the family bot.
const path='/home/claude/repo-oma/source/';
const E=require(path+'tools/builder/engine.js'), L=global.Layouts;
const {measureHuman}=require(path+'tools/sim/refit/human_style_measure.js');
const boards=JSON.parse(require('fs').readFileSync(path+'analysis/builder/knobs-v1/boards.json','utf8'));
const id=process.argv[2], runs=+process.argv[3]||10;
const d0=boards.find(b=>b.id===id).design;
function calm(d){
  d=JSON.parse(JSON.stringify(d)); const F=d.faces, ck=d.clock.i;
  const pre=d.solution.slice(0,d.solution.indexOf(ck)+1), inPre=new Set(pre);
  const g=E.game(d); let s=E.start(g); const freeEver=new Set();
  // every tile that can be free while digging: free at the start or uncovered by a prefix tile in any order (approx: witness order)
  for(const i of pre){ for(const j of E.legal(g,s)) if(typeof j==='number') freeEver.add(j); const n=E.step(g,s,i); if(!n) break; s=n; }
  for(let i=0;i<F.length;i++) if(!inPre.has(i)) { const al=new Uint8Array(F.length).fill(1); for(const p of pre) al[p]=0; if(L.isFree(i,al,g.nb)) freeEver.add(i); }
  const off=[...freeEver].filter(i=>!inPre.has(i));
  const buried=[...Array(F.length).keys()].filter(i=>!freeEver.has(i)&&!inPre.has(i));
  let swaps=0;
  for(let guard=0;guard<60;guard++){
    const seen=new Map(); let dup=null;
    for(const i of off){ if(d.down.includes(i)) continue; if(seen.has(F[i])){dup=i;break;} seen.set(F[i],i); }
    if(dup===null) break;
    const used=new Set([...freeEver,...pre].map(t=>F[t]));
    const c=buried.find(c=>!used.has(F[c]));
    if(c===undefined) break;
    [F[dup],F[c]]=[F[c],F[dup]]; swaps++;
  }
  d.swaps=swaps; return d;
}
const d1=calm(d0);
const g1=E.game(d1); const w=E.winnable(g1,E.start(g1),{nodes:400000,ms:8000}); const cs=E.clockShortest(g1,{nodes:300000,ms:6000});
console.log('swaps',d1.swaps,'off-way free tiles',0,'changed faces',d0.faces.filter((f,i)=>f!==d1.faces[i]).length,'winnable',w.result,'k',cs&&cs.k,'n',d1.clock.n);
if(w.result==='win'){ d1.solution=E.flatten(w.path);
 for(const [name,d] of [['original',d0],['calm',d1]]){ const m=measureHuman(d,{runs,seed:4711,seeds:1,setting:'family'}); console.log(name,'family',m.expectedTries.toFixed(2)); }}
