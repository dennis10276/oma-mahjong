'use strict';
// Optional offline schematic rendering; uses the existing test installation of
// Playwright (NODE_PATH) and the installed Chrome (CHROME). No live app session.
const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
async function main(){
  const dir=path.resolve(__dirname,'../../analysis/builder/bank/variety-v1/examples'),out=path.resolve(__dirname,'../../../codex-tasks/results/trap-variety-v1');
  const names=process.argv.slice(2),files=names.length?names:fs.readdirSync(dir).filter(f=>f.endsWith('.svg')).slice(0,2);
  const browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,timeout:15000});
  try{const page=await browser.newPage({viewport:{width:1000,height:1200},deviceScaleFactor:2});
    for(const file of files){await page.setContent(fs.readFileSync(path.join(dir,file),'utf8'));await page.locator('svg').screenshot({path:path.join(out,file.replace('.svg','.png')),timeout:15000});}
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
