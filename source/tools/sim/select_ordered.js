/* Select a complete strictly ordered chain from independently measured candidates.
   Writes a review artifact; use --install explicitly to update the LOCAL app table. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const H=require('../../www/hard'),P=require('./ordered_policy');
const root=path.resolve(__dirname,'../..'),read=f=>vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8')+';HARD_LEVELS');
const old=read('analysis/levels-1.49.js'),input=JSON.parse(fs.readFileSync(path.join(root,'analysis/ordered-measured.json')));
const candidates=Object.values(input.rows).filter(c=>P.quality(c.m)&&c.sensible<=c.m.win+.05).sort((a,b)=>b.m.win-a.m.win||a.id-b.id);
const count=P.POLICY.to-P.POLICY.from+1,n=candidates.length,gap=1/P.POLICY.validationRuns;
const predecessors=[],costs=[];
for(let step=0;step<count;step++){
 const lv=P.POLICY.from+step,goal=P.target(lv),cost=new Float64Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1);
 for(let j=0;j<n;j++){
  const c=candidates[j],d=H.unpack(lv,c.row),error=Math.abs(c.m.win-goal);
  if(error>.015||!P.clockFits(d,lv))continue;
  // Prefer useful visible planning when two boards are both near the target.
  const own=error*error+.4*Math.pow(Math.max(0,c.m.unknownShare-.22),2);
  if(!step){cost[j]=own;continue;}
  for(let i=0;i<j;i++){
   const a=candidates[i];if(!Number.isFinite(costs[step-1][i])||a.m.win-c.m.win<gap-1e-12||a.m.win-c.m.win>.04||a.m.afterClock<=c.m.afterClock)continue;
   const value=costs[step-1][i]+own+(a.sourceLevel===c.sourceLevel?.0001:0);
   if(value<cost[j]){cost[j]=value;prev[j]=i;}
  }
 }
 costs.push(cost);predecessors.push(prev);
 if(!cost.some(Number.isFinite))throw Error(`No complete ordered chain reaches level ${lv}; add candidates rather than accepting an easier step`);
}
let j=costs[count-1].reduce((best,v,i,a)=>v<a[best]?i:best,0),selected=[];
for(let step=count-1;step>=0;step--){selected.push({...candidates[j],lv:P.POLICY.from+step});j=predecessors[step][j];}selected.reverse();
const table=JSON.parse(JSON.stringify(old));table.v=5;table.cycleFrom=P.POLICY.to;table.overflow='hardest';
const rows=[];
for(const c of selected){
 const d=H.unpack(c.lv,c.row),before=H.unpack(c.sourceLevel,old.levels[c.sourceLevel-old.from]);
 if(!P.protectedBoard(d,before))throw Error('Protection failed at '+c.lv);
 const row=c.row.slice();row[8]=c.sensible;row[9]=c.m.win;table.levels[c.lv-table.from]=row;
 rows.push({lv:c.lv,sourceLevel:c.sourceLevel,candidateId:c.id,target:P.target(c.lv),sensible:c.sensible,focused:c.m.win,...c.m,tilePx:P.tilePx(d),hash:crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex')});
}
const report={modelVersion:H.MODEL_VERSION,observerHash:crypto.createHash('sha256').update(H.play.toString()).digest('hex'),profile:H.REF.focused,runs:P.POLICY.validationRuns,seed:P.POLICY.validationSeed,sensibleRuns:1024,policy:P.POLICY,maxStep:.04,targetTolerance:.015,candidateCount:candidates.length,rows};
const suffix=process.argv.includes('--preview')?'ordered-preview':'ordered';
if(process.argv.includes('--preview')&&process.argv.includes('--install'))throw Error('Preview cannot install');
fs.writeFileSync(path.join(root,'analysis/validation-'+suffix+'.json'),JSON.stringify(report,null,2)+'\n');
const content='/* Local unpublished draft: observer-safe measurements; strictly increasing measured difficulty from 80. */\nconst HARD_LEVELS = '+JSON.stringify(table)+';\n';
fs.writeFileSync(path.join(root,'analysis/levels-'+suffix+'.js'),content);
if(process.argv.includes('--install'))fs.writeFileSync(path.join(root,'www/levels-hard.js'),content);
console.log(`${rows.length} strictly ordered levels; ${candidates.length} qualified candidates. ${process.argv.includes('--install')?'LOCAL app table updated; nothing published.':'Review artifacts only.'}`);
for(const lv of [80,81,82,83,84,85,86,90,100,120,150,200,269]){const r=rows.find(r=>r.lv===lv);console.log(`${lv}: ${(100*r.focused).toFixed(2)}% target ${(100*r.target).toFixed(2)}%, clock reach ${(100*r.reach).toFixed(2)}%, blind ${(100*r.blindRate).toFixed(2)}%`);}
