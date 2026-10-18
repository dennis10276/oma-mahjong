'use strict';
/* The player's own test player in the live feed and the all-levels table: before the prediction was
   made, the chance the rolling test gave before each try (history); after it, the prediction for that
   board. The general test player's chance only shows where there is no own one, and never a 0. */
const path = require('path');
module.exports = [{
  name: 'dashboard: own test player chances in the live feed and the all-levels table',
  async run(t, { serve, FakeDB, browser, WWW }) {
    const site = await serve(path.join(__dirname, '../site'), { '/play/': WWW });
    const pid = 'pOwn', now = Date.now(), made = now - 60000;
    const pred = {
      made: '2026-10-16', madeAt: made, version: '1.55', model: 'move', runs: 60,
      comparable: [{ version: '1.54', levels: [[1, 50], [52, 52], [70, 1000]] }],
      players: { [pid]: { name: 'Proef', from: 62, fit: { model: 'move', tries: 40, firstTries: 20, retries: 20, levels: [10, 61], memory: [75, 50, 75] },
        levels: { 62: [40, 64, 84], 63: [52, 78, 95] }, history: { 61: [53, 50, 50] } } },
    };
    const db = new FakeDB({ scores: { [pid]: { name: 'Proef', level: 62 } }, plays: { [pid]: {
      a: { k: 'start', v: '1.55', lv: 61, at: 1, pr: 0, t: made - 9000 },
      b: { k: 'end', v: '1.55', lv: 61, at: 1, r: 'stuck', dur: 60, n: 80, left: 20, t: made - 8000 },
      c: { k: 'start', v: '1.55', lv: 61, at: 2, pr: 0, t: made - 7000 },
      d: { k: 'end', v: '1.55', lv: 61, at: 2, r: 'win', dur: 60, n: 80, left: 0, t: made - 6000 },
      e: { k: 'start', v: '1.55', lv: 62, at: 1, pr: 0, t: now - 5000 },
      f: { k: 'end', v: '1.55', lv: 62, at: 1, r: 'stuck', dur: 60, n: 80, left: 30, t: now - 4000 },
      g: { k: 'start', v: '1.55', lv: 62, at: 2, pr: 0, t: now - 3000 },
      h: { k: 'start', v: '1.53', lv: 90, at: 1, pr: 0.42, t: now - 2000 },
    } } });
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => db.handle(r));
    await ctx.route(u => /\/dash\/predict\.json/.test(u.pathname), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pred) }));
    const p = await ctx.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
    try {
      await p.goto(site.url + 'dash/#' + pid);
      await p.waitForFunction(() => document.querySelector('#feed') && /eigen testspeler/.test(document.querySelector('#feed').innerText));
      const feed = await p.locator('#feed').innerText();
      t.ok(/Level 62 begonnen · eigen testspeler: 40% in één keer, 84% binnen 4 pogingen/.test(feed), 'first try: own prediction', feed);
      t.ok(/Level 62 opnieuw \(poging 2\) · kans deze poging 40% \(eigen testspeler\)/.test(feed), 'retry: chance for this try ((64-40)/(100-40))', feed);
      t.ok(/Level 61 begonnen · eigen testspeler: 53% in één keer/.test(feed), 'before the prediction: the chance given before the try', feed);
      t.ok(/Level 61 opnieuw \(poging 2\) · kans deze poging 50%/.test(feed), 'before the prediction, a retry', feed);
      t.ok(!/testspeler haalt hem 0%/.test(feed), 'never "0%" from the general test player', feed);
      t.ok(/Level 90 begonnen · testspeler haalt hem 42% in één keer/.test(feed), 'without an own chance: the general test player', feed);
      const row = lv => p.locator('#tbl tbody tr').filter({ has: p.locator('td:first-child', { hasText: new RegExp('^Level ' + lv + '$') }) });
      t.ok((await row(62).innerText()).includes('40% · 64% · 84%'), 'table: prediction for the level now');
      t.ok((await row(61).innerText()).includes('53%'), 'table: the chance given before the level was played');
      t.eq(await p.locator('#tbl th').nth(2).innerText(), 'Voorspeld', 'table column');
      t.eq(errors, [], 'no dashboard errors');
    } finally { await ctx.close(); site.close(); }
  },
}];
