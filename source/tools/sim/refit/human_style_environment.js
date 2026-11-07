'use strict';
const assert=require('assert/strict');
const {performance}=require('perf_hooks');
const Hard=require('./physics/hard.js');
const Layouts=require('./physics/layouts.js');
const {decodeGame}=require('./personal_game_io.js');
const {createSessionFactory,parameters}=require('./production_physical_session.js');
const {visibilityGeometry,observeBoard,observeBoardFast}=require('./human_board_visibility.js');
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
function campaign(encoded,profile,seed,options={}){
 if(options.fast)return campaignFast(encoded,profile,seed,options);
 const {maxAttempts=12,choiceLimit=1024,capture=false,controllerFactory=createStyleController}=options;
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

function campaignFast(encoded,profile,seed,{maxAttempts=12,choiceLimit=1024,capture=false,controllerFactory=createStyleController,auditRate=0.01,_auditMutator=null}={}){
 const game=decodeGame(encoded);
 const geom=visibilityGeometry(game.tiles),nb=geom.neighbors;
 const tiles=game.tiles,faces=game.faces,rules=game.rules;
 const clock=game.clock&&game.clock.i>=0?game.clock:null;
 const n=tiles.length,downSrc=game.down||new Uint8Array(n),alive0=new Uint8Array(n).fill(1);
 const hasJoker=faces.includes(101);
 let byFace=null;
 if(hasJoker){
  byFace=new Map();
  faces.forEach((f,i)=>{if(!byFace.has(f))byFace.set(f,[]);byFace.get(f).push(i);});
 }
 const controller=controllerFactory(tiles,profile,seed),attempts=[];
 const settings={seed:20261111,choiceLimit,tapMs:1000},tapMs=settings.tapMs;
 const doAudit=auditRate>0&&(auditRate>=1||Math.random()<auditRate);
 const auditRecords=doAudit?[]:null;
 const oracle=!!process.env.G51_ORACLE;
 let verifiedTaps=0,slowestMove=0;
 const legalMask=new Uint8Array(n);

 for(let attempt=1;attempt<=maxAttempts;attempt++){
  controller.beginAttempt();
  const alive=new Uint8Array(n).fill(1),stateDown=Array.from(downSrc,v=>+v),peeked=new Uint8Array(n);
  const arrivingUntil=new Float64Array(256),tray=[],actions=[],decisions=[];
  let moves=0,left=n,openPeek=-1,physicalCount=0,tapTime=0,relieved=false,clockLeft=null;
  let endWin=false,endWhy='win';

  const can=i=>rules&&!relieved?Layouts.takeable(i,alive,nb,rules,alive0):Layouts.isFree(i,alive,nb);
  const peekMatch=index=>openPeek>=0&&openPeek!==index&&alive[openPeek]===1&&can(openPeek)&&faces[openPeek]===faces[index]&&!tray.includes(faces[index]);
  const off=(index,countsMove=true)=>{
   alive[index]=0;stateDown[index]=0;
   if(openPeek===index)openPeek=-1;
   left--;if(countsMove)moves++;
  };
  const takeTwin=(face,excluded)=>{
   let twin=-1,best=-1;
   for(let idx=0;idx<n;idx++)if(idx!==excluded&&alive[idx]&&faces[idx]===face){
    const val=(Layouts.isFree(idx,alive,nb)?1000:0)+tiles[idx].z;
    if(val>best){best=val;twin=idx;}
   }
   if(twin>=0)off(twin,true);
  };
  const take=i=>{
   if(!alive[i])return;
   const twin=peekMatch(i)?openPeek:-1,f=faces[i];
   const finale=f===101&&left===1&&tray.length===0;
   off(i,!finale);
   if(finale)return;
   const q=tray.indexOf(f);
   if(q>=0){tray.splice(q,1);arrivingUntil[f&255]=0;return;}
   if(twin>=0){off(twin,true);return;}
   if(f===101){
    const cands=[];
    for(let t=0;t<tray.length;t++)if(tray[t]!==101&&arrivingUntil[tray[t]&255]<=tapTime)cands.push(t);
    const target=cands.find(t=>!byFace.get(tray[t]).some(tw=>alive[tw]&&can(tw)))??cands[0];
    if(target!==undefined){const w=tray[target];tray.splice(target,1);takeTwin(w,-1);arrivingUntil[w&255]=0;return;}
    tray.push(f);arrivingUntil[f&255]=tapTime+230;return;
   }
   if(hasJoker){
    const jq=tray.indexOf(101);
    if(jq>=0&&arrivingUntil[101]<=tapTime){tray.splice(jq,1);takeTwin(f,i);arrivingUntil[101]=0;return;}
   }
   tray.push(f);arrivingUntil[f&255]=tapTime+230;
  };

  let terminated=false;
  while(left>0){
   tapTime=game.tapTimes?.[physicalCount]??(physicalCount+1)*tapMs;
   if(game.settleBefore?.[physicalCount])arrivingUntil.fill(0);
   if(clock&&alive[clock.i]&&moves>=clock.n){endWin=false;endWhy='clock';terminated=true;break;}
   if(physicalCount>=choiceLimit){endWin=false;endWhy='contextChoiceLimit';terminated=true;break;}

   legalMask.fill(0);
   let legalCount=0;
   for(let i=0;i<n;i++)if(alive[i]&&can(i)){legalMask[i]=1;legalCount++;}
   if(legalCount===0&&rules&&!relieved&&tray.length<4){
    for(let i=0;i<n;i++)if(alive[i]&&Layouts.isFree(i,alive,nb)){relieved=true;break;}
    if(relieved)for(let i=0;i<n;i++)if(alive[i]&&Layouts.isFree(i,alive,nb)){legalMask[i]=1;legalCount++;}
   }
   if(legalCount===0){endWin=false;endWhy='none';terminated=true;break;}

   const start=performance.now();
   const arriving=[];
   for(let t=0;t<tray.length;t++){const tf=tray[t];if(arrivingUntil[tf&255]>tapTime)arriving.push(tf);}
   const observed=observeBoardFast(geom,game,alive,stateDown,openPeek,moves,relieved,legalMask);
   // (luck measure only: G51_ORACLE=1 tells the player every hidden picture; the board itself is unchanged)
   if(oracle)for(let i=0;i<n;i++)if(alive[i])observed.pictures[i]=faces[i];
   controller.observe({alive,tray,moves,openPeek,relieved,arriving,physicalTaps:physicalCount},observed);
   const selected=controller.decide();assert(selected&&legalMask[selected.index]===1);
   if(capture==='tail'){
    decisions.push({state:{tray:tray.slice()},index:selected.index});
    if(decisions.length>5)decisions.shift();
   }else if(capture)decisions.push({state:{alive:Array.from(alive),tray:tray.slice(),moves,openPeek,physicalTaps:physicalCount},
    observed:structuredClone(observed),remembered:controller.remembered(),index:selected.index,score:selected.score});
   const elapsed=performance.now()-start;
   if(elapsed>slowestMove)slowestMove=elapsed;

   const idx=selected.index;
   actions.push(idx);
   const clockWasAlive=!!(clock&&alive[clock.i]),leftBeforeTap=left;
   const inOpts=!downSrc[idx]||openPeek===idx||(peeked[idx]===1&&(tray.includes(faces[idx])||peekMatch(idx)));
   if(!inOpts){
    const automatic=tray.includes(faces[idx])||peekMatch(idx);
    peeked[idx]=1;
    if(!automatic){openPeek=idx;physicalCount++;continue;}
   }
   if(clock&&alive[clock.i]&&moves>=clock.n){endWin=false;endWhy='clock';terminated=true;break;}
   take(idx);
   physicalCount++;
   if(clockWasAlive&&!alive[clock.i]){
    // UI takeOff removes the selected tile first, then its peek/joker mate.
    // Match the saved-clock event even when that same tap removes two tiles.
    clockLeft=idx===clock.i?leftBeforeTap-1:left;
   }
   if(inOpts&&tray.length>=4){endWin=false;endWhy='tray';terminated=true;break;}
  }
  if(!terminated){endWin=tray.length===0;endWhy=tray.length?'tray':'win';}

  const endArriving=[];
  for(let t=0;t<tray.length;t++){const tf=tray[t];if(arrivingUntil[tf&255]>tapTime)endArriving.push(tf);}
  const endAliveArr=Array.from(alive),endTrayArr=tray.slice();
  const terminalObserved=observeBoardFast(geom,game,alive,stateDown,openPeek,moves,relieved,null);
  const terminalState={alive:endAliveArr,tray:endTrayArr,moves,openPeek,physicalTaps:physicalCount};
  controller.observe({...terminalState,relieved,arriving:endArriving},terminalObserved);

  const computationCensored=endWhy==='contextChoiceLimit';
  const censored=computationCensored||!endWin&&!['tray','clock','stuck'].includes(endWhy);
  const phase=(clock&&alive[clock.i])?'clock':(left<=10?'late':'mid');
  if(!censored)controller.endAttempt?.(endWin?null:phase==='clock'?'beforeClock':phase,endTrayArr);

  if(doAudit){
   const snap={actions:actions.slice(),win:endWin,why:endWhy,computationCensored,clockLeft,
    state:{alive:endAliveArr,down:stateDown.slice(),tray:endTrayArr,moves,openPeek,relieved,arriving:endArriving,physicalTaps:physicalCount,observationTime:tapTime}};
   if(_auditMutator)_auditMutator(snap,attempt);
   auditRecords.push(snap);
  }
  attempts.push({attempt,win:endWin,why:endWhy,censored,
   phase:endWin||censored?null:phase,
   clockTiming:clockLossTiming(endWin||censored?null:phase,clockLeft,left),clockLeft,
   left,taps:actions.length,...(capture?{actions,decisions,terminal:{state:terminalState,observed:terminalObserved}}:{})});
  if(endWin||censored)break; // Only actual completed losses permit retry.
 }

 if(doAudit){
  const factory=createSessionFactory();
  for(const rec of auditRecords){
   const refSession=factory(game,settings);
   let refClockLeft=null;
   for(const tapIdx of rec.actions){
    const before=refSession.view();
    assert.notEqual(before.type,'productionPhysicalEnd-v1','Fast-mode audit failed: reference session ended early');
    assert(before.legalTiles.includes(tapIdx),'Fast-mode audit failed: illegal tap in reference session');
    const after=refSession.tap(tapIdx);
    if(game.clock&&before.state.alive[game.clock.i]&&!after.state.alive[game.clock.i]){
     refClockLeft=tapIdx===game.clock.i?before.state.alive.reduce((a,b)=>a+b,0)-1:after.state.alive.reduce((a,b)=>a+b,0);
    }
   }
   const endFrame=refSession.view();
   assert.equal(endFrame.type,'productionPhysicalEnd-v1','Fast-mode audit failed: reference session did not terminate');
   assert.equal(rec.win,endFrame.win,'Fast-mode audit failed: win mismatch');
   assert.equal(rec.why,endFrame.why,'Fast-mode audit failed: why mismatch');
   assert.equal(rec.computationCensored,endFrame.computationCensored,'Fast-mode audit failed: computationCensored mismatch');
   assert.equal(rec.clockLeft,refClockLeft,'Fast-mode audit failed: clockLeft mismatch');
   assert.deepEqual(rec.state,endFrame.state,'Fast-mode audit failed: terminal physicalFrame state mismatch');
   verifiedTaps+=verify(encoded,rec.actions,settings,refSession.audit());
  }
  factory.verifySource();
 }

 return {wonOn:attempts.at(-1).win?attempts.length:null,attempts,verifiedTaps,slowestMove};
}
module.exports={campaign,campaignFast,lossPhase};
