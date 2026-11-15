'use strict';
// Read Dennis's actual placements, not QA data. No solver run or data mutation.
const fs=require('fs'),path=require('path'),B=require('./narrow_placement_build'),M=require('./narrow_placement_model');
function review(dir=B.DATA){
  if(!fs.existsSync(dir))return {directory:dir,levels:[]};
  const results=new Map(),jobs=path.join(dir,'jobs');
  for(const file of fs.existsSync(jobs)?fs.readdirSync(jobs).filter(f=>f.endsWith('.result.json')).sort():[]){const r=JSON.parse(fs.readFileSync(path.join(jobs,file)));results.set(r.placementKey,r);}
  // A checked revision may be Dennis's exact saved layout. Keep the earlier
  // job files untouched while reporting the newer behavioural review.
  const asset=path.join(B.OUT,'placement-data.json');if(fs.existsSync(asset))for(const row of JSON.parse(fs.readFileSync(asset)).levels)if(row.proposal?.check?.ok){const key=M.key({baseHash:row.baseHash,positions:row.proposal.positions});if(!results.get(key)?.checkerVersion)results.set(key,{...row.proposal.check,provenance:'Checked proposal matching the saved positions'});}
  const levels=fs.readdirSync(dir).filter(f=>/^level-\d+\.json$/.test(f)).map(file=>{
    const state=JSON.parse(fs.readFileSync(path.join(dir,file))),result=results.get(M.key(state));
    return {level:state.level,remaining:state.positions.filter(p=>!p).length,updatedAt:state.updatedAt,status:result?.status||'not checked',note:state.note,errors:result?.errors||[],snapshot:path.join(dir,file),catalogue:state.catalogueId?path.join(dir,'catalogues',state.catalogueId+'.json'):null};
  }).sort((a,b)=>a.level-b.level);
  return {directory:dir,levels};
}
if(require.main===module)console.log(JSON.stringify(review(),null,2));module.exports={review};
