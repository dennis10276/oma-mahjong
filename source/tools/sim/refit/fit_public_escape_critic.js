'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {fit,predict,metrics}=require('./public_escape_critic.js');
const read=file=>JSON.parse(fs.readFileSync(file)),digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function run(directory){
 const folder=path.resolve(directory),audit=read(path.join(folder,'experience-independent-audit-v1.json')),
  plan=read(path.join(folder,'fit-plan-v2.json')),native=read(path.join(folder,'supervisor-native-exit.json'));
 assert(audit.verified&&native.authoritativelyTerminal&&native.exitCode===0);assert(read(path.join(folder,'independent-topology-audit-v2.json')).passed);
 assert.equal(digest(fs.readFileSync(path.join(folder,'fit-plan-v2.json'))),audit.fitPlanSha256);
 const selected=new Map(plan.rows.map(r=>[r.boardHash,r])),data={train:[],validation:[]},boards={train:0,validation:0},seen=new Set();
 for(let shard=0;shard<3;shard++)for(const record of fs.readFileSync(path.join(folder,'shard'+shard+'.jsonl'),'utf8').trim().split(/\r?\n/).map(JSON.parse)){
  if(record.type!=='experience')continue;assert(!seen.has(record.boardHash));seen.add(record.boardHash);
  const board=selected.get(record.boardHash);if(!board)continue;
  const rows=record.attempts.flatMap(a=>a.examples).filter(r=>r.y!==null);if(!rows.length)continue;boards[board.split]++;
  for(const row of rows)data[board.split].push({x:row.x,y:row.y,weight:1/rows.length});
 }
 assert.equal(seen.size,72);assert(data.train.length>0&&data.validation.length>0);
 const model=fit(data.train,plan.model),score=x=>predict(model,x),constant=()=>model.trainingPrevalence;
 const report={createdAt:new Date().toISOString(),modelKind:model.kind,fitPlanSha256:audit.fitPlanSha256,experienceAuditSha256:digest(fs.readFileSync(path.join(folder,'experience-independent-audit-v1.json'))),
  sourceHashes:Object.fromEntries(['public_escape_features.js','public_escape_critic.js','fit_public_escape_critic.js'].map(file=>[file,digest(fs.readFileSync(path.join(__dirname,file)))])),
  counts:plan.counts,contributingBoards:boards,hyperparameters:plan.model,training:metrics(data.train,score),validation:metrics(data.validation,score),
  constantTraining:metrics(data.train,constant),constantValidation:metrics(data.validation,constant),
  limitation:'Observed bot-policy escape estimates on sparse earlier experience;no benchmark/human labels,not causal guarantees or human attempt-count accuracy. Validation has only one clock board.'};
 model.provenance={fitPlanSha256:audit.fitPlanSha256,trainingExperienceAuditSha256:report.experienceAuditSha256,publicFeaturesSha256:report.sourceHashes['public_escape_features.js'],
  benchmarkTopologyExcluded:true,sharedAcrossBoards:true,eligibleTrainingBoards:plan.counts.train.boards,contributingTrainingBoards:boards.train};
 const encoded=JSON.stringify(model,null,2);report.modelSha256=digest(encoded);
 fs.writeFileSync(path.join(folder,'escape-model-v1.json'),encoded,{flag:'wx'});
 fs.writeFileSync(path.join(folder,'escape-model-fit-report-v1.json'),JSON.stringify(report,null,2),{flag:'wx'});
 console.log(JSON.stringify({modelSha256:report.modelSha256,contributingBoards:boards,
  training:{rows:report.training.rows,positive:report.training.positive,negative:report.training.negative,brier:report.training.brier,auc:report.training.auc},
  validation:{rows:report.validation.rows,positive:report.validation.positive,negative:report.validation.negative,brier:report.validation.brier,auc:report.validation.auc},constantValidationBrier:report.constantValidation.brier}));
 return report;
}
if(require.main===module)run(process.argv[2]);module.exports={run};
