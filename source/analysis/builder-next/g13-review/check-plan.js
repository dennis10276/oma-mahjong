const fs=require('fs'),path=require('path');
const root=path.resolve('..','gemini-builder-g13');
const mod=require(path.join(root,'source/tools/builder-next/plan_sequence.js'));
(async()=>{
 let result;
 try {const out=await mod.planSequence({start:275,count:1,seed:99,fallback:'none',outDir:path.resolve('source/build/g13-review/plan-275')});result={success:true,out};}
 catch(e){result={success:false,error:e.message};}
 fs.writeFileSync('source/build/g13-review/plan-275-result.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
