'use strict';
// Draft-only migration of the frozen released boards. Never replaces placed-all or a game table.
const fs=require('fs'),path=require('path'),cp=require('child_process'),vm=require('vm');
const H=require('../../../www/hard'),C=require('../compact_footprint'),F=require('../footprint');
const BANK=path.resolve(__dirname,'../../../analysis/builder/bank'),ROOT=path.resolve(__dirname,'../../../..');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
function authored(rec){
  const src=rec.source||'',paths=[];
  let m;
  if((m=/^batch (\d+)$/.exec(src)))paths.push('batch-250-289/level-'+m[1]+'.json','batch-250-289/rejected/level-'+m[1]+'.json');
  if((m=/^batch2 (\d+)$/.exec(src)))paths.push('batch-303-342/level-'+m[1]+'.json');
  if((m=/^chained (.+)$/.exec(src)))for(const prefix of ['chained-gentle/','chained-v2/examples/','chained-v1/examples/'])paths.push(prefix+m[1]+'.json');
  const p=paths.map(p=>path.join(BANK,p)).find(fs.existsSync);
  if(p)return {...read(p),...rec,card:read(p).card,roles:read(p).roles,brief:read(p).brief,intentSource:path.relative(ROOT,p)};
  if((m=/^chain lab-(\d+)$/.exec(src))){
    const names={291:'chain-11-46',292:'chain-15-12',293:'chain-5-9'},file=path.join(ROOT,'source/build/traps/examples2',names[m[1]]+'.json');
    if(fs.existsSync(file)){const q=read(file);return {...rec,card:{trap:q.card},intentSource:path.relative(ROOT,file)};}
  }
  return rec;
}
function baseline(){
  const text=cp.execFileSync('git',['show','a99b338e:source/www/levels-hard.js'],{cwd:ROOT,encoding:'utf8',maxBuffer:8e6});
  const table=vm.runInNewContext(text+';HARD_LEVELS');
  return Array.from({length:51},(_,i)=>{
    const level=250+i,rec=read(path.join(BANK,'placed-all/level-'+level+'.json'));
    const packed=H.pack({...rec.design,info:{rate:0,strong:0}}),live=Array.from(table.levels[level-table.from]);
    live[8]=0;live[9]=0;
    if(JSON.stringify(packed)!==JSON.stringify(live))throw Error('placed board differs from 1.69: '+level);
    return authored(rec);
  });
}
function run(opts={}){
  const out=path.resolve(opts.out||path.join(ROOT,'source/build/footprint60-250-300'));
  fs.mkdirSync(path.join(out,'before'),{recursive:true});fs.mkdirSync(path.join(out,'drafts'),{recursive:true});
  const rows=[];
  for(const before of baseline()){
    if(opts.levels&&!opts.levels.includes(before.level))continue;
    const file='level-'+before.level+'.json',beforeFile=path.join(out,'before',file);
    fs.writeFileSync(beforeFile,JSON.stringify(before));
    const result=C.compact(before,{seeds:opts.seeds??4,wallMs:opts.wallMs??3000});
    fs.writeFileSync(path.join(out,'drafts',file),JSON.stringify(result));
    const row={level:before.level,source:before.source,ok:!!result.design,tiles:before.design.tiles.length,beforePx:F.measure(before.design).tilePx,afterPx:result.design?F.measure(result.design).tilePx:null,fail:result.fail,
      binding:Object.entries(result.failures||{}).sort((a,b)=>b[1]-a[1]).slice(0,8)};
    rows.push(row);console.log(JSON.stringify(row));
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({ok:rows.every(r=>r.ok),levels:rows.length,passed:rows.filter(r=>r.ok).length,rows},null,2));
  }
  return rows;
}
if(require.main===module){const arg=(s,d)=>{const i=process.argv.indexOf(s);return i<0?d:process.argv[i+1]};run({levels:arg('--levels','')?arg('--levels','').split(',').map(Number):null,out:arg('--out',null),seeds:+arg('--seeds',4),wallMs:+arg('--ms',3000)});}
module.exports={baseline,authored,run};
