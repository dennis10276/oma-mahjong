'use strict';
// Bounded examination of half-row movements. No picture or clock changes.
const fs=require('fs'),path=require('path'),S=require('./shape_bench'),T=require('./shape_bench_tools'),D=require('./detower'),E=require(D.CF+'../engine');
const OUT=path.resolve(__dirname,'../../../analysis/builder/towers');fs.mkdirSync(OUT,{recursive:true});
for(const lv of process.argv.slice(2).map(Number)){
 const B=S.bench(lv),begin=Date.now(),attempts=[],sv=path.resolve(__dirname,`../../../../../codex-tasks/results/narrow-251-299/placements-4/level-${lv}.json`);
 if(fs.existsSync(sv)){const j=JSON.parse(fs.readFileSync(sv));j.positions.forEach((p,i)=>{if(p)B.st.T[i]=p.slice();});for(const i of j.erased||[])B.st.dropped.add(i);
  // Erased editor tiles are still unfinished work, not an odd-sized final board.
  // Put them back on supported spots before judging vertical compaction.
  let missing=false;for(const i of j.erased||[]){B.st.dropped.delete(i);const spot=S.safeSpot(B,i,{x0:0,x1:13,y0:0,y1:16,zmax:3});if(!spot){missing=true;B.st.dropped.add(i);}}
  if(missing){fs.writeFileSync(path.join(OUT,`vertical-${lv}.json`),JSON.stringify({level:lv,found:false,reason:'Editor erasures could not all be returned with unchanged trap holds; incomplete layouts were not treated as final compaction attempts.',missing:[...B.st.dropped]}));continue;}}
 else {const j=JSON.parse(fs.readFileSync(path.resolve(OUT,`../footprint60/detower/level-${lv}.json`)));B.load(j.ok?j:j.tried.find(t=>t.design&&t.errors));}
 const seed=T.geometry(B.design().d),initial=structuredClone(B.st.T),ys=[...new Set(initial.map(t=>t[1]))].sort((a,b)=>a-b),filtered={};let count=0,found=false;
 // Slide a contiguous vertical slice, optionally limited to upper layers.
 outer:for(let z0=0;z0<=3;z0++)for(let start=0;start<ys.length;start++)for(let end=start;end<ys.length;end++)for(const dy of [1,-1,2,-2]){
  if(Date.now()-begin>120000)break outer;
  B.st.T=initial.map(t=>[t[0],t[1]+(t[2]>=z0&&t[1]>=ys[start]&&t[1]<=ys[end]?dy:0),t[2]]);B.centre();const {d}=B.design();const geo=T.geometry(d);if(!geo.ok){for(const e of geo.errors)filtered[e]=(filtered[e]||0)+1;continue;}count++;
  // Replay the unchanged prefix before a full certificate.
  const pre=S.explainRoute(d,d.solution.slice(0,d.solution.indexOf(d.clock.i)+1));if(pre.lines.some(l=>/NOT TAKEABLE|LOSES/.test(l)))continue;
  const r=B.prove();attempts.push({z0,start:ys[start],end:ys[end],dy,r});console.log(lv,z0,ys[start],ys[end],dy,r.ok,r.errors||r.why);
  if(r.ok){B.save('Half-row compaction preserving the original trap');found=true;break outer;}
 }
 fs.writeFileSync(path.join(OUT,`vertical-${lv}.json`),JSON.stringify({level:lv,found,seed,filtered,count,ms:Date.now()-begin,attempts},null,2));
}
