/* Playing: tapping fast, face-down tiles, special tiles, winning. */
'use strict';
const free = () => { const G = __mj.G, L = __mj.Layouts; return G.tiles.map((t, i) => i).filter(i => G.alive[i] && L.isFree(i, G.alive, G.nb)); };

module.exports = [
  {
    name: 'play: fast taps, a face-down pair and a daily puzzle won at full speed',
    async run(t, { solve, modal, sleep }) {
      const p = await t.phone({ state: { level: 40 }, size: [360, 740] });
      await p.evaluate(() => __mj.startDaily('2026-10-07')); await sleep(1500);
      // two taps in the same moment on a free pair
      const pair = await p.evaluate(`(${free})()`).then(fr => p.evaluate(fr => { const G = __mj.G; const up = fr.filter(i => !G.down[i]); for (const a of up) for (const c of up) if (a < c && G.tiles[a].face === G.tiles[c].face) return [a, c]; return null; }, fr));
      if (t.ok(pair, 'a free pair exists')) {
        await p.evaluate(([a, c]) => { __mj.onTap(a); __mj.onTap(c); }, pair); await sleep(500);
        t.eq(await p.evaluate(([a, c]) => [__mj.G.alive[a], __mj.G.alive[c], __mj.G.tray.length], pair), [0, 0, 0], 'pair matched at once');
      }
      // a face-down tile and its open twin
      const pp = await p.evaluate(() => { const G = __mj.G, L = __mj.Layouts; const up = [], dn = []; G.tiles.forEach((t, i) => { if (G.alive[i] && L.isFree(i, G.alive, G.nb)) (G.down[i] ? dn : up).push(i); }); for (const d of dn) for (const u of up) if (G.tiles[d].face === G.tiles[u].face && !G.tray.some(x => G.tiles[x].face === G.tiles[u].face)) return [d, u]; return null; });
      if (pp) {
        await p.evaluate(([d]) => __mj.onTap(d), pp); await sleep(300);
        t.eq(await p.evaluate(([d]) => [__mj.G.peek === d, __mj.G.alive[d]], pp), [true, 1], 'first tap turns it over');
        await p.evaluate(([, u]) => __mj.onTap(u), pp); await sleep(600);
        t.eq(await p.evaluate(([d, u]) => [__mj.G.alive[d], __mj.G.alive[u], __mj.G.peek], pp), [0, 0, -1], 'the open twin matches it');
      }
      t.ok(await solve(p, 3000), 'solver finds a way');
      const m = await modal(p);
      t.eq(m && m.title, 'Dagpuzzel gehaald! 👑', 'daily won');
      t.eq(await p.evaluate(() => document.querySelectorAll('.flying,.ghost').length), 0, 'no tiles left flying');
    },
  },
  {
    name: 'play: levels with gold and joker tiles can be finished',
    async run(t, { startLevel, sleep, modal }) {
      const p = await t.phone({ state: { level: 60 } });
      let L = 30, found = null;
      for (; L <= 60 && !found; L++) {
        await startLevel(p, L);
        const r = await p.evaluate(() => { const G = __mj.G; return { joker: G.tiles.some(t => t.face === 101), gold: G.gold.size }; });
        if (r.joker && r.gold) found = L;
      }
      if (!t.ok(found, 'a level with gold and jokers')) return;
      for (let k = 0; k < 400; k++) {
        const r = await p.evaluate(() => { const G = __mj.G; if (G.done) return 'done'; const path = __mj.solveNow(60000); if (!path || !path.length) return 'stuck'; const m = path[0]; __mj.onTap(m); if (G.alive[m] && G.peek === m) __mj.onTap(m); return 'ok'; });
        if (r !== 'ok') { t.eq(r, 'done', 'played to the end'); break; }
        await sleep(60);
      }
      await sleep(3000);
      const s = await p.evaluate(() => __mj.S.stats);
      t.ok(s.gold >= 1, 'gold pair counted', s);
      t.ok((await modal(p) || {}).buttons.includes('wNext'), 'win screen');
    },
  },
  {
    name: 'play: levels 1, 10 and 25 can be won and the next level opens',
    async run(t, { startLevel, solve, modal }) {
      for (const L of [1, 10, 25]) {
        const p = await t.phone({ state: { level: L } });
        await startLevel(p, L);
        t.ok(await solve(p), `level ${L} solved`);
        t.eq(await p.evaluate(() => [__mj.S.level, __mj.S.stars[__mj.G.level]]), [L + 1, 3], `level ${L}: next level open, 3 stars`);
        t.ok((await modal(p) || {}).title, `level ${L}: win screen`);
      }
    },
  },
];
