'use strict';
// Bounded prototype authoring. Run through loop/heavy.js. Existing family proofs
// are rebuilt; the independent verifier is the authority for the saved result.
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const M=require('./trap_mixes.js'),E=require('./engine.js'),V=require('./verify_trap_mixes.js'),S=require('./select_trap_mixes.js');
const {tileVisibility}=require('../sim/refit/human_board_visibility.js');
const OUT=path.resolve(__dirname,'../../analysis/builder/bank/variety-v1'),DIR=path.join(OUT,'prototypes/ribbon');
const clone=x=>JSON.parse(JSON.stringify(x));
const {verify,badgeClear}=require('./verify_ribbon.js');
function make(file){
  const r=JSON.parse(fs.readFileSync(file)),d=r.design,roles=clone(r.roles),name=r.brief.story;
  roles.locks=new Set(roles.locks);roles.holderSpecials=new Set(roles.holderSpecials);
  const g=E.game(d),s=E.start(g),vis=tileVisibility(g.tiles,{...s,down:g.down,openPeek:-1},null).tiles;
  const endpoints=[...Array(g.n).keys()].filter(i=>!g.down[i]&&vis[i].role&&badgeClear(d,i));
  const specials=new Set([d.clock.i,...d.obst.keys,...d.obst.locks,...Object.keys(d.obst.ice).map(Number)]);
  const targets=endpoints.filter(i=>(i===d.clock.i||g.toClock[i]||specials.has(i)||d.solution.indexOf(i)<r.card.clock.fewestMoves));
  const sources=endpoints.filter(i=>!specials.has(i)&&E.legal(g,s).includes(i)&&d.solution.indexOf(i)>=r.card.clock.fewestMoves);
  const notes=[];
  for(const target of targets)for(const source of sources){
    if(target===source)continue;
    const dd=clone(d);dd.obst.after={[target]:source};dd.clock.n=99;
    const cs=M.shortest(dd);if(!cs||cs.k<=r.card.clock.fewestMoves||cs.k>17){notes.push(!cs?'shortestUnknown':'noMinimumEffect');continue;}
    const strict=M.shortest(dd,{strict:true});if(!strict||strict.k!==cs.k){notes.push('strictMinimum');continue;}
    const bd={...dd,solution:E.flatten(strict.path),clock:{...dd.clock,n:cs.k+1}},k=cs.k,proof=M.prove(name,bd,roles,{k,spare:1},{wallMs:12000});
    if(!proof.ok){notes.push(proof.why);continue;}
    const tail=M.Tail.measure(bd,{seed:977,playouts:800});if(tail.tailGreedyWin<.15||tail.tailGreedyWin>.4){notes.push('tail');continue;}
    const priced=V.controls(bd).map(take=>V.reprice(bd,k,take));if(priced.some(p=>!p.exact))continue;
    const value=p=>p.result==='lose'?Math.min(3,19-k)+1:p.cost;priced.sort((a,b)=>value(b)-value(a));
    proof.card.control={moves:priced.length,dearest:priced[0]||null,value:priced.length?value(priced[0]):0};
    for(const bait of proof.card.baits)bait.aboveControl=value(bait)>proof.card.control.value;
    const out={...r,design:bd,roles:{...r.roles},card:{...r.card,trapType:'prototype:ribbon:'+name,clock:{fewestMoves:k,spare:1,n:bd.clock.n,tile:bd.clock.i},trap:proof.card,tail,pressure:V.storedPressure(bd),pressureFacts:{capProof:{cap1:'unknown',cap2:'unknown'},needsWaiting:null,needsWaitingProven:false},ribbon:{source,target,kWithout:r.card.clock.fewestMoves,rule:'Take the numbered source before its arrow tile.',see:'Clear the numbered source before its arrow tile, then follow the melt route without parking the clock too early.'}},prototype:'ribbon-v1',parent:path.basename(file)};
    const previous=S.history(),check=verify(out,previous);if(!check.ok){notes.push(check.errors.join(','));continue;}
    out.verification=check;return out;
  }
  return {fail:'noRibbon',file,targets,sources,notes};
}
if(!isMainThread){try{parentPort.postMessage(workerData.verify?verify(JSON.parse(fs.readFileSync(workerData.file)),workerData.previous):make(workerData.file));}catch(e){parentPort.postMessage({fail:e.stack});}}
function job(data,ms=120000){return new Promise(resolve=>{const w=new Worker(__filename,{workerData:data}),timer=setTimeout(()=>{w.terminate();resolve({fail:'hardWall'});},ms);w.once('message',r=>{clearTimeout(timer);w.terminate();resolve(r);});w.once('error',e=>{clearTimeout(timer);resolve({fail:e.stack});});});}
async function run(){
  fs.mkdirSync(DIR,{recursive:true});const log=[],used=new Set(),saved=[];
  const files=['reserves','examples'].flatMap(dir=>fs.readdirSync(path.join(OUT,dir)).filter(f=>/^(keyRoofMeltFork|roofKeyGuard|nestedMeltFork|frozenKeyShared|repeatedFrozenKey|freeClockShared|freeClockIce|freeClockKeys).*\.json$/.test(f)).map(f=>path.join(OUT,dir,f)));
  let cursor=0;const deadline=Date.now()+20*60000;
  await Promise.all(Array.from({length:4},async()=>{while(cursor<files.length&&saved.length<2&&Date.now()<deadline){const file=files[cursor++],r=await job({file});log.push({file:path.basename(file),ok:!!r.design,fail:r.fail,notes:r.notes});console.log(JSON.stringify(log.at(-1)));if(r.design&&!used.has(r.card.layout)&&saved.length<2){used.add(r.card.layout);const name='ribbon-L'+r.card.layout+'.json';saved.push(name);fs.writeFileSync(path.join(DIR,name),JSON.stringify(r,null,2)+'\n');}}}));
  // Re-prove in a fresh worker and include the second prototype in this separate
  // demonstration ledger. They are not assigned after the 30-board sequence.
  let previous=S.history();const audit=[];
  for(const file of saved){const full=path.join(DIR,file),r=await job({file:full,verify:true,previous});audit.push({file,...r});if(r.ok){const b=JSON.parse(fs.readFileSync(full));b.verification=r;fs.writeFileSync(full,JSON.stringify(b,null,2)+'\n');previous.push(M.Ledger.signature(b.design,b.card));}else fs.unlinkSync(full);}
  const result={ok:saved.length===2&&audit.every(r=>r.ok),log,audit};fs.writeFileSync(path.join(DIR,'audit.json'),JSON.stringify(result,null,2)+'\n');fs.writeFileSync(path.join(DIR,'examples.json'),JSON.stringify({files:audit.filter(r=>r.ok).map(r=>r.file)},null,2)+'\n');if(!result.ok)process.exitCode=1;
}
if(isMainThread&&require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={verify,badgeClear,job};
