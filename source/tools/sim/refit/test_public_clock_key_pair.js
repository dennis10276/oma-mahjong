'use strict';
const assert=require('assert/strict'),L=require('../../../www/layouts.js');
const {clockKeyPairPlan}=require('./public_pile_pair_habit.js');
const {createSessionFactory}=require('./production_physical_session.js'),{encodeGame}=require('./personal_game_io.js');
const {verifyAttempt,createHumanController}=require('./human_reference_campaign.js');
function test(){
 const tiles=Array.from({length:4},(_,i)=>({x:i*8,y:0,z:0})),rules={ice:{},iceNb:L.iceNeighbors(tiles),keys:[0,1],locks:new Set([2])};
 const publicGame={tiles,nb:L.neighbors(tiles),rules,clock:{i:2,n:4}},actual={...publicGame,faces:[9,9,7,7],down:[1,0,0,0]};
 for(const f of ['faces','deck','seed'])Object.defineProperty(publicGame,f,{get(){throw Error('Private '+f);}});
 const factory=createSessionFactory(),settings={seed:1,tapMs:1000,choiceLimit:32},session=factory(actual,settings);session.tap(3);
 const state={...session.view().state,pictures:[9,9,7,7],down:actual.down.slice()},primary={index:1,path:[1,0,0],nodes:0};
 const options={knownKeys:[0,1],deadline:Date.now()+500},pair=clockKeyPairPlan(publicGame,state,primary,options);
 assert(pair);assert.deepEqual(pair.path,[0,1]);assert(pair.clockKeyPairPreparation.zeroAdditionalTraySlots);assert.equal(pair.clockKeyPairPreparation.endingEstimatedClockSlack,pair.clockKeyPairPreparation.startingEstimatedClockSlack);
 for(const i of pair.path){session.tap(i);assert.equal(session.view().state.tray.length,1);}assert(session.view().legalTiles.includes(2));session.tap(2);assert(session.view().win);
 assert.equal(verifyAttempt(encodeGame(actual),[3,0,1,2],settings,session.audit()),4);
 assert.equal(clockKeyPairPlan(publicGame,{...state,pictures:[null,9,7,7]},primary,options),null,'Never invent a hidden key picture');
 assert.equal(clockKeyPairPlan(publicGame,state,primary,{...options,knownKeys:[0]}),null,'One observed key is not a known pair');
 assert.equal(clockKeyPairPlan({...publicGame,clock:null},state,primary,options),null);
 assert.equal(clockKeyPairPlan(publicGame,{...state,tray:[1,2,3]},primary,options),null);
 assert.equal(clockKeyPairPlan({...publicGame,rules:{...rules,locks:new Set()}},state,primary,options),null,'Unrelated keys must not consume clock moves');
 assert.equal(clockKeyPairPlan({...publicGame,clock:{i:2,n:2}},state,primary,options),null,'Known clock expiration rejects the pair');
 assert.equal(clockKeyPairPlan(publicGame,state,{...primary,knownWin:true},options),null);
 assert.equal(clockKeyPairPlan(publicGame,state,{...primary,safeClockExit:true},options),null);
 assert.equal(clockKeyPairPlan(publicGame,state,primary,{...options,deadline:0}),null);
 assert.throws(()=>createHumanController(tiles,{clockKeyPairPreparation:true}));assert.throws(()=>createHumanController(tiles,{rememberKeyIdentities:true,clockKeyPairPreparation:'yes'}));
 factory.verifySource();console.log('PASS known closed-first key pair unlocks public clock without added tray pressure;4 winning production taps replay;unknown pictures,unrelated keys,expired clocks and protected wins stay untouched');
}
if(require.main===module)test();module.exports=test;
