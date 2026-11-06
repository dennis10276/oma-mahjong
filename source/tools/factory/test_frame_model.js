'use strict';const {test}=require('node:test'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
const F=require('./frame_model.js'),C=require('./compose.js');
test('conditional model splits by layout and cannot use held-out frame ratings',()=>{
 const bases=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../analysis/factory/piece-bases.json'))),rows=[];
 for(const b of bases)for(const spare of[1,2,3]){const design={...b.design,clock:{i:b.design.solution[3],n:4+spare}};for(const kind of['frame','historical'])rows.push({id:b.id+spare+kind,group:b.layout,kind,design,family:{exp:3+(4-spare)*2,valid:true,seedCount:2},skilled:{exp:1+(4-spare)/2,valid:true}});}
 const split=C.partition(rows),first=F.trainAndValidate(rows),changed=rows.map(r=>split.testGroups.includes(r.group)?{...r,family:{exp:19,valid:true},skilled:{exp:17,valid:true}}:r),second=F.trainAndValidate(changed);
 assert.deepEqual(first.heldoutModel,second.heldoutModel);assert.notDeepEqual(first.report.settings,second.report.settings);
 const p=F.predict(first.model,rows[0]);assert(p.family.tries>=1&&p.family.tries<=20);assert(Number.isFinite(p.family.conditionalFactor));
 assert.equal(F.frameFeatures(rows[0])['spare=1'],1);assert.equal(F.frameFeatures(rows[1])['spare=1'],1);
});
