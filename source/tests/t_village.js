/* News from Apeldoorn for grandma (and DennisTEST): mostly real news, sometimes a part of a
   neighbourhood story with a memory question; plus the helper that waits longer when she does well. */
'use strict';
const path = require('path'), { execFileSync } = require('child_process');
const OMA = { name: 'OmaHanny', pid: 'test-oma', level: 12 };
const DTEST = { name: 'DennisTEST', pid: 'pmuxw2uqkzcnbgx', level: 12 };    // the database is fake here
const DENNIS = { name: 'Dennis', pid: 'test-dennis', level: 12 };
const NOW = new Date('2026-10-07T15:00:00').getTime();                      // the test clock (lib.TODAY)
const NEWS = { updated: NOW - 3600e3, items: Array.from({ length: 10 }, (_, i) => ({ id: 'n' + i, t: NOW - i * 3 * 3600e3, title: `Nieuwsbericht ${i}`, text: `Iets leuks uit Apeldoorn, nummer ${i}.`, src: 'Samen1' })) };

// show what comes next after a won level and close it; returns what it was
const revealOne = p => p.evaluate(() => new Promise(done => {
  const x = villageNext();
  if (!x) return done(null);
  const kind = x.k === 'n' ? 'n' : 's:' + x.st.id + ':' + x.p;
  showVillage(() => done(kind));
  const tap = () => { const a = document.querySelector('.vg-a'); if (a) { [...document.querySelectorAll('.vg-a')].find(b => +b.dataset.i === x.st.ask.ok).click(); setTimeout(tap, 1800); } else if (document.querySelector('#vgOk')) document.querySelector('#vgOk').click(); else setTimeout(tap, 100); };
  setTimeout(tap, 50);
}));

module.exports = [
  {
    name: 'village: only grandma and DennisTEST get the news; DennisTEST gets all of grandma\'s help',
    async run(t) {
      for (const [st, on] of [[OMA, true], [DTEST, true], [DENNIS, false], [{ name: 'Mama', pid: 'pmv13884fc9vndv' }, false]]) {
        const p = await t.phone({ state: st, news: NEWS });
        const r = await p.evaluate(() => ({ on: villageOn(), care: careMode(), help: help() === HELP.care, chip: !document.querySelector('#btnPaper').classList.contains('hidden'), en: isEn() }));
        t.eq([r.on, r.chip], [on, on], `${st.name}: news ${on ? 'on' : 'off'}`);
        if (st === DTEST) t.eq(r, { on: true, care: true, help: true, chip: true, en: false }, 'DennisTEST: exactly like grandma');
        await p.ctx.close();
      }
    },
  },
  {
    name: 'village: four real news items, then a story part (80/20), with a memory question',
    async run(t, { sleep }) {
      const p = await t.phone({ state: OMA, news: NEWS });
      await p.evaluate(() => loadNews(true)); await sleep(300);
      const seen = [];
      for (let k = 0; k < 10; k++) seen.push(await revealOne(p));
      t.eq(seen.map(x => x && x[0]), ['n', 'n', 'n', 'n', 's', 'n', 'n', 'n', 'n', 's'], '1 in 5 is a story part');
      t.eq(seen.filter(x => x === 'n').length, 8, 'the newest news first, none twice');
      const v = await p.evaluate(() => ({ n: vg().n, s: vg().s, log: vg().log.length, first: vg().log[0].it.title }));
      t.eq(v, { n: 8, s: 2, log: 10, first: 'Nieuwsbericht 0' }, 'kept for Het krantje');
      // a story at its question: answering right gives a bonus star, then the part follows
      const b0 = await p.evaluate(() => { const v = vg(); v.n = 40; v.s = 4; v.sp.fiets = 4; v.act = ['fiets']; v.rr = 0; save(); return S.bonusStars; });
      await p.evaluate(() => showVillage(() => { window.__vgDone = 1; })); await sleep(300);
      t.ok(await p.evaluate(() => document.querySelectorAll('.vg-a').length === 3), 'memory question with three answers');
      await p.evaluate(() => [...document.querySelectorAll('.vg-a')].find(b => b.textContent.includes('Bananen')).click());
      await sleep(2000);
      t.eq(await p.evaluate(() => [S.bonusStars, vg().ask.fiets]), [b0 + 1, 1], 'right answer: a bonus star');
      t.ok((await p.evaluate(() => document.querySelector('#modalBox').innerText)).includes('deel 5 van 6'), 'then part 5');
      await p.evaluate(() => document.querySelector('#vgOk').click()); await sleep(200);
      t.eq(await p.evaluate(() => window.__vgDone), 1, 'and the game goes on');
      const ev = p.db.plays('test-oma');
      t.ok(ev.filter(e => e.k === 'vnews').length === 8 && ev.some(e => e.k === 'vstory') && ev.some(e => e.k === 'vask' && e.ok === 1), 'logged for the dashboard');
    },
  },
  {
    name: 'village: after a won level the news comes before the next level, which teases the next one',
    async run(t, { startLevel, solve, click, modal, sleep }) {
      const p = await t.phone({ state: { ...OMA, level: 3 }, news: NEWS });
      await p.evaluate(() => loadNews(true)); await sleep(300);
      await startLevel(p, 3);
      t.ok(await solve(p), 'level won');
      await click(p, '#wNext');
      let m = null;
      for (let k = 0; k < 12 && !(m && m.buttons.includes('vgOk')); k++) { await sleep(500); m = await modal(p); if (m && !m.buttons.includes('vgOk') && m.buttons.length) await click(p, '#' + m.buttons[0]); }
      t.ok(m && m.text.includes('Nieuws uit Apeldoorn') && m.text.includes('Nieuwsbericht 0') && m.text.includes('Samen1'), 'real news after the win', m);
      await click(p, '#vgOk'); await sleep(2600);
      t.eq(await p.evaluate(() => __mj.G.level), 4, 'then the next level');
      t.ok((await p.evaluate(() => document.querySelector('#gameMsg').textContent)).includes('nieuws uit Apeldoorn'), 'the top bar teases the next news');
      // Het krantje on the home screen keeps it
      await p.evaluate(() => __mj.show('home')); await sleep(200);
      await click(p, '#btnPaper'); await sleep(200);
      t.ok((await p.evaluate(() => document.querySelector('#modalBox').innerText)).includes('Nieuwsbericht 0'), 'in Het krantje');
    },
  },
  {
    name: 'village: no news file for days: stories fill in; the ranking shows 💬 for their characters',
    async run(t, { sleep }) {
      const p = await t.phone({ state: OMA, news: { updated: NOW - 5 * 864e5, items: [] } });
      await p.evaluate(() => loadNews(true)); await sleep(300);
      const a = await revealOne(p), b = await revealOne(p);
      t.eq([a, b], ['s:fiets:0', 's:kat:0'], 'two stories running side by side');
      await p.evaluate(() => __mj.show('ranking')); await sleep(300);
      const chat = await p.evaluate(() => [...document.querySelectorAll('.vg-chat')].map(b => b.dataset.who).sort());
      t.eq(chat, ['Buurvrouw Ans', 'Truus'], '💬 next to Truus and Ans');
      await p.evaluate(() => document.querySelector('.vg-chat[data-who="Truus"]').click()); await sleep(200);
      t.ok((await p.evaluate(() => document.querySelector('#modalBox').innerText)).includes('blauwe damesfiets'), 'tapping it shows her story so far');
      const q = await t.phone({ state: DENNIS, news: NEWS });
      await q.evaluate(() => __mj.show('ranking')); await sleep(300);
      t.eq(await q.evaluate(() => document.querySelectorAll('.vg-chat').length + (villageNext() ? 1 : 0)), 0, 'nothing for others');
    },
  },
  {
    name: 'village: every story is complete (6 parts, a cliffhanger, a fair memory question, a real character)',
    async run(t) {
      const p = await t.phone({ state: OMA });
      const bad = await p.evaluate(() => STORIES.flatMap(st => {
        const e = [];
        if (st.parts.length < 4) e.push(st.id + ': too short');
        st.parts.forEach(([txt, cl], i) => { if (!txt) e.push(`${st.id} ${i}: no text`); if (i < st.parts.length - 1 ? !cl : cl) e.push(`${st.id} ${i}: cliffhanger`); });
        if (!BOTS.some(b => b[0] === st.who)) e.push(st.id + ': unknown character ' + st.who);
        const a = st.ask;
        if (!a || a.at < 1 || a.at >= st.parts.length || !a.a[a.ok] || a.a.length !== 3) e.push(st.id + ': question');
        else if (!st.parts.slice(0, a.at).some(([x]) => x.toLowerCase().includes(a.a[a.ok].toLowerCase().replace(/^(om|uit|in het) /, '').split(' ')[0]))) e.push(st.id + ': answer not in an earlier part');
        return e;
      }));
      t.eq(bad, [], 'all stories');
      t.eq(await p.evaluate(() => new Set(STORIES.map(s => s.id)).size === STORIES.length), true, 'unique ids');
    },
  },
  {
    name: 'village: the news photo shows (or its smaller version, or nothing when it cannot load)',
    async run(t, { sleep }) {
      const png = require('fs').readFileSync(require('path').join(__dirname, '..', 'www', 'icons', require('fs').readdirSync(require('path').join(__dirname, '..', 'www', 'icons')).find(f => f.endsWith('.png'))));
      const pic = r => r.fulfill({ status: 200, contentType: 'image/png', body: png });
      const items = [
        { id: 'a', t: NOW - 1e6, title: 'Met foto', text: 'x', src: 'Samen1', img: 'https://pics.test/a.jpg' },
        { id: 'b', t: NOW - 2e6, title: 'Kleine foto', text: 'x', src: 'Samen1', img: 'https://pics.test/b-groot.jpg', thumb: 'https://pics.test/b-150x150.jpg' },
        { id: 'c', t: NOW - 3e6, title: 'Kapotte foto', text: 'x', src: 'Samen1', img: 'https://pics.test/c.jpg' },
      ];
      const p = await t.phone({ state: OMA, news: { updated: NOW, items }, routes: [['https://pics.test/a.jpg', pic], ['https://pics.test/b-150x150.jpg', pic], ['https://pics.test/b-groot.jpg', r => r.fulfill({ status: 404 })], ['https://pics.test/c.jpg', r => r.fulfill({ status: 404 })]] });
      await p.evaluate(() => loadNews(true)); await sleep(300);
      const photo = async () => { await p.evaluate(() => showVillage(() => { })); await sleep(700); const r = await p.evaluate(() => { const i = document.querySelector('.vg-photo img'); return i ? (i.naturalWidth > 0 ? i.src.split('/').pop() : 'broken') : 'none'; }); await p.evaluate(() => document.querySelector('#vgOk').click()); return r; };
      t.eq(await photo(), 'a.jpg', 'the photo');
      t.eq(await photo(), 'b-150x150.jpg', 'the big one is gone: the smaller one');
      t.eq(await photo(), 'none', 'no photo at all: the news without it');
      await p.evaluate(() => openPaper()); await sleep(500);
      t.eq(await p.evaluate(() => document.querySelectorAll('#modalBox .vg-photo').length), 2, 'Het krantje keeps the photos');
    },
  },
  {
    name: 'helper: waits longer when she wins easily, sooner when she struggles',
    async run(t, { startLevel }) {
      const p = await t.phone({ state: OMA });
      await startLevel(p, 12);
      const w = hist => p.evaluate(h => { S.adapt = { step: 0, hist: h, since: 0, key: 'L12' }; return nudgeWaits(); }, hist);
      t.eq(await w([]), { downS: 6, upS: 14 }, 'no results yet: the normal waits');
      t.eq(await w([1, 1, 1, 1, 1, 1, 1, 1]), { downS: 17, upS: 39 }, 'winning easily: about 40 s');
      t.eq(await w([0, 0, 1, 0, 0, 0.5, 0, 0]), { downS: 4, upS: 10 }, 'struggling: sooner');
      const mid = await w([1, 0, 1, 1, 0, 1, 0, 1]);
      t.ok(mid.upS >= 12 && mid.upS <= 18, 'in between: about normal', mid);
      t.eq(await p.evaluate(() => { S.adapt.hist = [1, 1, 1, 1, 1, 1]; S.fails.L12 = 1; return nudgeWaits(); }), { downS: 4, upS: 10 }, 'this level already went wrong once: sooner');
      const q = await t.phone({ state: DENNIS });
      t.eq(await q.evaluate(() => help().nudge), null, 'others have no helper');
    },
  },
  {
    name: 'news collector: keeps friendly local news, drops accidents, police, columns and doubles',
    async run(t) {
      const root = path.join(__dirname, '..'), out = path.join(require('os').tmpdir(), 'omamj-news-test.json');
      execFileSync('python3', [path.join(root, 'tools', 'news.py'), '--file', path.join(__dirname, 'fixtures', 'news-feed.xml'), '--out', out]);
      const j = require(out);
      t.eq(j.items.map(i => i.title), ['Indrukwekkend schouwspel op de heide: kudde schapen trekt door bij Uddel', 'Dier van de week: Piertje', 'Gelderland wil drones beter onderzoeken', 'Trampolinepark in Apeldoorn open'], 'friendly items only (also no "geluidsoverlast", no advertorials; a trampoline is fine)');
      t.ok(!/verscheen eerst|<|&amp;/.test(j.items.map(i => i.text).join(' ')), 'summaries are plain text', j.items.map(i => i.text));
      t.eq(j.items.map(i => [i.img, i.thumb]), [['https://example.org/uploads/schapen-uddel.jpg', 'https://example.org/uploads/schapen-uddel-150x150.jpg'], ['https://example.org/uploads/piertje-540x430-c.jpg', undefined], [undefined, undefined], [undefined, undefined]], 'the news photo (the sharp original of a thumbnail; no logos, no police photo; https)');
    },
  },
];
