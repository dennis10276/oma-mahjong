'use strict';
const assert=require('assert/strict'),Layouts=require('../../../www/layouts.js');
const {FEATURES,publicEscapeFeatures,escapeLabel}=require('./public_escape_features.js');
const {createSessionFactory}=require('./production_physical_session.js');
const {verifyAttempt}=require('./human_reference_campaign.js');const {encodeGame}=require('./personal_game_io.js');
function test(){
 const tiles=Array.from({length:8},(_,i)=>({x:i*8,y:0,z:0}));
 const actual={tiles,nb:Layouts.neighbors(tiles),faces:[1,2,3,100,100,1,2,3],down:[0,0,0,1,1,0,0,0],
  rules:{ice:{},iceNb:Layouts.iceNeighbors(tiles),keys:[3,4],locks:new Set([5])},clock:null};
 const model={tiles,nb:actual.nb,rules:actual.rules,clock:null};
 for(const field of ['faces','deck','seed','level','target'])Object.defineProperty(model,field,{get(){throw Error('Private '+field);}});
 const factory=createSessionFactory(),settings={seed:1,tapMs:1000,choiceLimit:32},session=factory(actual,settings);
 const features=index=>publicEscapeFeatures(model,{...session.view().state,pictures:actual.faces.slice(),down:actual.down.slice()},index,
  {roles:tiles.map((_,i)=>[3,4].includes(i)?'key':i===5?'lock':'none'),knownKeys:[3,4]});
 for(const i of [0,1,2])session.tap(i);
 const original=structuredClone(session.view().state),first=features(3);assert.equal(first.length,FEATURES.length);
 assert(first[FEATURES.indexOf('safePilePairs')]>0,'At tray3 the two known closed key tiles still provide an on-pile pair');
 assert.equal(first[FEATURES.indexOf('rootKey')],1);assert.equal(first[FEATURES.indexOf('rootCertainLoss')],0);
 assert.deepEqual(session.view().state,original);
 session.tap(3);assert.equal(features(4)[FEATURES.indexOf('rootPileMatch')],1);session.tap(4);
 assert.equal(session.view().state.tray.length,3);assert(session.view().legalTiles.includes(5));
 assert.equal(features(5)[FEATURES.indexOf('rootTrayMatch')],1);
 for(const i of [5,6,7])session.tap(i);assert(session.view().win);
 assert.equal(verifyAttempt(encodeGame(actual),[0,1,2,3,4,5,6,7],settings,session.audit()),8);
 const pressured={tray:3,clockLive:false};
 assert.equal(escapeLabel([pressured,{tray:2,clockLive:false},{tray:0,clockLive:false,won:true}],0,'cleared'),1);
 assert.equal(escapeLabel([pressured,{tray:2,clockLive:false},{tray:4,lost:true}],0,'physicalLoss'),0,'Temporary relief followed by loss is not a positive escape');
 assert.equal(escapeLabel([pressured,{tray:2,clockLive:false}],0,'unresolvedBudget'),null);
 assert.equal(escapeLabel([pressured,...Array.from({length:12},()=>({...pressured}))],0,'unresolvedBudget'),0,'No observed relief in12 taps is a negative horizon label,not a death proof');
 factory.verifySource();console.log('PASS public escape features preserve tray3 on-pile key matching and tray relief,read no private fields,never mutate state,and distinguish observed escapes/losses/censoring;8 independently replayed winning taps');
}
if(require.main===module)test();module.exports=test;
