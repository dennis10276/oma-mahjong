'use strict';
// Re-certify a frozen review pack; never modifies the bank or game table.
const fs=require('fs'),path=require('path'),cp=require('child_process'),vm=require('vm');
const H=require('../../../www/hard'),I=require('../preserve_intent'),F=require('../footprint');
const ROOT=path.resolve(__dirname,'../../../..');
function audit(pack){
  if(pack.rows.length!==51||pack.rows.some((r,i)=>r.level!==250+i||r.before.level!==r.level))throw Error('review pack must contain each level 250–300 exactly once, in order');
  const text=cp.execFileSync('git',['show',pack.baselineCommit+':source/www/levels-hard.js'],{cwd:ROOT,encoding:'utf8',maxBuffer:8e6}),table=vm.runInNewContext(text+';HARD_LEVELS');
  const rows=pack.rows.map(row=>{
    const before=row.before,live=Array.from(table.levels[row.level-table.from]);live[8]=0;live[9]=0;
    if(JSON.stringify(H.pack({...before.design,info:{rate:0,strong:0}}))!==JSON.stringify(live))throw Error('released baseline mismatch: '+row.level);
    if(!row.draft)return {...row,ok:false};
    const preservation=I.verify(before,row.draft),footprint=F.measure(row.draft.design,{minimum:58});
    return {...row,ok:preservation.ok&&footprint.ok,footprint,preservation};
  });
  return {...pack,minimum:58,target:60,released:false,complete:rows.every(r=>r.ok),passed:rows.filter(r=>r.ok).length,held:rows.filter(r=>!r.ok).map(r=>r.level),rows};
}
if(require.main===module){const input=process.argv[2],out=process.argv[3];if(!input)throw Error('usage: review_range.js input.json [output.json]');const result=audit(JSON.parse(fs.readFileSync(input)));if(out)fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,total:result.rows.length,held:result.held,complete:result.complete}));}
module.exports={audit};
