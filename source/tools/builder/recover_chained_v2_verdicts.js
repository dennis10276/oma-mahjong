'use strict';
// Restore the exact first eight boards. Never transfer ratings by level number
// onto the replacement boards: their IDs refer to different designs.
const fs=require('fs'),path=require('path'),vm=require('vm'),{OUT}=require('./chained_v2_run.js');
const dir=path.resolve(__dirname,'../../build/chained-v2-lab'),log=path.resolve(__dirname,'../../build/chained-v2-logs/build-chained-v2-preview.log');
const originalFile=path.join(OUT,'lab-selection-original.json');
const original=fs.existsSync(originalFile)?JSON.parse(fs.readFileSync(originalFile)):fs.readFileSync(log,'utf8').trim().split('\n').map(line=>{try{return JSON.parse(line);}catch{return null;}}).find(j=>j?.ok&&j.rows?.[0]?.id===170332)?.rows;
if(!original||original.length!==8)throw Error('Original board-to-ID evidence missing');
const oldContext={};vm.runInNewContext(fs.readFileSync(path.join(OUT,'lab-ideas.js'),'utf8')+'\nthis.data=LAB_IDEAS;',oldContext);
fs.writeFileSync(originalFile,JSON.stringify(original.map(({id,labLevel,file,layout,shape})=>({id,labLevel,file,layout,shape})),null,2)+'\n');
// Preserve the replacement set at a separate URL with all of its existing IDs.
for(const name of ['lab.html','index.html']){
  const html=fs.readFileSync(path.join(dir,name),'utf8');
  if(name==='lab.html')fs.writeFileSync(path.join(dir,'new.html'),html.replaceAll("'lab-ideas.js'","'lab-ideas-new.js'"));
}
fs.writeFileSync(path.join(dir,'lab-ideas-new.js'),fs.readFileSync(path.join(OUT,'lab-ideas.js')));
const source=path.join(OUT,'lab-ideas-original.js'),pinned={};
if(fs.existsSync(source))vm.runInNewContext(fs.readFileSync(source,'utf8')+'\nthis.data=LAB_IDEAS;',pinned);
const data={...oldContext.data,heading:'Your original eight boards',intro:'The original boards are restored with their saved notes, stars and verdicts. The additional new boards are available separately at /new.html.',ideas:pinned.data?.ideas||original.map(q=>{
  const r=JSON.parse(fs.readFileSync(path.join(OUT,'examples',q.file)));
  return {id:q.id,lv:q.labLevel,kind:'planned',title:`Chain ${q.labLevel-331} · ${r.card.shape}`,idea:'Find the route through the connected gates. The finish is kept light.',shape:r.card.shape,tiles:r.card.tiles,m:null,board:{...r.design,level:q.labLevel,aspect:1.6}};
})};
fs.writeFileSync(source,'const LAB_IDEAS = '+JSON.stringify(data)+';\n');fs.copyFileSync(source,path.join(dir,'lab-ideas.js'));
console.log(JSON.stringify({restored:original.map(q=>({id:q.id,file:q.file})),additional:'/new.html'}));
