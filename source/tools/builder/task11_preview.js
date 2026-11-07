'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), { createRequire } = require('module');
const { chromium } = createRequire(path.resolve(__dirname, '../../tests/package.json'))('playwright');
const { serve, CHROME } = require('../../tests/lib.js'), Gallery = require('./task11_gallery.js');
async function check(root) {
  const out = Gallery.build(root), rows = fs.readFileSync(path.join(root, 'example-boards.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  fs.copyFileSync(path.join(root, 'EXAMPLES.md'), path.join(out, 'EXAMPLES.md'));
  const server = await serve(out), browser = await chromium.launch({ headless: true, ...(CHROME ? { executablePath: CHROME } : {}) }), evidence = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true }), errors = [];
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    page.on('pageerror', e => errors.push(e.message));
    for (const row of rows) {
      await page.goto(server.url); await page.waitForFunction(() => window.__mjReady && document.querySelector('.lab-play'));
      await page.locator(`[data-id="${2026000 + row.level}"] .lab-play`).click();
      await page.waitForFunction(lv => window.__mj.G?.o?.level === lv && document.querySelectorAll('.task11-number').length === __mj.G.tiles.length, row.level);
      await page.waitForTimeout(700);
      const bounds = await page.locator('#board .tile').evaluateAll(ts => ts.map(t => { const b = t.getBoundingClientRect(); return [b.x, b.y, b.right, b.bottom]; }));
      assert.equal(bounds.length, row.design.tiles.length); assert(bounds.every(([x, y, r, b]) => x >= -1 && y >= -1 && r <= 391 && b <= 821), 'phone bounds');
      await page.screenshot({ path: path.join(out, 'example-' + row.level + '.png') });
      await page.evaluate(solution => { for (const i of solution) { if (__mj.G.down[i]) __mj.onTap(i); __mj.onTap(i); } }, row.design.solution);
      assert.equal(await page.evaluate(() => Array.from(__mj.G.alive).filter(Boolean).length), 0, 'stored route wins in actual game');
      evidence.push({ studyLevel: row.level, tiles: bounds.length, phone: '390x820', numberedTiles: true, fitsPhone: true, storedRouteWins: true });
      console.log('Diagnostic phone and actual-game route passed:', row.level);
    }
    assert.deepEqual(errors, []);
    require('./task11_plan.js').save(root, 'preview-evidence.json', { created: new Date().toISOString(), externalRequestsBlocked: true, errors, rows: evidence });
  } finally { await browser.close(); await server.close(); }
}
if (require.main === module) check(path.resolve(process.argv[2])).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { check };
