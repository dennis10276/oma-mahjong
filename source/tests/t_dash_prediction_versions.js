'use strict';
const path = require('path');
module.exports = [{
  name: 'dashboard: no predictions by default (Dennis 2026-10-22); dash/?pred=1 still shows the old card',
  async run(t, { serve, FakeDB, browser, WWW }) {
    const site = await serve(path.join(__dirname, '../site'), { '/play/': WWW });
    const pid = 'pmv16kj3jr35750', now = Date.now();
    const db = new FakeDB({ scores: { [pid]: { name: 'Mrs. Doubtfire', level: 93 } }, plays: { [pid]: { a: { k: 'open', v: '1.59', lv: 93, t: now - 3000 } } } });
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => db.handle(r));
    const p = await ctx.newPage(), errors = [], asked = []; p.on('pageerror', e => errors.push(e.message));
    p.on('request', r => { if (/predict[^/]*\.json/.test(r.url())) asked.push(r.url()); });
    try {
      await p.goto(site.url + 'dash/#' + pid);
      await p.waitForFunction(() => document.querySelector('#feed') && document.querySelector('#feed').textContent.includes('App geopend'));
      t.eq([await p.locator('#pred').count(), await p.getByText('Voorspelling', { exact: true }).count()], [0, 0], 'no Voorspelling card');
      t.eq(asked, [], 'no prediction file is downloaded');
      await p.goto(site.url + 'dash/?pred=1#' + pid);
      await p.waitForSelector('#pred');
      t.ok(await p.locator('#pred').isVisible(), 'dash/?pred=1 shows the old card');
      t.eq(errors, [], 'no dashboard errors');
    } finally { await ctx.close(); site.close(); }
  },
}];
