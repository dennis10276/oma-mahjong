/* Grandma keeps one thing: her own, easier levels. Everything else she used to get is gone. */
'use strict';
const OMA = { name: 'OmaHanny', pid: 'test-oma', level: 12 };
const DENNIS = { name: 'Dennis', pid: 'test-dennis', level: 12 };

module.exports = [
  {
    name: 'grandma: old switches for deleted parts are ignored',
    async run(t, { FakeDB, startLevel, fillTray, modal, click, sleep }) {
      const db = new FakeDB({ scores: {}, plays: { 'test-cfg-oma': {
        a: { k: 'cfg', t: 1, news: false }, b: { k: 'cfg', t: 2, nudge: false }, c: { k: 'cfg', t: 3, pro: false }, d: { k: 'cfg', t: 4, rescue: true },
        e: { k: 'cfg', t: 5, adapt: true }, f: { k: 'cfg', t: 6, gentle: true }, g: { k: 'cfg', t: 7, retry: true } } } });
      const p = await t.phone({ state: OMA, db });
      await p.evaluate(async () => { await loadCfg(); });
      t.ok(await p.evaluate(() => careMode()), 'grandma is recognised');
      await startLevel(p, 12);
      t.eq(await p.evaluate(() => [__mj.G.o.track, __mj.G.ez]), ['care', 0], 'her own levels, no gentler deal on top');
      t.eq(await fillTray(p), 4, 'tray full');
      const m = await modal(p);
      t.ok(m && m.buttons.includes('sRetry') && !m.buttons.includes('rsBack') && !m.buttons.includes('rsRetry'), 'a full tray ends the level, as for others', m);
      t.eq(await p.evaluate(() => __mj.S.fails.L12), 1, 'one failed try counted');
      for (let k = 0; k < 3; k++) { await click(p, '#sRetry'); await sleep(900); t.eq(await p.evaluate(() => __mj.G.ez), 0, 'retries stay as they were'); await fillTray(p); }
      t.eq(await p.evaluate(() => [Object.keys(help()).sort().join(), help().lucky.fromLevel, help().toolsGoneFrom]), ['comboMs,jokersGoneFrom,lucky,toolsGoneFrom', 10, 50], 'she gets the help everyone gets');
      t.eq(await p.evaluate(() => PARTS.map(x => x.id)), ['levels'], 'one part is left');
      t.eq(p.errors, [], 'no page errors');
    },
  },
  {
    name: 'others: a full tray simply ends the level, retries stay the same',
    async run(t, { startLevel, fillTray, modal, click, sleep }) {
      const p = await t.phone({ state: DENNIS });
      t.ok(!(await p.evaluate(() => careMode())), 'Dennis is not in grandma mode');
      await startLevel(p, 12);
      const faces0 = await p.evaluate(() => __mj.G.tiles.map(t => t.face).join());
      t.eq(await fillTray(p), 4, 'tray full');
      const m = await modal(p);
      t.ok(m && m.buttons.includes('sRetry') && !m.buttons.includes('rsBack'), 'game over', m);
      for (let k = 0; k < 3; k++) {
        await click(p, '#sRetry'); await sleep(900);
        t.eq(await p.evaluate(() => __mj.G.ez), 0, 'no easier retry');
        t.eq(await p.evaluate(() => __mj.G.tiles.map(t => t.face).join()), faces0, '"Opnieuw" gives the same deal');
        await fillTray(p);
      }
    },
  },
  {
    name: 'grandma levels: grandma plays her own gentler levels with the same points; others the normal ones',
    async run(t, { startLevel, solve, sleep }) {
      const p = await t.phone({ state: { ...OMA, level: 40 } });
      await startLevel(p, 35);
      const g = await p.evaluate(() => { const G = __mj.G; return { track: G.o.track, down: G.down.reduce((a, b) => a + b, 0), n: G.tiles.length, scale: G.ptsScale }; });
      t.eq(g.track, 'care', 'her own set of levels');
      t.ok(g.down <= 3, 'at most 3 face-down tiles at level 35', g);
      t.ok(g.scale > 1 && Math.abs(g.scale * g.n - 86) <= 6, 'her smaller pile scores like the normal one', g);
      t.ok(p.db.plays('test-oma').some(e => e.k === 'start' && e.lv === 35 && e.tk === 'care'), 'logged for the dashboard');
      t.ok(await p.evaluate(() => !!__mj.G.ob), 'ice at level 35, like everyone');
      const q = await t.phone({ state: { ...DENNIS, level: 40 } });
      await startLevel(q, 35);
      t.eq(await q.evaluate(() => [__mj.G.o.track || '', __mj.G.down.reduce((a, b) => a + b, 0) > 10]), ['', true], 'Dennis: the normal levels');
      // a level saved from the old (normal) deal is not resumed into grandma's new levels
      await q.evaluate(() => { const c = JSON.parse(localStorage.getItem('omamj.cur')); localStorage.setItem('omamj.cur', JSON.stringify(c)); __mj.S.name = 'OmaHanny'; });
      await startLevel(q, 35, false);
      t.eq(await q.evaluate(() => __mj.G.o.track), 'care', 'switching to grandma mode: her own deal, not the saved normal one');
      t.ok(await solve(q), 'and it can be cleared');
    },
  },
];
