/* Level factory, step 2 (Claude, 2026-10-28, for Dennis): deal each new pile and tune it.
   1. The game's own designer (www/hard.js make, with the factory's pile) deals pictures, face-down
      tiles, ice, locks and an early alarm clock along a known way through. Several deals per pile.
   2. Difficulty: the calibrated test players (tools/sim/honest, fitted to Dennisisdebeste and Mrs.
      Doubtfire, the model that ordered 92-269). Over levels 92-163 its Dennis player wins 45% of first
      tries where Dennis really won 53% (Mrs. Doubtfire 36% vs 35%), so it is right on average, not per
      level. Target (Dennis 2026-10-28: about 50% first try, slowly harder): the Dennis player's first
      try from 0.42 at level 175 to 0.36 at 270, within 0.05. The deal closest to it is tuned by
      swapping two pictures at a time (the known way through must stay valid).
   3. A way out a person can find: the strong human-information bot (Codex, wip/personal-bots,
      measure()) must clear it within 3 tries in each of 3 runs, seeing only what a person sees and
      remembering earlier tries. Otherwise the next deal.
     node source/tools/factory/design.js <piles.json> <out.jsonl> <measure.js> [levels comma]       */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const L = require(path.join(ROOT, 'www', 'layouts.js')); global.Layouts = L;
global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'www', 'levels-hard.js'), 'utf8') + ';HARD_LEVELS');
const RULES0 = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'www', 'js', 'rules.js'), 'utf8') + ';RULES', {});
global.RULES = { hard: { ...RULES0.hard, minTile: 52, minTileBig: 52 } };
const Hard = require(path.join(ROOT, 'www', 'hard.js'));
const MODEL = path.join(ROOT, 'tools', 'sim', 'honest');
const H = require(path.join(MODEL, 'hard')), HL = require(path.join(MODEL, 'layouts')), PROF = require(path.join(MODEL, 'players.json')).bots;

const SALTS = [1, 2, 3], MAX_TRIES = 3, DEALS = +(process.env.DEALS || 8), SWAPS = 30, BAND = 0.05;
const aim = lv => 0.42 - 0.06 * Math.min(1, Math.max(0, (lv - 175) / 95));

function game(d, Lx = HL) {
  const tiles = d.tiles.map(([x, y, z]) => ({ x, y, z })), down = new Uint8Array(tiles.length); d.down.forEach(i => down[i] = 1);
  const o = d.obst, keys = o && o.keys && o.keys.length ? o.keys : [];
  return { tiles, nb: Lx.neighbors(tiles), down, faces: d.faces, clock: d.clock,
    rules: o ? { iceNb: Lx.iceNeighbors(tiles), ice: o.ice || {}, locks: keys.length ? new Set(o.locks || []) : null, keys } : null };
}
function rate(d, name, runs, seed) {
  const p = { ...H.P, ...PROF[name].persona }, r = H.rateChain(game(d), runs, seed, p, p.memory, 4);
  return { first: +r.first.toFixed(3), two: +r.within[1].toFixed(3), four: +r.within[3].toFixed(3) };
}
const D = 'Dennisisdebeste', M = 'Mrs. Doubtfire';

if (require.main === module) {
  const [pilesFile, outFile, measurePath, only] = process.argv.slice(2);
  const { measure } = require(path.resolve(measurePath));
  const want = only ? only.split(',').map(Number) : null;
  const piles = JSON.parse(fs.readFileSync(pilesFile, 'utf8')).filter(p => !want || want.includes(p.level));
  const done = new Set(fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).level) : []);
  for (const p of piles) {
    if (done.has(p.level)) continue;
    const lv = p.level, target = aim(lv), t0 = Date.now(), tiles = p.tiles.map(([x, y, z]) => ({ x, y, z }));
    // 1. deals, each rated quickly by the Dennis player
    const deals = [];
    for (let salt = 0; salt < DEALS; salt++) {
      const d = Hard.makeNow(lv, 1.6, 1, salt, { tiles });
      if (!d.solution || !d.clock) continue;
      d.q = rate(d, D, 200, 7001 + salt);
      deals.push(d);
    }
    deals.sort((a, b) => Math.abs(a.q.first - target) - Math.abs(b.q.first - target));
    let row = null;
    for (const d0 of deals.slice(0, 3)) {
      // 2. swap pictures towards the target (the known way through must still work); measured again
      //    carefully, and swapped further while the careful measurement is still off
      let best = d0, swaps = 0, qd = null, qm = null;
      const g = game(d0, L), r = L.rng(lv * 31 + deals.indexOf(d0));
      for (let round = 0; round < 3; round++) {
        for (let s = 0; s < SWAPS && Math.abs(best.q.first - target) > BAND / 2; s++) {
          const faces = best.faces.slice(), n = faces.length;
          const a = Math.floor(r() * n), b = Math.floor(r() * n);
          if (faces[a] === faces[b]) continue;
          [faces[a], faces[b]] = [faces[b], faces[a]];
          if (!Hard.validSolution({ ...g, faces }, best.solution)) continue;
          const d = { ...best, faces }; d.q = rate(d, D, 300, 9001 + round * 1000 + s);
          if (Math.abs(d.q.first - target) < Math.abs(best.q.first - target)) { best = d; swaps++; }
        }
        qd = rate(best, D, 600, 31001 + lv + round);
        if (Math.abs(qd.first - target) <= BAND) break;
        best = { ...best, q: qd };
      }
      qm = rate(best, M, 600, 41001 + lv);
      if (Math.abs(qd.first - target) > BAND) { console.log(lv, 'off target', qd.first, 'vs', target.toFixed(2)); continue; }
      // 3. a way out a person can find
      const board = { tiles: best.tiles, faces: best.faces, down: best.down, obst: best.obst, clock: best.clock };
      let m; try { m = measure(board, { salts: SALTS, maxTries: MAX_TRIES }); } catch (e) { m = { triesPerSalt: SALTS.map(() => null), error: String(e).slice(0, 200) }; }
      const ok = m.triesPerSalt.every(x => x !== null && x <= MAX_TRIES);
      const info = { level: lv, shape: p.shape, n: best.tiles.length, px: p.px, shared: p.shared, target: +target.toFixed(3),
        dennis: qd, mrsD: qm, bot: m.triesPerSalt, botLoss: m.lossTypes, slowestMs: Math.round(m.slowestMove || 0), swaps,
        down: best.down.length, ice: Object.keys((best.obst || {}).ice || {}).length, locks: ((best.obst || {}).locks || []).length,
        clock: best.clock.n, clockSpare: best.clock.n - (best.solution.indexOf(best.clock.i) + 1), s: Math.round((Date.now() - t0) / 1000), ok, error: m.error };
      console.log(JSON.stringify(info));
      if (ok) { row = { ...info, design: { v: best.v, level: lv, aspect: 1.6, tiles: best.tiles, faces: best.faces, down: best.down, gold: best.gold, obst: best.obst, clock: best.clock, solution: best.solution, info: { rate: qm.first, strong: qd.first } } }; break; }
    }
    fs.appendFileSync(outFile, JSON.stringify(row || { level: lv, ok: false, shape: p.shape }) + '\n');
  }
}
module.exports = { aim, rate, game };
