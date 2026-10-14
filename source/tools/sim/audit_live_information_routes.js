/* Additional bounded route search on the already verified live snapshot only. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),H=require('../../www/hard'),A=require('./audit_information');
const OUT=path.resolve(__dirname,'../../analysis/live-information-80-150'),manifest=require(path.join(OUT,'source-manifest.json'));
const f=path.join(OUT,'snapshot/v',manifest.version,'levels-hard.js'),text=fs.readFileSync(f,'utf8');
if(A.hash(Buffer.from(text))!==manifest.files.find(r=>r.file==='v/'+manifest.version+'/levels-hard.js').sha256)throw Error('Live snapshot hash changed');
const T=vm.runInNewContext(text+';HARD_LEVELS'),limit=30000,rows=[];
for(let lv=manifest.from;lv<=manifest.to;lv++){
 const d=H.unpack(lv,T.levels[lv-T.from]),r={lv,boardHash:A.hash(JSON.stringify(T.levels[lv-T.from]))};
 for(const visibility of ['uncovered','all-face-up']){
  const found=A.search(d,limit,visibility);if(found.actions)found.certificate=A.verify(d,found.actions,visibility);r[visibility]=found;
 }
 rows.push(r);if(lv%10===0)console.log('Live '+lv+' searched');
}
const summary={};for(const v of ['uncovered','all-face-up'])summary[v]={certificates:rows.filter(r=>r[v].certificate).length,searchLimits:rows.filter(r=>r[v].status==='search-limit').length,restrictedFailures:rows.filter(r=>r[v].status==='no-route-under-this-restricted-policy').length};
fs.writeFileSync(path.join(OUT,'route-audit.json'),JSON.stringify({version:manifest.version,from:manifest.from,to:manifest.to,limit,claim:'These are restricted known-partner route searches, not universal observation-only proofs. The all-face-up model grants information beyond the real UI. Fixed-order free inspection and the known-partner requirement exclude other legitimate strategies. A search limit is inconclusive.',summary,rows},null,2)+'\n');console.log(JSON.stringify(summary));
