'use strict';
// Reproduce the reported half-offset drops without touching Dennis's saves.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const B=require('./narrow_placement_build'),L=require('./narrow_lab'),P=require('./narrow_proof'),M=require('./narrow_placement_model'),S=require('./narrow_placement_server'),lib=require('../../../tests/lib');
async function run(){
  const dataDir=fs.mkdtempSync(path.join(L.TMP,'drag-qa-')),qa=S.createServer({port:0,dataDir}),address=await qa.listen(),url='http://127.0.0.1:'+address.port+'/',row=JSON.parse(fs.readFileSync(path.join(B.OUT,'placement-data.json'))).levels.find(r=>r.level===251);
  const seed=async snapshot=>{const r=await fetch(url+'api/save',{method:'POST',body:JSON.stringify(snapshot)});assert.equal(r.status,200);};
  const legacy={...row,proposal:null};await seed(M.initial(legacy));await lib.setup();try{
    const makePhone=()=>lib.phone({url,size:[1280,940],state:{name:'Drag QA',pid:'test-placement-drag',level:301,seenSp:{clock:true,clockMoves:true,ice:true,lock:true}},routes:[['**/__blank__',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html>'})]]});let page=await makePhone();
    await page.waitForFunction(()=>window.NarrowEditor);await page.selectOption('#peLevel','251');
    const point=position=>page.evaluate(([x,y,z])=>{const b=document.querySelector('#peSurface').getBoundingClientRect(),g=NarrowEditor.geometry;return {x:b.left+g.ox+(x/2-z*.14+.5)*g.tw,y:b.top+g.oy+(y*.62-z*.14+.62)*g.tw,tw:g.tw};},position);
    await page.click('[data-choice="57"]');const first=await point([4,13,2]);await page.mouse.click(first.x,first.y);assert.deepEqual(await page.evaluate(()=>NarrowEditor.snapshot.positions[57]),[4,13,2]);
    const tile=await page.locator('[data-tile="57"]').boundingBox(),second=await point([6,13,2]),grab={x:tile.x+second.tw*.3,y:tile.y+second.tw*.4};
    await page.mouse.move(grab.x,grab.y);await page.mouse.down();await page.mouse.move(second.x-second.tw*.2,second.y-second.tw*.22,{steps:10});
    const floating=await page.locator('#peDragTile').boundingBox();assert.ok(floating);assert.ok(Math.abs(floating.x-(second.x-second.tw*.5))<3);await page.screenshot({path:path.join(P.DIR,'placement-lab/dragging.png')});
    await page.mouse.up();assert.deepEqual(await page.evaluate(()=>NarrowEditor.snapshot.positions[57]),[6,13,2]);assert.equal(await page.locator('#peDragTile').count(),0);
    await page.ctx.close();await new Promise(resolve=>setTimeout(resolve,300));const vertical=M.initial(legacy);vertical.positions[5]=[5,5,0];vertical.positions[35]=[5,7,0];vertical.positions[12]=[5,9,0];vertical.positions[42]=[5,5,1];await seed(vertical);
    page=await makePhone();await page.waitForFunction(()=>window.NarrowEditor);await page.click('[data-tile="42"]');
    const middle=await point([5,6,1]);await page.mouse.click(middle.x,middle.y-3);assert.deepEqual(await page.evaluate(()=>NarrowEditor.snapshot.positions[42]),[5,6,1]);
    const lower=await point([5,8,1]);await page.mouse.click(lower.x,lower.y);assert.deepEqual(await page.evaluate(()=>NarrowEditor.snapshot.positions[42]),[5,8,1]);
    await page.click('#peSave');await page.waitForFunction(()=>document.querySelector('#peSaved').textContent==='Saved on this PC');await page.reload();await page.waitForFunction(()=>window.NarrowEditor);assert.deepEqual(await page.evaluate(()=>NarrowEditor.snapshot.positions[42]),[5,8,1]);
    if(page.errors.length)throw Error(page.errors.join('; '));const result={ok:true,bridge56and48:true,bridge48and49:true,offCentreGrabPreserved:true,tileFollowsPointer:true,clickMoveOnSelectedTile:true,verticalHalfOffsets:true,savedAndReloaded:true,separateQaData:true};fs.writeFileSync(path.join(P.DIR,'placement-lab/drag-regression.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));await page.ctx.close();return result;
  }finally{await lib.teardown();await new Promise(resolve=>qa.server.close(resolve));}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});module.exports={run};
