'use strict';
// Explicit construction recipe: interleaved visible-choice body, then an
// authored key/cover-lock/thaw frame. Difficulty is measured by the pipeline.
const VC=require('./visible_choice.js'),K=require('./knobs.js');
const {readable}=require('../factory/placement_score.js');
function build(brief={},options={}){
 const start=Date.now(),frame=brief.frame||{},targets=brief.targets||{};
 if(Object.keys(brief).some(k=>!['id','mode','layout','shape','story','stage','seed','frame','targets','secondAct'].includes(k)))return {fail:'unsupportedBrief'};
 if(brief.story!=null&&brief.story!=='deepClock')return {fail:'incompatibleStory'};
 if(Object.keys(frame).some(k=>!['spare','keys','lockTile','keyIce'].includes(k)))return {fail:'unsupportedFrame'};
 if(Object.keys(targets).some(k=>!['tailPairWidth','traps'].includes(k)))return {fail:'unsupportedTarget'};
 if(Object.keys(options).some(k=>!['mode','tries','wallMs'].includes(k)))return {fail:'unsupportedOption'};
 const spare=frame.spare??2,width=targets.tailPairWidth??2;
 if(![1,2,3].includes(spare)||![1,2,3].includes(width))return {fail:'invalidPlan'};
 if(targets.traps!=null&&(!Number.isInteger(targets.traps)||targets.traps<1||targets.traps>4))return {fail:'invalidPlan'};
 if(!Number.isInteger(brief.layout))return {fail:'invalidLayout'};
 const layout=require('./builder.js').LAYOUTS[brief.layout];if(!layout)return {fail:'invalidLayout'};
 if(brief.shape!=null&&brief.shape!==layout.shape)return {fail:'incompatibleShape'};
 if(brief.stage!=null&&!['edge','centre','top'].includes(brief.stage))return {fail:'invalidStage'};
 if(!Array.isArray(frame.keys)||frame.keys.length!==2||frame.keys[0]===frame.keys[1]||frame.keys.some(i=>!Number.isInteger(i)||i<0||i>=layout.tiles.length))return {fail:'invalidKeys'};
 if(frame.lockTile!=null&&(!Number.isInteger(frame.lockTile)||frame.lockTile<0||frame.lockTile>=layout.tiles.length))return {fail:'invalidLockTile'};
 if(frame.keyIce!=null&&(!Number.isInteger(frame.keyIce.tile)||![1,2].includes(frame.keyIce.h)||Object.keys(frame.keyIce).some(k=>!['tile','h'].includes(k))))return {fail:'invalidIce'};
 const wallMs=options.wallMs??60000;if(!Number.isFinite(wallMs)||wallMs<=0)return {fail:'wallClock'};
 const timedOut=()=>Date.now()-start>=wallMs;
 // Fix the base deadline so frame.spare changes only the subsequent frame.
 const baseBrief={layout:brief.layout,shape:layout.shape,story:'deepClock',stage:brief.stage,seed:brief.seed??1,
  frame:{spare:2},targets:{trayRoom:2,hiddenOnWay:0,maxDown:0,tailPairWidth:width,...(targets.traps!=null?{traps:targets.traps}:{})}};
 const base=VC.build(baseBrief,{...(options.tries!=null?{tries:options.tries}:{}),wallMs});
 if(base.fail||!base.design)return base;
 if(timedOut())return {fail:'wallClock'};
 const proofOptions={...(frame.lockTile!=null?{lockTile:frame.lockTile}:{})};
 const keyed=frame.keyIce?K.clockKeyIce(base.design,frame.keys,frame.keyIce,spare,proofOptions):K.clockKeys(base.design,frame.keys,spare,proofOptions);
 if(timedOut())return {fail:'wallClock'};
 if(keyed.fail)return keyed;
 if(!readable(keyed.design))return {fail:'unreadableFrame'};
 const p=keyed.proof;
 return {...keyed,card:{shape:layout.shape,layout:brief.layout,tiles:keyed.design.tiles.length,story:'Visible keys before the clock',
  clock:{tile:keyed.design.clock.i,n:keyed.design.clock.n,fewestMoves:p.minimum,spare},
  base:{brief:baseBrief,minimum:p.originalMinimum},frame:{keys:p.keys,lockTile:p.lockTile,...(p.ice?{keyIce:p.ice}:{})},
  scope:'Explicit construction with meaningful visible prerequisites; difficulty, pacing and quality require pipeline checks'},
  intents:[{name:'complete strict witness',proven:true},{name:'matching strict/game clock minimum',proven:true},
   {name:'visible key frame increases minimum',proven:p.minimum>p.originalMinimum}],ms:Date.now()-start};
}
module.exports={build};
