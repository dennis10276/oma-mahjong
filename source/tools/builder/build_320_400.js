'use strict';
// Bounded local search for working, single-clock, combined-idea chains.
// Run through loop/heavy.js. Data is isolated from the lead's catalogues.
const fs=require('fs'),path=require('path');
const R=require('./chained_six_run.js');
const ROOT=path.resolve(__dirname,'../../..'),TMP=path.join(ROOT,'source/build/320-400'),OUT=path.join(ROOT,'source/analysis/builder/bank/range-320-400');
const arg=(n,d)=>{const i=process.argv.indexOf('--'+n);return i<0?d:process.argv[i+1];};
const names=['selfLocked_savePair','clockCount_savePair','clockCountThaw_savePair','lookalikeThaw_savePair','lookalikeThaw_clockCount','waitNested_selfLocked','waitThawKey_selfLocked','waitThawWay_selfLocked','waitThawWay_clockCount','waitThawKey_savePair','roofThawKey_clockCount','roofThawKey_selfLocked','roofThawKey_savePair','waitLookalikeWay','waitLookalikeRoof'];
async function main(){
  for(const p of [TMP,path.join(TMP,'raw'),OUT,path.join(OUT,'candidates')])fs.mkdirSync(p,{recursive:true});
  const seed=+arg('seed',601),workers=+arg('workers',8),until=Date.now()+ +arg('minutes',15)*60000;
  const defaults=process.argv.includes('--extended')?require('./chained_shapes.js').RANGE_COMBINATIONS:names;
  const chosen=arg('names',defaults.join(',')).split(','),layouts=arg('layouts',Array.from({length:48},(_,i)=>i).join(',')).split(',').map(Number),mode=arg('stage','build');
  let jobs;
  if(mode==='finish')jobs=fs.readdirSync(path.join(TMP,'raw')).filter(f=>f.endsWith('.json')&&!fs.existsSync(path.join(OUT,'candidates',f))).map(f=>({file:path.join(TMP,'raw',f),name:f.split('-L')[0]}));
  else jobs=layouts.flatMap(layout=>chosen.map(name=>({name,layout,seed})));
  if(arg('reverse','0')==='1')jobs.reverse();
  fs.writeFileSync(path.join(TMP,'jobs-'+seed+'.json'),JSON.stringify(jobs));
  let cursor=0;const log=path.join(TMP,`${mode}-${seed}-${Date.now()}.jsonl`);
  let failed=0;const note=r=>{fs.appendFileSync(log,JSON.stringify(r)+'\n');if(r.ok||r.complete||++failed%25===0)console.log(JSON.stringify(r));};
  await Promise.all(Array.from({length:workers},async()=>{while(cursor<jobs.length&&Date.now()<until){
    const j=jobs[cursor++],id=j.file?path.basename(j.file):`${j.name}-L${j.layout}-s${seed}-p1.json`,raw=path.join(TMP,'raw',id),out=path.join(OUT,'candidates',id);
    if(fs.existsSync(out))continue;
    if(mode==='build'&&!fs.existsSync(raw)){
      const r=await R.job({...j,mode:'build',tries:+arg('tries',500),ms:Math.min(+arg('build-ms',15000),until-Date.now()),readabilityProfile:'clear-specials-v1'});
      if(!r.design){note({...j,stage:'build',ok:false,fail:r.fail,fails:r.fails,wall:r.wall});continue;}
      fs.writeFileSync(raw,JSON.stringify(r));note({...j,stage:'build',ok:true,wall:r.wall});
    }
    if(Date.now()>=until)break;
    const r=await R.job({mode:'finish',file:raw,seed,finishProfile:'light-after-verdict',ms:Math.min(+arg('finish-ms',100000),until-Date.now()),tuneMs:40000,repairMs:16000});
    if(r.design){fs.writeFileSync(out,JSON.stringify(r,null,1));note({...j,stage:'finish',ok:true,file:id,wall:r.wall,ideas:r.card.wrongIdea});}
    else{if(r.checkpoint)fs.writeFileSync(raw,JSON.stringify(r.checkpoint));note({...j,stage:'finish',ok:false,file:id,fail:r.fail,detail:r.detail,errors:r.verification?.errors,wall:r.wall});}
  }}));
  note({complete:true,considered:cursor,total:jobs.length});
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={OUT,TMP,names};
