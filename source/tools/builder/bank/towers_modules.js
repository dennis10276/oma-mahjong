'use strict';
// Restore trimmed end modules as supported bricks, instead of four free fillers.
const fs=require('fs'),path=require('path'),S=require('./shape_bench'),T=require('./shape_bench_tools'),D=require('./detower'),G=require(D.CF+'narrow_methods');
const OUT=path.resolve(__dirname,'../../../analysis/builder/towers'),B=S.bench(293),j=JSON.parse(fs.readFileSync(path.join(OUT,'293-right.json'))),seed=j.tried[0];B.load(seed);
const initial=structuredClone(B.st.T),loose=[20,59,33,67],rest=initial.filter((_,i)=>!loose.includes(i));
function spots(pair,cur){const out=[];for(let z=0;z<=2;z++)for(let y=0;y<=14;y++)for(let x=0;x<=11;x++)for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
 const p=[x,y,z],q=[x+dx,y+dy,z+1],U=cur.concat([p,q]);if(!T.geometry({...B.a,tiles:U}).errors.every(e=>e==='tileCount'))continue;out.push({pair,ps:[p,q]});}return out;}
const aa=spots([20,59],rest),bb=spots([33,67],rest),candidates=[],begin=Date.now(),reference=T.relations(B.a);console.log('module spots',aa.length,bb.length);
for(const a of aa)for(const b of bb){const U=structuredClone(initial);a.pair.forEach((id,k)=>U[id]=a.ps[k]);b.pair.forEach((id,k)=>U[id]=b.ps[k]);B.st.T=U;const {d}=B.design();if(!T.geometry(d).ok||S.diffDeps(B,{silent:true}).length)continue;
 const inv=T.invariants(B),sc=inv.freed.length+inv.held.length;candidates.push({a,b,sc,mirror:D.shape(U).mirror});}
candidates.sort((a,b)=>a.sc-b.sc||b.mirror-a.mirror);console.log('candidates',candidates.length);
const attempts=[];for(const c of candidates.slice(0,150)){if(Date.now()-begin>180000)break;B.st.T=structuredClone(initial);for(const m of[c.a,c.b])m.pair.forEach((id,k)=>B.st.T[id]=m.ps[k]);const r=B.prove();attempts.push({c,r});console.log(attempts.length,c.sc,c.mirror,r.ok,r.errors||r.why);if(r.ok){B.save('Trimmed ends returned as held two-tile brick modules; original wrong move and control separation preserved');break;}}
fs.writeFileSync(path.join(OUT,'293-modules.json'),JSON.stringify({moduleSpots:[aa.length,bb.length],candidates:candidates.length,attempts,ms:Date.now()-begin},null,2));
