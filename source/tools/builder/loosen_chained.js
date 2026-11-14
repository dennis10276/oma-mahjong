'use strict';
// Fair opening dial: an extra clock move may add viable starts while BOTH
// authored traps still lose. Every changed claim is rebuilt and re-audited.
function loosen(r){
  if(r.card.clock.spare!==1||r.card.trap.firstMoves.winning>=3||r.design.clock.n>=19)return r;
  const M=require('./trap_mixes.js'),V=require('./verify_chained_mixes.js'),attempts=[];
  for(const spare of [2,3]){
    const copy=M.clone(r),roles={...copy.roles,locks:new Set(copy.roles.locks),holderSpecials:new Set(copy.roles.holderSpecials)},k=copy.card.clock.fewestMoves;
    if(k+spare>19)continue;copy.design.clock.n=k+spare;
    const p=M.prove(copy.card.trap.type,copy.design,roles,{k,spare,obviousnessDial:copy.brief.obviousnessDial});
    attempts.push({spare,ok:p.ok,why:p.why,winning:p.card?.firstMoves?.winning});if(!p.ok||p.card.firstMoves.winning<3)continue;
    copy.card.trap=p.card;copy.card.clock={...copy.card.clock,spare,n:k+spare};copy.brief.frame={...copy.brief.frame,spare};
    copy.card.pressureFacts={capProof:{},needsWaiting:null,needsWaitingProven:false};
    copy.notes.push({stage:'fairOpeningDial',from:1,to:spare,winningBefore:r.card.trap.firstMoves.winning,winningAfter:p.card.firstMoves.winning});
    const v=V.verify(copy);if(!v.ok){attempts.at(-1).errors=v.errors;continue;}copy.verification=v;copy.dialAttempts=attempts;return copy;
  }
  r.dialAttempts=attempts;return r;
}
module.exports={loosen};
if(require.main===module){
  const fs=require('fs'),path=require('path'),{job,OUT}=require('./run_chained_mixes.js');
  (async()=>{const dir=path.join(OUT,'examples'),files=fs.readdirSync(dir).filter(f=>f.endsWith('.json'));for(const file of files){
    const full=path.join(dir,file),r=JSON.parse(fs.readFileSync(full,'utf8'));if(r.card.trap.firstMoves.winning>=3)continue;
    const x=await job({mode:'loosen',file:full,wallMs:90000});if(!x.design)continue;
    console.log(JSON.stringify({file,attempts:x.dialAttempts}));
    if(x.card.clock.spare>1){const to=file.replace(/-p1\.json$/,'-p'+x.card.clock.spare+'.json');fs.writeFileSync(path.join(dir,to),JSON.stringify(x,null,2)+'\n');const reserve=path.join(OUT,'reserves');fs.mkdirSync(reserve,{recursive:true});if(to!==file)fs.renameSync(full,path.join(reserve,file));console.log(JSON.stringify({file:to,winning:x.card.trap.firstMoves.winning}));}
  }})();
}
