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
  ];
  const plays = {};
  for (const [pid, id, e] of rows) (plays[pid] = plays[pid] || {})[id] = e;
  return { plays, scores: { pOma: { name: 'OmaHanny', avatar: '👵', level: 12, points: 12000, t: now }, pDen: { name: 'Dennis', avatar: '😊', level: 27, points: 40000, t: now } } };
}

module.exports = [
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
        t.ok(/Moeilijkheid\s*iets makkelijker/.test(kpi) && /won 1 van de laatste 3 pogingen/.test(kpi), 'her difficulty step', kpi);
        t.ok(/Moeilijkheid aangepast: iets makkelijker/.test(await txt('#feed')), 'the change is in the feed');
        t.ok(await p.evaluate(() => document.querySelectorAll('#chClose .bar').length) === 2, 'closeness chart has both failed tries');
        const tbl = await txt('#tbl'), feed = await txt('#feed');
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
    name: 'dashboard: switching grandma mode and the news per player',
    async run(t, { serve, FakeDB, browser, sleep, WWW }) {
      const site = await serve(path.join(__dirname, '..', 'site'), { '/play/': WWW });
      const f = fixture();
      f.plays['cfg-pDen'] = { a: { k: 'cfg', t: 1, care: true } };          // Dennis was put in grandma mode earlier
      const db = new FakeDB(f);
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
      await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => db.handle(r));
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      try {
        await p.goto(site.url + 'dash/#pOma'); await sleep(1800);
        const sw = () => p.evaluate(() => [...document.querySelectorAll('#cfgBox .sw')].map(b => b.dataset.k + ':' + b.textContent));
        t.eq(await sw(), ['care:Aan', 'news:Aan'], 'grandma: grandma mode and news on (her defaults)');
        t.ok(!(await p.evaluate(() => [...document.querySelectorAll('#who option')].some(o => o.value.startsWith('cfg-')))), 'settings are not a player in the list');
        await p.evaluate(() => document.querySelector('#cfgBox .sw[data-k="news"]').click()); await sleep(400);
        const post = db.log.find(l => l.m === 'POST' && /plays\/cfg-pOma/.test(l.p));
        t.ok(post && post.body.k === 'cfg' && post.body.news === false && !('care' in post.body), 'turning the news off is saved for her', post);
        await p.evaluate(() => { document.querySelector('#who').value = 'pDen'; document.querySelector('#who').dispatchEvent(new Event('change')); }); await sleep(400);
        t.eq(await sw(), ['care:Aan', 'news:Uit'], 'Dennis: grandma mode on (switched), no news (his default)');
        t.eq(errs, [], 'no errors');
      } finally { await ctx.close(); site.close(); }
    },
  },
];
module.exports.fixture = fixture;   // also used to make screenshots of the dashboard
