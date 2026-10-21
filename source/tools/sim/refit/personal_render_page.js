'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../../..');

async function createPage(browser, width, height, options = {}) {
  assert(Object.keys(options).every(key => key === 'productionObstacles'));
  assert(options.productionObstacles === undefined || typeof options.productionObstacles === 'boolean');
  const page = await browser.newPage({ viewport: { width: Math.ceil(width), height: Math.ceil(height) }, deviceScaleFactor: 1 });
  await page.route('**/*', route => route.abort());
  await page.setContent('<!doctype html><style>' + fs.readFileSync(path.join(root, 'www/style.css'), 'utf8')
    + '\nbody{margin:0!important}#boardWrap{position:relative!important;display:block!important;width:' + width + 'px!important;height:' + height + 'px!important;overflow:visible!important}'
    + '#board{position:relative!important;width:100%!important;height:100%!important}'
    + '*,*::before,*::after{animation:none!important;transition:none!important}</style><div id="boardWrap"><div id="board"></div></div>');
  await page.addScriptTag({ content: 'const S={theme:"sunflower",highlight:false};const $=selector=>document.querySelector(selector);const replayView=()=>{};'
    + (options.productionObstacles ? 'const FX={emoji:()=>{}},Sound={flip:()=>{},unlock:()=>{}};'
      + 'const praise=()=>{},toast=()=>{},bumpStat=()=>{},tx=value=>value;'
      : 'const JOKER=101;const obKind=index=>G.rules?.keys?.includes(index)?"key":'
      + 'G.rules?.locks?.includes(index)?"lock":G.rules?.ice?.[index]?(G.rules.ice[index]>1?"ice2":"ice"):null;') });
  for (const relative of ['www/tiles.js', 'www/layouts.js', ...(options.productionObstacles ? ['www/js/specials.js'] : []), 'www/js/board.js']) {
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, relative), 'utf8') });
  }
  if (options.productionObstacles) await page.evaluate(() => { crackFx = () => {}; });
  return page;
}

module.exports = { createPage };
