'use strict';
process.env.FINISH_GATE='2';process.env.MECH='1';process.env.NARROW_TRAP='core';
const fs=require('fs'),path=require('path'),R=require('./gate1_rebuild'),P=require('./finish_all_sources'),C=require('./gate2_courses');
for(const lv of process.argv.slice(2).map(Number)){
 if(lv<301||lv>349)throw Error('Scope ends at 349');
 const file=path.join(R.OUT,`level-${lv}.json`);if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file)).ok)continue;
 const a=P.original(lv).design,poses=lv===331?[{}]:C.plans(lv);
 for(const pose of poses){const config={...pose,x0:0,y0:0,left:pose.left??0,protectPhotos:true,guard:false,prefix:true,badgeGuard:true,iceGuard:pose.iceGuard??true,baitFree:true,hardSpecialsOnly:true,hardBaits:true,softFixed:true,assignmentFixed:'prefix-specials-baits',assignmentIceOrders:true,assignmentGates:true,orders:pose.orders??1,rankPrefix:pose.fullWitness?undefined:a.solution.indexOf(a.clock.i)+1,seconds:30,assignSeconds:35,ms:100000},r=R.rebuild(lv,config);console.log('ELASTIC',lv,r.ok,r.certificate?.errors,r.controlGates?.changed.map(r=>r.tile));if(r.ok)break;}
}
