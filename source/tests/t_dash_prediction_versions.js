'use strict';
const path = require('path');
module.exports = [{
  name: 'dashboard: predictions follow the player app version and ignore results from replaced boards',
  async run(t, { serve, FakeDB, browser, WWW }) {
    const site = await serve(path.join(__dirname, '../site'), { '/play/': WWW });
    const pid = 'pmv16kj3jr35750', now = Date.now();
    const db = new FakeDB({ scores: { [pid]: { name: 'Mrs. Doubtfire', level: 93 } }, plays: { [pid]: {
      a: { k: 'end', v: '1.53', lv: 91, at: 1, r: 'win', dur: 60, n: 80, left: 0, t: now - 5000 },
      b: { k: 'end', v: '1.53', lv: 92, at: 1, r: 'win', dur: 60, n: 80, left: 0, t: now - 4000 },
      c: { k: 'open', v: '1.53', lv: 93, t: now - 3000 },
    } } });
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => db.handle(r));
    const p = await ctx.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
    const content = () => p.locator('#pred').innerText();
    const row = lv => p.locator('#pred tbody tr').filter({ has: p.locator('td:first-child', { hasText: new RegExp('^' + lv + '$') }) });
    const event = async (e, key = 'latest') => p.evaluate(({ pid, e, key }) => { PLAYS[pid][key] = e; render(); }, { pid, e, key });
    try {
      await p.goto(site.url + 'dash/#' + pid);
      await p.waitForFunction(() => document.querySelector('#pred .pred-note')?.textContent.includes('versie 1.53'));
      const archived = require('../site/dash/predict-1.53.json').players[pid];
      t.ok((await row(92).innerText()).includes(archived.levels[92][0] + '%'), 'old app uses its original board prediction');
      t.ok((await row(92).innerText()).includes('gehaald in 1 poging'), 'old app retains old results');
      await event({ k: 'open', v: '1.54', lv: 93, t: now });
      t.ok((await content()).includes('versie 1.54'), 'opening the new app switches predictions immediately');
      t.ok((await content()).includes('vanaf 92 600 keer'), 'updated simulation sample count');
      t.eq(await row(92).count(), 0, 'old level-92 win is not compared with its replacement');
      t.ok((await row(91).innerText()).includes('gehaald in 1 poging'), 'unchanged level-91 result still comparable');
      await event({ k: 'end', v: '1.54', lv: 92, at: 2, r: 'win', dur: 80, n: 76, left: 0, t: now + 1000 });
      t.ok((await row(92).innerText()).includes('gehaald in 2 pogingen'), 'new board result uses the new attempt, not the old win');
      const v154 = require('../site/dash/predict-1.54.json').players[pid];
      t.ok((await row(92).innerText()).includes(v154.levels[92][0] + '%'), 'new board uses the reviewed new prediction');
      // 1.55: the move-based test players; boards of 1.54 from level 70 on are the same, so a 1.54
      // result still counts next to the 1.55 prediction
      await event({ k: 'end', v: '1.54', lv: 93, at: 1, r: 'win', dur: 70, n: 76, left: 0, t: now + 1500 }, 'won93');
      await event({ k: 'open', v: '1.55', lv: 94, t: now + 2000 });
      t.ok((await content()).includes('versie 1.55'), 'the 1.55 prediction for a 1.55 app');
      const current = require('../site/dash/predict.json');
      const v155 = require('../site/dash/predict-1.55.json');
      t.eq(v155.version, '1.55', '1.55 predictions are archived for older apps');
      t.eq(current.version, '1.57', 'the current prediction file supports the message-logging release');
      t.eq(current.players, v155.players, 'unchanged boards keep the same prediction values');
      t.ok((await content()).includes('eigen gewoontes uit de opgenomen spellen'), 'explains the move-based test player');
      if (current.players[pid].levels[93]) t.ok((await row(93).innerText()).includes('gehaald in 1 poging'), 'a 1.54 result on a board that did not change still counts');
      await event({ k: 'open', v: '1.56', lv: 94, t: now + 3000 });
      t.ok((await content()).includes('versie 1.56'), 'tutorial update keeps predictions available');
      if (current.players[pid].levels[93]) t.ok((await row(93).innerText()).includes('gehaald in 1 poging'), 'unchanged older results remain comparable after the tutorial update');
      await event({ k: 'end', v: '1.56', lv: 94, at: 2, r: 'win', dur: 70, n: 76, left: 0, t: now + 3500 }, 'won94');
      await event({ k: 'open', v: '1.56', lv: 95, t: now + 3600 });
      if (current.players[pid].levels[94]) t.ok((await row(94).innerText()).includes('gehaald in 2 pogingen'), 'new-version results are compared with their predictions');
      await event({ k: 'open', v: '1.57', lv: 95, t: now + 4000 });
      t.ok((await content()).includes('versie 1.57'), 'message logging update keeps predictions available');
      if (current.players[pid].levels[94]) t.ok((await row(94).innerText()).includes('gehaald in 2 pogingen'), '1.56 results remain comparable in 1.57');
      await event({ k: 'open', v: '1.58', lv: 95, t: now + 4500 });
      t.ok((await content()).includes('Geen passende voorspelling voor versie 1.58'), 'unsupported version never gets another version predictions');
      t.eq(db.log.filter(e => e.m !== 'GET').length, 0, 'viewing predictions writes no player data');
      t.eq(errors, [], 'no dashboard errors');
    } finally { await ctx.close(); site.close(); }
  },
}];
