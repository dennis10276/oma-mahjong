/* The week comes from the win: points and cups once, the same number on the tile, the row, the upload and the home goal. */
'use strict';
const fs = require('fs'), path = require('path');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../firebase/rules.json'), 'utf8')).rules.scores.$id;
// the database rule expressions are plain JS once newData is a small stand-in
const nd = v => ({ val: () => v, isString: () => typeof v === 'string', isNumber: () => typeof v === 'number', isBoolean: () => typeof v === 'boolean', hasChildren: ks => ks.every(k => k in v) });
function refused(rec) {
  const bad = [];
  if (!new Function('newData', 'return ' + RULES['.validate'])(nd(rec))) bad.push('record');
  for (const [k, v] of Object.entries(rec)) {
    const rule = RULES[k];
    if (!rule) bad.push(k + ' unknown');
    else if (!new Function('newData', 'return ' + rule['.validate'])(nd(v))) bad.push(k);
  }
  return bad;
}
const ME = { name: 'Dennis', pid: 'test-weekwin', level: 5 };

module.exports = [
  {
    name: 'week: a fresh win adds the step-curve points once; reload, replay and a past Daily add none',
    async run(t, { startLevel, solve, sleep }) {
      const p = await t.phone({ state: ME });
      await startLevel(p, 5);
      t.ok(await solve(p, 1500), 'level 5 won');
      t.eq(await p.evaluate(() => [S.wk.v, S.wk.pts, S.wk.dayWins]), [2, 25, 1], 'first win of the day: 25 points');
      await p.reload(); await p.waitForFunction(() => window.__mjReady); await sleep(500);
      t.eq(await p.evaluate(() => S.wk.pts), 25, 'reload adds nothing');
      await startLevel(p, 5);
      t.ok(await solve(p, 1500), 'replay won');
      t.eq(await p.evaluate(() => S.wk.pts), 25, 'replaying a won level adds nothing');
      const past = await p.evaluate(() => WeekEconomy.awardWin(S, { mode: 'daily', fresh: true, date: '2026-10-01' }).ptAdded);
      t.eq(past, 0, 'a past Daily adds nothing');
      const today = await p.evaluate(() => [WeekEconomy.awardWin(S, { mode: 'daily', fresh: true, date: S.wk.day }).ptAdded, WeekEconomy.awardWin(S, { mode: 'daily', fresh: true, date: S.wk.day }).ptAdded]);
      t.eq(today, [20, 0], "today's first Daily gives +20, the second nothing");
    },
  },
  {
    name: 'week: a cup pays its coins once, tile and own row show the same points, the home goal shows the cup',
    async run(t, { sleep }) {
      const p = await t.phone({ state: { ...ME, level: 30, wk: { id: '2026-10-05', v: 2, pts: 95, day: '2026-10-07', dayWins: 1, dailyDone: '', cups: [], postDiamond: 0, prPaid: false } } });
      const c0 = await p.evaluate(() => S.coins);
      const r = await p.evaluate(() => { const a = WeekEconomy.awardWin(S, { mode: 'level', fresh: true, date: '' }); save(); return [a.ptAdded, a.cupCoins, S.coins, S.wk.cups]; });
      t.eq(r, [15, 15, c0 + 15, ['bronze']], 'crossing 100 pt pays the Brons cup once');
      await p.reload(); await p.waitForFunction(() => window.__mjReady); await sleep(500);
      t.eq(await p.evaluate(() => [S.coins, S.wk.pts, S.wk.cups]), [c0 + 15, 110, ['bronze']], 'reload keeps it, no second payment');
      const home = await p.evaluate(() => document.querySelector('#nextUnlock').textContent);
      t.eq(home, 'Nog 140 pt tot 🥈 Zilver · +25 🪙', 'home goal row: the cup goal');
      await p.evaluate(() => { S.lang = 'en'; applyLang(); renderHome(); });
      t.eq(await p.evaluate(() => document.querySelector('#nextUnlock').textContent), '140 pt to 🥈 Silver · +25 🪙', 'English goal row');
      await p.evaluate(() => { S.lang = 'nl'; applyLang(); show('ranking'); });
      await sleep(400);
      const tile = await p.evaluate(() => document.querySelector('.week-tile .now').textContent);
      const row = await p.evaluate(() => document.querySelector('.rrow.me .rp').textContent);
      t.ok(tile.includes(row) && row === '110', 'tile and my row show the same points', [tile, row]);
    },
  },
  {
    name: 'week: the upload carries wkV, wkPts, title and perfect and passes the database rules; other phones count only wkV 2',
    async run(t, { FakeDB, sleep }) {
      const db = new FakeDB({ scores: {
        pNew: { name: 'Nieuw', avatar: '🌷', points: 5, level: 9, t: 1, wk: '2026-10-05', wkV: 2, wkPts: 50, title: 'ti_gardener', perfect: true },
        pOld: { name: 'Oud', avatar: '👵', points: 5, level: 9, t: 1, wk: '2026-10-05', wkPts: 900 },
      } });
      const p = await t.phone({ db, state: { ...ME, title: 'ti_x', stars: { L1: 3, L2: 3, L3: 3, L4: 3 }, wk: { id: '2026-10-05', v: 2, pts: 40, day: '2026-10-07', dayWins: 1, dailyDone: '', cups: [], postDiamond: 0, prPaid: false } } });
      await p.evaluate(() => pushScore()); await sleep(300);
      const rec = db.get('scores/test-weekwin');
      t.eq([rec.wkV, rec.wkPts, rec.wk, rec.title, rec.perfect], [2, 40, '2026-10-05', 'ti_x', true], 'new fields uploaded');
      t.eq(refused(rec), [], 'the database rules accept the payload');
      await p.evaluate(() => fetchOnline());
      const lb = await p.evaluate(() => JSON.parse(localStorage.getItem('omamj.lb')));
      const nw = lb.find(e => e.id === 'pNew');
      t.eq([nw.wkV, nw.title, nw.perfect], [2, 'ti_gardener', true], 'wkV, title and perfect are cached');
      const week = await p.evaluate(() => ranking(undefined, 'week').map(e => [e.name, e.points]));
      t.eq(week, [['Nieuw', 50], ['Dennis', 40], ['Oud', 0]], 'old version rows show 0 and sort last');
    },
  },
  {
    name: 'week: a refused write still keeps the score (falls back step by step)',
    async run(t, { FakeDB, sleep }) {
      const db = new FakeDB({ scores: {} });
      const p = await t.phone({ db, state: { ...ME } });
      // an old database refuses the fields it does not know
      const known = ['name', 'avatar', 'points', 'level', 't', 'online', 'frame', 'wk', 'wkPts'];
      await p.ctx.route(/\/scores\/test-weekwin\.json$/, async route => {
        const req = route.request();
        if (req.method() === 'PUT' && Object.keys(JSON.parse(req.postData())).some(k => !known.includes(k))) return route.fulfill({ status: 401, body: '{"error":"Permission denied"}', headers: { 'Access-Control-Allow-Origin': '*' } });
        return route.fallback();
      });
      await p.evaluate(() => pushScore()); await sleep(400);
      const rec = db.get('scores/test-weekwin');
      t.ok(rec && rec.points === 0 && rec.wkPts === 0 && !('wkV' in rec), 'v1.77 fields stored after the new fields were refused', rec);
    },
  },
];
