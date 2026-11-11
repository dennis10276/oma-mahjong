const fs=require('fs'),path=require('path');
const root=path.resolve('..','gemini-builder-g13');
const {planSequence}=require(path.join(root,'source/tools/builder-next/plan_sequence.js'));
(async()=>{
 const t=Date.now();let record;
 try {const out=await planSequence({start:275,count:1,seed:99,fallback:'none',wallMs:15000,maxCandidates:1,campaigns:40,outDir:path.resolve('source/build/g13-review-latest/plan275')});record={executed:true,producedPlan:out.success===true,wallMs:Date.now()-t,out};}
 catch(e){record={executed:false,error:e.message,wallMs:Date.now()-t};}
 fs.writeFileSync('source/build/g13-review-latest/result.json',JSON.stringify(record,null,2));
 console.log(JSON.stringify({executed:record.executed,producedPlan:record.producedPlan,error:record.error,wallMs:record.wallMs,levelStatuses:record.out?.levels?.map(l=>({level:l.level,success:l.success,status:l.status}))}));
})();
