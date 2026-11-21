/* 1.15: no messages over the pile, and the little rewards. */
'use strict';
const OMA = { name: 'OmaHanny', pid: 'test-oma', level: 12 };
const DENNIS = { name: 'Dennis', pid: 'test-dennis', level: 12 };
const overlaps = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);

// make tile d (face down, free) and u (face up, free) a pair, keeping every picture count even:
// u swaps pictures with another tile w that has d's picture
const makeHiddenPair = () => {
  const G = __mj.G, L = __mj.Layouts, fr = G.tiles.map((t, i) => i).filter(i => G.alive[i] && L.isFree(i, G.alive, G.nb) && G.tiles[i].face < 100);
  const d = fr.find(i => G.down[i]);
  if (d === undefined) return null;
  const f = G.tiles[d].face;
  const u = fr.find(i => !G.down[i] && i !== d && G.tiles[i].face !== f && G.tiles.some((t, k) => k !== d && k !== i && t.face === f));
  if (u === undefined) return null;
  const w = G.tiles.findIndex((t, i) => i !== d && i !== u && t.face === f);
  const fu = G.tiles[u].face; G.tiles[u].face = f; G.tiles[w].face = fu;
  for (const i of [u, w]) G.tiles[i].el.querySelector('.face').innerHTML = Tiles.faceHTML(__mj.S.theme, G.tiles[i].face);
  return [d, u];
};

module.exports = [
  {
    name: 'messages: while playing nothing appears over the pile',
    async run(t, { startLevel, sleep }) {
      const p = await t.phone({ state: OMA, size: [390, 664] });
      await startLevel(p, 12);
      await p.evaluate(() => { toast('🍀 Geluksmoment! Pak snel de glinsterende steen', 3000); }); await sleep(400);
      const r = await p.evaluate(() => { const box = e => e.getBoundingClientRect().toJSON(); return { msg: box(document.querySelector('#gameMsg')), board: box(document.querySelector('#boardWrap')), text: document.querySelector('#gameMsg').innerText, toast: document.querySelector('#toast').classList.contains('on') }; });
      t.ok(/Geluksmoment/.test(r.text), 'message in the top bar', r.text);
      t.ok(!r.toast, 'no floating toast while playing');
      t.ok(!overlaps(r.msg, r.board), 'message is not over the pile', r);
      await p.evaluate(() => __mj.maybeLucky && praise('Halverwege! 💪')); await sleep(1500);
      t.ok(/Halverwege/.test(await p.evaluate(() => document.querySelector('#gameMsg').innerText)), 'praise there too, after the first message was readable');
      t.eq(await p.evaluate(() => document.querySelectorAll('#praise').length), 0, 'the old praise text over the board is gone');
      // points come out of the score counter, not out of the pile
      await p.evaluate(() => floatScore('+20'));
      const f = await p.evaluate(() => document.querySelector('.float.sc').getBoundingClientRect().toJSON());
      const b = await p.evaluate(() => document.querySelector('#boardWrap').getBoundingClientRect().toJSON());
      t.ok(f.bottom <= b.top + 2, 'points float above the pile', { f, b });
      // outside a level the normal toast is used
      await p.evaluate(() => __mj.show('home')); await p.evaluate(() => toast('hallo')); await sleep(100);
      t.ok(await p.evaluate(() => document.querySelector('#toast').classList.contains('on')), 'toast on the home screen');
    },
  },
  {
    name: 'rewards: levels in a row give a bonus star, a failed try breaks the streak',
    async run(t, { startLevel, solve, fillTray, modal, click, sleep }) {
      const p = await t.phone({ state: { ...DENNIS, level: 5, winStreak: 2 } });
      await startLevel(p, 5);
      // tap at a normal pace, so the milestones happen along the way
      const path = await p.evaluate(() => { const G = __mj.G; return __mj.Layouts.solve(G.tiles, G.nb, G.tiles.map(t => t.face), G.alive, G.tray.slice(), 80000); });
      const miles = [];
      for (const m of path) { await p.evaluate(m => { const G = __mj.G; if (!G.alive[m]) return; __mj.onTap(m); if (G.alive[m]) __mj.onTap(m); }, m); await sleep(260); miles.push(await p.evaluate(() => __mj.G.mile)); }
      await sleep(3500);
      t.eq(await p.evaluate(() => [__mj.S.winStreak, __mj.S.stats.streakStars]), [3, 1], 'third in a row: +1 star');
      t.ok(/3 op rij \+⭐/.test((await modal(p)).text), 'shown on the win screen');
      t.ok([1, 2, 3].every(m => miles.includes(m)), 'progress milestones at a quarter, half and three quarters', [...new Set(miles)]);
      await startLevel(p, 6); await fillTray(p);
      t.eq(await p.evaluate(() => __mj.S.winStreak), 0, 'a failed try resets the streak');
    },
  },
  {
    name: 'rewards: a daily gift on the first visit of the day',
    async run(t, { modal, click, sleep }) {
      const p = await t.phone({ state: { ...OMA, giftDay: '2026-10-06', bonusStars: 0 } });
      await sleep(1200);
      const m = await modal(p);
      t.ok(m && /dagcadeau/i.test(m.title), 'gift shown', m);
      await click(p, '#gOpen'); await sleep(400);
      const st = await p.evaluate(() => __mj.S.bonusStars);
      t.ok(st === 1 || st === 2, 'got 1 or 2 stars', st);
      t.ok(/\+\d ster/.test((await modal(p)).title), 'says how many');
      await click(p, '#gOpen'); await sleep(300);
      t.eq(await modal(p), null, 'closed');
      await p.evaluate(() => { __mj.show('levels'); __mj.show('home'); }); await sleep(1300);
      t.eq(await modal(p), null, 'only once a day');
    },
  },
  {
    name: 'face-down tiles: turned over with the twin in the tray, they match right then (everyone)',
    async run(t, { startLevel, sleep }) {
      const p = await t.phone({ state: { ...DENNIS, level: 40 } });
      let pair = null;
      for (let L = 28; L <= 40 && !pair; L++) { await startLevel(p, L); await sleep(300); pair = await p.evaluate(makeHiddenPair); }
      if (!t.ok(pair, 'set up a hidden pair')) return;
      await p.evaluate(([, u]) => __mj.onTap(u), pair); await sleep(500);    // its twin goes into the tray
      await p.evaluate(([d]) => __mj.onTap(d), pair);                        // tap the face-down tile
      t.ok(await p.evaluate(() => !!document.querySelector('.tile.flying.reveal')), 'it flips open while it flies');
      await sleep(600);
      t.eq(await p.evaluate(([d]) => ({ gone: !__mj.G.alive[d], open: __mj.G.peek === d, tray: __mj.G.tray.length }), pair), { gone: true, open: false, tray: 0 }, 'turned over and matched at once');
    },
  },
  {
    name: 'see-through: tapping a covered tile makes the tiles on top see-through for a moment',
    async run(t, { startLevel, sleep }) {
      const p = await t.phone({ state: { ...DENNIS, level: 25 } });
      await startLevel(p, 25); await sleep(1200);
      const i = await p.evaluate(() => { const G = __mj.G; const i = G.tiles.findIndex((t, i) => G.alive[i] && G.nb.above[i].some(j => G.alive[j])); __mj.onTap(i); return i; });
      await sleep(250);
      const r = await p.evaluate(i => { const G = __mj.G; const up = G.nb.above[i].filter(j => G.alive[j]); return { up: up.length, xray: up.filter(j => G.tiles[j].el.classList.contains('xray')).length, op: getComputedStyle(G.tiles[up[0]].el).opacity }; }, i);
      t.ok(r.up > 0 && r.xray === r.up && +r.op < 0.5, 'tiles on top see-through', r);
      await sleep(1800);
      t.eq(await p.evaluate(() => document.querySelectorAll('#board .xray').length), 0, 'back to normal after a moment');
    },
  },
  {
    name: 'lucky moment: the glowing tile stays visible on every layer (hidden under the pile before 1.23)',
    async run(t, { startLevel, sleep }) {
      const p = await t.phone({ state: { ...DENNIS, level: 25 } });
      await startLevel(p, 25); await sleep(1500);
      const r = await p.evaluate(() => {
        const G = __mj.G, L = __mj.Layouts, out = [];
        // the tile itself must be what you see at its centre (not a tile lying under it)
        const seen = el => { const b = el.getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!hit && hit.closest('.tile') === el; };
        for (const z of [0, 1, 2, 3]) {
          const i = G.tiles.findIndex((t, i) => t.z === z && G.alive[i] && L.isFree(i, G.alive, G.nb));
          if (i < 0) continue;
          const el = G.tiles[i].el;
          for (const cls of ['lucky']) { el.classList.add(cls); out.push({ z, cls, seen: seen(el) }); el.classList.remove(cls); }
        }
        return out;
      });
      t.ok(r.some(x => x.z >= 1), 'free tiles on higher layers found', r);
      t.ok(r.every(x => x.seen), 'always visible', r);
    },
  },
];
