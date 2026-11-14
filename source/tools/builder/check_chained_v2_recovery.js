'use strict';
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
async function run(){
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME}),rows=[];
  try{for(const host of ['127.0.0.1','localhost']){
    const context=await browser.newContext(),page=await context.newPage();
    await page.route('**/findings',route=>route.request().method()==='POST'?route.fulfill({status:200,body:'ok'}):route.continue());
    await page.goto(`http://${host}:8265/`);await page.locator('.lab-card').first().waitFor();
    const expected=await (await page.request.get(`http://${host}:8265/findings`)).json();
    const cards=await page.locator('.lab-card').evaluateAll(cs=>cs.map(c=>({id:c.dataset.id,note:c.querySelector('.lab-note').value,stars:c.querySelectorAll('.lab-stars button.on').length,verdict:c.querySelector('.lab-v.on')?.dataset.v||null})));
    const ok=cards.length===8&&cards.every(c=>{const r=expected.ratings[c.id];return r&&r.note===c.note&&r.stars===c.stars&&(r.verdict||null)===c.verdict;});
    rows.push({host,ok,cards});await context.close();
  }}finally{await browser.close();}
  const result={ok:rows.every(r=>r.ok),rows};fs.writeFileSync(path.resolve(__dirname,'../../../codex-tasks/results/chained-2/verdict-recovery-check.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({ok:result.ok,origins:rows.map(r=>({host:r.host,ok:r.ok,restored:r.cards.length}))}));if(!result.ok)process.exitCode=1;
}
run().catch(e=>{console.error(e);process.exitCode=1;});
