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
    name: 'grandma: after two failed tries the level gets easier',
    async run(t, { startLevel, fillTray, click, solve, sleep }) {
      const p = await t.phone({ state: OMA });
      await startLevel(p, 12);
      t.eq(await p.evaluate(() => __mj.G.ez), 1, 'grandma always gets the gentle deal');
      const k0 = await kinds(p), n0 = await p.evaluate(() => __mj.G.tiles.length);
      for (let k = 0; k < 2; k++) { await fillTray(p); await click(p, '#rsRetry'); await sleep(900); }
      t.eq(await p.evaluate(() => __mj.S.fails.L12), 2, 'two failed tries');
      t.eq(await p.evaluate(() => __mj.G.ez), 2, 'third try is easier');
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
    name: 'grandma: after four failed tries even easier, no face-down tiles',
    async run(t, { startLevel }) {
      const p = await t.phone({ state: { ...OMA, level: 30, fails: { L30: 4 } } });
      await startLevel(p, 30);
      t.eq(await p.evaluate(() => __mj.G.ez), 3, 'ease level 3');
      t.eq(await p.evaluate(() => __mj.G.down.reduce((a, b) => a + b, 0)), 0, 'no face-down tiles');
      const q = await t.phone({ state: { ...DENNIS, level: 30, fails: { L30: 4 } } });
      await startLevel(q, 30);
      t.eq(await q.evaluate(() => __mj.G.ez), 0, 'Dennis: still the normal level');
    },
  },
];
