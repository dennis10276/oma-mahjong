'use strict';
const assert=require('assert/strict');
const Layouts=require('../../../www/layouts.js');
const {search}=require('./public_witness_search.js');
const {createHumanController,verifyAttempt}=require('./human_reference_campaign.js');
const {createSessionFactory}=require('./production_physical_session.js');
const {observeBoard}=require('./human_board_visibility.js');
const {encodeGame}=require('./personal_game_io.js');

function test(){
  const tiles=Array.from({length:4},(unused,index)=>({x:index*4,y:0,z:0}));
  const factory=createSessionFactory(),settings={seed:1,choiceLimit:32,tapMs:1000};
  let verifiedTaps=0;
  for(const hidden of [3,101]){
    const actual={tiles,nb:Layouts.neighbors(tiles),faces:[1,1,hidden,hidden],down:[0,0,1,1],rules:null,clock:{i:0,n:1}};
    const session=factory(actual,settings),frame=session.view();
    const observed=observeBoard(tiles,frame.state,actual.clock,{picture:index=>actual.faces[index],role:()=> 'none'});
    const state={...frame.state,pictures:observed.pictures,down:observed.down};
    const game={tiles,nb:actual.nb,rules:null,clock:actual.clock};
    for(const field of ['faces','deck','seed'])Object.defineProperty(game,field,{get(){throw Error('Private clock ranking '+field);}});
    const actions=frame.legalTiles.map(index=>({index}));
    const old=search(game,state,actions),ranked=search(game,state,actions,{clockSlackRanking:true});
    assert.equal(ranked.index,0);assert.equal(ranked.safeClockExit,true);
    assert.equal(ranked.index,old.index);assert.equal(ranked.knownDead,false);
    const result=session.tap(ranked.index);assert.equal(result.state.alive[actual.clock.i],0);assert.notEqual(result.why,'clock');
    verifiedTaps+=verifyAttempt(encodeGame(actual),[ranked.index],settings,session.audit());
    const bounded=search(game,state,actions,{nodes:1,taps:1,clockSlackRanking:true});
    assert.equal(bounded.knownDead,false);
    const noClock={tiles,nb:actual.nb,rules:null,clock:null};
    assert.deepEqual(search(noClock,state,actions),search(noClock,state,actions,{clockSlackRanking:true}));
    assert.deepEqual(search(game,state,actions),search(game,state,actions,{clockSlackRanking:false}));
    const gated=search(game,state,actions,{clockSlackRanking:true,clockSlackRankingBudgetRange:[10,30]});
    assert.equal(gated.clockSlackRankingGate.active,false);
    assert.equal(gated.clockSlackRankingGate.publicStartingBudget,1);
    const {clockSlackRankingGate,...unchanged}=gated;
    assert.deepEqual(unchanged,old);
    const active=search(game,state,actions,{clockSlackRanking:true,clockSlackRankingBudgetRange:[1,30]});
    assert.equal(active.clockSlackRankingGate.active,true);
    assert.equal(active.index,old.index);assert(active.safeClockExit);
    assert.throws(()=>search(game,state,actions,{clockSlackRanking:'yes'}));
    assert.throws(()=>search(game,state,actions,{clockSlackRankingBudgetRange:[10,30]}));
    assert.throws(()=>search(game,state,actions,{clockSlackRanking:true,clockSlackRankingBudgetRange:[30,10]}));
  }
  assert.throws(()=>createHumanController(tiles,{clockSlackRanking:'yes'}));
  assert.throws(()=>createHumanController(tiles,{clockSlackRankingBudgetRange:[10,30]}));
  factory.verifySource();
  console.log('PASS clock-slack ranking preserves urgent physical clock exits across concealed worlds, disabled/nonclock behavior, private-input traps and bounded-search uncertainty; '+verifiedTaps+' taps independently replayed');
}
if(require.main===module)test();
module.exports=test;
