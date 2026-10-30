'use strict';
const assert=require('assert/strict'),{normalizeBoard}=require('./public_board_input.js'),{campaign}=require('./human_style_environment.js');
function test(){
 function run(clockFirst){const down=Array(10).fill(0);down[clockFirst?0:1]=1;const board=normalizeBoard({tiles:Array.from({length:10},(_,i)=>({x:i*4,y:0,z:0})),faces:[1,1,2,3,4,5,2,3,4,5],down,clock:{i:1,n:4}}),sequence=clockFirst?[2,3,0,1,4,5]:[2,3,1,0,4,5];let cursor=0;return campaign(board,{},0,{maxAttempts:1,choiceLimit:64,controllerFactory:()=>({beginAttempt(){cursor=0;},observe(){},decide(){return{index:sequence[cursor++],score:0};}})}).attempts[0];}
 const first=run(true),second=run(false);assert.equal(first.why,'tray');assert.equal(second.why,'tray');assert.equal(first.left,4);assert.equal(second.left,4);
 assert.equal(first.clockLeft,7,'Selected clock is removed before the matching peeked tile; match the UI clock event, not the end of the tap');assert.equal(first.clockTiming,'late','Three removals after the clock exceed the two-removal contact window');
 assert.equal(second.clockLeft,6);assert.equal(second.clockTiming,'clockContact','Clock removed second leaves exactly two later removals');
 console.log('PASS actual production clock-pair removal order, saved-last-move semantics and disjoint contact boundary; forced synthetic losses are timing fixtures, not model performance evidence');
}
if(require.main===module)test();module.exports=test;
