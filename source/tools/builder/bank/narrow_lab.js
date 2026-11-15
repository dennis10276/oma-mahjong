'use strict';
// Build only the Task 19 review lab, using the frozen 3b188bcd renderer with
// the proposed tray margin. It never writes a game table or published files.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const P=require('./narrow_proof'),F=require('../footprint');
const TMP=path.join(P.ROOT,'source/build/task19'),LAB=path.join(TMP,'lab-8268');
function accepted(){return fs.readdirSync(P.DIR).filter(f=>/^level-\d+\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(path.join(P.DIR,f)))).filter(r=>r.certificate?.ok&&r.certificate.afterHash===P.hash(r.design)).sort((a,b)=>a.level-b.level);}
function build(){
  fs.mkdirSync(TMP,{recursive:true});const records=accepted(),ideas=[];
  for(const row of records){const original=P.original(row.level);for(const [variant,design]of[['as released',original.design],['narrowed',row.design]]){
    const fp=F.measure(design,{minimum:58}),id=190000+row.level*2+(variant==='narrowed'?1:0);
    ideas.push({id,lv:row.level,title:`${variant} · ${fp.tilePx.toFixed(1)} px`,idea:variant==='narrowed'?'Same trap, narrower pile. Compare the shape and readability with the released version.':'The released pile, kept for comparison.',kind:'task19',tiles:design.tiles.length,board:design,variant,tilePx:fp.tilePx});
  }}
  const data={made:new Date().toISOString(),heading:'Narrower piles · before and after',factory:true,intro:'Compare each released pile with its narrowed draft. Tile sizes are measured on a 392 × 730 phone. The tenth levels stay as released. These drafts are for review.',noteHint:'Does the pile look tidy, and is the trap still clear?',winText:'How does the shape compare?',ideas};
  const input=path.join(TMP,'lab-ideas.js');fs.writeFileSync(input,'const LAB_IDEAS = '+JSON.stringify(data)+';\n');
  const app=path.join(P.ROOT,'source/build/task19-ui'),builder=path.join(app,'source/tools/lab/build_lab.js');
  if(!fs.existsSync(builder))throw Error('Prepare frozen 3b188bcd UI under source/build/task19-ui first; see Task 19 report');
  // build_lab.js recreates its output. Restrict that path to this checkout's
  // ignored Task 19 workspace before invoking it.
  if(!LAB.startsWith(TMP+path.sep))throw Error('Invalid lab destination');
  cp.execFileSync(process.execPath,[builder,LAB,input],{stdio:'inherit'});
  const artifactPage=path.join(LAB,'lab.html');
  fs.writeFileSync(artifactPage,'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'+fs.readFileSync(artifactPage,'utf8'));
  // The server's route/save controls originally covered the bottom row on a
  // phone. Use the unused lab score area and bottom safe gap instead.
  const controls='<style>#labWay{left:auto!important;right:64px!important;top:5px!important;bottom:auto!important;width:66px;min-height:44px;padding:3px!important;font-size:10px!important;line-height:1.1;white-space:normal}body:has(#labPanel:not(.hidden)) #labWay{display:none}#labPcSave{pointer-events:none;bottom:0!important;font-size:9px!important;padding:1px 2px!important;line-height:11px}</style>';
  for(const page of ['lab.html','index.html'])fs.appendFileSync(path.join(LAB,page),'\n'+controls+'\n');
  let js=fs.readFileSync(path.join(LAB,'lab.js'),'utf8');
  const start=js.indexOf(' · test players win the first try:'),end=js.indexOf('${r.starts || r.tries ?',start);
  if(start<0||end<0)throw Error('Lab metadata template changed');
  js=js.slice(0,start)+js.slice(end);fs.writeFileSync(path.join(LAB,'lab.js'),js);
  fs.writeFileSync(path.join(TMP,'manifest.json'),JSON.stringify({rendererCommit:'3b188bcd',viewport:[392,730],lab:LAB,levels:records.map(r=>r.level),ideas:ideas.map(({board,...r})=>r)},null,2)+'\n');
  console.log(JSON.stringify({lab:LAB,levels:records.length,cards:ideas.length}));
  return {LAB,data};
}
if(require.main===module)build();module.exports={accepted,build,TMP,LAB};
