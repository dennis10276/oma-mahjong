/* Remake 106-269, step 2 and 3, with the re-fitted strong test player (www/hard.js REF.strong).
     node remake_tune.js plan <version>              -> remake-plan.json (which board goes where)
     node remake_tune.js tune <version> [part] [parts] -> remake-tuned-<part>.json
   plan: the boards of the live table from 106 on, ordered from easy to hard into the levels (big
   boards stay on every 10th level). tune: each board's pictures are swapped step by step until the
   strong test player wins about the target share of first tries. Only tiles off the gold pair are
   swapped, and only when the board's own solution (with the 4-slot tray and the alarm clock) still
   works, so every level can still be finished. Positions, face-down tiles, ice, locks, keys, the
   clock tile and its countdown stay as they are. */
'use strict';
const fs = require('fs'), path = require('path');
const B = require('./boards.js'), L = B.L;
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const [cmd, v] = process.argv.slice(2, 4);
const FROM = 106, TO = 269;
// the new curve (strong first-try chance), agreed 2026-10-15
const CURVE = [[100, 0.55], [150, 0.45], [170, 0.40], [269, 0.40]];
const target = lv => { for (let i = 1; i < CURVE.length; i++) { const [a, x] = CURVE[i - 1], [b, y] = CURVE[i]; if (lv <= b) return x + (y - x) * (lv - a) / (b - a); } return CURVE[CURVE.length - 1][1]; };
const tenth = lv => lv % 10 === 0;
const tol = lv => tenth(lv) ? 0.07 : 0.05;
const planFile = path.join(__dirname, 'remake-plan.json');

function game(d) {
  const tiles = d.tiles.map(([x, y, z]) => ({ x, y, z })), nb = L.neighbors(tiles), n = tiles.length;
  const down = new Uint8Array(n); d.down.forEach(i => down[i] = 1);
  const ob = d.obst, rules = ob && (Object.keys(ob.ice || {}).length || (ob.keys || []).length) ? { iceNb: L.iceNeighbors(tiles), ice: ob.ice || {}, locks: (ob.keys || []).length ? new Set(ob.locks) : null, keys: ob.keys || [] } : null;
  return { tiles, nb, faces: d.faces, down, rules, clock: d.clock };
}
const rate = (d, runs, seed, who = 'strong') => Hard.rate(game(d), runs, seed, Hard.persona(who)).rate;

if (cmd === 'plan') {
  const M = {}; for (const f of fs.readdirSync(__dirname).filter(f => f.startsWith(`remake-${v}-`))) Object.assign(M, JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8')));
  // how easy a board is now: its countdown and the ones next to it (less noise)
  const ease = lv => { const m = M[lv], ns = [m.n0 - 1, m.n0, m.n0 + 1].filter(n => m.rates[n] !== undefined); return ns.reduce((s, n) => s + m.rates[n], 0) / ns.length; };
  const boards = Object.keys(M).map(Number).map(lv => ({ src: lv, big: M[lv].big, r0: ease(lv) }));
  const byEase = list => list.slice().sort((a, b) => b.r0 - a.r0);
  const bigs = byEase(boards.filter(b => b.big)), normals = byEase(boards.filter(b => !b.big));
  const plan = {};
  for (let lv = FROM; lv <= TO; lv++) { const b = (tenth(lv) ? bigs : normals).shift(); if (!b) throw Error('not enough boards for ' + lv); plan[lv] = { ...b, target: +target(lv).toFixed(3) }; }
  fs.writeFileSync(planFile, JSON.stringify(plan, null, 1));
  const far = Object.entries(plan).filter(([lv, p]) => Math.abs(p.r0 - p.target) > tol(+lv));
  console.log(`planned ${Object.keys(plan).length} levels; ${far.length} need tuning`);
}

// retune: a second round for the levels the first round left off target, starting from the
// first round's board, with more tries and a check on games it was not tuned on
if (cmd === 'tune' || cmd === 'retune') {
  const part = +(process.argv[4] || 0), parts = +(process.argv[5] || 1), again = cmd === 'retune';
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  // ROUND=3 and up: the best board of the earlier rounds, only where it is still more than 0.10 off
  const ROUND = again ? +(process.env.ROUND || 2) : 1;
  const prev = {};
  if (again) for (const f of fs.readdirSync(__dirname).filter(f => /^remake-tuned\d*-\d+\.json$/.test(f))) {
    const rd = +(f.match(/^remake-tuned(\d*)-/)[1] || 1); if (rd >= ROUND) continue;
    for (const [lv, x] of Object.entries(JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8')))) if (x.valid && (!prev[lv] || Math.abs(x.strong - x.target) < Math.abs(prev[lv].strong - prev[lv].target))) prev[lv] = x;
  }
  const file = path.join(__dirname, `remake-tuned${again ? ROUND : ''}-${part}.json`);
  const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const ctx = B.tableOf(v);
  for (let lv = FROM; lv <= TO; lv++) {
    if ((lv - FROM) % parts !== part || out[lv]) continue;
    const p = plan[lv], T = p.target;
    // LEVELS=a,b,...: only these (found off target or unfair on fresh games), checked for fairness too
    const only = process.env.LEVELS ? process.env.LEVELS.split(',').map(Number) : null;
    if (only ? !only.includes(lv) : again && Math.abs(prev[lv].strong - T) <= (ROUND > 2 ? 0.10 : tol(lv))) continue;
    const d0 = again ? ctx.Hard.unpack(lv, prev[lv].row) : ctx.Hard.get(p.src);
    const d = JSON.parse(JSON.stringify(d0)); d.level = lv;
    const g0 = game(d), n = d.faces.length, path_ = d.solution;
    const gold = new Set(d.gold || []);
    const fits = faces => { const tray = []; let k = 0; for (const m of path_) { const q = tray.indexOf(faces[m]); if (q >= 0) tray.splice(q, 1); else { tray.push(faces[m]); if (tray.length > L.SLOTS - 1) return false; } k++; } return !tray.length; };
    const r = L.rng(lv * 7919 + 4242 + (again ? 99 * ROUND : 0)), S = again ? 21 + 2 * ROUND : 21, RUNS = again ? 200 : 120;
    let cur = rate(d, RUNS, S), steps = 0, tried = 0;
    const start = cur;
    const unfair = () => only && rate(d, RUNS, S, 'sensible') > cur + 0.03;
    let bad = unfair();
    while ((Math.abs(cur - T) > tol(lv) * (again ? 0.7 : 1) || bad) && tried < (again ? 900 : 400) && steps < 40) {
      tried++;
      const faces = d.faces.slice(), harder = cur > T;
      let a, b;
      if (harder && r() < 0.6) {
        // a tile on its own twin (it must go to the tray first)
        const x = Math.floor(r() * n), ups = g0.nb.above[x]; if (!ups.length) continue;
        const u = ups[Math.floor(r() * ups.length)], xs = [];
        for (let y = 0; y < n; y++) if (y !== u && y !== x && faces[y] === faces[u]) xs.push(y);
        if (!xs.length || faces[x] === faces[u]) continue;
        a = x; b = xs[Math.floor(r() * xs.length)];
      } else { a = Math.floor(r() * n); b = Math.floor(r() * n); }
      if (a === b || faces[a] === faces[b] || gold.has(a) || gold.has(b)) continue;
      [faces[a], faces[b]] = [faces[b], faces[a]];
      if (!fits(faces)) continue;
      const e = { ...d, faces };
      const q = rate(e, 40, 31 + tried);
      if (Math.abs(q - T) >= Math.abs(cur - T) - 0.02) continue;
      const q2 = rate(e, RUNS, S);
      if ((Math.abs(q2 - T) < Math.abs(cur - T) || (bad && Math.abs(q2 - T) <= tol(lv))) && (!only || rate(e, RUNS, S, 'sensible') <= q2 + 0.03)) { d.faces = faces; cur = q2; steps++; bad = false; }
    }
    const g = game(d), ok = Hard.validSolution(g, d.solution);
    const FS = again ? 75 + 2 * ROUND : 77;
    const fin = { strong: rate(d, 300, FS), sensible: rate(d, 300, FS, 'sensible'), average: rate(d, 300, FS, 'average') };
    d.info = { rate: +fin.sensible.toFixed(4), strong: +fin.strong.toFixed(4) };
    out[lv] = { src: p.src, target: T, start: +start.toFixed(3), steps, tried, valid: ok, ...fin, row: ctx.Hard.pack(d) };
    fs.writeFileSync(file, JSON.stringify(out));
    console.error(`${lv} from ${p.src}: ${start.toFixed(2)} -> ${fin.strong.toFixed(2)} (target ${T.toFixed(2)}, ${steps} swaps, ${tried} tried) valid ${ok}`);
  }
}
