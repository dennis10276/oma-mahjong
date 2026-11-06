'use strict';
// Read existing full measurements without launching a bot or manufacturing a
// stage result. Planner reuse is strictly current-fingerprint only.
const fs=require('fs'),path=require('path'),M=require('./meter.js');
function inspector(options={}){
 const fingerprint=options.fingerprint||M.createMeter().fingerprint,dir=path.resolve(options.cacheDir||path.join(__dirname,'../../build/factory-cache'));
 function full(design,setting,seed=4711,capture){
  const settings={runs:20,seeds:2,seed,setting,...(capture?{capture}:{})},input=M.boardOf(design),approved=setting==='family'?M.FAMILY_CACHE_MIGRATIONS[fingerprint]||[]:[];
  for(const sourceFingerprint of[fingerprint,...approved]){
   const file=path.join(dir,M.digest({fingerprint:sourceFingerprint,input,settings})+'.json');if(!fs.existsSync(file))continue;
   let result;try{result=JSON.parse(fs.readFileSync(file));}catch{continue;}
   if(result.valid===true)return{result,file,fingerprint:sourceFingerprint,currentFingerprint:fingerprint,settings};
  }
  return null;
 }
 return{fingerprint,full};
}
module.exports={inspector};
