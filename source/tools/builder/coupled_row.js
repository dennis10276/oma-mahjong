'use strict';
// Turn a row's premature single into a safe uncovering move followed by a
// genuine choice of which identical matching copy should leave the board.
const E=require('./engine.js'),Rows=require('./row_choice.js');
const {tileVisibility}=require('../sim/refit/human_board_visibility.js');
function couple(source,choice,index=0,options={}){
 if(!Number.isInteger(index)||index<0||!source.clock||source.down?.length||source.gold?.length||Object.keys(source.obst?.ice||{}).length||source.obst?.locks?.length||source.obst?.keys?.length)return {fail:'unsupportedCouplingSource'};
 if(!choice?.tiles||!Rows.placements(source.tiles).some(p=>p.ids.join(',')===choice.tiles.join(',')))return {fail:'invalidRowChoice'};
 const core=new Set(choice.tiles),g=E.game(source);let state=E.start(g);
 for(const i of choice.prefix){state=E.step(g,state,i);if(!state)return {fail:'invalidPrefix'};}
 const bad=choice.tiles[5],head=choice.tiles[1],face=g.faces[head];
 if(state.tray.length!==1||core.size!==9||choice.tiles.some(i=>!state.alive[i])||g.faces.filter(f=>f===face).length!==2||source.clock.i!==choice.prefix[0])return {fail:'invalidRowChoice'};
 const setup=E.step(g,state,bad);if(!setup)return {fail:'invalidSetup'};
 const beforeFree=new Set(E.legal(g,state)),afterFree=new Set(E.legal(g,setup));
 const shown=tileVisibility(g.tiles,{alive:setup.alive,down:g.down,openPeek:-1},null).tiles,candidates=[];
 const unique=i=>g.faces.filter(f=>f===g.faces[i]).length===2;
 for(const exposed of afterFree)if(!core.has(exposed)&&!beforeFree.has(exposed)&&shown[exposed].picture&&unique(exposed)){
  for(const anchor of beforeFree)if(!core.has(anchor)&&anchor!==exposed&&shown[anchor].picture&&unique(anchor)&&g.faces[anchor]!==g.faces[exposed]){
   const mateA=g.faces.findIndex((f,i)=>i!==exposed&&f===g.faces[exposed]),mateB=g.faces.findIndex((f,i)=>i!==anchor&&f===g.faces[anchor]);
   if([exposed,anchor,mateA,mateB].every(i=>state.alive[i]&&!core.has(i)))candidates.push({exposed,anchor,mateA,mateB});
  }
 }
 candidates.sort((a,b)=>a.exposed-b.exposed||a.anchor-b.anchor);const selected=candidates[index];if(!selected)return {fail:'couplingNotFound',candidates:candidates.length};
 const {exposed,anchor,mateA,mateB}=selected,d=structuredClone(source),otherFace=g.faces[exposed];d.faces[exposed]=d.faces[anchor]=face;d.faces[mateA]=d.faces[mateB]=otherFace;
 if(!shown[head].picture)return {fail:'matchingChoiceHidden'};
 const nextGame=E.game(d);let at=E.start(nextGame);for(const i of choice.prefix)at=E.step(nextGame,at,i);
 const revealed=E.step(nextGame,at,bad),pairState=revealed&&E.step(nextGame,revealed,anchor),correct=pairState&&E.step(nextGame,pairState,head),wrong=pairState&&E.step(nextGame,pairState,exposed);
 if(!correct||!wrong)return {fail:'pairChoiceNotLegal',selected};
 const budget={nodes:options.nodes??200000,ms:Infinity},good=E.winnable(nextGame,correct,budget),lost=E.winnable(nextGame,wrong,budget);
 if(good.result!=='win'||lost.result!=='lose')return {fail:'coupledChoiceUnproven',selected,good:good.result,wrong:lost.result};
 d.solution=choice.prefix.concat([bad,anchor,head],E.flatten(good.path));if(!E.replay(d,d.solution,{strict:true}).ok)return {fail:'strictWitness'};
 return {design:d,proof:{...selected,candidateIndex:index,candidateCount:candidates.length,setup:bad,correctMate:head,wrongMate:exposed,
  rewiredTiles:[exposed,anchor,mateA,mateB],changed:source.faces.flatMap((f,i)=>f!==d.faces[i]?[i]:[]),picture:face,
  prefix:choice.prefix.slice(),atPair:{alive:Array.from(pairState.alive),tray:pairState.tray.map(i=>nextGame.faces[i]),moves:pairState.moves},correct:'win',wrong:'lose',setupIsSafe:true,allMatchingChoicesVisible:true,
  witness:true,minimum:1,spare:d.clock.n-1,scope:'Physical matching-copy fork with a complete winning witness; difficulty and quality require measurement'}};
}
function build(brief={},options={}){
 const begin=Date.now();
 if(brief.story&&brief.story!=='chooseMatchingCopy')return {fail:'incompatibleStory'};
 const index=brief.targets?.pairChoice??0,{pairChoice,...targets}=brief.targets||{};
 if(targets.control||targets.echoPairs)return {fail:'incompatibleCouplingPlan'};
 const base=Rows.build({...brief,mode:'rowChoice',story:'reserveBeforeRoof',targets},options);if(base.fail)return base;
 const result=couple(base.design,base.card.choice,index,options);if(result.fail)return result;
 if(Date.now()-begin>(options.wallMs??60000))return {fail:'wallClock'};
 return {...result,card:{shape:base.card.shape,tiles:base.card.tiles,layout:brief.layout,motifIndex:base.card.motifIndex,outsideWidth:base.card.outsideWidth,
  story:'Choose which matching copy clears the row',coupledChoice:result.proof,scope:'Authored coupled choice; not a difficulty or quality qualification'},
  intents:[{name:'complete strict witness',proven:true},{name:'safe setup and visible matching-copy fork',proven:true}],ms:Date.now()-begin};
}
module.exports={couple,build};
