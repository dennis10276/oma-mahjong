// for each bot decision on the way to the clock: what kind of move did it take, and what kind was the winning move?
const path='/home/claude/repo-oma/source/';
const E=require(path+'tools/builder/engine.js'), L=global.Layouts;
const boards=JSON.parse(require('fs').readFileSync(path+'analysis/builder/knobs-v1/boards.json','utf8'));
const [id, file]=process.argv.slice(2);
const d=(id==='calm'?JSON.parse(require('fs').readFileSync('calm-design.json','utf8')):boards.find(b=>b.id===id).design), m=JSON.parse(require('fs').readFileSync(file,'utf8'));
const g=E.game(d), ck=d.clock.i, F=d.faces;
const kind=(s,i)=>{ if(typeof i!=='number') return 'peekpair'; const trayHas=s.tray.some(t=>F[t]===F[i]); if(trayHas) return 'match';
  const L2=E.legal(g,s).filter(x=>typeof x==='number'); if(L2.some(j=>j!==i&&F[j]===F[i])) return 'pair'; return 'single'; };
const tally={}; let decisions=0;
for(const r of m.results) for(const a of r.attempts){
  let s=E.start(g);
  for(const i of a.actions){
    if(!s.alive[ck]) break;
    const cl=E.classify(g,s,{nodes:20000,ms:200}); const mine=cl.find(c=>c.move===i||JSON.stringify(c.move)===JSON.stringify(i));
    const win=cl.filter(c=>c.result==='win');
    if(win.length && win.length<cl.length && mine){ decisions++;
      const key=(mine.result==='win'?'RIGHT ':'WRONG ')+kind(s,i)+' | right kinds: '+[...new Set(win.map(c=>kind(s,c.move)))].sort().join('+');
      tally[key]=(tally[key]||0)+1; if(mine.result!=='win') { const n=E.step(g,s,i); break; } }
    const n=E.step(g,s,i); if(!n) break; s=n;
  }
}
console.log(id,'decisions',decisions); for(const [k,v] of Object.entries(tally).sort((a,b)=>b[1]-a[1])) console.log(String(v).padStart(4),k);
