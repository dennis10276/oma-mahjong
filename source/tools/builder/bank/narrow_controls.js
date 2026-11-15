const fs=require('fs'),path=require('path'),L=require('./narrow_lab'),lib=require('../../../tests/lib');
(async()=>{await lib.setup();try{
 const p=await lib.phone({url:'http://127.0.0.1:8268/',size:[392,730],state:{name:'Task19 controls check',pid:'test-task19-controls',level:301,seenSp:{clock:true,clockMoves:true,ice:true,lock:true}},routes:[['**/__blank__',r=>r.fulfill({status:200,body:'<!doctype html>'})],['**/findings',r=>r.fulfill({status:200,body:'ok'})],['**/replays',r=>r.fulfill({status:200,body:'ok'})]]});
 const manifest=JSON.parse(fs.readFileSync(path.join(L.TMP,'manifest.json'))),rows=[];
 for(const it of manifest.ideas.filter(i=>i.variant==='narrowed')){
  await p.evaluate(()=>{document.querySelector('#modal').classList.add('hidden');document.querySelector('#labPanel').classList.remove('hidden')});
  await p.locator(`.lab-card[data-id='${it.id}'] .lab-play`).click();await p.waitForTimeout(500);
  const row=await p.evaluate(()=>{const tiles=[...document.querySelectorAll('#board .tile')].map(t=>t.getBoundingClientRect());const box=id=>{const b=document.querySelector(id).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,overlaps:tiles.filter(t=>b.left<t.right&&b.right>t.left&&b.top<t.bottom&&b.bottom>t.top).length}};return {route:box('#labWay'),save:box('#labPcSave')}});
  rows.push({level:it.lv,...row});
 }
 const out={viewport:[392,730],ok:rows.every(r=>r.route.overlaps===0&&r.save.overlaps===0),rows};fs.writeFileSync('source/analysis/builder/footprint60/narrow/controls.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));if(!out.ok)process.exitCode=1;await p.ctx.close();
 }finally{await lib.teardown()}})().catch(e=>{console.error(e);process.exitCode=1});

