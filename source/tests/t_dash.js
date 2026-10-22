/* The family dashboard (site/dash): stuck alert, heart from the PC, closeness chart, new events. */
'use strict';
const path = require('path');

function fixture() {
  const now = Date.now(), min = 60e3;
  let n = 0;
  const ev = (pid, mAgo, e) => [pid, '-e' + String(++n).padStart(4, '0'), { t: now - mAgo * min, v: '1.14', dev: 'android', ses: 's1', ...e }];
  const rows = [
    ev('pOma', 300, { k: 'open', lv: 11, name: 'OmaHanny' }),
    ev('pOma', 299, { k: 'start', lv: 11, at: 1, n: 72 }),
    ev('pOma', 290, { k: 'end', r: 'win', lv: 11, at: 1, n: 72, left: 0, dur: 0, tp: 0, st: 3, sc: 1200 }),   // the old 0-second bug
    ev('pOma', 60, { k: 'start', lv: 12, at: 1, n: 72 }),
    ev('pOma', 55, { k: 'rescue', lv: 12, at: 1, s: 180, left: 30 }),
    ev('pOma', 50, { k: 'end', r: 'stuck', lv: 12, at: 1, n: 72, left: 6, dur: 420, tp: 80, rb: 1, tm: 4 }),
    ev('pOma', 45, { k: 'adapt', from: 0, to: 1, rate: 40, n: 10, lv: 12 }),
    ev('pOma', 40, { k: 'start', lv: 12, at: 2, n: 72, ez: 1.5, ad: 1 }),
    ev('pOma', 30, { k: 'err', msg: 'test error', w: 'board.js:12', lv: 12 }),
    ev('pOma', 20, { k: 'end', r: 'stuck', lv: 12, at: 2, n: 72, left: 20, dur: 300, tp: 60, tm: 4 }),
    ev('pDen', 100, { k: 'open', lv: 26, name: 'Dennis' }),
    ev('pDen', 99, { k: 'start', lv: 26, at: 1, n: 80 }),
    ev('pDen', 90, { k: 'end', r: 'win', lv: 26, at: 1, n: 80, left: 0, dur: 170, tp: 100, st: 3, sc: 1500 }),
    ev('pDen', 600, { k: 'start', lv: 27, at: 1, n: 84 }),                 // started in the morning, paused,
    ev('pDen', 598, { k: 'pause', lv: 27, at: 1, left: 68, s: 82 }),
    ev('pDen', 30, { k: 'start', lv: 27, at: 1, n: 84, res: true }),       // and continued in the evening
  ];
  const plays = {};
  for (const [pid, id, e] of rows) (plays[pid] = plays[pid] || {})[id] = e;
  return { plays, scores: { pOma: { name: 'OmaHanny', avatar: '👵', level: 12, points: 12000, t: now }, pDen: { name: 'Dennis', avatar: '😊', level: 27, points: 40000, t: now } } };
}

module.exports = [
  {
    name: 'dashboard: leaderboard shows online and last seen, respects hiding and expires heartbeats',
    async run(t, { serve, FakeDB, browser, WWW }) {
      const site = await serve(path.join(__dirname, '..', 'site'), { '/play/': WWW });
      const now = Date.now(), minute = 60000;
      const scores = {
        pOnline: { name: 'Online speler', level: 10, online: now, t: now - 10 * minute },
        pLegacy: { name: 'Oudere app', level: 9 },
        pOffline: { name: 'Weggegaan', level: 8, online: 0 },
        pStale: { name: 'Verlopen', level: 7, online: now - 90000 },
        pHidden: { name: 'Verborgen', level: 6, online: now - 2000 },
        pUnknown: { name: 'Onbekend', level: 5 },
        pScore: { name: 'Alleen score', level: 4, t: now - minute },
        pOldHidden: { name: 'Oud verborgen', level: 3 },
      };
      const plays = {
        pOnline: { a: { k: 'open', t: now - 10 * minute } },
        pLegacy: { a: { k: 'start', t: now - minute } },
        pOffline: { a: { k: 'start', t: now - minute } },
        pStale: { a: { k: 'start', t: now - minute } },
        pHidden: { a: { k: 'open', t: now - 2 * minute }, b: { k: 'hide', t: now - 1000 } },
        pOldHidden: { a: { k: 'open', t: now - 2 * minute }, b: { k: 'hide', t: now - minute }, c: { k: 'err', t: now - 1000 } },
      };
      const ctx = await browser.newContext({ viewport: { width: 2048, height: 1000 } });
      await ctx.addInitScript(value => { window.__presenceNow = value; Date.now = () => window.__presenceNow; }, now);
      const db = new FakeDB({ scores, plays });
      await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => db.handle(r));
      const p = await ctx.newPage();
      const status = name => p.locator(`#ranking a[href="#${Object.keys(scores).find(id => scores[id].name === name)}"]`).locator('..').locator('.ranking-status');
      try {
        await p.goto(site.url + 'dash/#pOnline');
        await p.waitForFunction(() => !!PLAYS.pLegacy);
        t.eq(await status('Online speler').innerText(), 'Online', 'fresh heartbeat is online despite an older play log');
        t.eq(await status('Oudere app').innerText(), 'Online', 'recent foreground activity supports older apps');
        for (const name of ['Weggegaan', 'Verlopen', 'Verborgen', 'Alleen score', 'Oud verborgen']) {
          t.ok((await status(name).innerText()).startsWith('Laatst gezien '), name + ' is offline');
          t.eq(await status(name).evaluate(el => el.classList.contains('online')), false, name + ' has no green online label');
        }
        t.eq(await status('Onbekend').innerText(), 'Laatst gezien onbekend', 'missing activity does not invent a last-seen time');
        t.eq(await p.locator('#live').evaluate(el => el.classList.contains('on')), true, 'selected player header agrees with online status');
        await p.evaluate(() => { window.__presenceNow += 90000; render(); });
        t.ok((await status('Online speler').innerText()).startsWith('Laatst gezien '), 'heartbeat expires at ninety seconds');
        t.eq(await p.locator('#live').evaluate(el => el.classList.contains('on')), false, 'header also goes offline');
        await p.evaluate(() => { SCORES.pOffline.online = Date.now(); renderRanking(); });
        t.eq(await status('Weggegaan').innerText(), 'Online', 'a new foreground heartbeat restores online status');
        await p.setViewportSize({ width: 390, height: 844 });
        t.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'status wraps without making mobile page wider');
        t.eq(db.log.filter(e => e.m !== 'GET').length, 0, 'viewing presence writes nothing to the database');
      } finally { await ctx.close(); site.close(); }
    },
  },
  {
    name: 'dashboard: compact leaderboard ranks by level, shares ties and follows live progress',
    async run(t, { serve, FakeDB, browser, WWW }) {
      const site = await serve(path.join(__dirname, '..', 'site'), { '/play/': WWW });
      const f = fixture();
      f.scores.pOma.points = 999999;
      f.scores.pAnna = { name: 'Anna <3', avatar: '🌷', level: 27, points: 1 };
      f.scores['test-hidden'] = { name: 'Test', level: 999, points: 9999999 };
      f.scores.pmuxw2uqkzcnbgx = { name: 'Renamed test account', level: 999, points: 9999999 };
      f.scores.pNamedTest = { name: 'dennisTest', level: 999, points: 9999999 };
      f.plays.pLog = { a: { k: 'open', name: 'Logspeler', lv: 15, t: Date.now() }, b: { k: 'start', m: 'd', lv: 999, t: Date.now() + 1 } };
      f.plays['msg-pOma'] = { a: { k: 'msg', name: 'Message', lv: 999, t: Date.now() } };
      f.plays['cfg-pOma'] = { a: { k: 'cfg', name: 'Settings', lv: 999, t: Date.now() } };
      const db = new FakeDB(f);
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => db.handle(r));
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      const rows = () => p.locator('#ranking tbody tr').evaluateAll(rs => rs.map(r => [...r.cells].map(c => (c.querySelector('a') || c).textContent.trim())));
      try {
        await p.goto(site.url + 'dash/#pOma');
        await p.waitForFunction(() => document.querySelectorAll('#ranking tbody tr').length === 4);
        t.eq(await rows(), [['1', '🌷 Anna <3', '27'], ['1', '😊 Dennis', '27'], ['3', '🙂 Logspeler', '15'], ['4', '👵 OmaHanny', '12']], 'levels rank above points, ties share places, logs work without scores and daily/message/settings/test entries are excluded');
        await p.locator('#ranking a').filter({ hasText: 'Anna <3' }).click();
        t.eq(await p.locator('#name').textContent(), 'Anna <3', 'click opens that player');
        t.eq(await p.locator('#who').inputValue(), 'pAnna', 'picker follows the clicked player');
        t.eq(await p.locator('#ranking .selected a').getAttribute('aria-current'), 'true', 'selected player highlighted accessibly');
        t.ok(await p.locator('#ranking').evaluate(el => el.scrollWidth <= el.clientWidth), 'compact ranking fits mobile width');
        db.set('plays/pOma/-rankWin', { k: 'end', r: 'win', lv: 30, t: Date.now() + 2 });
        await p.waitForFunction(() => document.querySelector('#ranking tbody tr').textContent.includes('OmaHanny'), null, { timeout: 10000 });
        t.eq((await rows())[0], ['1', '👵 OmaHanny', '31'], 'live win updates ranking before score refresh');
        db.set('scores/pAnna/level', 40);
        await p.evaluate(async () => { await loadScores(); render(); });
        t.eq((await rows())[0], ['1', '🌷 Anna <3', '40'], 'score refresh updates ranking');
        await p.evaluate(() => { PLAYS = {}; SCORES = {}; sel = null; render(); });
        t.eq(await p.locator('#ranking').innerText(), 'Nog geen spelers', 'empty leaderboard renders without a selected player');
        t.eq(errs, [], 'no dashboard errors');
      } finally { await ctx.close(); site.close(); }
    },
  },
  {
    name: 'dashboard: stuck alert, heart from the PC, closeness chart and new events',
    async run(t, { serve, FakeDB, browser, sleep, WWW }) {
      const site = await serve(path.join(__dirname, '..', 'site'), { '/play/': WWW });   // the dashboard uses the game's rules.js
      const db = new FakeDB(fixture());
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
      await ctx.addInitScript(() => {
        window.__notes = [];
        window.Notification = class { constructor(title, o) { window.__notes.push(title); } close() { } static requestPermission() { return Promise.resolve('granted'); } };
        window.Notification.permission = 'granted';
      });
      await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => db.handle(r));
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      try {
        await p.goto(site.url + 'dash/'); await sleep(2000);
        const txt = s => p.evaluate(s => (document.querySelector(s) || {}).innerText || '', s);
        const alert = await txt('#alerts');
        t.ok(/OmaHanny/.test(alert) && /level 12/.test(alert) && /2× niet gelukt/.test(alert) && /6 stenen over/.test(alert), 'stuck alert', alert);
        t.ok(/makkelijker/.test(alert), 'says her next try gets easier', alert);
        t.ok(!/Dennis zit vast/.test(alert), 'no alert for Dennis');
        t.ok((await p.evaluate(() => document.title)).startsWith('😟'), 'tab title shows it');
        t.eq(await p.evaluate(() => window.__notes.length), 0, 'no notification for what was already there');
        const kpi = await txt('#kpis');
        t.ok(/Vastgelopen\s*67%/.test(kpi), 'stuck rate KPI', kpi);
        t.ok(/Tijd per level\s*–/.test(kpi), 'the 0-second win does not count as a time', kpi);
        t.ok(/Totaal gespeeld\s*12:00/.test(kpi) && /per speeldag/.test(kpi), 'all-time play time (420 s + 300 s of tries)', kpi);
        t.ok(/Moeilijkheid\s*iets makkelijker/.test(kpi) && /won 1 van de laatste 3 pogingen/.test(kpi), 'her difficulty step', kpi);
        t.ok(/Moeilijkheid aangepast: iets makkelijker/.test(await txt('#feed')), 'the change is in the feed');
        t.ok(await p.evaluate(() => document.querySelectorAll('#chClose .bar').length) === 2, 'closeness chart has both failed tries');
        const tbl = await txt('#tbl'), feed = await txt('#feed');
        const when = await p.evaluate(() => { const l = analyse(events('pDen')).levels; return { order: l.sort((a, b) => b.last - a.last).map(x => x.lv), ago: Math.round((Date.now() - l.find(x => x.lv === 27).last) / 60e3) }; });
        t.ok(when.order[0] === 27 && when.ago >= 29 && when.ago <= 32, 'a level continued later shows when it was last played (not when it was first started)', when);
        t.ok(/↩/.test(tbl) && /6 over/.test(tbl), 'table shows the rescue and the closest try', tbl.slice(0, 300));
        t.ok(/Stenen teruggelegd/.test(feed) && /tijd onbekend/.test(feed) && /Foutje in de app: test error/.test(feed), 'feed shows the new events', feed.slice(0, 600));
        // send a heart from the PC as Dennis
        await p.evaluate(() => { const s = document.querySelector('#alerts select'); s.value = 'pDen'; s.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('#alerts .hmsg').value = 'Goed bezig oma, wie haalt level 13 eerst? 😉'; document.querySelector('#alerts [data-heart]').click(); });
        await sleep(800);
        const h = db.get('hearts/pOma/pDen');
        t.ok(h && h.name === 'Dennis' && h.t > 0, 'heart written to the database', h);
        t.ok(/verstuurd/.test(await txt('#alerts')), 'shows it was sent');
        const msgs = Object.values(db.get('plays/msg-pOma') || {});
        t.ok(msgs.length === 1 && msgs[0].from === 'pDen' && msgs[0].t === h.t && [msgs[0].m0, msgs[0].m1, msgs[0].m2].join('') === 'Goed bezig oma, wie haalt level 13 eerst? 😉' && [msgs[0].m0, msgs[0].m1].every(x => x.length <= 40), 'message stored in pieces of at most 40', msgs);
        t.ok(/met berichtje/.test(await txt('#alerts')), 'says it went with a message');
        await sleep(5000);
        t.ok(/Bericht van Dennis: “Goed bezig oma/.test(await txt('#feed')), 'message in her feed');
        t.ok(!(await p.evaluate(() => [...document.querySelectorAll('#who option')].map(o => o.value))).some(v => v.startsWith('msg-')), 'the messages are not a player in the list');
        db.set('hearts/pOma/pDen', { name: 'Dennis', t: -h.t });       // Oma's app marks it seen
        await p.evaluate(() => checkHeartsSeen()); await sleep(500);
        t.ok(/gezien/.test(await txt('#alerts')), 'shows it was seen');
        // Dennis fails twice too: a new alert, with a notification
        const now = Date.now();
        db.set('plays/pDen/-x1', { k: 'end', r: 'stuck', lv: 27, at: 1, n: 80, left: 10, dur: 100, tp: 50, t: now, v: '1.14' });
        db.set('plays/pDen/-x2', { k: 'end', r: 'restart', lv: 27, at: 2, n: 80, left: 70, dur: 20, tp: 5, t: now + 1, v: '1.14' });
        // and Oma wins her level: her alert goes away
        db.set('plays/pOma/-x3', { k: 'end', r: 'win', lv: 12, at: 3, n: 72, left: 0, dur: 250, tp: 70, st: 3, sc: 1100, t: now + 2, v: '1.14' });
        await sleep(5000);   // the live stream reconnects and brings the new data
        const a2 = await txt('#alerts');
        t.ok(/Dennis zit vast op level 27/.test(a2) && !/OmaHanny zit vast/.test(a2), 'alerts follow the live data', a2);
        t.ok((await p.evaluate(() => window.__notes)).some(n => /Dennis zit vast/.test(n)), 'notification for the new alert');
        t.eq(errs, [], 'no errors on the dashboard');
      } finally { await ctx.close(); site.close(); }
    },
  },
  {
    name: 'dashboard: prediction from the player\'s own test player, with the real results next to it',
    async run(t, { serve, FakeDB, browser, sleep, WWW }) {
      const site = await serve(path.join(__dirname, '..', 'site'), { '/play/': WWW });
      const data = fixture();
      for (const es of Object.values(data.plays)) for (const e of Object.values(es)) e.v = '1.53';
      const db = new FakeDB(data);
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
      await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => db.handle(r));
      const levels = {}; for (let lv = 26; lv < 46; lv++) levels[lv] = [lv === 26 ? 80 : 40, 70, lv === 30 ? 50 : 90, lv >= 30 ? 9 : 0];
      const pred = { made: '2026-10-16', version: '1.53', players: { pDen: { name: 'Dennis', from: 26, fit: { firstTries: 74, retries: 21, levels: [42, 105], memory: [75, 75, 75], blunder: 15 }, levels } } };
      await ctx.route(u => /\/dash\/predict\.json/.test(u.pathname), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pred) }));
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      try {
        await p.goto(site.url + 'dash/?pred=1#pDen'); await sleep(2000);
        const txt = await p.evaluate(() => document.querySelector('#pred').innerText);
        t.ok(!txt.includes('%'), 'old percentage chance metrics are completely absent from the Voorspelling card', txt);
        t.ok(/8\+ pogingen verwacht[\s\S]*Level 30/i.test(txt), '8+ attempt levels are highlighted in the summary', txt.slice(0, 300));
        t.ok(/26[^\n]*1e poging[^\n]*gehaald in 1 poging/.test(txt), 'a level played since the prediction shows the projected attempt and real result', txt);
        t.ok(/27[^\n]*nog bezig|27[^\n]*begonnen/.test(txt), 'the level being played');
        t.ok(/Eigen persoonlijke bot van Dennis/.test(txt), 'explains the personal attempt-predicting bot', txt.slice(-300));
        t.eq(await p.evaluate(() => [...document.querySelectorAll('#pred tr.hard td:first-child')].map(td => td.textContent)), ['30'], '8+ / trap level marked');
        await p.evaluate(() => selectPlayer('pOma')); await sleep(300);
        t.ok(/Nog geen eigen testspeler voor OmaHanny/.test(await p.evaluate(() => document.querySelector('#pred').innerText)), 'a player without a test player');
        t.eq(errs, [], 'no errors on the dashboard');
      } finally { await ctx.close(); site.close(); }
    },
  },
  {
    name: 'dashboard: Super-omamodus and each part of it switched per player',
    async run(t, { serve, FakeDB, browser, sleep, WWW }) {
      const site = await serve(path.join(__dirname, '..', 'site'), { '/play/': WWW });
      const f = fixture();
      f.plays['cfg-pDen'] = { a: { k: 'cfg', t: 1, adapt: true } };          // Dennis: only the part that follows his results
      f.scores.pRash = { name: 'Rashmi', avatar: '🌷', level: 5, points: 500, t: Date.now() };   // nothing switched on
      const db = new FakeDB(f);
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 1100 } });
      await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => db.handle(r));
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      try {
        await p.goto(site.url + 'dash/#pOma'); await sleep(1800);
        const sw = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#cfgBox .sw')].map(b => [b.dataset.k, b.textContent])));
        t.eq(await p.evaluate(() => document.querySelector('#cfgBox details').open), true, 'grandma: settings open');
        const oma = await sw();
        t.eq(Object.values(oma).filter(v => v === 'Aan').length, Object.keys(oma).length, 'grandma: Super-omamodus and every part on');
        t.ok('super' in oma && 'levels' in oma && 'adapt' in oma && 'news' in oma && !('combo' in oma), 'the switches', Object.keys(oma));
        t.ok(!(await p.evaluate(() => [...document.querySelectorAll('#who option')].some(o => o.value.startsWith('cfg-')))), 'settings are not a player in the list');
        await p.evaluate(() => document.querySelector('#cfgBox .sw[data-k="news"]').click()); await sleep(400);
        const post = db.log.find(l => l.m === 'POST' && /plays\/cfg-pOma/.test(l.p));
        t.ok(post && post.body.k === 'cfg' && post.body.news === false && Object.keys(post.body).length === 3, 'one part off for her: only that is saved', post);
        await p.evaluate(() => { document.querySelector('#who').value = 'pDen'; document.querySelector('#who').dispatchEvent(new Event('change')); }); await sleep(400);
        t.eq(await p.evaluate(() => document.querySelector('#cfgBox details').open), true, 'Dennis has a part on: open');
        const den = await sw();
        t.eq([den.super, den.adapt, den.levels, den.rescue, den.news], ['Uit', 'Aan', 'Uit', 'Uit', 'Uit'], 'Dennis: only "follows the results"');
        // someone with nothing switched on: collapsed, with a one-line summary; opening it is remembered
        await p.evaluate(() => { document.querySelector('#who').value = 'pRash'; document.querySelector('#who').dispatchEvent(new Event('change')); }); await sleep(400);
        t.eq(await p.evaluate(() => [document.querySelector('#cfgBox details').open, document.querySelector('#cfgBox summary').innerText.includes('alles uit')]), [false, true], 'nothing switched on: collapsed');
        await p.evaluate(() => document.querySelector('#cfgBox summary').click()); await sleep(200);
        await p.evaluate(() => { render(); }); await sleep(200);
        t.eq(await p.evaluate(() => document.querySelector('#cfgBox details').open), true, 'opened by hand: stays open');
        t.eq(errs, [], 'no errors');
      } finally { await ctx.close(); site.close(); }
    },
  },
];
module.exports.fixture = fixture;   // also used to make screenshots of the dashboard
