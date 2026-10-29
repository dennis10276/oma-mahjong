'use strict';
const assert=require('assert/strict'),Layouts=require('../../../www/layouts.js');
const {trayHorizon}=require('./human_style_tray_horizon.js');
function test(){
 const tiles=[{x:0,y:0,z:0},{x:1,y:0,z:0},{x:8,y:0,z:0}],nb=Layouts.neighbors(tiles);
 const state={alive:[1,1,1],tray:[2],openPeek:-1};
 const seen={down:[0,0,0],takeable:[true,false,true]};
 const pictures=[3,3,4],roles=['none','ice','none'];
 const before=JSON.stringify({state,seen,pictures,roles});
 const no=trayHorizon(tiles,nb,state,seen,pictures,roles,2).get(0);
 const yes=trayHorizon(tiles,nb,state,seen,pictures,roles,2,{iceReleaseBelief:1}).get(0);
 const half=trayHorizon(tiles,nb,state,seen,pictures,roles,2,{iceReleaseBelief:.5}).get(0);
 assert(yes>no,'A neighboring take may melt the matching escape tile');
 assert(half>no&&half<yes,'A probable release must remain confidence weighted');
 assert(!trayHorizon(tiles,nb,state,seen,pictures,roles,2,{iceReleaseBelief:1}).has(1),'A hypothetical future release cannot enable an illegal root tap');
 assert.equal(trayHorizon(tiles,nb,state,seen,pictures,['none','ice2','none'],2,{iceReleaseBelief:1}).get(0),no,'One removal cannot melt a two-hit ice glyph');
 assert.equal(trayHorizon(tiles,nb,state,seen,pictures,['none','lock','none'],2,{iceReleaseBelief:1}).get(0),no,'Actual underlying blocking roles supersede the ice expectation');
 assert.equal(JSON.stringify({state,seen,pictures,roles}),before,'Hypothetical ice transitions never mutate public observations or memory');
 console.log('PASS public-neighbor ice anticipation, uncertainty weighting, two-hit threshold, blocking role correction and root legality');
}
if(require.main===module)test();module.exports=test;
