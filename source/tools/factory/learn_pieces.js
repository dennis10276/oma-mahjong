'use strict';
const fs=require('fs'),path=require('path');
const M=require('./meter.js'),C=require('./compose.js'),P=require('./pieces.js'),O=require('./originality.js');
const read=f=>JSON.parse(fs.readFileSync(f));
function loadHistorical(buildRoot,current){
  const familyBots=new Set([current,'cae3bc38f7b01e627e288330d5ba0cf210383e39e864ab35976e29faff64f83d','ac24aad82490bab263850596afacb302f2f50b4b73464430c8e95962562808ef']);
  const rows=new Map(),stats={folders:[],badKeys:0,unapprovedFamily:0,oldSkilled:0};
  for(const folder of fs.readdirSync(buildRoot,{withFileTypes:true}).filter(d=>d.isDirectory()&&/^batch-200-225/.test(d.name))){
    const dir=path.join(buildRoot,folder.name),file=path.join(dir,'pool.json');if(!fs.existsSync(file))continue;
    const time=fs.statSync(file).mtimeMs,files=new Set(fs.readdirSync(dir));stats.folders.push(folder.name);
    for(const r of read(file)){
      if(!r.design?.solution||!r.design.tiles.length)continue;
      const id=M.boardKey(r.design),get=mode=>files.has(r.id+'.'+mode+'.json')?read(path.join(dir,r.id+'.'+mode+'.json')):null,rate=get('rate'),quality=get('quality');
      if(!rate&&!quality)continue;
      let family=null,skilled=null;
      if(rate?.train?.valid){if(rate.key!==id){stats.badKeys++;continue;}
        if(familyBots.has(rate.bot))family={exp:rate.validation?.valid?(rate.train.exp+rate.validation.exp)/2:rate.train.exp,
          seeds:rate.validation?.valid?[rate.train.exp,rate.validation.exp]:[rate.train.exp],seedCount:rate.validation?.valid?2:1,valid:true,source:dir,bot:rate.bot};
        else stats.unapprovedFamily++;
      }
      if(quality?.skilled?.valid){
        if(quality.key!==id){stats.badKeys++;continue;}
        if(quality.bot===current&&(quality.skilled.botValid??quality.skilled.valid))skilled={exp:quality.skilled.botExp??quality.skilled.exp,valid:true,source:dir,bot:quality.bot};
        else stats.oldSkilled++;
      }
      if(!family&&!skilled)continue;
      const prior=rows.get(id),use=prior&&prior.time>time?{...prior}:{id,kind:'historical',group:O.layoutKey(r.design),design:r.design,shape:r.shape,time};
      use.family=prior?.family;
      if(family&&(!use.family||family.seedCount>use.family.seedCount||family.seedCount===use.family.seedCount&&time>=(prior?.time??0)))use.family=family;
      use.skilled=skilled||prior?.skilled;
      rows.set(id,use);
    }
  }
  return {rows:[...rows.values()],stats};
}
function loadDiagnostics(handback,current){
  const file=path.join(handback,'planner-diagnostics.json'),levels=path.join(handback,'levels.jsonl');if(!fs.existsSync(file)||!fs.existsSync(levels))return [];
  const boards=new Map(fs.readFileSync(levels,'utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>{const row=JSON.parse(line);return [row.id,row];})),rows=[];
  for(const r of read(file)){const old=boards.get(r.id);if(!old||r.newBot!==current||!r.allFaceUpValid||r.boardHash!==M.boardKey(old.design))continue;
    const design={...old.design,down:[]};rows.push({id:M.boardKey(design),kind:'all-face-up-diagnostic',group:O.layoutKey(design),design,shape:old.shape,
      skilled:{exp:r.allFaceUp,valid:true,bot:current,seed:4711,runs:20,seedBatches:2,source:file}});
  }return rows;
}
function main(experimentDir,out){
  const measuredFile=path.join(experimentDir,'measurements','measurements.json');if(!fs.existsSync(measuredFile))throw Error('Finish the piece measurements before fitting');
  const records=read(measuredFile),state=read(path.join(experimentDir,'construction.json')),bases=read(path.resolve(__dirname,'../../analysis/factory/piece-bases.json')),meter=M.createMeter();
  if(records.length!==state.rows.length||records.some(r=>!r.valid||r.bot!==meter.fingerprint))throw Error('Incomplete, invalid or stale experiment measurements');
  const historical=loadHistorical(path.resolve(__dirname,'../../build'),meter.fingerprint),rows=new Map(historical.rows.map(r=>[r.id,r]));
  const diagnostics=loadDiagnostics(path.resolve(__dirname,'../../../../codex-tasks/results/200-225-v11'),meter.fingerprint);
  for(const r of diagnostics)rows.set(r.id,{...(rows.get(r.id)||{}),...r});
  for(const base of bases)rows.set(M.boardKey(base.design),{id:M.boardKey(base.design),kind:'calm-base',group:base.layout,design:base.design,shape:base.shape,
    family:{...base.family,seedCount:2,valid:true},skilled:{...base.skilled,valid:true}});
  for(const r of records)rows.set(r.board,{id:r.board,kind:r.sample.kind,group:r.sample.layout,design:r.sample.design,shape:r.sample.shape,
    family:{...r.family,seedCount:2,valid:true},skilled:{...r.skilled,valid:true}});
  const dataset=[...rows.values()],fit=C.trainAndValidate(dataset,{bot:meter.fingerprint,lambda:12}),effects=C.summarizeEffects(records,bases);
  fs.mkdirSync(out,{recursive:true});
  M.atomicJson(path.join(out,'catalogue.json'),{version:P.VERSION,pieces:Object.values(P.CATALOGUE).map(({place,...s})=>s),commonPairs:state.common,
    placed:records.length,attempted:state.done.length,failures:state.failures,baseCount:bases.length,notes:['Effects can be negative and depend on layout.','Pairs reuse the same base and operation seed; role placements may change in context.','Tempting pairs are opportunities, not automatically proven bad moves.']});
  M.atomicJson(path.join(out,'effects.json'),effects);M.atomicJson(path.join(out,'model.json'),fit.model);M.atomicJson(path.join(out,'heldout-model.json'),fit.heldoutModel);M.atomicJson(path.join(out,'heldout-report.json'),fit.report);
  M.atomicJson(path.join(out,'training-data.json'),dataset);M.atomicJson(path.join(out,'data-audit.json'),{bot:meter.fingerprint,historical:historical.stats,
    historicalUnique:historical.rows.length,diagnosticBoards:diagnostics.length,measuredExperimental:records.length,trainingUnique:dataset.length,familyLabels:dataset.filter(r=>r.family).length,
    familyTwoSeed:dataset.filter(r=>r.family?.seedCount===2).length,skilledLabels:dataset.filter(r=>r.skilled).length,
    rules:['Deduplicated exact physical boards','Held out whole D4 layouts, including all sibling variants','Only full current-bot skilled labels; no scout or planner-preview labels','Family uses exact approved unchanged fingerprints; single-seed full labels have half weight','Independent seed 29717 is excluded entirely','Fixed ridge penalty 12 chosen before held-out results','Training normalizes layout contribution by inverse square root of group count']});
  console.log(JSON.stringify({rows:dataset.length,settings:fit.report.settings,effectSettings:effects.length},null,2));return {dataset,...fit,effects};
}
module.exports={loadHistorical,loadDiagnostics,main};
if(require.main===module){try{main(process.argv[2],process.argv[3]);}catch(e){console.error(e);process.exitCode=1;}}
