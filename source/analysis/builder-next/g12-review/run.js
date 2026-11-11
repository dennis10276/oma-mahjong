'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve('..','gemini-builder-g12');
const {createBuilder}=require(path.join(root,'source/tools/builder-next'));
const {createYardstick}=require(path.join(root,'source/tools/builder-next/yardstick.js'));
const ys=createYardstick({cacheDir:path.resolve('source/build/g12-review/meter-cache')});
const builder=createBuilder({ys,knowledgeFile:false});
(async()=>{
 const rows=[];
 for(const seed of [4,11]){
  console.log('Starting diamond target10 seed '+seed);
  const result=await builder.build({target:10,layout:30,seed},{maxCandidates:4,wallMs:120000,campaigns:80});
  rows.push({seed,result});fs.writeFileSync('source/build/g12-review/results.json',JSON.stringify(rows,null,2));
  console.log(JSON.stringify({seed,status:result.status,success:result.success,D:result.evaluation?.D,S:result.evaluation?.S,cost:result.cost,attempts:result.attempts.map(a=>({recipe:a.recipe.id,seed:a.seed,D:a.evaluation?.D,S:a.evaluation?.S,issues:a.issues,failure:a.failure}))}));
 }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
