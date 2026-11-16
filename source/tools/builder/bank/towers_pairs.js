'use strict';
// Restore the exposed ordinary pairs lost when the top row was placed inside.
const fs=require('fs'),path=require('path'),S=require('./shape_bench'),B=S.bench(279),file=path.resolve(__dirname,'../../../analysis/builder/footprint60/bench/level-279.json'),initial=JSON.parse(fs.readFileSync(file)),attempts=[];
const targets=[1,4,3,68],pools=[[41,40,57,69],[41,40,59,69],[41,40,72,69],[41,40,75,69],[41,40,74,69],[41,40,57,72],[41,40,59,72]];
for(const partners of pools){B.load(initial);targets.forEach((id,k)=>{const p=B.st.T[id];B.st.T[id]=B.st.T[partners[k]];B.st.T[partners[k]]=p;});const r=B.prove();attempts.push({targets,partners,result:r});console.log(partners,r.ok,r.errors||r.why);if(r.ok){B.save('All original visible finish pairs restored by moving ordinary tiles; route and trap pictures unchanged');break;}}
fs.writeFileSync(path.resolve(__dirname,'../../../analysis/builder/towers/279-pairs.json'),JSON.stringify(attempts,null,2));
