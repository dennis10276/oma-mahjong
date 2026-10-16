'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const SITE = path.resolve(__dirname, '..', 'site'), KEY = 'omamj.dashboard.layout.v1';
module.exports = [
  {
    name: 'dashboard: editor assets use content revisions to avoid stale browser caches',
    async run(t) {
      const html = fs.readFileSync(path.join(SITE, 'dash', 'index.html'), 'utf8');
      for (const file of ['layout.js', 'layout.css']) {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(SITE, 'dash', file), 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);
        t.ok(html.includes(file + '?v=' + hash), file + ' content revision is current');
      }
    },
  },
  {
    name: 'dashboard: visual layout editing moves, resizes and hides panels without interrupting data or playback',
    async run(t, { serve, FakeDB, browser, WWW }) {
      const site = await serve(SITE, { '/play/': WWW }), born = Date.now() - 3600000, aid = 'layout-attempt';
      const sample = require('./t_dash_watch').sample(aid, born);
      const finish = { ...sample.next, seq: 2, data: JSON.stringify({ events: [[100000, 'end', { r: 'stuck' }]] }) };
      const db = new FakeDB({ scores: { pA: { name: 'Anna', level: 39 } }, plays: { pA: { s: { k: 'start', aid, lv: 39, at: 1, t: born }, e: { k: 'end', aid, lv: 39, r: 'stuck', at: 1, t: born + 100000 } } }, replays: { pA: { [aid]: { createdAt: born, first: sample.first, next: sample.next, finish } } } });
      const ctx = await browser.newContext({ viewport: { width: 1600, height: 2400 } });
      await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => db.handle(r));
      const p = await ctx.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
      const panel = id => p.locator(`[data-panel="${id}"]`);
      try {
        await p.goto(site.url + 'dash/#pA'); await p.waitForSelector('#tbl button[data-aid]');
        t.ok(await p.locator('#layoutBoard').isHidden(), 'original layout remains until editor is used');
        await p.locator('#layoutEdit').click(); await p.waitForSelector('#layoutBoard .layout-panel');
        t.eq(await p.locator('#layoutBoard .layout-panel').count(), 9, 'every dashboard panel has an edit control');
        await p.getByLabel('Breedte Meekijken', { exact: true }).selectOption('6');
        await p.getByLabel('Toon Live verloop', { exact: true }).uncheck();
        await p.getByRole('button', { name: 'Verplaats Meekijken omhoog', exact: true }).click();
        await p.getByRole('button', { name: 'Verplaats Meekijken omhoog', exact: true }).click();
        t.eq(await p.locator('#layoutBoard > .layout-panel').first().getAttribute('data-panel'), 'game', 'keyboard buttons move the game to the top');
        await p.waitForTimeout(400);
        await panel('ranking').locator('.layout-drag').dragTo(panel('feed').locator('.layout-bar'));
        const ordered = await p.locator('#layoutBoard > .layout-panel').evaluateAll(nodes => nodes.map(n => n.dataset.panel));
        t.ok(ordered.indexOf('ranking') === ordered.indexOf('feed') - 1 && ordered.indexOf('ranking') > ordered.indexOf('activity'), 'drag and drop moves a panel before its target');
        await panel('game').locator('.layout-resize').scrollIntoViewIfNeeded();
        const handle = await panel('game').locator('.layout-resize').boundingBox(), unit = await p.locator('#layoutBoard').evaluate(n => (n.getBoundingClientRect().width + 12) / 12);
        await p.mouse.move(handle.x + 12, handle.y + 12); await p.mouse.down(); await p.mouse.move(handle.x + 12 + unit * 2, handle.y + 112, { steps: 8 }); await p.mouse.up();
        t.eq(await panel('game').evaluate(n => n.style.getPropertyValue('--panel-span')), '8', 'resize corner changes panel width');
        t.ok(await panel('game').locator('.layout-content').evaluate(n => parseInt(n.style.getPropertyValue('--panel-height'), 10) > 0), 'resize corner sets minimum content height');
        await p.getByRole('button', { name: 'Indeling opslaan', exact: true }).click();
        t.ok(await p.locator('#layoutEditor').isHidden(), 'save leaves edit mode');
        t.ok(await panel('feed').isHidden(), 'hidden panels stay hidden after saving');
        const saved = await p.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
        t.eq(saved.panels.find(n => n.id === 'game').span, 8, 'size saved locally');
        t.eq(saved.panels.find(n => n.id === 'feed').visible, false, 'visibility saved locally');
        await p.waitForTimeout(350);
        t.ok(await p.evaluate(() => {
          const boxes = [...document.querySelectorAll('#layoutBoard > .layout-panel')].filter(n => n.getBoundingClientRect().height > 0).map(n => n.getBoundingClientRect());
          return boxes.every((a, i) => boxes.every((b, j) => i === j || a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1));
        }), 'masonry row sizes prevent overlapping panels');
        await p.locator('#tbl button[data-aid]').click(); await p.waitForSelector('#watchBoard .watch-tile');
        await p.locator('#watchPause').click(); await p.locator('#watchForward').click();
        t.eq(await p.locator('#watchPosition').innerText(), '0:30', 'replay controls retain their listeners after moving the panel');
        db.set('scores/pA/level', 55); await p.evaluate(async () => { await loadScores(); render(); });
        t.ok((await p.locator('#ranking').innerText()).includes('55'), 'live dashboard data still updates moved panels');
        t.eq(await panel('game').evaluate(n => n.style.getPropertyValue('--panel-span')), '8', 'render does not reset panel size');
        await p.reload(); await p.waitForSelector('#layoutBoard .game-watch');
        t.eq(await panel('game').evaluate(n => n.style.getPropertyValue('--panel-span')), '8', 'saved layout restored after reload');
        t.ok(await panel('feed').isHidden(), 'hidden setting restored after reload');
        await p.locator('#layoutEdit').click(); await p.getByLabel('Toon Meekijken', { exact: true }).uncheck();
        await p.getByRole('button', { name: 'Indeling annuleren', exact: true }).click();
        t.ok(await panel('game').isVisible(), 'cancel restores the saved layout');
        await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
        t.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'custom layout fits a phone without sideways scroll');
        await p.locator('#layoutEdit').click(); await p.getByLabel('Toon Live verloop', { exact: true }).check();
        await p.getByRole('button', { name: 'Indeling opslaan', exact: true }).click();
        t.ok(await panel('feed').isVisible(), 'hidden panels can be restored on mobile');
        await p.locator('#layoutEdit').click(); await p.getByRole('button', { name: 'Oorspronkelijke indeling herstellen', exact: true }).click();
        t.ok(await p.locator('#layoutBoard').isHidden(), 'reset restores original layout');
        t.eq(await p.evaluate(key => localStorage.getItem(key), KEY), null, 'reset clears saved layout');
        t.ok(await p.locator('.play-analysis > .game-watch').count() === 1, 'original game panel is returned intact');
        t.ok(await p.locator('.dashboard-side #ranking').count() === 1, 'original ranking location is restored');
        await p.evaluate(key => localStorage.setItem(key, '{invalid json'), KEY); await p.reload(); await p.waitForSelector('#tbl button[data-aid]');
        t.ok(await p.locator('#layoutBoard').isHidden(), 'malformed preferences fall back to the original layout');
        t.eq(db.log.filter(e => e.m !== 'GET').length, 0, 'editing layout never writes to the game database');
        t.eq(errors, [], 'no editor or replay errors');
      } finally { await ctx.close(); site.close(); }
    },
  },
];
