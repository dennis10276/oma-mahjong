'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const dir=path.resolve(__dirname,'../build/test-geometry-prefix');fs.mkdirSync(dir,{recursive:true});
const input=path.join(dir,'input.json'),output=path.join(dir,'output.json');
// The initially free roof is a bad opening, but belongs later on the correct
// route. Once that route removes it, the lower tile must be considered uncovered.
fs.writeFileSync(input,JSON.stringify({sites:[[0,0,0],[2,0,0],[1,0,1]],count:3,fixed:[[0,0,0],[2,0,0],[1,0,1]],original:[[0,0,0],[2,0,0],[1,0,1]],prefix:[[1,0,1],[0,0,0]],free:[[1,0,1]],highLimits:[],seconds:5}));
cp.execFileSync('python',[path.resolve(__dirname,'../tools/builder/bank/gate1_geometry_milp.py'),input,output],{windowsHide:true});
const r=JSON.parse(fs.readFileSync(output));assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.tiles.length,3);
const job=JSON.parse(fs.readFileSync(input));job.prefixes=[[[1,0,1],[2,0,0]]];fs.writeFileSync(input,JSON.stringify(job));
cp.execFileSync('python',[path.resolve(__dirname,'../tools/builder/bank/gate1_geometry_milp.py'),input,output],{windowsHide:true});assert.equal(JSON.parse(fs.readFileSync(output)).ok,true);
// The first opening must not make the roof disappear in the counterfactual.
job.prefixes=[[[2,0,0]]];fs.writeFileSync(input,JSON.stringify(job));
cp.execFileSync('python',[path.resolve(__dirname,'../tools/builder/bank/gate1_geometry_milp.py'),input,output],{windowsHide:true});assert.equal(JSON.parse(fs.readFileSync(output)).ok,false);
console.log('Removed prefix tile no longer blocks later route, even when initially free.');
