'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { createRequire } = require('module');
const { chromium } = createRequire(path.resolve(__dirname, '../../tests/package.json'))('playwright');
const { serve, CHROME } = require('../../tests/lib.js');
const { readRows } = require('./run_file.js');
const { build } = require('./batch_lab.js');
async function check(batchFile, out, levels = [200, 210, 212, 220, 225]) {
  const rows = readRows(batchFile); build(batchFile, out);
  const server = await serve(path.resolve(out)), browser = await chromium.launch({ headless: true, ...(CHROME ? { executablePath: CHROME } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true });
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    for (const level of levels) {
      const row = rows.find(r => r.level === level); assert(row, 'Missing preview level ' + level);
      await page.goto(server.url); await page.waitForFunction(() => window.__mjReady && document.querySelector('.lab-play'));
      await page.locator(`[data-id="${2026000 + level}"] .lab-play`).click();
      await page.waitForFunction(lv => window.__mj.G?.o?.level === lv && document.querySelectorAll('#board .tile').length > 0, level);
      await page.waitForTimeout(700);
      const bounds = await page.locator('#board .tile').evaluateAll(tiles => tiles.map(t => {
        const b = t.getBoundingClientRect(); return [b.x, b.y, b.right, b.bottom];
      }));
      assert.equal(bounds.length, row.design.tiles.length);
      assert(bounds.every(([x, y, r, b]) => x >= -1 && y >= -1 && r <= 391 && b <= 821), 'Board fits the phone at ' + level);
      await page.screenshot({ path: path.join(path.resolve(out), 'level-' + level + '.png') });
      await page.evaluate(solution => { for (const i of solution) {
        const g = __mj.G; if (g.down[i]) __mj.onTap(i); __mj.onTap(i);
      } }, row.design.solution);
      assert.equal(await page.evaluate(() => Array.from(__mj.G.alive).filter(Boolean).length), 0, 'Stored route wins in the real game at ' + level);
      console.log('phone preview and real-game solution passed:', level);
    }
    assert.deepEqual(errors, []); return out;
  } finally { await browser.close(); await server.close(); }
}
module.exports = { check };
if (require.main === module) check(process.argv[2], process.argv[3], process.argv[4] ? process.argv[4].split(',').map(Number) : undefined)
  .catch(e => { console.error(e); process.exitCode = 1; });
