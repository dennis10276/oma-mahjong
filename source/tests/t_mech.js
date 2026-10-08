/* 1.18: the joker fits every picture, no more gifts, ice from level 35, lock & key from level 45. */
'use strict';
const DENNIS = { name: 'Dennis', pid: 'test-dennis' };
const findLevel = async (p, startLevel, from, to, test) => {
  for (let L = from; L <= to; L++) { await startLevel(p, L); if (await p.evaluate(test)) return L; }
  return null;
};
// play the level to the end with the solver that knows ice and locks; report what happened on the way
const playOut = page => page.evaluate(async () => {
  const G = __mj.G, seen = { refused: 0, melted: 0, unlocked: false, steps: 0 };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  for (let s = 0; s < 400 && !G.done; s++) {
    // now and then: try a frozen or locked tile that is otherwise free: it must stay put
    const blocked = G.tiles.findIndex((t, i) => G.alive[i] && __mj.Layouts.isFree(i, G.alive, G.nb) && !__mj.canTake(i));
    if (blocked >= 0 && seen.refused < 3) { __mj.onTap(blocked); if (G.alive[blocked]) seen.refused++; else return { error: 'a frozen or locked tile was taken' }; }
    const path = __mj.solveNow(60000);
    if (!path || !path.length) return { error: 'no way forward', steps: s, seen };
    const m = path[0]; __mj.onTap(m); if (G.alive[m] && G.peek === m) __mj.onTap(m);
    seen.steps++;
    await wait(300);
  }
  if (G.ob) { seen.melted = Object.values(G.ob.left).filter(v => v === 0).length; seen.unlocked = G.ob.unlocked; }
  return seen;
});

module.exports = [
  {
    name: 'mechanics: no more gift tiles; gold and joker still come',
    async run(t, { startLevel }) {
      const p = await t.phone({ state: { ...DENNIS, level: 60 } });
      let gifts = 0, jokers = 0, gold = 0;
      for (let L = 25; L <= 44; L++) { await startLevel(p, L); const r = await p.evaluate(() => { const G = __mj.G; return [G.tiles.some(t => t.face === 100), G.tiles.some(t => t.face === 101), G.gold.size > 0]; }); gifts += r[0]; jokers += r[1]; gold += r[2]; }
      t.eq(gifts, 0, 'no gift tiles');
      t.ok(jokers >= 5 && gold >= 15, 'jokers and gold pairs still there', { jokers, gold });
    },
  },
  {
    name: 'joker: takes a tile out of the tray together with its twin; with an empty tray it waits',
    async run(t, { startLevel, sleep }) {
      const p = await t.phone({ state: { ...DENNIS, level: 40 } });
      // make a free tile a joker by swapping pictures with a joker tile (counts stay the same)
      const setup = () => p.evaluate(() => {
        const G = __mj.G, L = __mj.Layouts, free = i => G.alive[i] && !G.down[i] && __mj.canTake(i);
        const jokers = G.tiles.map((t, i) => i).filter(i => G.tiles[i].face === 101);
        if (!jokers.length) return null;
        let j = jokers.find(free);
        if (j === undefined) {
          const u = G.tiles.findIndex((t, i) => free(i) && t.face < 100 && !jokers.includes(i));
          const f = G.tiles[u].face; G.tiles[u].face = 101; G.tiles[jokers[0]].face = f;
          for (const i of [u, jokers[0]]) G.tiles[i].el.querySelector('.face').innerHTML = Tiles.faceHTML(__mj.S.theme, G.tiles[i].face);
          j = u;
        }
        return j;
      });
      const L = await findLevel(p, startLevel, 30, 60, () => __mj.G.tiles.some(t => t.face === 101));
      if (!t.ok(L, 'a level with jokers')) return;
      let j = await setup();
      // put a tile in the tray whose twin is not free
      const x = await p.evaluate(j => { const G = __mj.G, c = i => G.alive[i] && !G.down[i] && __mj.canTake(i); const x = G.tiles.findIndex((t, i) => i !== j && c(i) && t.face < 100 && !G.tiles.some((u, k) => k !== i && c(k) && u.face === t.face)); __mj.onTap(x); return x; }, j);
      await sleep(400);
      const before = await p.evaluate(x => ({ tray: __mj.G.tray.length, twins: __mj.G.tiles.filter((t, k) => k !== x && __mj.G.alive[k] && t.face === __mj.G.tiles[x].face).length }), x);
      t.eq(before.tray, 1, 'one tile waiting');
      await p.evaluate(j => __mj.onTap(j), j); await sleep(700);
      const after = await p.evaluate(([x, j]) => ({ tray: __mj.G.tray.length, j: __mj.G.alive[j], twins: __mj.G.tiles.filter((t, k) => k !== x && __mj.G.alive[k] && t.face === __mj.G.tiles[x].face).length }), [x, j]);
      t.eq(after, { tray: 0, j: 0, twins: before.twins - 1 }, 'joker, the tray tile and its twin are gone');
      // the other joker with an empty tray: waits, then takes the next tile and its twin
      j = await setup();
      if (j !== null) {
        await p.evaluate(j => __mj.onTap(j), j); await sleep(400);
        t.eq(await p.evaluate(() => __mj.G.tray.map(t => __mj.G.tiles[t].face)), [101], 'joker waits in the tray');
        const y = await p.evaluate(() => { const G = __mj.G; const y = G.tiles.findIndex((t, i) => G.alive[i] && !G.down[i] && __mj.canTake(i) && t.face < 100); const f = G.tiles[y].face; const n0 = G.tiles.filter((t, k) => G.alive[k] && t.face === f).length; __mj.onTap(y); return { y, f, n0 }; });
        await sleep(700);
        const n1 = await p.evaluate(f => __mj.G.tiles.filter((t, k) => __mj.G.alive[k] && t.face === f).length, y.f);
        t.eq([await p.evaluate(() => __mj.G.tray.length), y.n0 - n1], [0, 2], 'next tile and its twin taken with the joker');
      }
      t.ok(await p.evaluate(() => __mj.S.stats.jokers >= 1), 'counted');
    },
  },
  {
    name: 'ice (level 35+): frozen tiles stay put until tiles around them are gone; level can be won',
    async run(t, { startLevel, sleep, modal }) {
      const p = await t.phone({ state: { ...DENNIS, level: 40 } });
      const L = await findLevel(p, startLevel, 35, 44, () => !!(__mj.G.ob && Object.keys(__mj.G.ob.need).length));
      if (!t.ok(L, 'a level with ice')) return;
      t.ok(await p.evaluate(() => document.querySelectorAll('#board .ob[data-k^="ice"]').length >= 2), 'ice drawn on the tiles');
      const r = await playOut(p);
      t.ok(!r.error, 'played to the end', r);
      t.ok(r.melted >= 2, 'the ice melted on the way', r);
      await sleep(3500);
      t.ok((await modal(p) || {}).buttons.includes('wNext'), 'won');
    },
  },
  {
    name: 'lock & key (level 45+): locked tiles open after the key pair; level can be won',
    async run(t, { startLevel, sleep, modal }) {
      const p = await t.phone({ state: { ...DENNIS, level: 50 } });
      const L = await findLevel(p, startLevel, 45, 52, () => !!(__mj.G.ob && __mj.G.ob.keys.length));
      if (!t.ok(L, 'a level with lock and key')) return;
      t.ok(await p.evaluate(() => document.querySelectorAll('#board .ob[data-k="lock"]').length >= 2 && document.querySelectorAll('#board .ob[data-k="key"]').length === 2), 'locks and keys drawn');
      // keys keep the same picture
      t.ok(await p.evaluate(() => { const [a, b] = __mj.G.ob.keys; return __mj.G.tiles[a].face === __mj.G.tiles[b].face; }), 'the two keys are a pair');
      const r = await playOut(p);
      t.ok(!r.error && r.unlocked, 'played to the end, locks opened', r);
      await sleep(3500);
      t.ok((await modal(p) || {}).buttons.includes('wNext'), 'won');
    },
  },
  {
    name: 'mechanics: below level 35 nothing new; first time ice shows up it is explained',
    async run(t, { startLevel, sleep, modal }) {
      const p = await t.phone({ state: { ...DENNIS, level: 40 } });
      for (const L of [20, 30, 34]) { await startLevel(p, L); t.eq(await p.evaluate(() => __mj.G.ob), null, `level ${L}: no ice or locks`); }
      const q = await t.phone({ state: { ...DENNIS, level: 40, seenSp: { gold: 1, joker2: 1 } } });
      await q.evaluate(() => { localStorage.removeItem('omamj.cur'); __mj.startLevel(35); }); await sleep(1800);
      const m = await modal(q);
      t.ok(m && /Bevroren/.test(m.title), 'ice explained', m);
    },
  },
  {
    name: 'mechanics: never stuck because of ice or locks alone',
    async run(t, { startLevel, sleep }) {
      const p = await t.phone({ state: { ...DENNIS, level: 40 } });
      await startLevel(p, 36);
      const r = await p.evaluate(() => {
        const G = __mj.G;
        // freeze every tile that is free right now
        G.ob = G.ob || { need: {}, left: {}, locks: new Set(), keys: [], unlocked: true }; G.inb = G.inb || __mj.Layouts.iceNeighbors(G.tiles);
        G.tiles.forEach((t, i) => { if (__mj.Layouts.isFree(i, G.alive, G.nb)) { G.ob.need[i] = 9; G.ob.left[i] = 9; } });
        const before = G.tiles.some((t, i) => __mj.canTake(i));
        obRelief();
        return { before, after: G.tiles.some((t, i) => __mj.canTake(i)) };
      });
      t.eq(r, { before: false, after: true }, 'the ice gives way');
    },
  },
];
