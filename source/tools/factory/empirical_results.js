'use strict';
// Descriptive counts only. A missing skilled measurement is unknown.
const fs=require('fs'),path=require('path'),M=require('./meter.js'),I=require('../lab/ideas.js'),P=require('./pieces.js'),Supports=require('./trap_supports.js');
const read=f=>{try{return JSON.parse(fs.readFileSync(f));}catch{return null;}};
function inventory(root){
 const bot=M.createMeter().fingerprint,boards=new Map(),directories=fs.readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name.startsWith('batch-200-225')).map(d=>path.join(root,d.name));
 for(const dir of directories){const pool=read(path.join(dir,'pool.json'));if(!Array.isArray(pool))continue;
  for(const row of pool){if(!row.design?.tiles||!row.id)continue;const key=M.boardKey(row.design),record=boards.get(key)||{id:row.id,row,sources:[],rate:null,quality:null,skilled:null};record.sources.push(dir);
   const rate=read(path.join(dir,row.id+'.rate.json')),quality=read(path.join(dir,row.id+'.quality.json')),confirm=read(path.join(dir,row.id+'.confirm.json'));
   if(rate?.key===key&&[bot,...M.FAMILY_CACHE_MIGRATIONS[bot]||[]].includes(rate.bot)&&rate.train?.valid&&rate.validation?.valid){record.rate=rate;record.rateDir=dir;}
   if(quality?.key===key&&quality.bot===bot){record.quality=quality;record.qualityDir=dir;if(quality.skilled?.botValid??quality.skilled?.valid)record.skilled=quality.skilled.botExp??quality.skilled.exp;}
   if(confirm?.key===key&&confirm.bot===bot&&confirm.valid)record.skilled=confirm.skilledBot;
   // Prefer the latest full authorship for a repeated physical board.
   record.row=row;boards.set(key,record);
  }
 }
 return{bot,directories,boards:[...boards.values()]};
}
function summarize(stock){
 const rows=stock.boards.filter(r=>r.rate).map(r=>{const row=r.row,d=row.design,c=I.ctxOf(d),depth=i=>{const seen=new Set(),todo=[i];while(todo.length)for(const j of c.nb.above[todo.pop()])if(!seen.has(j)){seen.add(j);todo.push(j);}return seen.size;};
  return{id:r.id,recipe:[...new Set(row.recipe||[])].sort().join('+'),shape:row.shape?.split(' · ')[0],n:d.tiles.length,family:(r.rate.train.exp+r.rate.validation.exp)/2,skilled:r.skilled,
   quality:!!r.quality?.eligible&&Supports.compatible(row,r.quality),creation:row.origin?.creationId,freshConstruction:!row.edit&&!row.tunedFrom&&!row.tuning,
   frame:(d.obst.locks.includes(d.clock.i)?'locked clock':'other clock')+' / '+(d.obst.keys.some(i=>depth(i)>=3)?'deep keys':'shallow/no keys')+' / spare '+P.spareOf(d)+' / hidden '+Math.round(d.down.length/d.tiles.length*10)/10};});
 function group(field,fresh=false){const groups=new Map();for(const r of rows){if(fresh&&!r.freshConstruction)continue;const name=r[field],g=groups.get(name)||{name,fullFamily:0,familyBand:0,paired:0,jointBand:0,qualityJoint:0,unknownInBand:0,creations:new Set()};g.fullFamily++;g.creations.add(r.creation);const band=r.family>=9&&r.family<=14;if(band)g.familyBand++;if(Number.isFinite(r.skilled)){g.paired++;if(band&&r.skilled>=2.5&&r.skilled<=6){g.jointBand++;if(r.quality)g.qualityJoint++;}}else if(band)g.unknownInBand++;groups.set(name,g);}
  return[...groups.values()].map(g=>({...g,creations:g.creations.size,jointRateAmongPaired:g.paired?g.jointBand/g.paired:null,observedJointLowerBound:g.jointBand/g.fullFamily})).sort((a,b)=>b.jointBand-a.jointBand||b.fullFamily-a.fullFamily);}
 return{bot:stock.bot,scope:'All batch-200-225* pools. Deduplicated physical boards. Only current skilled proof; the two documented family-only cache migrations are allowed. Historical selection and tuning are nonrandom. Unmeasured skilled ratings stay unknown. These are counts, not a composition model.',poolDirectories:stock.directories,uniqueBoards:stock.boards.length,fullFamily:rows.length,byRecipe:group('recipe'),freshByRecipe:group('recipe',true),byFrame:group('frame'),freshByFrame:group('frame',true),byShape:group('shape'),rows};
}
module.exports={inventory,summarize};
if(require.main===module){const stock=inventory(process.argv[2]),report=summarize(stock);M.atomicJson(process.argv[3],report);console.log(JSON.stringify({boards:report.uniqueBoards,fullFamily:report.fullFamily,recipes:report.byRecipe.slice(0,15)},null,2));}
