'use strict';
const fs=require('fs'),path=require('path'),lib=require('../../tests/lib.js'),{OUT}=require('./chained_v2_run.js');
const REPORT=path.resolve(__dirname,'../../../codex-tasks/results/chained-2');
async function run(){
  const rows=[],selection=JSON.parse(fs.readFileSync(path.join(OUT,'lab-selection.json')));await lib.setup();
  try{for(const q of selection){const r=JSON.parse(fs.readFileSync(path.join(OUT,'examples',q.file))),p=await lib.phone({size:[390,844],state:{name:'Task 17 local',level:80,theme:'classic',seenSp:{gold:1,joker2:1,ice:1,lock:1,clockMoves:1,trayPair:1}}});
    try{
      await p.evaluate(d=>begin({mode:'lab',key:'TASK17-LOCAL',level:332,title:'New chain',track:'',fixedAspect:1.6,makeSpec:()=>({tiles:d.tiles.map(([x,y,z])=>({x,y,z})),kinds:new Set(d.faces).size,seed:17001,diff:Layouts.difficultyFor(201),made:d})},true),r.design);
      await lib.sleep(500);await p.screenshot({path:path.join(REPORT,`lab-${q.id}.png`)});
      const game=await p.evaluate(async d=>{for(const i of d.solution){if(!canTake(i))return {ok:false,why:'notTakeable',tile:i};onTap(i);if(G.alive[i]&&G.peek===i)onTap(i);await new Promise(r=>setTimeout(r,25));if(G.done&&aliveCount())return {ok:false,why:'lost',tile:i};}return {ok:aliveCount()===0&&G.tray.length===0,left:aliveCount(),tray:G.tray.length,done:G.done,moves:G.mv};},r.design);
      rows.push({...q,...game,errors:p.errors.slice(),ok:game.ok&&!p.errors.length});
    }finally{await p.ctx.close();}
  }}finally{await lib.teardown();}
  const result={ok:rows.length===8&&rows.every(r=>r.ok),rows};fs.writeFileSync(path.join(REPORT,'game-previews.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
}
run().catch(e=>{console.error(e);process.exitCode=1;});
