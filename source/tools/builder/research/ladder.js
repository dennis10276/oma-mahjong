// causal check: same story + layout + seed, only keysShown changes (0, 1, 2); family + planner ratings
const path='/home/claude/repo-oma/source/';
const B=require(path+'tools/builder/builder.js');
const {measureHuman}=require(path+'tools/sim/refit/human_style_measure.js');
const pairs=[['keysFarSide',7],['keysFarSide',20],['lockBeside',7],['lockBeside',20],['iceLockClock',7],['iceLockClock',20]];
for(const [story,layout] of pairs) for(const ks of [2,1,0]){
  const r=B.build({layout,story,seed:1,frame:{spare:1},targets:{trayRoom:0,hiddenOnWay:0,maxDown:0.3,keysShown:ks}},{});
  if(r.fail){console.log(story,layout,ks,'FAIL',r.fail);continue;}
  const f=measureHuman(r.design,{runs:10,seed:4711,seeds:1,setting:'family'});
  const p=measureHuman(r.design,{runs:10,seed:4711,seeds:1,setting:'planner'});
  console.log(JSON.stringify({story,layout,ks,shown:r.card.keysShown,reveal:r.card.keysRevealAt,k:r.card.clock.fewestMoves,family:+f.expectedTries.toFixed(2),skilled:+p.expectedTries.toFixed(2)}));
}
