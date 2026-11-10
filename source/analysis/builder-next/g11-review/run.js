'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve('..','gemini-builder-g11');
const {createBuilder}=require(path.join(root,'source/tools/builder-next'));
const {createYardstick}=require(path.join(root,'source/tools/builder-next/yardstick.js'));
const ys=createYardstick({cacheDir:path.resolve('source/build/g11-review/meter-cache')});
const builder=createBuilder({ys,knowledgeFile:false});
(async()=>{
 const rows=[];
 for(const seed of [4,5]){
  console.log('Starting pyramid target13 seed '+seed);
  const result=await builder.build({target:13,layout:6,seed},{maxCandidates:6,wallMs:120000,campaigns:80});
  const row={seed,result};rows.push(row);fs.writeFileSync('source/build/g11-review/results.json',JSON.stringify(rows,null,2));
  console.log(JSON.stringify({seed,status:result.status,success:result.success,D:result.evaluation?.D,S:result.evaluation?.S,cost:result.cost,attempts:result.attempts.map(a=>({recipe:a.recipe.id,D:a.evaluation?.D,S:a.evaluation?.S,issues:a.issues,failure:a.failure}))}));
 }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
