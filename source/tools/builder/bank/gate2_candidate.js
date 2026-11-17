'use strict';
// Adoption is deliberately all-or-nothing. Building this tool does not extend
// the candidate until every 301–349 puzzle has current proof and game evidence.
const fs=require('fs'),path=require('path'),cp=require('child_process'),vm=require('vm'),crypto=require('crypto'),P=require('./finish_all_sources'),D=require('./detower'),T=require('./shape_bench_tools'),E=require(D.CF+'../engine');
const OUT=path.resolve(__dirname,'../../../analysis/builder/finish-all/gate2'),CAND=path.resolve(__dirname,'../../../../../codex-towers-candidate'),BASE='97dc6221',REVISION=12;
const read=f=>JSON.parse(fs.readFileSync(path.join(OUT,f))),hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function at(file){return cp.execFileSync('git',['show',`${BASE}:${file}`],{cwd:CAND,encoding:'utf8',maxBuffer:10000000});}
function build(){const progress=read('progress.json'),browser=read('browser.json');
 if(progress.checksPass!==49||progress.sourceGameWins!==49||progress.draftGameWins!==49||browser.gameVersion!=='1.70')throw Error('All 49 current proofs, finish targets and game wins are required before adoption');
 if(cp.execFileSync('git',['branch','--show-current'],{cwd:CAND,encoding:'utf8'}).trim()!=='wip/codex-towers-candidate')throw Error('Wrong candidate branch');
 cp.execFileSync('git',['merge-base','--is-ancestor',BASE,'HEAD'],{cwd:CAND});
 const baseline=at('source/www/levels-hard.js'),old=vm.runInNewContext(baseline+';HARD_LEVELS'),table=structuredClone(old),Hard=require(path.join(CAND,'source/www/hard')),rows=[];
 if(old.from+old.levels.length-1!==300)throw Error('Unexpected released table');
 const builder=path.resolve(__dirname,'../../../..'),builderCommit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:builder,encoding:'utf8'}).trim(),proofFiles=Array.from({length:49},(_,i)=>301+i).flatMap(n=>['level','audit','finish-pressure'].map(k=>`source/analysis/builder/finish-all/gate2/${k}-${n}.json`)).concat('source/analysis/builder/finish-all/gate2/browser.json');
 cp.execFileSync('git',['ls-files','--error-unmatch',...proofFiles],{cwd:builder,stdio:'pipe'});cp.execFileSync('git',['diff','--quiet','HEAD','--',...proofFiles],{cwd:builder,stdio:'pipe'});
 const candidateTest=fs.readFileSync(path.join(OUT,'candidate-tests/t_gate2_versions.js'),'utf8');
 for(let level=301;level<=349;level++){
  const r=read(`level-${level}.json`),a=read(`audit-${level}.json`),f=read(`finish-pressure-${level}.json`),h=P.hash(r.design),source=P.original(level),shape=T.geometry(r.design,{tenth:level%10===0});
  if(!r.ok||!a.ok||a.schema!==4||a.hash!==h||a.sourceHash!==P.hash(source.design)||!a.controlGates.ok||!f.met||f.hash!==h||!shape.ok||a.pressure?.delta.wrongPark>=.25||!browser.rows.some(b=>b.level===level&&b.variant==='revised'&&b.hash===h&&b.ok))throw Error('Stale or incomplete evidence '+level);
  if(!r.keep.every((id,i)=>r.design.faces[i]===source.design.faces[id]))throw Error('Changed identity picture '+level);
  const packed=Hard.pack({...r.design,info:{rate:0,strong:0}}),d=Hard.unpack(level,packed);
  if(!E.replay(d,d.solution,{strict:true}).ok||!T.geometry(d,{tenth:level%10===0}).ok)throw Error('Packed round trip '+level);
  table.levels.push(packed);table.ratingModels.push('strong');table.boardVersions[level]=REVISION;
  rows.push({level,sourceHash:P.hash(source.design),designHash:h,packedHash:hash(packed),revision:REVISION,tiles:d.tiles.length,px:shape.px,pressure:f.after.pressureParks,pressureTarget:f.target.pressureParks,validatorHash:a.validatorHash});
 }
 table.repeatVersion=REVISION;
 if(hash(table.levels.slice(0,old.levels.length))!==hash(old.levels)||Object.keys(old.boardVersions).some(k=>table.boardVersions[k]!==old.boardVersions[k]))throw Error('Released boards or revisions changed');
 const runtimeBase=at('source/www/hard.js'),anchor='    const T = table();\n    // Refits invalidate only their own saved layouts';
 const runtime=runtimeBase.replace(anchor,'    const T = table();\n    // Extending the repeat span changes every board past the authored table.\n    if (T && Number.isInteger(T.repeatVersion) && level > T.from + T.levels.length - 1) return T.repeatVersion;\n    // Refits invalidate only their own saved layouts');
 if(runtime===runtimeBase)throw Error('Missing repeat-version anchor');
 const L=require(path.join(CAND,'source/www/layouts')),oldH=vm.runInNewContext(runtimeBase+';Hard',{Layouts:L,HARD_LEVELS:old}),newH=vm.runInNewContext(runtime+';Hard',{Layouts:L,HARD_LEVELS:table});
 for(let n=1;n<=300;n++)if(newH.designVersion(n)!==oldH.designVersion(n))throw Error('Earlier save revision '+n);
 for(let n=301;n<=749;n++)if(newH.designVersion(n)!==REVISION)throw Error('New/repeated save revision '+n);
 const start=baseline.indexOf('const HARD_LEVELS = '),tail=baseline.slice(baseline.lastIndexOf('};')+2),text=baseline.slice(0,start)+'/* Task 24 gate 2: own-source refits 301–349; released 250–300 preserved. Candidate only. */\nconst HARD_LEVELS = '+JSON.stringify(table)+';'+tail;
 const manifest={task:24,gate:2,scope:[301,349],base:BASE,builderCommit,revision:REVISION,repeatVersion:REVISION,last:349,earlierPackedHash:hash(old.levels),earlierRevisions:old.boardVersions,rows,all49RoundTrips:true,allEarlierRowsAndRevisionsUnchanged:true,ratingFields:'Legacy zero placeholders; no player win-rate prediction',releaseAuthorized:false,ok:true};
 // Prepare exact test changes from released files, failing on an unexpected base.
 const refitBase=at('source/tests/t_refit_versions.js'),refit=refitBase.replace('Object.keys(T.boardVersions).map(Number),manifest.changedLevels','Object.keys(T.boardVersions).map(Number).filter(n=>n<=300),manifest.changedLevels').replace("t.eq(last,300,'gate 2 table not introduced')","t.eq(last,349,'gate 2 table ends at 349')").replace("T.boardVersions[base]||9,'repeat revision '","12,'repeat revision '");
 const reorderBase=at('source/tests/t_reorder_honest.js'),reorder=reorderBase.replace('[250, 9, now.v, 9, 9]','[250, 9, now.v, 9, 12]');
 if(refit===refitBase||reorder===reorderBase)throw Error('Missing saved-version test anchor');
 fs.writeFileSync(path.join(CAND,'source/www/levels-hard.js'),text);fs.writeFileSync(path.join(CAND,'source/www/hard.js'),runtime);
 fs.writeFileSync(path.join(CAND,'source/analysis/refit-301-349.json'),JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(path.join(CAND,'source/tests/t_refit_versions.js'),refit);fs.writeFileSync(path.join(CAND,'source/tests/t_reorder_honest.js'),reorder);
 fs.writeFileSync(path.join(CAND,'source/tests/t_gate2_versions.js'),candidateTest);
 fs.writeFileSync(path.join(OUT,'candidate.json'),JSON.stringify(manifest,null,2));
 console.log(JSON.stringify({base:BASE,last:349,rows:rows.length,revision:REVISION,repeatVersion:REVISION,preservedThrough:300}));return manifest;
}
if(require.main===module)build();module.exports={build};
