/* 1.15: no messages over the pile, grandma's glowing-pair helper, and the little rewards. */
'use strict';
const OMA = { name: 'OmaHanny', pid: 'test-oma', level: 12 };
// the helper's timings, shortened (the real ones are in HELP.care.nudge): face-down after 2 s, visible after 5 s
const QUICK = { HELP: { care: { nudge: { downS: 2, upS: 5 } } } };
const DENNIS = { name: 'Dennis', pid: 'test-dennis', level: 12 };
const overlaps = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);

// make tile d (face down, free) and u (face up, free) a pair, keeping every picture count even
const makeHiddenPair = () => {
  const G = __mj.G, L = __mj.Layouts, fr = G.tiles.map((t, i) => i).filter(i => G.alive[i] && L.isFree(i, G.alive, G.nb));
  const d = fr.find(i => G.down[i]), u = fr.find(i => !G.down[i] && i !== d);
  if (d === undefined || u === undefined) return null;
  const w = G.tiles.findIndex((t, i) => i !== d && i !== u && t.face === G.tiles[d].face);
  const fu = G.tiles[u].face; G.tiles[u].face = G.tiles[d].face; G.tiles[w].face = fu;
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
      t.ok(/Geluksmoment/.test(r.text), 'message in the strip', r.text);
      t.ok(!r.toast, 'no floating toast while playing');
      t.ok(!overlaps(r.msg, r.board), 'strip is not over the pile', r);
      await p.evaluate(() => __mj.maybeLucky && praise('Halverwege! 💪')); await sleep(1500);
      t.ok(/Halverwege/.test(await p.evaluate(() => document.querySelector('#gameMsg').innerText)), 'praise in the strip too, after the first message was readable');
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
    name: 'helper (grandma): a pair with a face-down tile is turned over and glows until matched',
    async run(t, { startLevel, sleep }) {
      const p = await t.phone({ state: { ...OMA, level: 30 }, tune: QUICK });
      await startLevel(p, 30); await sleep(500);
      const pair = await p.evaluate(makeHiddenPair);
      if (!t.ok(pair, 'set up a hidden pair')) return;
      await p.evaluate(() => { __mj.G.lastMove = performance.now(); });
      await sleep(1000);
      t.eq(await p.evaluate(() => __mj.G.nudge), null, 'nothing yet after 1 second');
      await sleep(2200);
      const g = await p.evaluate(([d, u]) => { const G = __mj.G; return { nudge: (G.nudge || []).slice().sort(), down: G.down[d], glow: [d, u].map(i => G.tiles[i].el.classList.contains('nudge')), back: G.tiles[d].el.classList.contains('back') }; }, pair);
      t.eq(g, { nudge: pair.slice().sort((a, b) => a - b), down: 0, glow: [true, true], back: false }, 'turned face up and glowing', g);
      await sleep(3000);
      t.ok(await p.evaluate(([d]) => __mj.G.tiles[d].el.classList.contains('nudge'), pair), 'keeps glowing');
      await p.evaluate(([, u]) => __mj.onTap(u), pair); await sleep(500);
      t.ok(await p.evaluate(([d]) => __mj.G.tiles[d].el.classList.contains('nudge') && document.querySelector('#tray .slot.nudge') !== null, pair), 'its twin in the tray glows too, the other tile still glows');
      await p.evaluate(([d]) => __mj.onTap(d), pair); await sleep(600);
      t.eq(await p.evaluate(([d, u]) => [__mj.G.alive[d], __mj.G.alive[u], __mj.G.tray.length, __mj.G.nudge, document.querySelectorAll('.nudge').length], pair), [0, 0, 0, null, 0], 'matched: glow gone');
      t.ok(p.db.plays('test-oma').some(e => e.k === 'nudge' && e.down === 1), 'logged for the dashboard');
    },
  },
  {
    name: 'helper (grandma): a visible pair glows after a longer pause; not for others',
    async run(t, { startLevel, sleep }) {
      const p = await t.phone({ state: { ...OMA, level: 3 }, tune: QUICK });     // level 3: no face-down tiles
      await startLevel(p, 3); await p.evaluate(() => { __mj.G.lastMove = performance.now(); });
      await sleep(3500);
      t.eq(await p.evaluate(() => __mj.G.nudge), null, 'not after the short wait');
      await sleep(3000);
      t.ok(await p.evaluate(() => (__mj.G.nudge || []).length >= 1 && document.querySelectorAll('#board .tile.nudge').length >= 1), 'glowing after the long wait');
      const q = await t.phone({ state: { ...DENNIS, level: 30 }, tune: QUICK });
      await startLevel(q, 30); await sleep(300);
      await q.evaluate(makeHiddenPair);
      await sleep(7000);
      t.eq(await q.evaluate(() => [__mj.G.nudge, document.querySelectorAll('.nudge').length]), [null, 0], 'Dennis gets no helper');
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
      const p = await t.phone({ state: { ...DENNIS, level: 30 } });
      await startLevel(p, 30); await sleep(300);
      const pair = await p.evaluate(makeHiddenPair);
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
    name: 'lucky moment and helper: the glowing tile stays visible on every layer (hidden under the pile before 1.23)',
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
          for (const cls of ['lucky', 'nudge']) { el.classList.add(cls); out.push({ z, cls, seen: seen(el) }); el.classList.remove(cls); }
        }
        return out;
      });
      t.ok(r.some(x => x.z >= 1), 'free tiles on higher layers found', r);
      t.ok(r.every(x => x.seen), 'always visible', r);
    },
  },
];
