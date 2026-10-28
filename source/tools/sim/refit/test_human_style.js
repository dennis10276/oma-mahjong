'use strict';
const assert=require('assert/strict'),{createStyleController}=require('./human_style_controller.js');
const profiles=require('./human_style_profiles.json');
const {measureHuman}=require('./human_style_measure.js'),{lossPhase}=require('./human_style_environment.js');
const {observeBoard}=require('./human_board_visibility.js');
const {trayHorizon}=require('./human_style_tray_horizon.js');
const Layouts=require('../../../www/layouts.js');
function test(){
 const tiles=Array.from({length:6},(_,i)=>({x:i*4,y:0,z:0}));
 const s={alive:tiles.map(()=>1),tray:[],moves:0,openPeek:-1,relieved:false,arriving:[],physicalTaps:0};
 const o={pictures:[1,1,2,2,3,3],roles:tiles.map(()=>'none'),down:tiles.map(()=>0),takeable:tiles.map(()=>true),clock:null};
 const selections=new Set();
 assert.throws(()=>createStyleController(tiles,{...profiles.Dennis,perLevelOverrides:{}},1));
 assert.throws(()=>createStyleController(tiles,{...profiles.Dennis,clockWeight:Infinity},1));
 for(let seed=1;seed<=30;seed++){
  const c=createStyleController(tiles,profiles.Dennis,seed);c.beginAttempt();c.observe(s,o);selections.add(c.decide().index);
 }
 assert(selections.size>=4,'Seeds must change choices on a board with several good pairs');
 const forget=createStyleController(tiles,{...profiles.Dennis,memoryDecay:1,retryRetention:0},12);
 forget.beginAttempt();forget.observe(s,o);forget.observe({...s,physicalTaps:1},{...o,pictures:tiles.map(()=>null),down:tiles.map(()=>1)});
 assert(forget.remembered().every(p=>p===null));
 forget.observe({...s,physicalTaps:2},o);assert.deepEqual(forget.remembered(),o.pictures,'Current visible identities must not be forgotten');
 assert.equal(lossPhase({alive:[1,1,1]}, {i:0}),'clock');
 assert.equal(lossPhase({alive:[0,1,1]}, {i:0}),'late');
 assert.equal(lossPhase({alive:Array(12).fill(1)},null),'mid');
 const board={tiles,faces:[1,1,2,2,3,3],down:tiles.map(()=>0)};
 for(const key of ['level','dennis','seed','solution'])Object.defineProperty(board,key,{get(){throw Error('Private or outcome field accessed');}});
 const r=measureHuman(board,{runs:3,maxAttempts:2,seed:37,capture:true});
 assert(r.valid);assert.equal(r.settings.Dennis.firstTryRate,1);assert.equal(r.settings.family.firstTryRate,1);
 assert(r.settings.Dennis.results.every(c=>c.verifiedTaps===6));
 const limited=measureHuman(board,{runs:1,maxAttempts:3,seed:37,choiceLimit:1});
 for(const setting of Object.values(limited.settings)){
  assert.equal(setting.averageTries,null);assert.equal(setting.censoredCampaigns,1);
  assert.equal(setting.firstTryRate,null,'A computation cap is not a human first-try loss');
  assert.equal(setting.results[0].attempts.length,1,'Computation censoring must not create free retries');
  assert.deepEqual(setting.lossCounts,{clock:0,mid:0,late:0});
 }
 // A poisoned hidden picture never enters the observed policy packet.
 const closedState={...s,down:[1,1,0,0,0,0]},packets=[];
 const decisions=[];
 for(const hidden of [[1,1],[6,7]]){
  const faces=hidden.concat([2,2,3,3]);
  const closed=observeBoard(tiles,closedState,null,{picture:i=>{assert(i>=2,'Concealed identity reader was called');return faces[i];},role:()=> 'none',takeable:()=>true});
  packets.push(closed);
  const controller=createStyleController(tiles,profiles.Dennis,99);controller.beginAttempt();
  controller.observe(s,closed);decisions.push(controller.decide());
 }
 assert.deepEqual(packets[0],packets[1]);
 assert.deepEqual(decisions[0],decisions[1]);
 const visited=new Set();function graph(m){if(visited.has(m.id))return;visited.add(m.id);for(const child of m.children)graph(child);}
 graph(require.cache[require.resolve('./human_style_controller.js')]);
 assert([...visited].every(id=>!/[\\/](?:optimal_bot|public_witness_search|human_reference_campaign|known_tray_plan)\.js$/.test(id)),
  'The human policy must not import the exact/reference planning graph');
 // Equal immediate side counts conceal a two-step left vs one-step right exit.
 const routeTiles=[2,4,6,8].map(x=>({x,y:0,z:0})).concat([{x:5,y:0,z:1}]);
 const route=createStyleController(routeTiles,{...profiles.Dennis,clockWeight:40,outWeight:9,lapse:0,temperature:.01},31);
 route.beginAttempt();route.observe({...s,alive:[1,1,1,1,0],tray:[5]},
  {pictures:[1,2,3,4,null],roles:Array(5).fill('none'),down:[0,0,0,0,null],takeable:[true,false,false,true,null],clock:{i:2,n:8,remaining:7}});
 assert.equal(route.decide().index,3,'Shallow clock sides must not loop back through the clock itself');
 const before=JSON.stringify({s,o});
 const horizon=trayHorizon(tiles,Layouts.neighbors(tiles),s,o,o.pictures,o.roles,3);
 assert([...horizon.values()].every(Number.isFinite));
 assert.equal(JSON.stringify({s,o}),before,'Thinking must not mutate the real observation');
 assert.throws(()=>trayHorizon(tiles,Layouts.neighbors(tiles),s,o,o.pictures,o.roles,4));
 const blocked=createStyleController(tiles.slice(0,4),{...profiles.Dennis,outWeight:9,trayDepth:0,lapse:0,temperature:.01},71);
 blocked.beginAttempt();blocked.observe({...s,alive:[1,1,1,1]},
  {pictures:[7,1,2,7],roles:['none','none','none','lock'],down:[0,0,0,0],takeable:[true,true,true,false],clock:null});
 assert.equal(blocked.decide().score,-6,'A geometrically free locked tile is neither a reachable mate nor an out created by an unrelated move');
 function retryRole(previousRole){
  const c=createStyleController(tiles.slice(0,4),{...profiles.Dennis,retryRetention:1,outWeight:9,trayDepth:0,lapse:0,temperature:.01},71);
  const packet={pictures:[7,1,2,7],roles:['none','none','none',previousRole],down:[0,0,0,0],takeable:[true,true,true,false],clock:null};
  c.beginAttempt();c.observe({...s,alive:[1,1,1,1]},packet);c.beginAttempt();
  c.observe({...s,alive:[1,1,1,1]},{...packet,pictures:[7,1,2,null],roles:['none','none','none',null]});
  return c.decide();
 }
 assert.deepEqual(retryRole('none'),retryRole(null),'A melted-ice none observation from a failed attempt must not certify an unseen starting role on retry');
 console.log('PASS human-style stochastic choices, forgetting, public-only API, replay, phase accounting and no free retry at computational cap');
}
if(require.main===module)test();module.exports=test;
