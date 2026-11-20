'use strict';
/* Dennis 2026-11-20, two answers about rules the designed levels lean on:
   - "Show the real number": ice that needs 3 or more melts carries its number (❄️3) and the texts say how many, instead of
     looking like ❄️❄️ and saying "2".
   - "Allow it as a trick": the game checks the clock after a whole action, so a face-down pair that holds the clock may end one
     move past the number; the solution check (Hard.validSolution) now agrees. */
const path = require('path');
const DENNIS = { name: 'Dennis', pid: 'test-thick-ice', level: 301, seenSp: { clock: 1, clockMoves: 1, ice: 1, lock: 1, lock2: 1, gold: 1, joker: 1, trayPair: 1 } };
module.exports = [
  { name: 'clock in a face-down pair: the solution check allows it one move late, only when the clock is in the pair', async run(t) {
    const L = require(path.join(__dirname, '../www/layouts.js'));
    global.Layouts = L; const H = require(path.join(__dirname, '../www/hard.js'));
    // three tiles wait (W1-W3), then the face-down clock C goes with its twin T at a full tray, then W1-W3 meet their twins
    const tiles = [[0, 0, 0], [0, 4, 0], [0, 8, 0], [4, 0, 0], [8, 0, 0], [12, 0, 0], [12, 4, 0], [12, 8, 0]].map(([x, y, z]) => ({ x, y, z }));
    const nb = L.neighbors(tiles), faces = [3, 4, 5, 1, 1, 3, 4, 5], down = Uint8Array.from([0, 0, 0, 1, 0, 0, 0, 0]), sol = [0, 1, 2, 3, 4, 5, 6, 7];
    const g = n => ({ tiles, nb, faces, down, rules: null, clock: { i: 3, n } });
    t.ok(H.validSolution(g(5), sol), 'clock 5: the pair ends at the 5th tile, in time as before');
    t.ok(H.validSolution(g(4), sol), 'clock 4: the pair ends at the 5th tile - one move late, still in time (the game checks after the pair)');
    t.ok(!H.validSolution(g(3), sol), 'clock 3: the pair would start after the number - too late');
    // the same position with the clock elsewhere (on W1's twin, taken last): a pair that does not hold the clock gets no extra move
    const g2 = { tiles, nb, faces, down, rules: null, clock: { i: 5, n: 5 } };
    t.ok(!H.validSolution(g2, sol), 'a pair without the clock does not stretch the number');
  } },
  { name: 'thick ice: 3 or more melts carry their number, and the texts say how many', async run(t, { startLevel, sleep }) {
    const p = await t.phone({ state: DENNIS });
    await startLevel(p, 300);
    const r = await p.evaluate(() => {
      // a tile with at least four ice neighbours still on the board, frozen 4
      const i = G.tiles.findIndex((x, k) => G.alive[k] && Layouts.iceNeighbors(G.tiles)[k].filter(j => G.alive[j]).length >= 4);
      const ob = obState() || { need: {}, left: {}, locks: [], keys: [] };
      setObstacles({ ...ob, need: { ...ob.need, [i]: 4 }, left: { ...ob.left, [i]: 4 } });
      decorate(i);
      const read = () => { const el = G.tiles[i].el.querySelector('.ob'); return el ? [el.dataset.k, el.dataset.n || ''] : null; };
      const out = { start: read() }, nbs = G.inb[i].filter(j => G.alive[j]);
      G.alive[nbs[0]] = 0; updateObstacles(); out.one = read();
      G.alive[nbs[1]] = 0; updateObstacles(); out.two = read();
      G.alive[nbs[2]] = 0; updateObstacles(); out.three = read();
      out.texts = [tx('iceThick', 4), tx('iceCrack', 3), tx('iceCrack', 1), tx('iceThick')];
      return out;
    });
    t.eq(r.start, ['ice2', '4'], 'frozen 4 shows the number 4');
    t.eq(r.one, ['ice2', '3'], 'one melt: 3');
    t.eq(r.two, ['ice2', ''], 'two melts: back to the plain ❄️❄️ (2 left)');
    t.eq(r.three, ['ice', ''], 'three melts: ❄️ (1 left)');
    t.ok(/4/.test(r.texts[0]) && /3/.test(r.texts[1]) && !/\d/.test(r.texts[2]) && /2/.test(r.texts[3]), 'texts: remove 4 / 3 more / one more / 2 by default', r.texts);
  } },
];
