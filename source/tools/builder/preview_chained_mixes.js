'use strict';
// Real game render/replay against the test harness's fake database. No live
// service and no prototype mechanic. Run under the final heavy reservation.
const fs=require('fs'),path=require('path'),lib=require('../../tests/lib.js');
const {OUT}=require('./verify_chained_mixes.js'),REPORT=path.resolve(__dirname,'../../../codex-tasks/results/chained-mixes-v1');
async function run(){
  const selection=JSON.parse(fs.readFileSync(path.join(OUT,'selection.json'),'utf8'));
  const requested=process.argv.slice(2),files=requested.length?requested:selection.order.slice(0,3),rows=[];
  await lib.setup();
  try{
    for(const file of files){
      const r=JSON.parse(fs.readFileSync(path.join(OUT,'examples',file),'utf8'));
      const p=await lib.phone({size:[390,844],state:{name:'Chain review',level:80,theme:'classic',seenSp:{gold:1,joker2:1,ice:1,lock:1,clockMoves:1,trayPair:1}}});
      try{
        await p.evaluate(d=>begin({mode:'lab',key:'TASK15-LOCAL',level:300,title:'Chained mix review',track:'',fixedAspect:1.6,makeSpec:()=>({tiles:d.tiles.map(([x,y,z])=>({x,y,z})),kinds:new Set(d.faces).size,seed:15001,diff:Layouts.difficultyFor(201),made:d})},true),r.design);
        await lib.sleep(600);await p.screenshot({path:path.join(REPORT,file.replace('.json','.png'))});
        const result=await p.evaluate(async d=>{
          for(const i of d.solution){if(!canTake(i))return {ok:false,why:'notTakeable',tile:i};onTap(i);if(G.alive[i]&&G.peek===i)onTap(i);await new Promise(r=>setTimeout(r,25));if(G.done&&aliveCount())return {ok:false,why:'lost',tile:i};}
          return {ok:aliveCount()===0&&G.tray.length===0,left:aliveCount(),tray:G.tray.length,done:G.done,moves:G.mv};
        },r.design);
        const errors=p.errors.slice();rows.push({file,...result,errors,ok:result.ok&&errors.length===0});
      }finally{await p.ctx.close();}
    }
  }finally{await lib.teardown();}
  const result={ok:rows.length===files.length&&rows.every(r=>r.ok),rows};fs.writeFileSync(path.join(REPORT,'game-previews.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
}
run().catch(e=>{console.error(e);process.exitCode=1;});
