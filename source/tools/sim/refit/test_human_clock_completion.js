'use strict';
const assert=require('assert/strict'),{measureHuman}=require('./human_bot.js'),{createFactoryController}=require('./human_factory_controller.js');
const board=require('./human_clock_completion_fixture.json'),base=require('./human_v1_clock_outs_profiles.json');
function science(r){return r.results.map(({slowestMove,...x})=>x);}
function test(){
 const calm=structuredClone(base),rush=structuredClone(base);calm.family.lapse=0;rush.family.lapse=0;rush.family.clockCompletionBonus=40;
 const options={setting:'family',runs:1,maxAttempts:1,seed:20261028,capture:true};
 const control=measureHuman(board,{...options,profiles:calm}),biased=measureHuman(board,{...options,profiles:rush}),a=control.results[0].attempts[0],b=biased.results[0].attempts[0];
 assert(a.win);assert(board.tiles.length-a.clockLeft>=5);assert.equal(board.tiles.length-b.clockLeft,3);assert.equal(b.why,'tray');assert.equal(b.clockTiming,'clockContact');assert(!b.censored);assert(biased.verifiedTaps>0);
 const zero=structuredClone(calm);zero.family.clockCompletionBonus=0;assert.deepEqual(science(control),science(measureHuman(board,{...options,profiles:zero})),'Zero bonus preserves every actual action and retry fact');
 const hidden=structuredClone(board);hidden.faces[70]=17;const variant=measureHuman(hidden,{...options,profiles:rush});assert.deepEqual(b.actions.slice(0,2),variant.results[0].attempts[0].actions.slice(0,2),'Concealed picture cannot affect the decision to inspect it');
 const easy={tiles:Array.from({length:6},(_,i)=>({x:i*4,y:0,z:0})),faces:[1,1,2,2,3,3],down:Array(6).fill(0),clock:{i:1,n:4}};assert.equal(measureHuman(easy,{...options,profiles:rush}).firstTryRate,1,'The preference does not inject a loss');
 assert.throws(()=>createFactoryController(board.tiles,{...rush.family,clockCompletionBonus:121},1));
 console.log('PASS public clock-completion preference reproduces a recorded rush/exit failure, preserves zero-bonus behavior and hidden-picture prefix invariance, and still clears an easy clock; test-only lapse0 isolates choice scoring, full campaigns retain human lapse');
}
if(require.main===module)test();module.exports=test;
