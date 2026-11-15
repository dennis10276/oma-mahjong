'use strict';
// Real game phone rendering and exact stored-route replay, no playing bot.
// Test sessions and their local findings/replays never enter Dennis's lab logs.
const fs=require('fs'),path=require('path');
const P=require('./narrow_proof'),L=require('./narrow_lab'),lib=require('../../../tests/lib');
async function run(){
  const shots=path.join(P.DIR,'screenshots');fs.mkdirSync(shots,{recursive:true});
  const data=JSON.parse(fs.readFileSync(path.join(L.TMP,'manifest.json'))),results=[];
  await lib.setup();
  try{
    const makePhone=()=>lib.phone({url:'http://127.0.0.1:8268/',size:[392,730],state:{name:'Task 19 automated check',pid:'test-task19-browser',level:301,seenSp:{lock:true,ice:true,joker2:true,trayPair:true,clock:true,clockMoves:true}},routes:[
      ['**/__blank__',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Test setup</title>'})],
      ['**/findings',r=>r.fulfill({status:200,body:'ok'})],['**/replays',r=>r.fulfill({status:200,body:'ok'})]
    ]});
    for(const it of data.ideas){
      const page=await makePhone();
      try{
        await page.evaluate(()=>{document.querySelector('#modal')?.classList.add('hidden');document.querySelector('#labPanel')?.classList.remove('hidden');});
        await page.locator(`.lab-card[data-id="${it.id}"] .lab-play`).click();
        await page.waitForFunction(id=>__mj.G?.o?.lab===id,it.id);await page.waitForTimeout(700);
        await lib.closeModal(page);
        if(await page.locator('#modal').evaluate(el=>!el.classList.contains('hidden')))throw Error('Unexpected blocking modal before screenshot');
        const loaded=await page.evaluate(id=>LAB_IDEAS.ideas.find(r=>r.id===id).board,it.id);
        const expected=it.variant==='narrowed'?L.accepted().find(r=>r.level===it.lv).design:P.original(it.lv).design;
        if(P.hash(loaded)!==P.hash(expected))throw Error('Browser loaded a different board');
        const geometry=await page.evaluate(()=>{const g=__mj.G,b=document.querySelector('#board').getBoundingClientRect(),t=document.querySelector('#tray').getBoundingClientRect();return {tilePx:g.tw,tiles:g.tiles.length,rows:(Math.max(...g.tiles.map(t=>t.y))-Math.min(...g.tiles.map(t=>t.y)))/2+1,trayGap:b.top+Math.min(...g.tiles.map(t=>t.r.t))-t.bottom};});
        if(Math.abs(geometry.tilePx-it.tilePx)>.12)throw Error('Profile/renderer mismatch '+JSON.stringify(geometry));
        if(it.variant==='narrowed'&&(geometry.tilePx<58||geometry.rows>8||geometry.trayGap<9.5))throw Error('Narrowed geometry fails '+JSON.stringify(geometry));
        // Hide only the local server's fixed save/route buttons for the photo,
        // so the screenshot shows the actual game pile/tray without overlays.
        await page.addStyleTag({content:'#labWay,#labPcSave{visibility:hidden!important}'});
        const name=`level-${it.lv}-${it.variant==='narrowed'?'after':'before'}.png`;await page.screenshot({path:path.join(shots,name)});
        const d=expected;
        await page.evaluate(sol=>{for(const i of sol){__mj.onTap(i);if(__mj.G.alive[i])__mj.onTap(i);}},d.solution);
        await page.waitForFunction(()=>__mj.G.done&&__mj.G.alive.every(v=>!v),null,{timeout:8000});
        if(page.errors.length)throw Error(page.errors.join('; '));
        results.push({level:it.lv,variant:it.variant,ok:true,designHash:P.hash(loaded),...geometry,screenshot:'screenshots/'+name});
      }catch(e){results.push({level:it.lv,variant:it.variant,ok:false,error:e.message});}
      console.log(JSON.stringify(results.at(-1)));
      await page.ctx.close();
    }
    // Verify the local route demonstration is present and can reach the clock
    // by real timed taps, separately from the full-route replay above.
    const first=data.ideas.find(r=>r.variant==='narrowed');
    const page=await makePhone();
    await page.evaluate(()=>{document.querySelector('#modal')?.classList.add('hidden');document.querySelector('#labPanel')?.classList.remove('hidden');});
    await page.locator(`.lab-card[data-id="${first.id}"] .lab-play`).click();
    await page.locator('#labWay').evaluate(el=>{el.style.visibility='visible';el.click();});
    await page.waitForFunction(()=>!__mj.G.alive[__mj.G.clock.i],null,{timeout:35000}).catch(()=>{});
    const routeButton=await page.evaluate(()=>({present:!!document.querySelector('#labWay'),moves:__mj.G.mv,clockGone:!__mj.G.alive[__mj.G.clock.i]}));
    const summary={rendererCommit:data.rendererCommit,viewport:data.viewport,fakeDatabase:true,findingsIntercepted:true,passed:results.filter(r=>r.ok).length,total:results.length,routeButton,rows:results};
    fs.writeFileSync(path.join(P.DIR,'browser.json'),JSON.stringify(summary,null,2)+'\n');
    if(summary.passed!==summary.total||!routeButton.clockGone)process.exitCode=1;
    await page.ctx.close();return summary;
  }finally{await lib.teardown();}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});module.exports={run};
