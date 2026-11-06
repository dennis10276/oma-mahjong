'use strict';
// Two-stage log model: measured frame pressure, then conditional piece residuals.
// Never use a held-out layout's measured frame as its prediction baseline.
const C=require('./compose.js'),P=require('./pieces.js'),F=require('./pressure_frame.js'),{layoutKey}=require('./originality.js'),M=require('./meter.js');
const SCHEMA='conditional-frame-model-v1';
let hash;const implementation=()=>hash||=(M.sourceHash(__filename));
function frameFeatures(input){const b=input.design||input,f=F.describe(b),c=f||{depth:0,share:0,spare:0},s=c.share,d=Math.log1p(c.depth),out={hasClock:f?1:0,depth:d,share:s,size:(b.tiles.length-80)/16};
 for(const n of[1,2,3]){out['spare='+n]=c.spare===n?1:0;out['depth:spare='+n]=c.spare===n?d:0;out['share:spare='+n]=c.spare===n?s:0;}
 for(const cut of[.1,.2])out['share>'+cut]=Math.max(0,s-cut);out['depth:share']=d*s;out.partnerRoute=b.clockMate===undefined?0:1;return out;}
function pieceFeatures(input){const b=input.design||input,all=C.features(b),f=F.describe(b),out={};
 for(const [k,v]of Object.entries(all))if(!/^(clock\.|clockWay\.|piece:clock$|piece:clockWay$|pair:clock\+clockWay$)/.test(k))out[k]=v;
 for(const [key,value]of Object.entries(out))if(key.startsWith('piece:')||key.startsWith('pair:')){
  out[key+':frameShare']=value*(f?.share??0);out[key+':frameDepth']=value*Math.log1p(f?.depth??0);
  for(const n of[1,2,3])out[key+':frameSpare='+n]=f?.spare===n?value:0;
 }
 return out;}
function rawPrediction(model,x){const p=C.predictRegression(model,x);return {log:p.log,tries:Math.exp(p.log)*(model.smearing??1)};}
function fit(rows,options={}){
 const groups=new Map();for(const r of rows){const g=r.group||layoutKey(r.design);groups.set(g,(groups.get(g)||0)+1);}
 const settings={};
 for(const k of['family','skilled']){
  const valid=rows.filter(r=>r[k]?.valid!==false&&Number.isFinite(r[k]?.exp)),frames=valid.filter(r=>['frame','frame-control'].includes(r.kind));if(frames.length<2)throw Error('Insufficient measured training frames');
  const weight=r=>(r.weight??1)*(k==='family'&&r.family.seedCount===1?.5:1)/Math.sqrt(groups.get(r.group||layoutKey(r.design)));
  const frame=C.fitRegression(frames.map(r=>({x:frameFeatures(r),y:r[k].exp,weight:weight(r)})),options.lambda??12);
  const residual=C.fitRegression(valid.map(r=>({x:pieceFeatures(r),y:r[k].exp/rawPrediction(frame,frameFeatures(r)).tries,weight:weight(r)})),options.lambda??12);
  settings[k]={frame,residual};
 }
 return {schema:SCHEMA,featureSource:implementation(),settings,lambda:options.lambda??12,bot:options.bot,trainingBoards:rows.length,input:M.digest(rows.map(r=>[r.id,r.family,r.skilled])),intervalMeaning:'combined training residual approximation, not calibrated coverage'};
}
function predict(model,row){if(model.schema!==SCHEMA||model.featureSource!==implementation())throw Error('Frame model source changed; fit again');return Object.fromEntries(['family','skilled'].map(k=>{
 const a=rawPrediction(model.settings[k].frame,frameFeatures(row)),b=rawPrediction(model.settings[k].residual,pieceFeatures(row)),log=Math.log(a.tries*b.tries),sd=Math.hypot(model.settings[k].frame.logRMSE,model.settings[k].residual.logRMSE),clamp=x=>Math.max(1,Math.min(20,x));
 return[k,{tries:clamp(Math.exp(log)),frame:Math.max(1,Math.min(20,a.tries)),conditionalFactor:b.tries,log,interval:[clamp(Math.exp(log-1.645*sd)),clamp(Math.exp(log+1.645*sd))]}];}));}
function trainAndValidate(rows,options={}){const split=C.partition(rows),heldoutModel=fit(split.train,options),predictions=split.test.map(r=>({id:r.id,kind:r.kind,group:r.group||layoutKey(r.design),familySeeds:r.family?.seedCount,...Object.fromEntries(['family','skilled'].map(k=>[k,{predicted:predict(heldoutModel,r)[k].tries,measured:r[k]?.exp??null}]))}));
 const report={schema:SCHEMA,split:{trainBoards:split.train.length,testBoards:split.test.length,trainGroups:split.trainGroups,testGroups:split.testGroups},settings:{},predictions};
 for(const k of['family','skilled']){const valid=predictions.filter(r=>Number.isFinite(r[k].measured));report.settings[k]={all:C.metrics(valid.map(r=>r[k])),frames:C.metrics(valid.filter(r=>r.kind==='frame').map(r=>r[k])),conditional:C.metrics(valid.filter(r=>['conditional-single','conditional-pair'].includes(r.kind)).map(r=>r[k])),historical:C.metrics(valid.filter(r=>r.kind==='historical').map(r=>r[k])),target:C.metrics(valid.filter(r=>r[k].measured>=(k==='family'?9:2.5)&&r[k].measured<=(k==='family'?14:6)).map(r=>r[k]))};}
 return{model:fit(rows,options),heldoutModel,report};}
module.exports={SCHEMA,frameFeatures,pieceFeatures,fit,predict,trainAndValidate};
