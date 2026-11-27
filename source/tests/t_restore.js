/* A restore code from the dashboard brings an existing player's progress to a new phone (js/features/restore). */
'use strict';
const path = require('path');
const { TODAY } = require('./lib');
const NOW = new Date(TODAY + 'T15:00:00').getTime();
const PID = 'test-restore';
const weekOf = t => { const d = new Date(t); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// a player who won levels 1-3 (level 2 twice), had a gift and is now at level 4
function oldPlayer(code, t = NOW - 60000) {
  const win = (lv, st, sc, at) => ({ k: 'end', r: 'win', lv, st, sc, at, t: NOW - 9e6 + lv * 1000 + at });
  return {
    scores: { [PID]: { name: 'Rashmi', avatar: '🌷', frame: 'none', level: 4, points: 3500, wk: weekOf(NOW), wkPts: 900, t: NOW - 9e6 } },   // old weekly points (no wkV)
    plays: {
      [PID]: {
        a: { k: 'start', lv: 1, at: 1, t: NOW - 9e6 }, b: win(1, 3, 1000, 1),
        c: { k: 'start', lv: 2, at: 2, t: NOW - 9e6 + 1 }, d: win(2, 2, 700, 1), e: win(2, 3, 1100, 2),
        f: win(3, 1, 900, 1), g: { k: 'gift', stars: 1, t: NOW - 8e6 }, h: { k: 'end', r: 'lose', lv: 4, at: 1, t: NOW - 7e6 },
      },
      'test-cfg-restore': { r: { k: 'cfg', t, restore: code } },
    },
  };
}
const fresh = { level: 1, name: undefined, pid: undefined, stars: {}, lvlPts: {} };

async function typeCode(p, code, click, sleep) {
  await p.evaluate(() => openSettings()); await sleep(200);
  await click(p, '#mRestore'); await sleep(200);
  await p.fill('#rcIn', code);
  await click(p, '#rcGo'); await sleep(800);
}

module.exports = [
  {
    name: 'restore: the right code brings back level, stars, points and the player',
    async run(t, { FakeDB, modal, click, sleep }) {
      const db = new FakeDB(oldPlayer('K7M2QX'));
      const p = await t.phone({ state: fresh, db });
      await typeCode(p, 'k7m-2qx', click, sleep);
      const m = await modal(p);
      t.ok(m && m.title.includes('Rashmi') && m.buttons.includes('rcYes'), 'the player is found and shown', m);
      t.ok(m && m.text.includes('level 4') && m.text.includes('⭐ 8 '), 'level 4 with 7 level stars + 1 gift star', m && m.text);
      // (the game reloads after the takeover: wait for that page, then read it; reading during the reload can hang)
      const loaded = p.waitForEvent('load', { timeout: 8000 });
      await click(p, '#rcYes');
      await loaded;
      await p.waitForFunction(() => window.__mjReady === true && __mj.S.pid === 'test-restore', null, { timeout: 8000 });
      const s = await p.evaluate(() => ({ pid: __mj.S.pid, name: __mj.S.name, level: __mj.S.level, stars: __mj.S.stars, pts: myPoints(), att: __mj.S.att, coins: __mj.S.coins, econ: __mj.S.econV }));
      t.eq([s.pid, s.name, s.level], [PID, 'Rashmi', 4], 'same player, same level');
      t.eq(s.stars, { 1: 3, 2: 3, 3: 1 }, 'best stars per level');
      t.eq(s.pts, 3500, 'the all-time points on the leaderboard');
      t.eq(await p.evaluate(() => [myWeekPts(), __mj.S.wk.v]), [0, 2], 'an old-version player starts the week at 0 in the new week system');
      t.eq(s.att, { L1: 1, L2: 2 }, 'tries per level');
      t.ok(s.econ === 2 && s.coins > 0, 'coins from the migration of an old save', s);
      const cfg = db.plays('test-cfg-restore');
      t.eq(cfg[cfg.length - 1].restore, '', 'the code is used up');
      t.eq(db.get('scores/' + PID).points, 3500, 'leaderboard unchanged');
    },
  },
  {
    name: 'restore: a wrong or expired code changes nothing',
    async run(t, { FakeDB, modal, click, sleep }) {
      const p = await t.phone({ state: { ...fresh, level: 3 }, db: new FakeDB(oldPlayer('K7M2QX')) });
      await typeCode(p, 'AAAAAA', click, sleep);
      t.ok((await p.evaluate(() => document.querySelector('#rcMsg').textContent)).length > 5, 'wrong code: a message');
      t.eq(await p.evaluate(() => __mj.S.level), 3, 'progress untouched');
      const q = await t.phone({ state: fresh, db: new FakeDB(oldPlayer('K7M2QX', NOW - 25 * 36e5)) });
      await typeCode(q, 'K7M2QX', click, sleep);
      const m = await modal(q);
      t.ok(m && !m.buttons.includes('rcYes'), 'a code older than 24 hours is not accepted', m);
    },
  },
  {
    name: 'restore: a phone with its own progress is warned first',
    async run(t, { FakeDB, modal, click, sleep }) {
      const p = await t.phone({ state: { ...fresh, level: 3 }, db: new FakeDB(oldPlayer('K7M2QX')) });
      await typeCode(p, 'K7M2QX', click, sleep);
      const m = await modal(p);
      t.ok(m && m.text.includes('level 3'), 'says what on this phone is replaced', m && m.text);
    },
  },
  {
    name: 'restore: the dashboard makes a code in the player\'s settings and shows it',
    async run(t, { serve, FakeDB, browser, sleep, WWW }) {
      const site = await serve(path.join(__dirname, '..', 'site'), { '/play/': WWW });
      const db = new FakeDB({ scores: { pRash: { name: 'Rashmi', avatar: '🌷', level: 66, points: 500, t: Date.now() } },
        plays: { pRash: { a: { k: 'open', t: Date.now() - 6e4, dev: 'ios', lv: 66 } } } });
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 1100 } });
      await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => db.handle(r));
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      try {
        await p.goto(site.url + 'dash/#pRash'); await sleep(1800);
        t.ok(await p.evaluate(() => !!document.querySelector('#cfgBox [data-restore]')), 'a code button for Rashmi');
        await p.evaluate(() => document.querySelector('#cfgBox [data-restore]').click()); await sleep(600);
        const ev = Object.values(db.get('plays/cfg-pRash') || {});
        const code = ev.length && ev[ev.length - 1].restore;
        t.ok(/^[A-HJ-NP-Z2-9]{6}$/.test(code || ''), 'a 6-character code in her settings', ev);
        t.ok(await p.evaluate(c => document.querySelector('#cfgBox').textContent.includes(c), code), 'the code is shown');
        t.eq(errs, [], 'no errors on the dashboard');
      } finally { await ctx.close(); site.close(); }
    },
  },
];
