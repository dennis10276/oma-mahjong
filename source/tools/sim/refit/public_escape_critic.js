'use strict';
const assert=require('assert/strict');const {FEATURES}=require('./public_escape_features.js');
const INTERACTIONS=Object.freeze([['trayPressure','rootTrayMatch'],['trayPressure','rootPileMatch'],['orphanTray','nextTrayMatches'],['liveClock','rootKey'],['clockRoom','rootClockExit']]);
const NAMES=Object.freeze([...FEATURES,...INTERACTIONS.map(pair=>pair.join('*'))]);
function expand(x){assert(Array.isArray(x)&&x.length===FEATURES.length&&x.every(Number.isFinite));return [...x,...INTERACTIONS.map(([a,b])=>x[FEATURES.indexOf(a)]*x[FEATURES.indexOf(b)])];}
const sigmoid=z=>1/(1+Math.exp(-Math.max(-30,Math.min(30,z))));
function validate(model){assert.equal(model.kind,'public-escape-logistic-v1');assert.deepEqual(model.features,NAMES);assert(model.weights.length===NAMES.length+1&&model.weights.every(Number.isFinite));}
function predict(model,x){validate(model);const f=expand(x);let z=model.weights[0];for(let j=0;j<f.length;j++)z+=f[j]*model.weights[j+1];return Math.max(1e-6,Math.min(1-1e-6,sigmoid(z)));}
function fit(rows,{epochs=800,learningRate=.5,l2=.01}={}){
 assert(rows.length>0);assert(Number.isInteger(epochs)&&epochs>0);assert(learningRate>0&&l2>=0);
 const data=rows.map(r=>{assert(r.y===0||r.y===1);assert(Number.isFinite(r.weight)&&r.weight>0);return{x:expand(r.x),y:r.y,weight:r.weight};});
 const total=data.reduce((s,r)=>s+r.weight,0),rate=Math.max(1e-6,Math.min(1-1e-6,data.reduce((s,r)=>s+r.weight*r.y,0)/total));
 const weights=Array(NAMES.length+1).fill(0);weights[0]=Math.log(rate/(1-rate));
 for(let epoch=0;epoch<epochs;epoch++){
  const gradient=Array(weights.length).fill(0);
  for(const row of data){let z=weights[0];for(let j=0;j<row.x.length;j++)z+=weights[j+1]*row.x[j];const e=(sigmoid(z)-row.y)*row.weight/total;
   gradient[0]+=e;for(let j=0;j<row.x.length;j++)gradient[j+1]+=e*row.x[j];}
  for(let j=0;j<weights.length;j++)weights[j]-=learningRate*(gradient[j]+(j?l2*weights[j]:0));
 }
 const model={kind:'public-escape-logistic-v1',features:[...NAMES],weights,trainingPrevalence:rate,horizonPhysicalTaps:12,scoreMeaning:'Estimated surviving12 physical taps AND finding tray/clock relief or clearing;not a proof or calibrated human attempt count'};
 validate(model);return model;
}
function metrics(rows,score){
 let weight=0,brier=0,logLoss=0;const bins=Array.from({length:5},()=>({count:0,weight:0,p:0,y:0}));
 const ranked=rows.map(r=>{const p=score(r.x);assert(p>0&&p<1);weight+=r.weight;brier+=r.weight*(p-r.y)**2;
  logLoss-=r.weight*(r.y*Math.log(p)+(1-r.y)*Math.log(1-p));const bin=bins[Math.min(4,Math.floor(p*5))];bin.count++;bin.weight+=r.weight;bin.p+=r.weight*p;bin.y+=r.weight*r.y;return{p,y:r.y};}).sort((a,b)=>a.p-b.p);
 let positiveRanks=0,positive=0;for(let i=0;i<ranked.length;){let end=i+1;while(end<ranked.length&&ranked[end].p===ranked[i].p)end++;
  for(let j=i;j<end;j++)if(ranked[j].y){positive++;positiveRanks+=(i+1+end)/2;}i=end;}
 const negative=ranked.length-positive;
 return{rows:rows.length,positive,negative,brier:weight?brier/weight:null,logLoss:weight?logLoss/weight:null,
  auc:positive&&negative?(positiveRanks-positive*(positive+1)/2)/(positive*negative):null,
  calibration:bins.map(b=>({count:b.count,predicted:b.weight?b.p/b.weight:null,observed:b.weight?b.y/b.weight:null}))};
}
module.exports={FEATURES,NAMES,expand,validate,predict,fit,metrics};
