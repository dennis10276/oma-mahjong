'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict');
const CAND=path.resolve(__dirname,'../../../../../codex-towers-candidate'),OUT=path.resolve(__dirname,'../../../analysis/builder/finish-all/gate2'),lib=require(path.join(CAND,'source/tests/lib'));
const tableFile=path.join(CAND,'source/www/levels-hard.js'),tableText=fs.readFileSync(tableFile,'utf8'),tableHash=crypto.createHash('sha256').update(tableText).digest('hex');
global.HARD_LEVELS=vm.runInNewContext(tableText+';HARD_LEVELS');const H=require(path.join(CAND,'source/www/hard')),manifest=require(path.join(CAND,'source/analysis/refit-301-349.json'));
async function run(){const file=path.join(OUT,'packed-game.json'),old=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):null,rows=old?.tableHash===tableHash?old.rows:[];
 await lib.setup();try{
  for(const r of manifest.rows){if(rows.some(q=>q.level===r.level&&q.packedHash===r.packedHash&&q.ok))continue;
   const d=H.get(r.level),p=await lib.phone({size:[392,730],state:{name:'Candidate QA',pid:'test-gate2-packed',level:400,theme:'sunflower',sunSeen:true}});
   await lib.startLevel(p,r.level);const state=await p.evaluate(()=>({positions:G.tiles.map(t=>[t.x,t.y,t.z]),faces:G.tiles.map(t=>t.face),clock:G.clock,pitch:G.tw,theme:S.theme,revision:Hard.designVersion(G.level)}));
   assert.deepEqual(state.positions,d.tiles);assert.deepEqual(state.faces,d.faces);assert.equal(state.theme,'sunflower');assert.equal(state.revision,12);assert.ok(state.pitch>=(r.level%10?58:53.5));
   await p.evaluate(sol=>{for(const i of sol){__mj.onTap(i);if(G.alive[i])__mj.onTap(i);}},d.solution);
   await p.waitForFunction(()=>G.done&&G.alive.every(x=>!x)&&S.stars[G.level]===3,null,{timeout:10000});assert.deepEqual(p.errors,[]);
   rows.push({level:r.level,packedHash:r.packedHash,pitch:state.pitch,revision:state.revision,stars:3,ok:true});await p.ctx.close();
   fs.writeFileSync(file,JSON.stringify({ok:rows.length===49,tableHash,viewport:[392,730],sunflower:true,actualPackedGame:true,rows},null,1));console.log(r.level,'packed game win');
  }
  const data=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../build/finish-all-comparison/lab-ideas.js'),'utf8').replace(/^const LAB_IDEAS = /,'').replace(/;\s*$/,'')),it=data.ideas.find(r=>r.lv===336&&r.variant==='revised'),routes=[['**/__blank__',r=>r.fulfill({status:200,body:'<!doctype html>'})],['**/findings',r=>r.fulfill({status:200,body:'QA intercepted'})],['**/replays',r=>r.fulfill({status:200,body:'QA intercepted'})]],p=await lib.phone({url:'http://127.0.0.1:8290/',size:[392,730],state:{name:'Comparison QA',pid:'test-gate2-comparison',level:400,theme:'sunflower',sunSeen:true},routes});
  await p.waitForSelector('#comparisonFilter');assert.equal(await p.locator('.lab-card').count(),245);
  for(const [lv,count]of[[251,3],[299,3],[336,2],[349,2]]){await p.selectOption('#comparisonFilter select',String(lv));assert.equal(await p.locator('.lab-card:visible').count(),count);}
  await p.selectOption('#comparisonFilter select','336');assert.match(await p.locator('.lab-card:visible').allTextContents().then(a=>a.join(' ')),/Validated draft/);
  await p.screenshot({path:path.join(OUT,'combined-phone-selector.png')});await p.click(`.lab-card[data-id="${it.id}"] .lab-play`);await p.waitForFunction(id=>G.o.lab===id,it.id);await p.waitForTimeout(700);
  await p.screenshot({path:path.join(OUT,'combined-phone-336.png')});await p.click('#labWay');await p.waitForFunction(()=>!G.alive[G.clock.i],null,{timeout:30000});
  assert.equal(await p.evaluate(()=>G.mv),it.board.solution.indexOf(it.board.clock.i)+1);
  await p.evaluate(sol=>{for(const i of sol)if(G.alive[i]){__mj.onTap(i);if(G.alive[i])__mj.onTap(i);}},it.board.solution);await p.waitForFunction(()=>G.done&&G.alive.every(x=>!x));assert.deepEqual(p.errors,[]);await p.ctx.close();
  fs.writeFileSync(path.join(OUT,'combined-ui.json'),JSON.stringify({ok:true,url:'http://127.0.0.1:8290/',viewport:[392,730],cards:245,levels:98,selectorChecks:[251,299,336,349],clockRoute336:true,fullWin336:true,feedbackIntercepted:true},null,1));console.log('Combined comparison and clock-route button pass');
 }finally{await lib.teardown();}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});module.exports={run};
