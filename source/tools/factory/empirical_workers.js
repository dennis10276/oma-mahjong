'use strict';
const {Worker}=require('worker_threads');
// One bounded pool: independent boards share the available CPUs even when
// one parent has many more expensive children than the others.
async function pool(tasks,file,onResult,limit=4){
 if(!Number.isInteger(limit)||limit<1)throw Error('Worker limit must be positive');
 if(!tasks.length)return;
 const queue=tasks.slice(),workers=[];
 await new Promise((resolve,reject)=>{
  let stopped=false,closed=0;
  const fail=async e=>{if(stopped)return;stopped=true;await Promise.allSettled(workers.map(w=>w.terminate()));reject(e);};
  const next=w=>{if(stopped)return;const task=queue.shift();if(task){w.busy=true;w.postMessage(task);}else w.terminate().then(()=>{if(++closed===workers.length&&!stopped){stopped=true;resolve();}},fail);};
  for(let i=0;i<Math.min(limit,tasks.length);i++){
   const w=new Worker(file);workers.push(w);w.on('error',fail);
   w.on('exit',code=>{if(w.busy&&!stopped)fail(Error('Worker exited during a board: '+code));});
   w.on('message',async r=>{if(stopped)return;w.busy=false;try{if(r.error)throw Error(r.error);await onResult(r);next(w);}catch(e){await fail(e);}});
  }
  workers.forEach(next);
 });
}
module.exports={pool};
