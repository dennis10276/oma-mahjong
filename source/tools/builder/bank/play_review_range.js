'use strict';
// Browser check against an explicit local app checkout and a certified review pack.
// Firebase is intercepted by tests/lib.js; only test-* identities are used.
const fs=require('fs'),path=require('path'),cp=require('child_process'),vm=require('vm');
const H=require('../../../www/hard');
async function run(packFile,appRoot,out){
  const pack=JSON.parse(fs.readFileSync(packFile)),lib=require(path.resolve(appRoot,'source/tests/lib.js'));
  const text=cp.execFileSync('git',['show',pack.baselineCommit+':source/www/levels-hard.js'],{encoding:'utf8',maxBuffer:8e6}),table=vm.runInNewContext(text+';HARD_LEVELS');
  const pending=pack.rows.filter(r=>r.ok),results=[];
  for(const r of pending)table.levels[r.level-table.from]=H.pack({...r.draft.design,info:{rate:0,strong:0}});
  const body='const HARD_LEVELS = '+JSON.stringify(table)+';';
  await lib.setup();
  try{
    await Promise.all(Array.from({length:3},async(_,worker)=>{
      const page=await lib.phone({size:[392,730],state:{name:'Dennis',pid:'test-footprint-'+worker,level:301},routes:[['**/levels-hard.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body})]]});
      for(let row;(row=pending.shift());){
        try{
          await lib.startLevel(page,row.level);
          const geometry=await page.evaluate(()=>{const g=__mj.G,board=document.querySelector('#board').getBoundingClientRect(),tray=document.querySelector('#tray').getBoundingClientRect();return {tilePx:g.tw,tiles:g.tiles.length,trayGap:board.top+Math.min(...g.tiles.map(t=>t.r.t))-tray.bottom,rows:(Math.max(...g.tiles.map(t=>t.y))-Math.min(...g.tiles.map(t=>t.y)))/2+1};});
          if(Math.abs(geometry.tilePx-row.footprint.tilePx)>.1||geometry.tilePx<58||geometry.rows>8||geometry.trayGap<9.5)throw Error('unexpected geometry '+JSON.stringify(geometry));
          await page.evaluate(solution=>{for(const i of solution){__mj.onTap(i);if(__mj.G.alive[i])__mj.onTap(i);}},row.draft.design.solution);
          await page.waitForFunction(level=>__mj.G.done&&__mj.S.stars[level]>0,row.level,{timeout:6500});
          if(page.errors.length)throw Error(page.errors.join('; '));
          results.push({level:row.level,ok:true,...geometry});
        }catch(e){results.push({level:row.level,ok:false,error:e.message});}
        console.log(JSON.stringify(results.at(-1)));
      }
      await page.ctx.close();
    }));
  }finally{await lib.teardown();}
  results.sort((a,b)=>a.level-b.level);const result={viewport:[392,730],fakeDatabase:true,passed:results.filter(r=>r.ok).length,total:results.length,rows:results};
  fs.writeFileSync(out,JSON.stringify(result,null,2));if(result.passed!==result.total)process.exitCode=1;return result;
}
if(require.main===module)run(...process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
