/* Grandma's extra help: the tray rescue and easier retries, and that nobody else gets them. */
'use strict';
const OMA = { name: 'OmaHanny', pid: 'test-oma', level: 12 };
const DENNIS = { name: 'Dennis', pid: 'test-dennis', level: 12 };
const kinds = page => page.evaluate(() => new Set(__mj.G.tiles.map(t => t.face)).size);

module.exports = [
  {
    name: 'grandma: a full tray offers to put the tiles back, once per level',
    async run(t, { startLevel, fillTray, modal, click, solve, sleep }) {
      const p = await t.phone({ state: OMA });
      t.ok(await p.evaluate(() => careMode()), 'grandma is recognised');
      await startLevel(p, 12);
      const alive0 = await p.evaluate(() => __mj.G.alive.reduce((a, b) => a + b, 0));
      t.eq(await fillTray(p), 4, 'tray full');
      let m = await modal(p);
      t.ok(m && m.buttons.includes('rsBack') && m.buttons.includes('rsRetry'), 'rescue offered', m);
      await click(p, '#rsBack'); await sleep(900);
      const g = await p.evaluate(() => { const G = __mj.G; return { tray: G.tray.length, alive: G.alive.reduce((a, b) => a + b, 0), rescued: G.rescued, busy: G.busy, hidden: G.tiles.filter((t, i) => G.alive[i] && (t.el.classList.contains('hidden') || t.el.classList.contains('returning'))).length }; });
      t.eq(g, { tray: 0, alive: alive0, rescued: true, busy: false, hidden: 0 }, 'tiles back on the board');
      t.eq(await modal(p), null, 'pop-up closed');
      // the rescue survives closing the app
      await p.reload(); await p.waitForFunction(() => window.__mjReady); await sleep(300);
      await p.evaluate(() => __mj.startLevel(12)); await sleep(800);
      t.ok(await p.evaluate(() => __mj.G.rescued), 'still used after reopening');
      // second time: the normal game over
      await fillTray(p);
      m = await modal(p);
      t.ok(m && m.buttons.includes('sRetry') && !m.buttons.includes('rsBack'), 'second full tray ends the level', m);
      t.eq(await p.evaluate(() => __mj.S.fails.L12), 1, 'one failed try counted');
      await click(p, '#sRetry'); await sleep(900);
      t.eq(await p.evaluate(() => __mj.G.rescued), false, 'a new try has its rescue back');
      const ev = p.db.plays('test-oma');
      t.ok(ev.some(e => e.k === 'rescue' && e.lv === 12), 'rescue logged for the dashboard');
      t.ok(ev.some(e => e.k === 'end' && e.r === 'stuck' && e.rb === 1), 'the end after a rescue is marked');
    },
  },
  {
    name: 'grandma: a rescued level gives one star less',
    async run(t, { startLevel, fillTray, click, solve, sleep }) {
      const p = await t.phone({ state: OMA });
      await startLevel(p, 12);
      await fillTray(p); await click(p, '#rsBack'); await sleep(900);
      t.ok(await solve(p), 'level solvable after the rescue');
      t.eq(await p.evaluate(() => __mj.S.stars[12]), 2, 'two stars');
      t.ok((await p.evaluate(() => document.querySelector('#modalBox').innerText)).includes('Zonder terugleggen'), 'win screen says why');
      t.ok(p.db.plays('test-oma').some(e => e.k === 'end' && e.r === 'win' && e.rb === 1), 'win logged with the rescue');
    },
  },
  {
    name: 'others: a full tray simply ends the level, retries stay the same',
    async run(t, { startLevel, fillTray, modal, click, sleep }) {
      const p = await t.phone({ state: DENNIS });
      t.ok(!(await p.evaluate(() => careMode())), 'Dennis gets no extra help');
      await startLevel(p, 12);
      const faces0 = await p.evaluate(() => __mj.G.tiles.map(t => t.face).join());
      t.eq(await fillTray(p), 4, 'tray full');
      // a 5th tile that would match is refused once the tray is full
      const fifth = await p.evaluate(() => { const G = __mj.G, L = __mj.Layouts; const tf = new Set(G.tray.map(t => G.tiles[t].face)); const i = G.tiles.findIndex((t, i) => G.alive[i] && L.isFree(i, G.alive, G.nb) && tf.has(t.face)); if (i < 0) return 'none'; __mj.onTap(i); return G.alive[i]; });
      t.ok(fifth === 'none' || fifth === 1, 'no taps after the tray is full', fifth);
      const m = await modal(p);
      t.ok(m && m.buttons.includes('sRetry') && !m.buttons.includes('rsBack'), 'game over, no rescue', m);
      for (let k = 0; k < 3; k++) {
        await click(p, '#sRetry'); await sleep(900);
        t.eq(await p.evaluate(() => __mj.G.ez), 0, 'no easier retry for Dennis');
        t.eq(await p.evaluate(() => __mj.G.tiles.map(t => t.face).join()), faces0, '"Opnieuw" gives the same deal');
        await fillTray(p);
      }
    },
  },
  {
    name: 'grandma: only after three failed tries the level gets easier',
    async run(t, { startLevel, fillTray, click, solve, sleep }) {
      const p = await t.phone({ state: OMA });
      await startLevel(p, 12);
      t.eq(await p.evaluate(() => __mj.G.ez), 1, 'grandma always gets the gentle deal');
      const k0 = await kinds(p), n0 = await p.evaluate(() => __mj.G.tiles.length);
      for (let k = 0; k < 3; k++) {
        if (k === 2) t.eq(await p.evaluate(() => __mj.G.ez), 1, 'after two failed tries still her normal level');
        await fillTray(p); await click(p, '#rsRetry'); await sleep(900);
      }
      t.eq(await p.evaluate(() => __mj.S.fails.L12), 3, 'three failed tries');
      t.eq(await p.evaluate(() => __mj.G.ez), 2, 'fourth try is easier');
      t.eq(await p.evaluate(() => __mj.G.tiles.length), n0, 'same pile size');
      const k1 = await kinds(p);
      t.ok(k1 < k0, 'fewer different pictures', { before: k0, after: k1 });
      const faces1 = await p.evaluate(() => __mj.G.tiles.map(t => t.face).join());
      // reopening the app continues the same easier deal
      await p.evaluate(() => { const G = __mj.G; const L = __mj.Layouts; const i = G.tiles.findIndex((t, i) => G.alive[i] && !G.down[i] && L.isFree(i, G.alive, G.nb)); __mj.onTap(i); });
      await sleep(500);
      await p.reload(); await p.waitForFunction(() => window.__mjReady); await sleep(300);
      await p.evaluate(() => __mj.startLevel(12)); await sleep(800);
      t.eq(await p.evaluate(() => [__mj.G.ez, __mj.G.tiles.map(t => t.face).join()]), [2, faces1], 'resumed with the same easy deal');
      t.ok(await solve(p), 'easy deal is solvable');
      t.eq(await p.evaluate(() => (__mj.S.fails || {}).L12), undefined, 'winning clears the failed tries');
      const ev = p.db.plays('test-oma');
      t.ok(ev.some(e => e.k === 'start' && e.lv === 12 && e.ez === 2), 'easier start logged');
      // the next level starts normal again
      await startLevel(p, 13);
      t.eq(await p.evaluate(() => __mj.G.ez), 1, 'next level: back to her gentle normal');
    },
  },
  {
    name: 'grandma: many failed tries do not make it easier than the one step',
    async run(t, { startLevel }) {
      const p = await t.phone({ state: { ...OMA, level: 30, fails: { L30: 4 } } });
      await startLevel(p, 30);
      t.eq(await p.evaluate(() => __mj.G.ez), 2, 'one easier step, no more');
      const q = await t.phone({ state: { ...DENNIS, level: 30, fails: { L30: 4 } } });
      await startLevel(q, 30);
      t.eq(await q.evaluate(() => __mj.G.ez), 0, 'Dennis: still the normal level');
    },
  },
  {
    name: 'shuffle: grandma keeps it for later when she presses it right at the start; others can always',
    async run(t, { startLevel, click, sleep }) {
      const p = await t.phone({ state: { ...OMA, level: 16 } });
      await startLevel(p, 16); await sleep(300);
      await click(p, '#btnShuffle'); await sleep(400);
      t.eq(await p.evaluate(() => __mj.G.usedShuffle), false, 'not used, star kept');
      t.ok(/Bewaar schudden/.test(await p.evaluate(() => document.querySelector('#gameMsg').innerText)), 'tells her why');
      // after playing a few pairs it works, and the pictures stay the same set
      const path = await p.evaluate(() => __mj.solveNow(60000));
      for (const m of path.slice(0, 10)) { await p.evaluate(m => { const G = __mj.G; if (!G.alive[m]) return; __mj.onTap(m); if (G.alive[m]) __mj.onTap(m); }, m); await sleep(280); }
      const before = await p.evaluate(() => { const G = __mj.G, c = {}; G.tiles.forEach((t, i) => { if (G.alive[i]) c[t.face] = (c[t.face] || 0) + 1; }); return c; });
      await click(p, '#btnShuffle'); await sleep(1300);
      const after = await p.evaluate(() => { const G = __mj.G, c = {}; G.tiles.forEach((t, i) => { if (G.alive[i]) c[t.face] = (c[t.face] || 0) + 1; }); return c; });
      t.eq(await p.evaluate(() => __mj.G.usedShuffle), true, 'shuffled after playing');
      t.eq(after, before, 'same pictures, new places');
      t.ok(await p.evaluate(() => !!__mj.solveNow(60000)), 'still solvable');
      const q = await t.phone({ state: { ...DENNIS, level: 16 } });
      await startLevel(q, 16); await sleep(300);
      await click(q, '#btnShuffle'); await sleep(1200);
      t.eq(await q.evaluate(() => __mj.G.usedShuffle), true, 'Dennis can shuffle at the start');
    },
  },
  {
    name: 'grandma: her own results move the difficulty by half steps, only when a new level starts',
    async run(t, { startLevel, solve, fillTray, click, sleep }) {
      const bad = [0, 1, 0, 0, 0.5, 0, 1, 0, 0, 0];      // 25% won
      const p = await t.phone({ state: { ...OMA, adapt: { step: 0, hist: bad, since: 6, key: 'L11' } } });
      await startLevel(p, 12);
      t.eq(await p.evaluate(() => [__mj.S.adapt.step, __mj.G.ez, __mj.S.adapt.since]), [1, 1.5, 0], 'won too little: half a step easier');
      let ev = p.db.plays('test-oma');
      t.ok(ev.some(e => e.k === 'adapt' && e.from === 0 && e.to === 1 && e.rate === 25), 'change logged for the dashboard', ev.filter(e => e.k === 'adapt'));
      t.ok(ev.some(e => e.k === 'start' && e.lv === 12 && e.ad === 1 && e.ez === 1.5), 'start logged with her step');
      // a failed try is remembered; the retry keeps the same step and the same deal
      const faces = await p.evaluate(() => __mj.G.tiles.map(t => t.face).join());
      await fillTray(p); await click(p, '#rsRetry'); await sleep(900);
      t.eq(await p.evaluate(() => [__mj.S.adapt.step, __mj.G.ez, __mj.S.adapt.hist.slice(-1)[0], __mj.S.adapt.since]), [1, 1.5, 0, 1], 'retry: same step, the stuck try counted');
      t.eq(await p.evaluate(() => __mj.G.tiles.map(t => t.face).join()), faces, 'retry: same deal');
      t.ok(await solve(p), 'easier deal solvable');
      t.eq(await p.evaluate(() => [__mj.S.adapt.hist.slice(-1)[0], __mj.S.adapt.since]), [1, 2], 'the win counted');
      // the next level: too few tries since the change, so no new change yet
      await startLevel(p, 13);
      t.eq(await p.evaluate(() => [__mj.S.adapt.step, __mj.G.ez]), [1, 1.5], 'no change after only 2 tries');
    },
  },
  {
    name: 'grandma: winning a lot moves her back towards the normal level, never past it',
    async run(t, { startLevel }) {
      const good = [1, 1, 1, 1, 1, 1, 1, 0.5, 1, 1];
      const p = await t.phone({ state: { ...OMA, level: 20, adapt: { step: -1, hist: good, since: 5, key: 'L19' } } });
      await startLevel(p, 20);
      t.eq(await p.evaluate(() => [__mj.S.adapt.step, __mj.G.ez]), [-2, 0], 'one half step harder: now the normal level');
      await p.evaluate(() => { __mj.S.adapt.since = 9; __mj.S.adapt.key = 'L19'; }); await startLevel(p, 21);
      t.eq(await p.evaluate(() => [__mj.S.adapt.step, __mj.G.ez]), [-2, 0], 'not harder than normal');
      // in between 60% and 85%: stays
      const q = await t.phone({ state: { ...OMA, level: 20, adapt: { step: 0, hist: [1, 1, 0, 1, 1, 0, 1, 0, 1, 1], since: 8, key: 'L19' } } });
      await startLevel(q, 20);
      t.eq(await q.evaluate(() => [__mj.S.adapt.step, __mj.G.ez]), [0, 1], '70% won: stays at her gentle level');
      // the 3-failed-tries help still comes on top
      const r = await t.phone({ state: { ...OMA, level: 20, fails: { L20: 3 }, adapt: { step: 1, hist: [], since: 0, key: 'L20' } } });
      await startLevel(r, 20);
      t.eq(await r.evaluate(() => __mj.G.ez), 2.5, 'step +1 and 3 failed tries: 2.5');
    },
  },
  {
    name: 'others: results do not change their levels',
    async run(t, { startLevel, fillTray, click, sleep }) {
      const p = await t.phone({ state: { ...DENNIS, adapt: { step: 0, hist: [0, 0, 0, 0, 0, 0], since: 6, key: 'L11' } } });
      await startLevel(p, 12);
      await fillTray(p); await click(p, '#sRetry'); await sleep(900);
      t.eq(await p.evaluate(() => [__mj.G.ez, __mj.S.adapt.step, __mj.S.adapt.hist.length]), [0, 0, 6], 'Dennis: normal level, nothing recorded');
      t.ok(!p.db.plays('test-dennis').some(e => e.k === 'adapt' || (e.k === 'start' && e.ad != null)), 'no step in his log');
    },
  },
];
