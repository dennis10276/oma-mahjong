'use strict';
process.env.MECH='1';process.env.NARROW_TRAP='core';
const fs=require('fs'),path=require('path'),D=require('./detower'),P=require('./finish_all_sources'),Q=require('./towers_proof'),T=require('./shape_bench_tools'),G=require(D.CF+'narrow_methods'),E=require(D.CF+'../engine');
const OUT=path.resolve(__dirname,'../../../analysis/builder/finish-all/gate1'),before=P.original(298),a=before.design,base=P.prepare(before),fixed=new Set([a.clock.i,...a.obst.keys,...a.obst.locks,...Object.keys(a.obst.ice).map(Number),...(before.card?.trap?.baits||[]).flatMap(b=>b.tiles),...a.solution.slice(0,a.solution.indexOf(a.clock.i)+1),54,65,75,71,50]);
for(const file of fs.readdirSync(OUT).filter(f=>/^height-candidate-298-2-true-/.test(f)).slice(0,20)){
 const seed=JSON.parse(fs.readFileSync(path.join(OUT,file))),d=structuredClone(seed.design),old65=d.tiles[65],old75=d.tiles[75];d.tiles[54]=[10,11,1];d.tiles[65]=[10,13,1];d.tiles[75]=[10,12,2];d.tiles[50]=old65;
 const variants=[{d,edits:[]}];
 // A returned tile can have acquired a filler on it. Fill that old support spot
 // with an ordinary top tile before checking the reshaped board.
 if(!G.valid(d.tiles))for(let i=0;i<a.tiles.length;i++){if(fixed.has(i))continue;const g=E.game(d);if(g.nb.above[i].length)continue;for(const p of[old65,old75]){const q=structuredClone(d);q.tiles[i]=p;if(G.valid(q.tiles))variants.push({d:q,edits:[[i,p]]});}}
 for(const v of variants){if(!T.geometry(v.d).ok)continue;const sol=D.route(v.d);if(!sol)continue;v.d.solution=sol;const cert=Q.certify(before,v.d,a.tiles.map((_,i)=>i),base);console.log(file,v.edits,cert.ok,cert.errors);
  const r={level:298,source:298,design:v.d,keep:a.tiles.map((_,i)=>i),fixed:[54,65,75,71],certificate:cert,shape:T.geometry(v.d),method:'Keep 75 beside 71; support it with the original 54/65 shifted to half-row offsets above and below row 12'};
  fs.writeFileSync(path.join(OUT,'restore-298-candidate.json'),JSON.stringify(r));if(cert.ok){fs.writeFileSync(path.join(OUT,'level-298.json'),JSON.stringify({...r,ok:true},null,1));process.exit(0);}if(cert.errors.every(e=>['visibleTwins','authoredProof:staticGates'].includes(e)))process.exit(0);
 }
}
