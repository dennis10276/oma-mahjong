'use strict';
const assert=require('assert/strict');
const Layouts=require('../../../www/layouts.js');
const {explorationWitness}=require('./public_exploration_witness.js');
const {retryInformationSearch}=require('./public_retry_information.js');
const {createHumanController,verifyAttempt}=require('./human_reference_campaign.js');
const {createSessionFactory}=require('./production_physical_session.js');
const {observeBoard}=require('./human_board_visibility.js');
const {encodeGame}=require('./personal_game_io.js');
const {createExposureFrontier}=require('./public_exposure_frontier.js');

function test(){
  const tiles=Array.from({length:10},(unused,index)=>({x:index*4,y:0,z:0}));
  const factory=createSessionFactory(),settings={seed:1,choiceLimit:64,tapMs:1000};
  let controls=0,verifiedTaps=0;
  for(const clocked of [false,true])for(const hidden of [...Array(36).keys(),101]){
    const actual={tiles,nb:Layouts.neighbors(tiles),faces:[hidden,5,6,6,8,9,8,9,5,hidden],
      down:[1,0,0,0,0,0,1,1,1,1],rules:null,clock:clocked?{i:1,n:7}:null};
    const session=factory(actual,settings);
    const opening=session.view();
    const initial=observeBoard(tiles,opening.state,actual.clock,{picture:index=>actual.faces[index],role:()=> 'none'});
    const memory={pictures:initial.pictures.slice(),down:initial.down.slice(),initialRoles:initial.roles.slice()};
    session.tap(4);session.tap(5);
    const frame=session.view(),observed=observeBoard(tiles,frame.state,actual.clock,{picture:index=>actual.faces[index],role:()=> 'none'});
    const state={...frame.state,pictures:observed.pictures,down:observed.down.map((value,index)=>frame.state.alive[index]?value:0)};
    const game={tiles,nb:actual.nb,rules:null,clock:actual.clock};
    for(const field of ['faces','deck','seed'])Object.defineProperty(game,field,{get(){throw Error('Private two-carry information '+field);}});
    assert.deepEqual(state.tray,[8,9]);assert.equal(state.pictures[0],null);
    const roots=[{index:2}],options={nodes:1000,deadline:Date.now()+1000};
    const legacy=explorationWitness(game,state,roots,options);
    assert.equal(legacy.path,null);
    const snapshot=JSON.stringify([state,memory]);
    const planned=explorationWitness(game,state,roots,{...options,peekTrayLimit:2});
    assert.deepEqual(planned.path,[2,3,0]);assert.equal(planned.knownPrefixTaps,2);
    assert.equal(planned.kind,'actualPeekRequired');assert.equal(planned.imaginedPicturesAdded,0);
    assert.equal(JSON.stringify([state,memory]),snapshot);
    const primary={index:2,path:[2],goal:'primary',nodes:0,knownWin:false,knownDead:false,safeClockExit:false};
    const policy=retryInformationSearch(()=>primary,{nodes:1000,milliseconds:100,choices:64,peekTrayLimit:2});
    policy.beginAttempt(memory);assert.strictEqual(policy.search(game,state,roots),primary);
    policy.finish('physicalLoss',memory);policy.beginAttempt(memory);
    const retry=policy.search(game,state,roots);
    assert.deepEqual(retry.path,[2,3,0]);assert.equal(retry.retryInformationWitness.peekTrayLimit,2);
    assert.equal(JSON.stringify([state,memory]),snapshot);
    const actions=[4,5];
    for(const index of planned.path){session.tap(index);actions.push(index);}
    assert(session.view().state.tray.length<=2);assert.notEqual(session.view().why,'clock');
    assert.equal(state.pictures[0],null);
    for(const index of [8,1,6,7,0,9]){
      if(session.view().win)break;
      if(session.view().state.alive[index]){session.tap(index);actions.push(index);}
    }
    assert(session.view().win);
    verifiedTaps+=verifyAttempt(encodeGame(actual),actions,settings,session.audit());
    const bounded=explorationWitness(game,state,roots,{nodes:1,deadline:Date.now()+1000,peekTrayLimit:2});
    assert.equal(bounded.path,null);assert.equal(bounded.boundary,true);
    const expired=explorationWitness(game,state,roots,{deadline:Date.now()-1,peekTrayLimit:2});assert.equal(expired.reason,'deadline');
    assert.equal(explorationWitness(game,{...state,tray:[8,9,10]},roots,{...options,peekTrayLimit:2}).path,null);
    if(clocked)assert.equal(explorationWitness({...game,clock:{i:1,n:6}},state,roots,{...options,peekTrayLimit:2}).path,null);
    controls++;
  }
  let preferenceControls=0;
  for(const hidden of [5,8,11,101]){
    const exposedTiles=tiles.map(tile=>({...tile}));
    exposedTiles[2]={x:8.28,y:0.28/1.24,z:1};exposedTiles[6]={x:8,y:0,z:0};
    const actual={tiles:exposedTiles,nb:Layouts.neighbors(exposedTiles),faces:[hidden,5,6,6,8,9,8,9,5,hidden],
      down:[1,0,0,0,0,0,1,1,1,1],rules:null,clock:null};
    const session=factory(actual,settings);session.tap(4);session.tap(5);
    const frame=session.view(),seen=observeBoard(exposedTiles,frame.state,null,{picture:index=>actual.faces[index],role:()=> 'none'});
    assert.equal(seen.down[6],null);
    const state={...frame.state,pictures:seen.pictures,down:seen.down.map((value,index)=>frame.state.alive[index]?value:0)};
    const game={tiles:exposedTiles,nb:actual.nb,rules:null,clock:null,
      publicFrontier:position=>({free:exposedTiles.flatMap((tile,index)=>position.alive[index]&&Layouts.isFree(index,position.alive,actual.nb)?[index]:[]),uncertain:position.alive[6]?[6]:[]}),
      publicInformationExposure:createExposureFrontier(exposedTiles,{...state,roles:seen.roles},'all',true)};
    for(const field of ['faces','deck','seed'])Object.defineProperty(game,field,{get(){throw Error('Private peek preference '+field);}});
    const options={nodes:1000,deadline:Date.now()+1000,peekTrayLimit:2};
    const first=explorationWitness(game,state,[{index:2}],options);
    assert.deepEqual(first.path,[2,3]);assert.equal(first.kind,'newPublicExposure');
    const snapshot=JSON.stringify([state,seen]);
    const preferred=explorationWitness(game,state,[{index:2}],{...options,preferActualPeek:true});
    assert.deepEqual(preferred.path,[2,3,0]);assert.equal(preferred.kind,'actualPeekRequired');
    assert.equal(preferred.exposureFallbackUsed,false);assert.equal(JSON.stringify([state,seen]),snapshot);
    const fallback=explorationWitness(game,state,[{index:2}],{...options,nodes:3,preferActualPeek:true});
    assert.deepEqual(fallback.path,[2,3]);assert.equal(fallback.exposureFallbackUsed,true);
    assert.equal(fallback.budgetStopReason,'node_limit');assert.equal(fallback.boundary,true);
    const memory={pictures:state.pictures,down:state.down,initialRoles:seen.roles};
    const primary={index:2,path:[2],goal:'primary',nodes:0,knownWin:false,knownDead:false,safeClockExit:false};
    const wrapper=retryInformationSearch(()=>primary,{nodes:3,milliseconds:100,choices:64,peekTrayLimit:2,preferActualPeek:true});
    wrapper.beginAttempt(memory);wrapper.finish('physicalLoss',memory);wrapper.beginAttempt(memory);
    const wrapped=wrapper.search(game,state,[{index:2}]);
    assert.equal(wrapped.retryInformationWitness.exposureFallbackUsed,true);assert.equal(wrapper.stats().nodeStops,1);
    const actions=[4,5];
    for(const index of preferred.path){session.tap(index);actions.push(index);}
    for(const index of [8,1,6,7,0,9]){
      if(session.view().win)break;
      if(session.view().state.alive[index]){session.tap(index);actions.push(index);}
    }
    assert(session.view().win);verifiedTaps+=verifyAttempt(encodeGame(actual),actions,settings,session.audit());
    preferenceControls++;
  }
  assert.throws(()=>explorationWitness({tiles,nb:Layouts.neighbors(tiles),rules:null,clock:null},
    {alive:tiles.map(()=>1)},[],{peekTrayLimit:3}));
  assert.throws(()=>retryInformationSearch(()=>null,{peekTrayLimit:3}));
  assert.throws(()=>retryInformationSearch(()=>null,{preferActualPeek:'yes'}));
  assert.throws(()=>createHumanController(tiles,{retryInformationPeekTrayLimit:2}));
  assert.throws(()=>createHumanController(tiles,{retryInformationWitness:true,retryInformationPeekTrayLimit:3}));
  assert.throws(()=>createHumanController(tiles,{retryInformationPreferPeek:true}));
  factory.verifySource();
  console.log('PASS '+controls+' concealed ordinary/Joker worlds allow a two-carry peek after a known pair; '+preferenceControls+' renderer-projected preference worlds preserve a bounded exposure fallback; '+verifiedTaps+' winning-route taps independently replay. Legacy limit, clock margin, budgets and unchanged memory protected. Retry trigger is a supplied no-learning failed-outcome unit input, not a measured failed campaign.');
}
if(require.main===module)test();
module.exports=test;
