'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),{execFileSync}=require('child_process');
const {prepareLabCatalog,validatePrepared,summarizeLab,digest}=require('./human_lab_ranking.js');
const FACTORY=require('./human_factory_contract.json');
const SOURCE=path.resolve(__dirname,'../../..'),ROOT=path.dirname(SOURCE);
function read(file){return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}
function json(file,value){fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
function records(dir){return fs.readFileSync(path.join(dir,'records.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);}
function freshDirectory(dir){assert(!fs.existsSync(dir),'Use a new output directory');fs.mkdirSync(dir,{recursive:true});}
function prepare(input,out){
 const raw=fs.readFileSync(input),data=JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')),prepared=prepareLabCatalog(data);
 freshDirectory(out);fs.writeFileSync(path.join(out,'input.json'),raw,{flag:'wx'});json(path.join(out,'prepared.json'),prepared);
 json(path.join(out,'status.json'),{status:'prepared-without-model-measurements',modelRuns:0,boards:prepared.entries.length,primary:prepared.contract.primary,threshold:prepared.contract.minimumSpearman});
 console.log(JSON.stringify({status:'prepared-without-model-measurements',levels:prepared.contract.levels,excluded:prepared.excluded,modelRuns:0}));return prepared;
}
function assertPrerequisites(calibration,factory,rows,exits){
 assert(calibration.finalGatesMet===true&&calibration.valid===true&&calibration.developmentScreen===false,'Milestone2 is not passed; no held-out lab measurement is allowed');
 const {CONTRACT,summarize}=require('./human_style_benchmark.js');
 const expected=[...new Set([...Array.from({length:CONTRACT.progression.to-CONTRACT.progression.from+1},(_,i)=>CONTRACT.progression.from+i),...CONTRACT.risk,...CONTRACT.controls,...CONTRACT.clockCases])].sort((a,b)=>a-b);
 assert.deepEqual(rows.map(r=>r.lv).sort((a,b)=>a-b),expected,'Incomplete or duplicated calibration coverage');
 const replay=summarize(rows,12);assert(replay.finalGatesMet&&replay.valid);assert.deepEqual(replay.settings,calibration.settings,'Calibration greens disagree with underlying records');
 assert(Array.isArray(exits)&&exits.length>=1&&exits.length<=4&&new Set(exits.map(r=>r.worker)).size===exits.length&&exits.every(r=>r.exitCode===0),'Calibration workers did not all complete');
 assert(factory.passed===true&&['d','e','timing','valid'].every(k=>factory.checks[k]===true),'Factory regression gates are unmet');
 assert.deepEqual(factory.contract.gates,FACTORY.gates,'Factory thresholds changed');
 assert.deepEqual(factory.rows.map(r=>r.key).sort(),Object.keys(FACTORY.boards).sort(),'Factory board coverage changed');
 assert(factory.rows.every(r=>r.boardHash===FACTORY.boards[r.key]&&r.seed===FACTORY.seed&&r.cleared===r.runs&&r.runs===FACTORY.runs&&r.valid),'The exact factory boards and complete clear coverage from v0 must be retained');
 const versions=new Set();for(const row of rows)for(const name of ['Dennis','family']){
  const m=row.measure.settings[name];assert(m.runs===20&&m.results.length===20&&m.valid);
  for(const c of m.results)assert(c.wonOn!==null||c.attempts.length===12,'A shorter failed campaign cannot prove a full calibration run');
  versions.add(m.version);
 }
 assert(versions.size===1&&/^human-v[1-9][0-9]*(?:[.-].*)?$/.test([...versions][0]),'A correctly identified post-v0 model is required');
 return {version:[...versions][0]};
}
function verifyArchive(dir){
 const manifest=read(path.join(dir,'source-manifest.json')),root=path.resolve(dir,'sources');
 const pairs=manifest.files.map(file=>{const resolved=path.resolve(root,file);assert(!path.isAbsolute(file)&&resolved.startsWith(root+path.sep),'Archive path leaves its source directory');return [file,crypto.createHash('sha256').update(fs.readFileSync(resolved)).digest('hex')];});
 assert.equal(digest(pairs),manifest.hash,'Prerequisite source archive was modified');return manifest;
}
function assertSameModelSources(snapshot,dir){
 verifyArchive(dir);
 for(const file of snapshot.files){const current=fs.readFileSync(path.join(SOURCE,file),'utf8').replace(/\r\n/g,'\n');
  assert.equal(fs.readFileSync(path.join(dir,'sources',file),'utf8').replace(/\r\n/g,'\n'),current,'Model changed since prerequisite evaluation:'+file);}
}
function run(preparedDir,out,calibrationDir,factoryDir){
 // This guard precedes importing or executing the simulator. Preparing the
 // catalog never consumes the held-out lab outcomes of an uncalibrated bot in this calibration round.
 let releaseCommit;try{releaseCommit=execFileSync('git',['rev-parse','--verify','human-v1^{commit}'],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
 catch{throw Error('Milestone2 release human-v1 is required before lab measurements; --prepare remains available');}
 execFileSync('git',['merge-base','--is-ancestor',releaseCommit,'HEAD'],{cwd:ROOT,stdio:'pipe'});
 const prepared=read(path.join(preparedDir,'prepared.json'));validatePrepared(prepared);
 const input=read(path.join(preparedDir,'input.json'));
 assert.equal(digest(input),prepared.contract.dataHash,'Prepared input changed');
 assert.deepEqual(prepared,prepareLabCatalog(input),'Prepared cohort no longer matches its source data');
 const full=read(path.join(calibrationDir,'summary.json')),factory=read(path.join(factoryDir,'summary.json'));
 const proof=assertPrerequisites(full,factory,records(calibrationDir),read(path.join(calibrationDir,'worker-exits.json')));
 const profiles=read(path.join(calibrationDir,'profiles.json'));
 const {PROFILES}=require('./human_factory_controller.js');assert.deepEqual(factory.contract.profiles??{Dennis:PROFILES.dennis,family:PROFILES.family},profiles,'Factory and calibration person profiles differ');
 const {measureHuman}=require('./human_bot.js'),{captureSources}=require('./human_level_sources.js');
 const snapshot=captureSources(require.cache[require.resolve('./human_bot.js')]);
 assertSameModelSources(snapshot,calibrationDir);assertSameModelSources(snapshot,factoryDir);
 const execution=captureSources(module);
 const profileHash=digest(profiles);for(const r of records(calibrationDir))for(const m of Object.values(r.measure.settings))assert.equal(m.profileHash,profileHash);
 freshDirectory(out);json(path.join(out,'prepared.json'),prepared);json(path.join(out,'profiles.json'),profiles);
 json(path.join(out,'prerequisite.json'),{releaseCommit,version:proof.version,calibrationDir:path.resolve(calibrationDir),factoryDir:path.resolve(factoryDir)});
 for(const file of execution.files){const to=path.join(out,'sources',file);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(SOURCE,file),to,fs.constants.COPYFILE_EXCL);}
 execution.verify();json(path.join(out,'source-manifest.json'),{hash:execution.hash,files:execution.files,modelHash:snapshot.hash});
 const measured=[];
 for(const entry of prepared.entries){
  execution.verify();const measure=measureHuman(entry.game,{setting:'dennis',runs:prepared.contract.runs,seed:prepared.contract.seed,maxAttempts:prepared.contract.maxAttempts,profiles});
  assert.equal(measure.version,proof.version);assert.equal(measure.profileHash,profileHash);
  measured.push({lv:entry.lv,measure});fs.appendFileSync(path.join(out,'records.jsonl'),JSON.stringify(measured.at(-1))+'\n');
  console.log(entry.lv,JSON.stringify({first:measure.firstTryRate,mean:measure.averageTries,uncleared:measure.unclearedAtAttemptLimit,minutes:measure.minutes}));
 }
 execution.verify();const summary=summarizeLab(prepared,measured);summary.priorMilestonesVerified=true;
 summary.milestone3Met=summary.rankingGateMet;summary.note='Prospective validation is still required even when the lab ranking passes';
 json(path.join(out,'summary.json'),summary);console.log(JSON.stringify({status:summary.status,rho:summary.primarySpearman,rankingGateMet:summary.rankingGateMet}));return summary;
}
function main(){const [mode,...args]=process.argv.slice(2);if(mode==='--prepare'){assert(args.length===2);return prepare(...args);}assert(mode==='--run'&&args.length===4,'Usage: --prepare lab-clears.json new-dir OR --run prepared-dir new-dir calibration-dir factory-dir');return run(...args);}
if(require.main===module){try{main();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={prepare,run,assertPrerequisites,verifyArchive};
