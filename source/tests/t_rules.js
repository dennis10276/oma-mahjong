/* The rules table (www/js/rules.js): changing a value there really changes the game. */
'use strict';
const DENNIS = { name: 'Dennis', pid: 'test-dennis', level: 12 };
// two free tiles with the same picture, both face up
const freePair = () => { const G = __mj.G, L = __mj.Layouts; const fr = G.tiles.map((t, i) => i).filter(i => G.alive[i] && !G.down[i] && L.isFree(i, G.alive, G.nb)); for (const a of fr) for (const b of fr) if (a < b && G.tiles[a].face === G.tiles[b].face) return [a, b]; return null; };

module.exports = [
  {
    name: 'rules: the help table decides who gets which help (here: Dennis gets grandma\'s)',
    async run(t, { startLevel, fillTray, modal, sleep }) {
      const p = await t.phone({ state: DENNIS, tune: { HELP: { normal: { rescue: true, gentle: 1 } } } });
      await startLevel(p, 12);
      t.eq(await p.evaluate(() => __mj.G.ez), 1, 'the gentle deal');
      await fillTray(p);
      const m = await modal(p);
      t.ok(m && m.buttons.includes('rsBack'), 'putting the tray back is offered', m);
      t.ok(await p.evaluate(() => isCarePlayer('pmuy4wmdp17hbws', 'x') && isCarePlayer('p1', 'Oma Riet') && !isCarePlayer('p1', 'Dennis')), 'grandma is known by her id or an "Oma" name');
    },
  },
  {
    name: 'rules: points, tools and the prize level follow the rules table',
    async run(t, { startLevel, sleep }) {
      const p = await t.phone({ state: { ...DENNIS, level: 6 }, tune: { RULES: { score: { pair: 100 }, tools: { fromLevel: 5 }, sunflower: { level: 5 } } } });
      await startLevel(p, 6);
      t.ok(await p.evaluate(() => !document.querySelector('#btnHint').classList.contains('locked')), 'hint open from level 5');
      const pair = await p.evaluate(freePair);
      if (t.ok(pair, 'a free pair')) {
        await p.evaluate(([a, b]) => { __mj.onTap(a); __mj.onTap(b); }, pair); await sleep(600);
        t.eq(await p.evaluate(() => __mj.G.score), 100, 'a pair is worth 100');
      }
      t.ok(await p.evaluate(() => sunUnlocked()), 'the prize theme after level 5');
    },
  },
  {
    name: 'rules: Hint and Schudden are gone from level 50 (with a one-time message), but not in grandma mode',
    async run(t, { startLevel, solve, click, modal, sleep }) {
      const bar = p => p.evaluate(() => ({ shown: getComputedStyle(document.querySelector('.toolbar')).display !== 'none', open: toolsOpen() }));
      const p = await t.phone({ state: { name: 'Dennis', pid: 'test-dennis', level: 50 } });
      await startLevel(p, 49);
      t.eq(await bar(p), { shown: true, open: true }, 'level 49: still there');
      await startLevel(p, 50);
      t.eq(await bar(p), { shown: false, open: false }, 'level 50: gone');
      const h0 = await p.evaluate(() => { const b = document.querySelector('#board').getBoundingClientRect(); return b.height; });
      t.ok(h0 > 0, 'the pile is drawn');
      await startLevel(p, 49);
      t.ok(await solve(p), 'level 49 won');
      let seen = false;
      await click(p, '#wNext');
      for (let k = 0; k < 10 && !seen; k++) { await sleep(500); const m = await modal(p); if (m && m.buttons.includes('tgOk')) { seen = true; await click(p, '#tgOk'); } else if (m && m.buttons.length) await click(p, '#' + m.buttons[0]); }
      t.ok(seen, 'told once that from level 50 there are no tools');
      t.eq(await p.evaluate(() => __mj.S.toolsGoneSeen), true, 'not again');
      const g = await t.phone({ state: { name: 'OmaHanny', pid: 'test-oma', level: 60 } });
      await startLevel(g, 60);
      t.eq(await bar(g), { shown: true, open: true }, 'grandma mode: still there at level 60');
    },
  },
];
