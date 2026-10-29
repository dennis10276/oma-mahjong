'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),{execFileSync}=require('child_process');
const {PROFILES}=require('./human_factory_controller.js'),{KEYS}=require('./human_factory_benchmark.js');
function test(){
 const root=path.resolve(__dirname,'../../../..'),dir=path.join(root,'.codex-runs/human-style/factory-profile-test-'+process.pid+'-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 const board={tiles:[[0,0,0],[4,0,0]],faces:[1,1],down:[]};
 const data=path.join(dir,'data.json'),profiles=path.join(dir,'profiles.json'),output=path.join(dir,'result');
 const p={Dennis:{...PROFILES.dennis,lapse:0},family:PROFILES.family};
 fs.writeFileSync(data,JSON.stringify({boards:KEYS.map(key=>({key,board}))}));fs.writeFileSync(profiles,JSON.stringify(p));
 execFileSync(process.execPath,[path.join(__dirname,'human_factory_benchmark.js'),data,output,'4',profiles],{windowsHide:true,stdio:'pipe'});
 const summary=JSON.parse(fs.readFileSync(path.join(output,'summary.json')));
 assert.deepEqual(summary.contract.profiles,p,'The factory gate must evaluate the same explicit person profiles as full calibration');
 assert.equal(summary.rows.length,5);assert(summary.rows.every(r=>r.profileHash===crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex')));
 assert(summary.rows.every(r=>r.version==='human-v1-development'&&r.calibrationStatus==='experimental-not-calibrated'&&r.valid));
 assert(!summary.checks.e,'Equal easy and hard outcomes must not satisfy the contrast gate');
 console.log('PASS factory regression runner applies the explicit candidate profiles, captures identity, preserves replay, and does not mislabel them as released v0');
}
if(require.main===module)test();module.exports=test;
