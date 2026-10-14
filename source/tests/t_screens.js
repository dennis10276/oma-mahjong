/* Screens: everything opens without errors, and fits on small phones. */
'use strict';
const FAM = { pfam1: { name: 'Dennis', avatar: '😊', frame: 'rainbow', level: 18, points: 28080, t: 1, wk: '2026-10-05', wkPts: 15000 }, pfam2: { name: 'Rashmi', avatar: '🌷', frame: 'none', level: 7, points: 8140, t: 1, wk: '2026-10-05', wkPts: 8000 } };
const PLAYER = { winStreak: 4, level: 12, name: 'Oma', pid: 'test-shot', avatar: '👵', stars: { 1: 3, 2: 3, 3: 2 }, lvlPts: { 1: 900, 2: 1000 }, wk: { id: '2026-10-05', pts: 5000 }, lvlHist: { '2026-10-05': 6, '2026-10-06': 9, '2026-10-07': 12 } };

module.exports = [
  {
    name: 'screens: every screen and pop-up opens without errors',
    async run(t, { FakeDB, startLevel, modal, click, sleep }) {
      const p = await t.phone({ state: PLAYER, db: new FakeDB({ scores: FAM }) });
      for (const s of ['levels', 'daily', 'themes', 'trophies', 'ranking', 'home']) {
        await p.evaluate(s => __mj.show(s), s); await sleep(200);
        t.ok(await p.evaluate(s => document.querySelector('#' + s).classList.contains('active'), s), `${s} shown`);
      }
      await p.evaluate(() => __mj.show('ranking')); await sleep(300);
      const fam = await p.evaluate(() => document.querySelector('#famBox').innerText);
      t.ok(fam.includes('Dennis') && fam.includes('level 18'), 'family box shows names and levels', fam);
      await click(p, '#rkAll'); await sleep(200);
      await p.evaluate(() => __mj.show('home'));
      for (const b of ['#btnSettings', '#btnTasks', '#rankName']) {
        await click(p, b); await sleep(250);
        t.ok(await modal(p), `${b} opens a pop-up`);
        await p.evaluate(() => document.querySelector('#modal').classList.add('hidden'));
      }
      for (const L of [1, 16, 30]) { await startLevel(p, L); t.eq(await p.evaluate(() => __mj.G.level), L, `level ${L} started`); }
    },
  },
  {
    name: 'screens: Zonnebloem theme, big tiles and high contrast',
    async run(t, { startLevel }) {
      const p = await t.phone({ state: { ...PLAYER, level: 22, theme: 'sunflower', bg: 'sunfield', sunSeen: true } });
      await startLevel(p, 22);
      const faces = await p.evaluate(() => [...document.querySelectorAll('#board .tile .emo')].length);
      t.ok(faces > 50, 'sunflower tiles drawn', faces);
      const q = await t.phone({ state: { ...PLAYER, level: 16, bigTiles: true, contrast: true } });
      await startLevel(q, 16);
      t.ok(await q.evaluate(() => document.body.classList.contains('contrast')), 'high contrast on');
    },
  },
  {
    name: 'screens: every theme has 36 different pictures (Zonnebloem easy to tell apart)',
    async run(t) {
      const p = await t.phone({});
      const th = await p.evaluate(() => Object.fromEntries(Object.entries(Tiles.THEMES).map(([k, v]) => [k, { n: v.faces.length, uniq: new Set(v.faces).size }])));
      for (const [k, v] of Object.entries(th)) t.eq([v.n, v.uniq], [36, 36], `theme ${k}`);
      const sun = await p.evaluate(() => Tiles.THEMES.sunflower.faces.join(''));
      // pictures that looked too much alike in 1.12 must not come back
      for (const pair of [['🌻', '🌼'], ['🌻', '🌞'], ['🌷', '🌹'], ['🌸', '🌺'], ['🍀', '🌿'], ['🍓', '🍒']]) t.ok(!(sun.includes(pair[0]) && sun.includes(pair[1])), `not both ${pair.join(' ')}`);
      t.ok(sun.startsWith('🌻🐝🐞'), 'sunflower, bee and ladybug first (home logo)');
    },
  },
  {
    name: 'screens: after a level nothing needs scrolling (win and climb), on small and big phones',
    async run(t, { FakeDB, startLevel, solve, sleep }) {
      const SIZES = [[390, 664], [375, 560], [360, 740], [390, 820]];
      const fits = (p, btn) => p.evaluate(btn => { const b = document.querySelector('#modalBox'), n = document.querySelector(btn).getBoundingClientRect(); return { sh: b.scrollHeight, ch: b.clientHeight, btn: Math.round(n.bottom), vh: innerHeight }; }, btn);
      const p = await t.phone({ state: PLAYER, db: new FakeDB({ scores: FAM }), size: SIZES[0] });
      await startLevel(p, 12);
      await p.evaluate(() => { __mj.G.usedHint = true; });   // 2 stars: the extra line on the win screen too
      await solve(p, 3800);
      // one win screen, looked at on every screen size
      for (const [w, h] of SIZES) {
        await p.setViewportSize({ width: w, height: h }); await sleep(250);
        const r = await fits(p, '#wNext');
        t.ok(r.sh <= r.ch + 1 && r.btn <= r.vh, `${w}x${h}: win screen fits`, r);
      }
      await p.evaluate(() => document.querySelector('#modal').classList.add('hidden'));
      await p.evaluate(() => __mj.showClimb(3000, 30000, () => {}, 'week')); await sleep(4500);
      for (const [w, h] of SIZES) {
        await p.setViewportSize({ width: w, height: h }); await sleep(250);
        const r = await fits(p, '#clOk');
        t.ok(r.sh <= r.ch + 1 && r.btn <= r.vh, `${w}x${h}: climb fits`, r);
      }
    },
  },
  {
    name: 'screens: short iPhone screens can scroll to the ranking button',
    async run(t, { sleep }) {
      for (const size of [[390, 664], [375, 560], [390, 820]]) {
        const p = await t.phone({ state: { level: 5 }, size, ios: true });
        await p.evaluate(() => document.querySelector('#home').scrollTo(0, 9999)); await sleep(200);
        const r = await p.evaluate(() => ({ bottom: Math.round(document.querySelector('#btnRanking').getBoundingClientRect().bottom), vh: innerHeight }));
        t.ok(r.bottom <= r.vh, `${size.join('x')}: ranking button reachable`, r);
        await p.ctx.close();
      }
    },
  },
];
