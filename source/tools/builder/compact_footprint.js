'use strict';
const F=require('./footprint.js'),G=require('./bank/compact_geometry.js'),P=require('./preserve_trap.js');
function compact(record,opts={}){
  if(!record.design)return record;
  const before=F.measure(record.design);
  if(before.ok)return {...record,footprint:{...record.footprint,...before,changed:record.footprint?.changed??false}};
  const start=Date.now(),failures={},windows=G.enumerateWindows(record.design);
  let attempts=0,placed=0;
  for(const window of windows)for(const extraCount of [0,2,4,8,16,24])for(let seed=1;seed<=(opts.seeds??8);seed++){
    if(Date.now()-start>(opts.wallMs??30000))return {fail:'compactFootprintBudget',footprint:before,attempts,placed,failures};
    attempts++;
    const design=G.buildRestackedTiles(record.design,record.level??record.design.level??record.brief?.seed??1,window,{seed,extraCount,useStripShift:false});
    if(!design){failures.noPlacement=(failures.noPlacement||0)+1;continue;}
    placed++;
    const fit=F.measure(design);if(!fit.ok){failures.renderedBounds=(failures.renderedBounds||0)+1;continue;}
    const proof=P.verify(record,{design},opts.proof);
    if(!proof.ok){for(const why of proof.errors)failures[why]=(failures[why]||0)+1;continue;}
    return {...record,design,brief:record.brief?{...record.brief,tiles:design.tiles}:record.brief,
      keep:record.keep?{...record.keep,geometry:JSON.stringify(design.tiles.map(([x,y,z])=>({x,y,z})))}:record.keep,
      card:record.card?{...record.card,layoutGeometry:design.tiles,sourceLayout:record.card.layout,layers:Math.max(...design.tiles.map(t=>t[2]))+1}:record.card,
      footprint:{...fit,changed:true,beforePx:before.tilePx,attempts,placed,failures},preservation:proof,
      // The source is stored with the draft so its certificate can be rechecked independently.
      footprintOriginal:record.design};
  }
  return {fail:'compactFootprintUnresolved',footprint:before,attempts,placed,failures};
}
// CLI writes separate review artifacts; input and placed/live tables are never overwritten.
if(require.main===module){
  const fs=require('fs'),path=require('path'),input=process.argv[2],out=process.argv[3];
  if(!input||!out)throw Error('usage: node compact_footprint.js input-record.json output-record.json');
  if(path.resolve(input)===path.resolve(out))throw Error('output must differ from input');
  const result=compact(JSON.parse(fs.readFileSync(input,'utf8')));
  fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({ok:!!result.design,footprint:result.footprint,fail:result.fail,checks:result.preservation?.checks,attempts:result.attempts,failures:result.failures}));
  if(!result.design)process.exitCode=1;
}
module.exports={compact};
