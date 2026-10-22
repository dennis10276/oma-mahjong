/* Voorspeltest on the dashboard: locked predictions (forecasts/) scored against the real plays. */
'use strict';
const path = require('path');
const SITE = path.join(__dirname, '..', 'site');
const FS = require(path.join(SITE, 'dash', 'forecast-score.js'));

function fixture(now) {
  const h = 3600e3;
  let n = 0;
  const plays = {}, add = (pid, hAgo, e) => { (plays[pid] = plays[pid] || {})['-e' + String(++n).padStart(4, '0')] = { t: now - hAgo * h, v: '1.59', dev: 'android', ses: 's1', ...e }; };
  const level = (pid, lv, hAgo, results) => results.forEach((r, i) => {
    add(pid, hAgo - i * 0.1, { k: 'start', lv, at: i + 1, n: 80 });
    add(pid, hAgo - i * 0.1 - 0.05, { k: 'end', lv, at: i + 1, n: 80, r, left: r === 'win' ? 0 : 10, dur: 120 });
  });
  level('pG', 101, 20, ['win']);                                   // predicted 1, won at 1: right, and "always 1" right
  level('pG', 102, 19, ['stuck', 'stuck', 'stuck', 'win']);        // predicted 3, won at 4: right (+-1)
  level('pG', 103, 18, ['stuck', 'stuck', 'win']);                 // predicted 1, won at 3: wrong
  level('pG', 104, 17, Array(9).fill('stuck'));                    // predicted 8, still not won after 9: right already
  level('pG', 105, 10, ['stuck']);                                 // predicted 2, still playing
  level('pG', 109, 9, ['stuck']);                                  // predicted 1, first try lost: already wrong
  level('pG', 106, 30, ['win']);                                   // locked after it was opened: does not count
  add('pG', 5, { k: 'end', m: 'd', d: '2026-10-22', lv: 107, r: 'win', at: 1 });   // a daily puzzle is not level 107
  const f = (p, hAgo) => ({ p, t: now - hAgo * h, by: 'gemini', model: 'v9' });
  const forecasts = {
    pG: { 101: f(1, 40), 102: f(3, 40), 103: f(1, 40), 104: f(8, 40), 105: f(2, 40), 109: f(1, 40), 106: f(1, 25), 107: f(2, 40), 108: f(4, 40) },
    'test-x': { 1: f(1, 40) },
  };
  return { plays, forecasts, scores: { pG: { name: 'Gerda', level: 108, t: now } } };
}

module.exports = [
  {
    name: 'voorspeltest: scoring counts only predictions locked before the first opening, against "always 1 try"',
    async run(t) {
      const now = Date.now(), { plays, forecasts } = fixture(now);
      const ev = Object.values(plays.pG).sort((a, b) => a.t - b.t);
      const { rows, summary } = FS.score(forecasts.pG, ev);
      const by = Object.fromEntries(rows.map(r => [r.lv, r]));
      t.eq([1, 2, 3, 4, 5, 6, 7, 8].map(a => FS.correct(3, a)), [false, false, true, true, false, false, false, false], 'tolerance: exact to 3, +-1 for 4-5, +-2 for 6-7');
      t.eq([FS.correct(8, 8), FS.correct(8, 30), FS.correct(7, 9), FS.correct(5, 8), FS.correct(6, 30)], [true, true, true, false, false], '8 means 8 or more; within 2 from 6 tries on');
      t.eq([by[101].status, by[101].actual, by[101].ok, by[101].baseline], ['scored', 1, true, true], 'won on the first try');
      t.eq([by[102].actual, by[102].ok, by[102].baseline], [4, true, false], 'won on try 4, predicted 3');
      t.eq([by[103].actual, by[103].ok], [3, false], 'won on try 3, predicted 1');
      t.eq([by[104].status, by[104].actual, by[104].ok, by[104].baseline], ['scored', null, true, false], 'not won after 9 tries: 8+ is certain');
      t.eq([by[105].status, by[105].tries], ['playing', 1], 'still playing: try 2 would still be right');
      t.eq([by[109].status, by[109].ok, by[109].actual], ['scored', false, null], 'predicted 1 and the first try was lost: wrong already');
      t.eq(by[106].status, 'late', 'locked after the level was opened');
      t.eq(by[107].status, 'waiting', 'the daily puzzle does not open level 107');
      t.eq(summary, { cohort: 6, decided: 5, ok: 3, baseline: 1, playing: 1, waiting: 2, late: 1, invalid: 0, target: 16, size: 20 }, 'summary');
      t.eq(FS.score({ 5: { p: 9, t: 1 }, 6: { p: 2 }, x: { p: 1, t: 1 } }, []).summary.invalid, 2, 'malformed predictions are shown as invalid, not scored');
    },
  },
  {
    name: 'voorspeltest: the dashboard card shows each player against the baseline and the levels of the chosen player',
    async run(t, { serve, FakeDB, browser, WWW }) {
      const site = await serve(SITE, { '/play/': WWW }), now = Date.now();
      const db = new FakeDB(fixture(now));
      const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
      await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => db.handle(r));
      const p = await ctx.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
      await p.goto(site.url + 'dash/#pG');
      await p.waitForFunction(() => document.querySelector('#fcScore').textContent.includes('Gerda'));
      const text = await p.locator('#fcScore').innerText();
      t.ok(/6 van 20/.test(text) && /3 van 5/.test(text) && /1 van 5/.test(text) && /beter/.test(text), 'summary: 6 in the test, 3 of 5 right, "always 1" 1 of 5', text);
      t.ok(!text.includes('test-x'), 'test players are left out');
      t.ok(/Level 103/.test(text) && /Level 106/.test(text) && /telt niet/.test(text) && /8\+ \(nog niet gehaald\)/.test(text) && /bezig, 1 poging/.test(text) && /nog niet, na 1 poging/.test(text), 'per-level rows for the chosen player', text);
      t.ok(/Level 107/.test(text) && /nog niet gespeeld/.test(text), 'upcoming locked levels are listed');
      const empty = new FakeDB({ ...fixture(now), forecasts: null });
      const q = await ctx.newPage(); await q.unroute('**/*').catch(() => { });
      await ctx.unroute(() => true).catch(() => { });
      await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => empty.handle(r));
      await q.goto(site.url + 'dash/#pG');
      await q.waitForFunction(() => document.querySelector('#fcScore').textContent.includes('Nog geen vastgelegde voorspellingen'));
      t.eq(errors, [], 'no page errors');
      await ctx.close();
    },
  },
];
