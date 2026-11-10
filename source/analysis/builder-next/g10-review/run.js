'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve('..','gemini-builder-g10');
const {createBuilder}=require(path.join(root,'source/tools/builder-next'));
const {createYardstick}=require(path.join(root,'source/tools/builder-next/yardstick.js'));
const ys=createYardstick({cacheDir:path.resolve('source/build/g10-review/meter-cache')});
const builder=createBuilder({ys,knowledgeFile:false});
(async()=>{
 const result=await builder.build({target:10,layout:22,seed:1},{maxCandidates:6,wallMs:180000,campaigns:80});
 fs.writeFileSync('source/build/g10-review/target10-ushape.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({status:result.status,success:result.success,cost:result.cost,attempts:result.attempts.map(a=>({recipe:a.recipe.id,keys:a.recipe.keys,D:a.evaluation?.D,S:a.evaluation?.S,issues:a.issues,failure:a.failure,failedGates:a.evaluation?.failedGates}))}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
