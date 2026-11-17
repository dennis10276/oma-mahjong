'use strict';
// A legal but fatal early clock tap must not rule out another winning opening.
const assert=require('assert/strict'),D=require('../tools/builder/bank/detower'),P=require('../tools/builder/bank/finish_all_sources'),E=require(D.CF+'../engine');
for(const level of[266,319,337]){
 const d=structuredClone(P.original(level).design),g=E.game(d,{strict:true});
 assert.ok(E.legal(g,E.start(g)).includes(d.clock.i));
 d.solution=[d.clock.i,...d.solution.filter(i=>i!==d.clock.i)];
 const bad=E.step(g,E.start(g),d.clock.i);
 assert.equal(E.winnable(g,bad,{nodes:1000000,ms:10000}).result,'lose');
 const route=D.route(d);
 assert.ok(route,'another full winning route exists for '+level);
 assert.equal(route.length,d.tiles.length);
 assert.equal(E.replay(d,route,{strict:true}).ok,true);
 assert.ok(route.indexOf(d.clock.i)>0);
 console.log(level,'recovered a full win after rejecting a legal fatal clock opening');
}
