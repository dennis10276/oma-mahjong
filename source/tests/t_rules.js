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
];
