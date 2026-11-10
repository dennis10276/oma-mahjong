'use strict';
const fs=require('fs');
const {createBuilder}=require('../../../tools/builder-next');
const dir='source/build/builder-next-b3-pilot-repeat';
fs.mkdirSync(dir,{recursive:true});
const builder=createBuilder({knowledgeFile:dir+'/knowledge.json'});
(async()=>{
 const rows=[];
 for(const [layout,target] of [[22,10],[22,13],[20,10],[20,13]]) {
  console.log(JSON.stringify({starting:{layout,target},at:new Date().toISOString()}));
  const result=await builder.build({layout,target},{maxCandidates:4,wallMs:180000,campaigns:80});
  const row={layout,target,result};rows.push(row);
  fs.writeFileSync(dir+'/results.json',JSON.stringify(rows,null,2));
  console.log(JSON.stringify({layout,target,status:result.status,cost:result.cost,attempts:result.attempts.map(a=>({recipe:a.recipe.id,D:a.evaluation?.D,S:a.evaluation?.S,issues:a.issues,failure:a.failure,failedGates:a.evaluation?.failedGates,unresolved:a.evaluation?.unresolved}))}));
 }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
