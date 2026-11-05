'use strict';
// A surrogate, never an acceptance gate. Family and skilled are fitted on log
// tries independently; negative piece effects and non-additive pairs are legal.
const Pieces=require('./pieces.js'),{layoutKey}=require('./originality.js'),{digest,sourceHash}=require('./meter.js');
const SCHEMA='piece-composition-model-v1';
let featureSource;const implementation=()=>featureSource||=(sourceHash(__filename));
const clamp=x=>Math.max(1,Math.min(20,x));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
function quantile(a,p){if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y),q=(b.length-1)*p,i=Math.floor(q);return b[i]+(b[Math.ceil(q)]-b[i])*(q-i);}
function features(input){
  const d=Pieces.decompose(input.design||input),f={'layout.size':(d.layout.n-80)/16,'layout.layers':d.layout.maxZ/5,'layout.free':d.layout.freeShare},counts={};
  for(const p of d.pieces){counts[p.name]=(counts[p.name]||0)+1;
    for(const [key,v]of Object.entries(p.params)){
      if(typeof v==='boolean'){if(v)f[p.name+'.'+key]=1;continue;}
      const n=key==='share'?v:Math.log1p(v)/Math.log(8);f[p.name+'.'+key]=(f[p.name+'.'+key]||0)+n;
    }
  }
  for(const [name,n]of Object.entries(counts))f['piece:'+name]=Math.log1p(n)/Math.log(2);
  const names=Object.keys(counts).sort();for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++)
    f['pair:'+names[i]+'+'+names[j]]=Math.log1p(counts[names[i]])*Math.log1p(counts[names[j]]);
  const clock=d.pieces.find(p=>p.name==='clock'),way=d.pieces.find(p=>p.name==='clockWay');
  if(clock&&way){const spare=clock.params.spare,share=way.params.share;
    f['clock.spare='+spare]=1;
    for(const cut of [.05,.1,.2,.3]){const h=Math.max(0,share-cut);f['route>'+cut]=h;f['route>'+cut+':spare='+spare]=h;}
    for(const name of ['keys','blindWay','frozenPartner','lockedPartners'])if(counts[name])f['spare='+spare+'×'+name]=f['piece:'+name];
  }
  f['residual.locks']=Math.log1p(d.residual.locks);f['residual.ice']=Math.log1p(d.residual.iceTiles);f['residual.hidden']=d.residual.hidden/d.layout.n;
  return f;
}
function solveSPD(matrix,rhs){
  const n=rhs.length,L=Array.from({length:n},()=>new Float64Array(n));
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let sum=matrix[i][j];for(let k=0;k<j;k++)sum-=L[i][k]*L[j][k];
    if(i===j){if(sum<=0)throw Error('Singular composition fit');L[i][j]=Math.sqrt(sum);}else L[i][j]=sum/L[j][j];}
  const y=new Float64Array(n),out=new Float64Array(n);
  for(let i=0;i<n;i++){let v=rhs[i];for(let j=0;j<i;j++)v-=L[i][j]*y[j];y[i]=v/L[i][i];}
  for(let i=n-1;i>=0;i--){let v=y[i];for(let j=i+1;j<n;j++)v-=L[j][i]*out[j];out[i]=v/L[i][i];}return [...out];
}
function fitRegression(samples,lambda=12){
  if(samples.length<2)throw Error('At least two measured boards are required');
  const keys=[...new Set(samples.flatMap(r=>Object.keys(r.x)))].sort(),total=samples.reduce((n,r)=>n+(r.weight??1),0),center={},scale={};
  for(const k of keys){center[k]=samples.reduce((n,r)=>n+(r.weight??1)*(r.x[k]||0),0)/total;
    scale[k]=Math.sqrt(samples.reduce((n,r)=>n+(r.weight??1)*((r.x[k]||0)-center[k])**2,0)/total);}
  const active=keys.filter(k=>scale[k]>1e-8),n=active.length+1,A=Array.from({length:n},()=>new Float64Array(n)),b=new Float64Array(n);
  for(const r of samples){const x=[1,...active.map(k=>((r.x[k]||0)-center[k])/scale[k])],w=r.weight??1;
    for(let i=0;i<n;i++){b[i]+=w*x[i]*Math.log(r.y);for(let j=0;j<=i;j++)A[i][j]+=w*x[i]*x[j];}}
  for(let i=0;i<n;i++){A[i][i]+=i===0?1e-8:lambda;for(let j=0;j<i;j++)A[j][i]=A[i][j];}
  const beta=solveSPD(A,b),model={keys:active,center,scale,intercept:beta[0],beta:beta.slice(1),lambda,n:samples.length};
  model.logRMSE=Math.sqrt(samples.reduce((n,r)=>n+(r.weight??1)*(Math.log(r.y)-predictRegression(model,r.x).log)**2,0)/total);
  return model;
}
function predictRegression(m,x){let log=m.intercept;for(let i=0;i<m.keys.length;i++){const k=m.keys[i];log+=m.beta[i]*((x[k]||0)-m.center[k])/m.scale[k];}
  return {log,tries:clamp(Math.exp(log)),interval:[clamp(Math.exp(log-1.645*m.logRMSE)),clamp(Math.exp(log+1.645*m.logRMSE))],
    unseen:Object.keys(x).filter(k=>!Object.hasOwn(m.center,k)&&Math.abs(x[k])>1e-8)};}
function groupOf(row){return row.group||layoutKey(row.design);}
function partition(rows){
  const groups=[...new Set(rows.map(groupOf))].sort(),test=new Set(groups.filter(g=>parseInt(digest(['piece-model-holdout-v1',g]).slice(0,8),16)%5===0));
  if(!test.size&&groups.length>1)test.add(groups.at(-1));if(test.size===groups.length)test.delete(groups[0]);
  return {train:rows.filter(r=>!test.has(groupOf(r))),test:rows.filter(r=>test.has(groupOf(r))),trainGroups:groups.filter(g=>!test.has(g)),testGroups:[...test]};
}
function ranks(values){const order=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v),r=Array(values.length);for(let i=0;i<order.length;){let j=i+1;while(j<order.length&&order[j].v===order[i].v)j++;for(let k=i;k<j;k++)r[order[k].i]=(i+j-1)/2;i=j;}return r;}
function correlation(a,b){if(a.length<2)return null;const x=mean(a),y=mean(b),top=a.reduce((n,v,i)=>n+(v-x)*(b[i]-y),0),bottom=Math.sqrt(a.reduce((n,v)=>n+(v-x)**2,0)*b.reduce((n,v)=>n+(v-y)**2,0));return bottom?top/bottom:null;}
function metrics(rows){if(!rows.length)return {n:0};const errors=rows.map(r=>r.predicted-r.measured),absolute=errors.map(Math.abs);return {n:rows.length,within1:absolute.filter(x=>x<=1).length/rows.length,within2:absolute.filter(x=>x<=2).length/rows.length,mae:mean(absolute),rmse:Math.sqrt(mean(errors.map(x=>x*x))),bias:mean(errors),spearman:correlation(ranks(rows.map(r=>r.measured)),ranks(rows.map(r=>r.predicted))),atCap:rows.filter(r=>r.measured>=19.9).length};}
function fit(rows,options={}){
  const groups=new Map();for(const r of rows)groups.set(groupOf(r),(groups.get(groupOf(r))||0)+1);
  const settings={};for(const setting of ['family','skilled']){
    const samples=rows.filter(r=>Number.isFinite(r[setting]?.exp)&&r[setting].exp>=1&&r[setting].valid!==false).map(r=>({x:features(r),y:r[setting].exp,
      weight:(r.weight??1)*(setting==='family'&&r.family.seedCount===1?.5:1)/Math.sqrt(groups.get(groupOf(r)))}));
    settings[setting]=fitRegression(samples,options.lambda??12);
  }
  return {schema:SCHEMA,piecesVersion:Pieces.VERSION,featureSource:implementation(),settings,lambda:options.lambda??12,trainingBoards:rows.length,trainingGroups:groups.size,
    bot:options.bot??null,input:digest(rows.map(r=>[r.id,groupOf(r),r.family,r.skilled])),intervalMeaning:'log residual normal approximation; not calibrated coverage'};
}
function predict(model,row){if(model.schema!==SCHEMA)throw Error('Unsupported composition model');if(model.featureSource&&model.featureSource!==implementation())throw Error('Composition features changed; rebuild the model');const x=features(row);return Object.fromEntries(['family','skilled'].map(k=>[k,predictRegression(model.settings[k],x)]));}
function trainAndValidate(rows,options={}){
  const split=partition(rows),fitted=fit(split.train,options),predictions=split.test.map(r=>({id:r.id,group:groupOf(r),kind:r.kind,familySeeds:r.family?.seedCount,
    ...Object.fromEntries(['family','skilled'].map(k=>[k,{predicted:predict(fitted,r)[k].tries,measured:r[k]?.exp??null}]))}));
  const report={schema:SCHEMA,split:{rule:'fixed hash of entire D4 layout; no siblings cross split',trainBoards:split.train.length,testBoards:split.test.length,trainGroups:split.trainGroups,testGroups:split.testGroups},lambda:options.lambda??12,settings:{},predictions};
  for(const k of ['family','skilled']){const valid=predictions.filter(r=>Number.isFinite(r[k].measured));report.settings[k]={all:metrics(valid.map(r=>r[k])),twoSeed:metrics(valid.filter(r=>k!=='family'||r.familySeeds===2).map(r=>r[k]))};}
  return {model:fit(rows,options),report,heldoutModel:fitted};
}
function settingKey(piece){return piece.name+':'+JSON.stringify(Object.fromEntries(Object.entries(piece.params).sort(([a],[b])=>a.localeCompare(b))));}
function summarizeEffects(records,bases){
  const neutral=new Map(bases.map(b=>[b.id,b])),single=new Map(),groups=new Map();
  for(const r of records)if(r.valid&&r.sample.kind==='single')single.set(r.sample.base+'|'+settingKey(r.sample.pieces[0]),r);
  for(const r of records){if(!r.valid)continue;const b=neutral.get(r.sample.base);if(!b)continue;const spec=r.sample.pieces,key=spec.map(settingKey).join(' + '),g=groups.get(key)||{kind:r.sample.kind,pieces:spec,values:{family:[],skilled:[]},bases:[],contextChanged:0};
    const controls=spec.map(p=>single.get(r.sample.base+'|'+settingKey(p)));if(spec.length===2&&controls.some(x=>!x))continue;
    for(const k of ['family','skilled']){let delta=Math.log(r[k].exp/b[k].exp);if(spec.length===2)delta-=controls.reduce((n,s)=>n+Math.log(s[k].exp/b[k].exp),0);g.values[k].push(delta);}
    if(spec.length===2){const owned=r.sample.design.pieceInstances.at(-1).owned,alone=controls[1].sample.design.pieceInstances.at(-1).owned;if(JSON.stringify(owned)!==JSON.stringify(alone))g.contextChanged++;}
    g.bases.push(r.sample.base);groups.set(key,g);
  }
  return [...groups].map(([key,g])=>({key,kind:g.kind,pieces:g.pieces,n:g.bases.length,bases:g.bases,contextChanged:g.contextChanged,
    ...Object.fromEntries(['family','skilled'].map(k=>{const a=g.values[k];return [k,{medianLog:quantile(a,.5),factor:Math.exp(quantile(a,.5)),factorIQR:[Math.exp(quantile(a,.25)),Math.exp(quantile(a,.75))],logSD:Math.sqrt(mean(a.map(x=>(x-mean(a))**2))),logRange:[Math.min(...a),Math.max(...a)]}];}))}));
}
module.exports={SCHEMA,features,fitRegression,predictRegression,partition,metrics,fit,predict,trainAndValidate,settingKey,summarizeEffects};
