/* Auto-finish from level 50: only when no order of taps can fill the tray any more. */
'use strict';
const DENNIS = { name: 'Dennis', pid: 'test-dennis', level: 60 };
// a row of tiles (x 0, 2, 4, ...): only the two ends are free
const row = (faces, tray, down = []) => `(() => {
  const tiles = ${JSON.stringify(faces)}.map((f, k) => ({ x: k * 2, y: 0, z: 0, face: f }));
  const nb = Layouts.neighbors(tiles);
  return finishSafe({ faces: tiles.map(t => t.face), nb, alive: new Uint8Array(tiles.length).fill(1), down: new Uint8Array(tiles.length).map((x, k) => ${JSON.stringify(down)}.includes(k) ? 1 : 0), tray: ${JSON.stringify(tray)} });
})()`;

module.exports = [
  {
    name: 'auto-finish: the check is exact (safe only when no order of taps can fill the tray)',
    async run(t) {
      const p = await t.phone({ state: DENNIS });
      t.eq(await p.evaluate(row([1, 1, 2, 2], [])), true, 'two pairs, empty tray: safe');
      t.eq(await p.evaluate(row([5, 3, 4, 5], [3, 4])), true, 'tray of 2, both ends match each other: safe');
      t.eq(await p.evaluate(row([5, 3, 4, 6, 5], [3, 4, 6])), false, 'tray of 3: taking a 5 fills it: not safe');
      t.eq(await p.evaluate(row([5, 6, 7, 8, 8, 7, 6, 5], [])), false, 'four different ends can be taken in a bad order: not safe');
      t.eq(await p.evaluate(row([5, 6, 6, 5], [1, 2])), false, 'tray of 2 + a 5 and a 6 = a full tray: not safe');
      t.eq(await p.evaluate(row([1, 2, 2, 1], [])), true, 'nested pairs with an empty tray: safe');
    },
  },
  {
    name: 'auto-finish: at level 50+ the end plays itself once it cannot go wrong; not before level 50',
    async run(t, { startLevel, sleep, modal }) {
      for (const [lv, expect] of [[55, true], [40, false]]) {
        const p = await t.phone({ state: { ...DENNIS, level: lv } });
        await startLevel(p, lv);
        // play the solver's moves until 6 tiles are left (each tap waits a little, like a person)
        const path = await p.evaluate(() => __mj.solveNow(80000));
        t.ok(path && path.length, `level ${lv}: solvable`);
        for (const m of path) {
          if (await p.evaluate(() => __mj.G.alive.reduce((a, b) => a + b, 0)) <= 6) break;
          await p.evaluate(m => { const G = __mj.G; if (!G.alive[m]) return; __mj.onTap(m); if (G.alive[m]) __mj.onTap(m); }, m);
          await sleep(60);
        }
        await sleep(6000);
        const st = await p.evaluate(() => ({ done: !!__mj.G.done, auto: !!__mj.G.autoFin }));
        if (expect) {
          t.eq(st, { done: true, auto: true }, `level ${lv}: the last tiles went by themselves`);
          t.ok(p.db.plays('test-dennis').some(e => e.k === 'auto' && e.lv === lv), 'logged for the dashboard');
          t.ok(await modal(p), 'win screen');
        } else t.eq(st, { done: false, auto: false }, `level ${lv}: nothing happens by itself`);
      }
    },
  },
  {
    name: 'auto-finish: fast enough on real end positions',
    async run(t, { startLevel }) {
      const p = await t.phone({ state: DENNIS });
      await startLevel(p, 70);
      const r = await p.evaluate(() => {
        const G = __mj.G, path = __mj.solveNow(80000), alive = Uint8Array.from(G.alive), faces = G.tiles.map(t => t.face);
        // walk the solution and check every position with at most 24 tiles left (tray left empty: worst case is slower)
        let worst = 0, checks = 0, removed = new Set();
        for (const m of path) {
          alive[m] = 0;
          const left = alive.reduce((a, b) => a + b, 0);
          if (left > 24 || left === 0) continue;
          const t0 = performance.now();
          finishSafe({ faces, nb: G.nb, alive, down: G.down, tray: [] });
          worst = Math.max(worst, performance.now() - t0); checks++;
        }
        return { worst, checks };
      });
      t.ok(r.checks > 5 && r.worst < 400, 'every check within 0.4 s', r);
    },
  },
];
