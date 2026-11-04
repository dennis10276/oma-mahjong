'use strict';
const assert=require('assert/strict');
const {performance}=require('perf_hooks');
const Hard=require('./physics/hard.js');
const {decodeGame}=require('./personal_game_io.js');
const {createSessionFactory,parameters}=require('./production_physical_session.js');
const {observeBoard}=require('./human_board_visibility.js');
const {clockLossTiming}=require('./human_clock_loss_timing.js');
const {createStyleController}=require('./human_style_controller.js');

function visibleRole(game,state,index){
 if(!game.rules||state.relieved)return 'none';
 const r=game.rules,gone=r.iceNb[index].filter(i=>!state.alive[i]).length;
 const remaining=Math.max(0,(r.ice[index]||0)-gone);
 if(remaining)return remaining>1?'ice2':'ice';
 const keysLeft=r.keys.some(i=>state.alive[i]);
 if(keysLeft&&r.locks?.has(index))return 'lock';
 return keysLeft&&r.keys.includes(index)?'key':'none';
}
function verify(encoded,actions,settings,audit){
 if(!actions.length){assert.equal(audit.physicalLog.length,0);return 0;}
 const game={...decodeGame(encoded),physicalLog:[]},trace=[];let candidates,cursor=0;
 const result=Hard.play(game,{...parameters(encoded.tiles.length,settings),
  physicalTrayPlanning(g,s,available){candidates=available;return{features:available.map(()=>[]),nodes:0,boundaries:0};},
  physicalChoice(){const next=actions[cursor++],i=candidates.findIndex(action=>action.index===next);assert(i>=0,'Production replay rejected human-policy tap');return i;}
 },settings.seed,trace);
 assert.equal(cursor,actions.length);assert.deepEqual(result,audit.result);
 assert.deepEqual(game.physicalLog,audit.physicalLog);assert.deepEqual(trace,audit.trace);
 return actions.length;
}
// Threshold declared before any fitting: late = <=10 tiles remaining, after
// the clock. A pre-clock tray failure belongs to clock phase, too.
function lossPhase(state,clock){
 if(clock&&state.alive[clock.i])return 'clock';
 return state.alive.reduce((a,b)=>a+b,0)<=10?'late':'mid';
}
function campaign(encoded,profile,seed,{maxAttempts=12,choiceLimit=1024,capture=false,controllerFactory=createStyleController}={}){
 const game=decodeGame(encoded),factory=createSessionFactory();
 const controller=controllerFactory(game.tiles,profile,seed),attempts=[];
 const settings={seed:20261111,choiceLimit,tapMs:1000};let verifiedTaps=0,slowestMove=0;
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  controller.beginAttempt();const session=factory(game,settings),actions=[],decisions=[];
  let frame=session.view(),clockLeft=null;
  while(frame.type!=='productionPhysicalEnd-v1'){
   const start=performance.now(),state=frame.state,legal=new Set(frame.legalTiles);
   const observed=observeBoard(game.tiles,state,game.clock,{picture:i=>game.faces[i],role:i=>visibleRole(game,state,i),takeable:i=>legal.has(i)});
   // (luck measure only: G51_ORACLE=1 tells the player every hidden picture; the board itself is unchanged)
   if(process.env.G51_ORACLE)for(let i=0;i<game.tiles.length;i++)if(state.alive[i])observed.pictures[i]=game.faces[i];
   controller.observe({alive:state.alive,tray:state.tray,moves:state.moves,openPeek:state.openPeek,
    relieved:state.relieved,arriving:state.arriving,physicalTaps:state.physicalTaps},observed);
   const selected=controller.decide();assert(selected&&legal.has(selected.index));
   if(capture === 'tail') {
    decisions.push({state:{tray:state.tray.slice()},index:selected.index});
    if(decisions.length>5)decisions.shift();
   } else if(capture)decisions.push({state:{alive:state.alive.slice(),tray:state.tray.slice(),moves:state.moves,
    openPeek:state.openPeek,physicalTaps:state.physicalTaps},observed:structuredClone(observed),
    remembered:controller.remembered(),index:selected.index,score:selected.score});
   slowestMove=Math.max(slowestMove,performance.now()-start);
   actions.push(selected.index);frame=session.tap(selected.index);
   if(game.clock&&state.alive[game.clock.i]&&!frame.state.alive[game.clock.i]){
    // UI takeOff removes the selected tile first, then its peek/joker mate.
    // Match the saved-clock event even when that same tap removes two tiles.
    clockLeft=selected.index===game.clock.i?state.alive.reduce((a,b)=>a+b,0)-1:frame.state.alive.reduce((a,b)=>a+b,0);
   }
  }
  verifiedTaps+=verify(encoded,actions,settings,session.audit());
  const terminal={state:{alive:frame.state.alive.slice(),tray:frame.state.tray.slice(),moves:frame.state.moves,
   openPeek:frame.state.openPeek,physicalTaps:frame.state.physicalTaps},
   observed:observeBoard(game.tiles,frame.state,game.clock,{picture:i=>game.faces[i],role:i=>visibleRole(game,frame.state,i),takeable:()=>false})};
  controller.observe({...terminal.state,relieved:frame.state.relieved,arriving:frame.state.arriving},terminal.observed);
  const censored=frame.computationCensored||!frame.win&&!['tray','clock','stuck'].includes(frame.why);
  if(!censored)controller.endAttempt?.(frame.win?null:lossPhase(frame.state,game.clock)==='clock'?'beforeClock':lossPhase(frame.state,game.clock),frame.state.tray);
  attempts.push({attempt,win:frame.win,why:frame.why,censored,
   phase:frame.win||censored?null:lossPhase(frame.state,game.clock),
   clockTiming:clockLossTiming(frame.win||censored?null:lossPhase(frame.state,game.clock),clockLeft,frame.state.alive.reduce((a,b)=>a+b,0)),clockLeft,
   left:frame.state.alive.reduce((a,b)=>a+b,0),taps:actions.length,...(capture?{actions,decisions,terminal}: {})});
  if(frame.win||censored)break; // Only actual completed losses permit retry.
 }
 factory.verifySource();
 return {wonOn:attempts.at(-1).win?attempts.length:null,attempts,verifiedTaps,slowestMove};
}
module.exports={campaign,lossPhase};
