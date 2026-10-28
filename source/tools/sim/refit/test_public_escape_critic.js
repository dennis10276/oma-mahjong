'use strict';
const assert=require('assert/strict');const {FEATURES,fit,predict,metrics}=require('./public_escape_critic.js');
function test(){
 const safe=Array(FEATURES.length).fill(0),dead=safe.slice();
 safe[FEATURES.indexOf('rootTrayMatch')]=1;safe[FEATURES.indexOf('rootKnownSafe')]=1;
 dead[FEATURES.indexOf('rootCertainLoss')]=1;dead[FEATURES.indexOf('orphanTray')]=1;
 const rows=[{x:safe,y:1,weight:1},{x:dead,y:0,weight:1}],before=JSON.stringify(rows),model=fit(rows);
 assert(predict(model,safe)>.8&&predict(model,dead)<.2,'Learn the direction of observed escape outcomes');assert.equal(JSON.stringify(rows),before);
 const duplicated=fit([...Array.from({length:80},()=>({x:safe,y:1,weight:1/80})),rows[1]]);
 assert(Math.abs(predict(duplicated,safe)-predict(model,safe))<1e-8,'Board-balanced rows prevent a long repeated episode from changing its weight');
 const result=metrics(rows,x=>predict(model,x));assert.equal(result.auc,1);assert(result.brier<.25);
 assert(predict(model,Array(FEATURES.length).fill(100))<1,'Even extreme learned scores are probabilities,never proof');
 assert.throws(()=>predict({...model,features:[]},safe));assert.throws(()=>predict(model,[1]));assert.throws(()=>fit([{x:safe,y:null,weight:1}]));
 console.log('PASS shared escape critic learns actual-label direction,weights boards consistently,validates feature schema and keeps learned probabilities separate from proofs');
}
if(require.main===module)test();module.exports=test;
