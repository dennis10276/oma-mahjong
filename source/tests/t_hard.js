/* The test player and the harder levels (www/hard.js), and the alarm clock in the game. */
'use strict';
const path = require('path');
const Hard = require(path.join(__dirname, '..', 'www', 'hard.js'));
const L = require(path.join(__dirname, '..', 'www', 'layouts.js'));
const asGame = d => {
  const tiles = d.tiles.map(([x, y, z]) => ({ x, y, z })), nb = L.neighbors(tiles), n = tiles.length;
  const ob = d.obst, rules = ob && (Object.keys(ob.ice || {}).length || (ob.keys || []).length) ? { iceNb: L.iceNeighbors(tiles), ice: ob.ice || {}, locks: (ob.keys || []).length ? new Set(ob.locks) : null, keys: ob.keys || [] } : null;
  return { tiles, nb, n, rules };
};
const STARS = Object.fromEntries(Array.from({ length: 99 }, (_, i) => [i + 1, 2]));
const SEEN = { gold: 1, gift: 1, joker: 1, joker2: 1, ice: 1, lock: 1, clock: 1 };

module.exports = [
  {
    name: 'hard: designed levels are the same every time, can be finished, fair, near their target; face-down only where it hurts; the clock from 80',
    cpu: true,
    async run(t) {
      const a = Hard.makeNow(83, 1.6), b = Hard.makeNow(83, 1.6);
      t.eq(a.faces, b.faces, 'the same level and screen give the same design (every phone)');
      for (const lv of [72, 77, 83, 97]) {
        const d = Hard.makeNow(lv, 1.55), g = asGame(d), all = new Uint8Array(g.n).fill(1);
        t.ok(L.solve(g.tiles, g.nb, d.faces, all, [], 200000, g.rules), `level ${lv}: can be finished with ice and locks`);
        t.ok(Math.abs(d.info.rate - d.info.target) <= 0.2, `level ${lv}: the sensible test player wins about the target share`, d.info);
        if (lv >= 75) {
          t.ok(d.info.strong >= d.info.rate - 0.1, `level ${lv}: playing better helps (strong ${d.info.strong}, sensible ${d.info.rate})`);
          const free0 = d.down.filter(i => L.isFree(i, all, g.nb));
          t.eq(free0, [], `level ${lv}: no face-down tile that is free at the start (it could just be turned over)`);
          t.ok(d.down.length <= Math.round(g.n * 0.4), `level ${lv}: not more face-down tiles than before`, d.down.length);
        }
        if (lv >= 80) {
          t.ok(d.clock && d.clock.n > 0, `level ${lv}: an alarm clock`, d.clock);
          const bad = new Set([...d.down, ...(d.gold || []), ...Object.keys((d.obst && d.obst.ice) || {}).map(Number), ...((d.obst && d.obst.locks) || []), ...((d.obst && d.obst.keys) || [])]);
          t.ok(d.clock && !bad.has(d.clock.i), `level ${lv}: the clock is not on a face-down, iced, locked or gold tile`);
        } else t.eq(d.clock, null, `level ${lv}: no clock yet`);
      }
    },
  },
  {
    name: 'hard: the test player knows only what a person can see, and is fitted to real players (strong ~ Dennisisdebeste, average ~ Mrs. Doubtfire)',
    cpu: true,
    async run(t) {
      const cal = require(path.join(__dirname, '..', 'tools', 'sim', 'calibration.json'));
      t.ok(cal.dennis.realWin > 0.8 && cal.doubt.realWin < 0.5, 'the real players in the fit', { dennis: cal.dennis.realWin, doubt: cal.doubt.realWin });
      t.ok(Hard.REF.strong.temp < Hard.REF.sensible.temp && Hard.REF.sensible.temp < Hard.REF.average.temp, 'three test players, from strong to average');
      // what it cannot see does not steer it: swapping the pictures of two covered face-down tiles
      // does not change its first moves
      const d = Hard.makeNow(77, 1.6), g = asGame(d), all = new Uint8Array(g.n).fill(1);
      const down = new Uint8Array(g.n); d.down.forEach(i => down[i] = 1);
      const hidden = d.down.filter(i => g.nb.above[i].length >= 2 && g.tiles[i].z === 0 && d.faces[i] < 100);
      const [x, y] = [hidden[0], hidden.find(j => d.faces[j] !== d.faces[hidden[0]])];
      const sw = d.faces.slice(); [sw[x], sw[y]] = [sw[y], sw[x]];
      const run = faces => { const tr = []; Hard.play({ tiles: g.tiles, nb: g.nb, faces, down, rules: g.rules }, Hard.P, 7, tr); return tr.slice(0, 2).map(e => e.pick.join('+')); };
      t.eq(run(sw), run(d.faces), 'it cannot look under face-down tiles');
    },
  },
  {
    name: 'hard: the alarm clock counts down with every tile taken, ends the level at 0, and is safe once its tile is gone',
    async run(t, { startLevel, sleep, modal }) {
      const p = await t.phone({ state: { name: 'Dennis', pid: 'test-dennis', level: 90, stars: STARS, seenSp: SEEN } });
      await startLevel(p, 82);
      const st = await p.evaluate(() => ({ made: !!__mj.G.o.spec.made, clock: __mj.G.clock, badge: (document.querySelector('#clockBadge') || {}).textContent }));
      t.ok(st.made && st.clock && st.badge === '⏰' + st.clock.n, 'designed level with a clock badge showing the moves', st);
      // take a pair that is not the clock: the number goes down by 2
      const pair = await p.evaluate(() => { const G = __mj.G, Lx = __mj.Layouts; const fr = G.tiles.map((t, i) => i).filter(i => i !== G.clock.i && G.alive[i] && !G.down[i] && canTake(i)); for (const a of fr) for (const b of fr) if (a < b && G.tiles[a].face === G.tiles[b].face) return [a, b]; return null; });
      if (t.ok(pair, 'a free pair')) {
        await p.evaluate(([a, b]) => { __mj.onTap(a); __mj.onTap(b); }, pair); await sleep(900);
        t.eq(await p.evaluate(() => [__mj.G.mv, document.querySelector('#clockBadge').textContent]), [2, '⏰' + (st.clock.n - 2)], 'two moves used');
      }
      // run the clock out: one move left, take another tile
      await p.evaluate(() => { __mj.G.clock.n = __mj.G.mv + 1; });
      const one = await p.evaluate(() => { const G = __mj.G; return G.tiles.map((t, i) => i).find(i => i !== G.clock.i && G.alive[i] && !G.down[i] && canTake(i)); });
      await p.evaluate(i => __mj.onTap(i), one); await sleep(1500);
      const m = await modal(p);
      t.ok(m && /wekker ging af/i.test(m.text) && m.buttons.includes('sRetry'), 'the level is over, with a try again', m);
      const ends = Object.values(p.db.get('plays/test-dennis') || {}).filter(e => e.k === 'end');
      t.ok(ends.some(e => e.ck === 1 && e.r === 'stuck'), 'logged as lost by the clock');
      // a new try: the clock starts again; taking the clock tile makes it safe
      await p.evaluate(() => document.querySelector('#sRetry').click()); await sleep(900);
      t.eq(await p.evaluate(() => [__mj.G.mv, __mj.G.clock.n === __mj.G.o.clock.n]), [0, true], 'a new try starts the count again');
      await p.evaluate(() => { const G = __mj.G; for (const j of G.nb.above[G.clock.i]) G.alive[j] = 0; G.down[G.clock.i] = 0; updateBlocked(); });
      const freeClock = await p.evaluate(() => canTake(__mj.G.clock.i));
      if (freeClock) {
        await p.evaluate(() => __mj.onTap(__mj.G.clock.i)); await sleep(900);
        t.eq(await p.evaluate(() => [clockOn(), !!document.querySelector('#clockBadge')]), [false, false], 'clock tile taken: no more clock');
      }
      t.eq(p.errors, [], 'no errors');
    },
  },
  {
    name: 'hard: the next level is built in quiet moments while playing; grandma keeps her own levels',
    async run(t, { startLevel, sleep }) {
      const p = await t.phone({ state: { name: 'Dennis', pid: 'test-dennis', level: 90, stars: STARS, seenSp: SEEN } });
      await startLevel(p, 76);
      t.ok(await p.evaluate(() => !!__mj.G.o.spec.made && !__mj.G.clock), 'level 76: designed, no clock yet');
      let ready = false;
      for (let k = 0; k < 120 && !ready; k++) { await sleep(500); ready = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('omamj.hard') || '{}')).some(k => k.split(':')[1] === '77')); }
      t.ok(ready, 'level 77 was made in the background');
      const t0 = Date.now(); await p.evaluate(() => __mj.startLevel(77)); await sleep(100);
      t.ok(await p.evaluate(() => __mj.G.key === 'L77' && !document.querySelector('#buildMsg')), 'and starts right away');
      // a half-played designed level comes back the same
      await p.evaluate(() => { const G = __mj.G; const i = G.tiles.findIndex((t, i) => G.alive[i] && !G.down[i] && canTake(i)); __mj.onTap(i); saveCur(); });
      const before = await p.evaluate(() => ({ faces: __mj.G.tiles.map(t => t.face).join(), mv: __mj.G.mv }));
      await p.evaluate(() => __mj.startLevel(77)); await sleep(800);
      t.eq(await p.evaluate(() => ({ faces: __mj.G.tiles.map(t => t.face).join(), mv: __mj.G.mv })), before, 'resumed exactly');
      const g = await t.phone({ state: { name: 'OmaHanny', pid: 'test-oma', level: 85 } });
      await startLevel(g, 85);
      t.ok(await g.evaluate(() => !__mj.G.o.spec.made && !__mj.G.clock && __mj.G.o.track === 'care'), 'grandma: her own gentle level, no clock');
      t.eq([...p.errors, ...g.errors], [], 'no errors');
    },
  },
];
