/* Level variety, the quicker way (2026-10-21; replaces the per-level tuning of variety.js, which took
   up to an hour per level). Same goal: from FROM on, every level a new pile shape unlike every other
   designed level, and the difficulty curve as it is (both personal players with the frozen observer,
   the 1.54 reorder measure; targets from analysis/variety-plan.json, i.e. reorder-92.json).

     node source/tools/sim/variety/variety2.js cands [workers=2] [from=158] [to=269]   resumable
     node source/tools/sim/variety/variety2.js assign [from=158]
     node source/tools/sim/variety/variety2.js tune [workers=2]        only levels without a close candidate
     node source/tools/sim/variety/variety2.js validate [workers=2]    independent 1200-game check
     node source/tools/sim/variety/variety2.js report                  the curve, old against new
     node source/tools/sim/variety/variety2.js apply [from]            writes www/levels-hard.js (not published)

   1. cands: per level, up to CANDS boards, each on another new shape (piles.js) with the game's designer
      on a quick setting; a quick look (SCREEN games), then the promising ones measured (SEARCH games).
   2. assign: every level takes the closest unused candidate made for itself or a level at most NEAR away
      (big boards only on every 10th level), never two boards that look alike. Like the 1.54 reorder:
      measured boards put where their difficulty fits.
   3. tune: a short tuning (at most TUNE_STEPS) only where no candidate was close enough.
   4. validate: FINAL games with other seeds; a level passes within TOL of its target.
   Files: analysis/variety2-cands.json (candidates), analysis/variety2.json (assignment, tuning, checks). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const A = f => path.join(ROOT, 'analysis', f);
const BASE = A('levels-before-variety.js'), PLAN = A('variety-plan.json'), CANDS_F = A('variety2-cands.json'), OUT = A('variety2.json');
const NAMES = ['Dennisisdebeste', 'Mrs. Doubtfire'];
const CANDS = 5, SCREEN = 120, SEARCH = 300, FINAL = { runs: 1200, seed: 55001 }, NEAR = 2, TUNE_STEPS = 12;
const TOL = { first: 0.05, two: 0.06, four: 0.05, ease: 0.03 };
const NOVEL = { pos: 0.6, foot: 0.65 };
const readJ = (f, d) => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d;
const writeJ = (f, x) => { fs.writeFileSync(f + '.tmp', JSON.stringify(x)); fs.renameSync(f + '.tmp', f); };

function gameModules() {
  const L = require(path.join(ROOT, 'www', 'layouts.js'));
  global.Layouts = L;
  global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(BASE, 'utf8') + ';HARD_LEVELS');
  // the designer on a quick setting: every board is measured afterwards anyway
  global.RULES = { hard: { rounds: 4, deals: 4, steps: 4 } };
  const Hard = require(path.join(ROOT, 'www', 'hard.js'));
  return { L, Hard, T: global.HARD_LEVELS };
}
const tilesOf = d => d.tiles.map(([x, y, z]) => ({ x, y, z }));
const tilePx = tiles => { let l = 1e9, r = -1e9, t0 = 1e9, b = -1e9; for (const t of tiles) { const x = t.x / 2 - t.z * 0.14, y = t.y / 2 * 1.24 - t.z * 0.14; l = Math.min(l, x); r = Math.max(r, x + 1); t0 = Math.min(t0, y); b = Math.max(b, y + 1.24); } return Math.min(384 / (r - l + 0.125), 592 / (b - t0 + 0.16)); };
const norm = t => { const mx = Math.min(...t.map(a => a[0])), my = Math.min(...t.map(a => a[1])); return t.map(([x, y, z]) => [x - mx, y - my, z]); };
const mir = t => { const w = Math.max(...t.map(a => a[0])); return t.map(([x, y, z]) => [w - x, y, z]); };
const sig = t => { const n = norm(t), m = norm(mir(t)); return { pos: [new Set(n.map(a => a.join(','))), new Set(m.map(a => a.join(',')))], foot: [new Set(n.map(a => a[0] + ',' + a[1])), new Set(m.map(a => a[0] + ',' + a[1]))] }; };
const overlap = (a, b) => { let c = 0; for (const k of a) if (b.has(k)) c++; return c / Math.max(a.size, b.size); };
const alike = (sa, sb) => ({ pos: Math.max(overlap(sa.pos[0], sb.pos[0]), overlap(sa.pos[1], sb.pos[0])), foot: Math.max(overlap(sa.foot[0], sb.foot[0]), overlap(sa.foot[1], sb.foot[0])) });
const tooAlike = (a, b) => { const x = alike(a, b); return x.pos > NOVEL.pos || x.foot > NOVEL.foot; };
const ease = m => 0.5 * m.first + 0.25 * m.two + 0.25 * m.four;
const distTo = (m, target) => NAMES.reduce((s, n) => s + Math.abs(m[n].first - target[n].first) + 0.5 * Math.abs(m[n].two - target[n].two) + 0.5 * Math.abs(m[n].four - target[n].four), 0);
const within = (m, target, ez, f = 1) => NAMES.every(n => Math.abs(m[n].first - target[n].first) <= TOL.first * f && Math.abs(m[n].two - target[n].two) <= TOL.two * f && Math.abs(m[n].four - target[n].four) <= TOL.four * f && (!ez || Math.abs(ease(m[n]) - ease(target[n])) <= TOL.ease * f));

// the observer's measurement and the board checks (in workers)
function tools() {
  const G = gameModules();
  const H2 = require(path.join(ROOT, 'tools', 'sim', 'honest', 'hard.js')), L2 = require(path.join(ROOT, 'tools', 'sim', 'honest', 'layouts.js'));
  const profiles = require(path.join(ROOT, 'tools', 'sim', 'honest', 'players.json')).bots;
  const obsGame = b => { const tiles = tilesOf(b), down = new Uint8Array(tiles.length); b.down.forEach(i => down[i] = 1); const o = b.obst;
    return { tiles, nb: L2.neighbors(tiles), down, faces: b.faces, rules: o ? { iceNb: L2.iceNeighbors(tiles), ice: o.ice || {}, locks: new Set(o.locks || []), keys: o.keys || [] } : null, clock: b.clock }; };
  const measure = (b, runs, seed) => { const g = obsGame(b), out = {}; for (const n of NAMES) { const p = { ...H2.P, ...profiles[n].persona }; const r = H2.rateChain(g, runs, seed, p, p.memory, 4); out[n] = { first: r.first, two: r.within[1], four: r.within[3] }; } return out; };
  const gameG = b => { const tiles = tilesOf(b), o = b.obst; const rules = o && (Object.keys(o.ice || {}).length || (o.keys || []).length) ? { iceNb: G.L.iceNeighbors(tiles), ice: o.ice || {}, locks: (o.keys || []).length ? new Set(o.locks) : null, keys: o.keys || [] } : null;
    return { tiles, nb: G.L.neighbors(tiles), faces: b.faces, rules, clock: b.clock }; };
  // the stored way through works (ice, locks, tray, clock) and no face-down tile is free at the start
  const valid = b => { const g = gameG(b); if (!G.Hard.validSolution(g, b.solution)) return false; const al = new Uint8Array(b.tiles.length).fill(1); return b.down.every(i => !G.L.isFree(i, al, g.nb)); };
  return { ...G, measure, valid };
}

// ---------- 1. candidates for one level ----------
function candidates(job) {
  const { Hard, L, measure, valid } = tools();
  const { pile } = require('./piles');
  const P = job.level, lv = P.lv, minPx = P.big ? 48 : 54, fixed = job.fixed.map(sig);
  const out = [];
  for (const shape of P.shapes) {
    if (out.length >= CANDS) break;
    // a pile of this shape: right size, tiles big enough, about as tall, unlike the levels that stay
    let best = null;
    for (let s = 0; s < 6; s++) for (const bf of [0.2, 0.25, 0.3, 0.36]) for (const ly of [P.layers, P.layers + 1, P.layers + 2, P.layers + 3]) for (const st of [0.2, 0.4, 0.6]) {
      if (ly > 8) continue;
      const p = pile({ shape, seed: lv * 7907 + s * 131 + ly, target: P.tiles, layers: ly, aspect: 1.6, baseFrac: bf, stack: st, keep: [0.6, 0.85], twin: 0.35 });
      if (!p || p.tiles.length !== P.tiles || tilePx(p.tiles) < minPx) continue;
      const mz = Math.max(...p.tiles.map(t => t.z)) + 1; if (mz < P.layers - 1 || mz > P.layers + 4) continue;
      const nb = L.neighbors(p.tiles), al = new Uint8Array(p.tiles.length).fill(1); let fr = 0; for (let i = 0; i < p.tiles.length; i++) if (L.isFree(i, al, nb)) fr++;
      if (best && Math.abs(fr - P.free) >= Math.abs(best.free - P.free)) continue;
      const sg = sig(p.tiles.map(t => [t.x, t.y, t.z]));
      if (fixed.some(f => tooAlike(sg, f))) continue;
      best = { tiles: p.tiles, free: fr };
    }
    if (!best) continue;
    // the designer on that pile (two tries for a valid board with a clock where the level had one)
    let b = null;
    for (let k = 0; k < 2 && !b; k++) {
      const x = Hard.makeNow(lv, 1.6, 1, out.length * 2 + k, { tiles: best.tiles });
      if (!x.solution || !valid(x) || (P.clock && !x.clock)) continue;
      b = { tiles: x.tiles, faces: x.faces.slice(), down: x.down.slice(), gold: (x.gold || []).slice(), obst: x.obst, clock: x.clock ? { ...x.clock } : null, solution: x.solution.slice() };
    }
    if (!b) continue;
    let quick = measure(b, SCREEN, 31 + lv);
    // the cheapest strong lever right away: the clock a move longer when far too hard, shorter when too
    // easy (no clock: a face-down tile more or less), each change kept only if the quick look gets closer
    const own = P.target, gap = mm => NAMES.reduce((s, x) => s + (mm[x].first - own[x].first) + (mm[x].two - own[x].two) + (mm[x].four - own[x].four), 0) / 6;
    const base = b.clock ? b.solution.indexOf(b.clock.i) + 1 : 0, al = new Uint8Array(b.tiles.length).fill(1), nb0 = L.neighbors(tilesOf(b));
    for (let k = 0; k < 3 && !within(quick, own, false); k++) {
      const dir = gap(quick), c = { ...b, down: b.down.slice(), clock: b.clock ? { ...b.clock } : null };
      if (c.clock) { const nn = c.clock.n + (dir > 0 ? -1 : 1); if (nn < base + 1 || nn > base + 5) break; c.clock.n = nn; }
      else if (dir > 0) { const ob = c.obst || {}, ban = new Set([...(c.gold || []), ...Object.keys(ob.ice || {}).map(Number), ...(ob.locks || []), ...(ob.keys || [])]); const f = []; for (let i = 0; i < c.tiles.length; i++) if (!ban.has(i) && !c.down.includes(i) && !L.isFree(i, al, nb0)) f.push(i); if (!f.length) break; c.down.push(f[(lv * 31 + k) % f.length]); }
      else { if (c.down.length < 2) break; c.down.pop(); }
      if (!valid(c)) break;
      const mq = measure(c, SCREEN, 31 + lv + k + 1);
      if (distTo(mq, own) < distTo(quick, own)) { b = c; quick = mq; } else break;
    }
    out.push({ lv, shape, free: best.free, board: b, quick });
  }
  // measured properly: the ones a level nearby could use (quick look not far off any target near by)
  for (const c of out) {
    const near = job.near.map(t => distTo(c.quick, t));
    if (Math.min(...near) < 0.6) c.m = measure(c.board, SEARCH, 17011 + lv * 101 + out.indexOf(c));
  }
  return { lv, cands: out };
}

// ---------- 3. short tuning towards a target ----------
function tune(job) {
  const { L, measure, valid } = tools();
  const { target } = job; let b = job.board;
  const n = b.tiles.length, al = new Uint8Array(n).fill(1), nb0 = L.neighbors(tilesOf(b));
  const ob = b.obst || {}, banned = new Set([...(b.gold || []), ...Object.keys(ob.ice || {}).map(Number), ...(ob.locks || []), ...(ob.keys || []), ...(b.clock ? [b.clock.i] : [])]);
  const downOK = i => !banned.has(i) && !L.isFree(i, al, nb0);
  const d0 = b.down.length, base = b.clock ? b.solution.indexOf(b.clock.i) + 1 : 0;
  const r = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(job.lv * 9973 + 5);
  const gap = mm => NAMES.reduce((s, x) => s + (mm[x].first - target[x].first) + (mm[x].two - target[x].two) + (mm[x].four - target[x].four), 0) / 6;
  const free = c => { const o = []; for (let i = 0; i < n; i++) if (downOK(i) && !c.down.includes(i)) o.push(i); return o; };
  const propose = dir => {
    const c = { ...b, faces: b.faces.slice(), down: b.down.slice(), clock: b.clock ? { ...b.clock } : null }, k = r();
    if (k < 0.3) {   // a tile right under its twin makes a level harder; taking such a pair apart, easier
      const d = Math.floor(r() * n), ups = nb0.above[d]; if (!ups.length) return null; const u = ups[Math.floor(r() * ups.length)];
      if (dir > 0) { if (c.faces[d] === c.faces[u]) return null; const xs = []; for (let x = 0; x < n; x++) if (x !== u && x !== d && c.faces[x] === c.faces[u]) xs.push(x); if (!xs.length) return null; const x = xs[Math.floor(r() * xs.length)]; [c.faces[d], c.faces[x]] = [c.faces[x], c.faces[d]]; }
      else { if (c.faces[d] !== c.faces[u]) return null; const x = Math.floor(r() * n); if (c.faces[x] === c.faces[d]) return null; [c.faces[d], c.faces[x]] = [c.faces[x], c.faces[d]]; }
    } else if (k < 0.5) { const a = Math.floor(r() * n), z = Math.floor(r() * n); if (c.faces[a] === c.faces[z]) return null; [c.faces[a], c.faces[z]] = [c.faces[z], c.faces[a]]; }
    else if (k < 0.65 && c.clock) { const nn = c.clock.n + (dir > 0 ? -1 : 1); if (nn < base + 1 || nn > base + 4) return null; c.clock.n = nn; }
    else if (k < 0.8) { const f = free(c); if (!f.length) return null; c.down[Math.floor(r() * c.down.length)] = f[Math.floor(r() * f.length)]; }
    else if (dir > 0) { if (c.down.length >= d0 + 8) return null; const f = free(c); if (!f.length) return null; c.down.push(f[Math.floor(r() * f.length)]); }
    else { if (c.down.length <= d0 - 8) return null; c.down.splice(Math.floor(r() * c.down.length), 1); }
    return valid(c) ? c : null;
  };
  let seed = 17011 + job.lv * 101 + 3, m = job.m, d = distTo(m, target);
  for (let it = 0; it < TUNE_STEPS && !within(m, target, false, 0.8); it++) {
    let best = null;
    for (let q = 0; q < 4; q++) { const c = propose(gap(m)); if (!c) continue; const dc = distTo(measure(c, SCREEN, seed), target); if (!best || dc < best.d) best = { c, d: dc }; }
    if (best && best.d < d + 0.05) { const mc = measure(best.c, SEARCH, seed + 1); const dc = distTo(mc, target); if (dc < d) { b = best.c; m = mc; d = dc; } }
    seed += 1000003;
  }
  return { lv: job.lv, board: b, m, dist: d };
}

function validate(job) { const { measure } = tools(); return { lv: job.lv, final: measure(job.board, FINAL.runs, FINAL.seed + job.lv * 101) }; }

// ---------- workers ----------
function pool(jobs, kind, workers, done) {
  let i = 0, active = 0;
  return new Promise(res => {
    const next = () => {
      if (i >= jobs.length) { if (!active) res(); return; }
      const job = jobs[i++]; active++;
      const w = new Worker(__filename, { workerData: { kind, job } });
      w.on('message', m => done(m));
      w.on('error', e => console.error(kind, job.lv || (job.level && job.level.lv), e.stack));
      w.on('exit', () => { active--; next(); });
    };
    for (let k = 0; k < Math.max(1, workers); k++) next();
  });
}

const plan = () => { const P = readJ(PLAN, null); if (!P) throw Error('no analysis/variety-plan.json'); return P; };
const target = lv => plan().levels.find(l => l.lv === lv).target;

async function cmdCands(workers, from, to) {
  const P = plan(), { Hard } = gameModules();
  const C = readJ(CANDS_F, { made: new Date().toISOString(), levels: {} });
  // the levels that stay (70 up to the first one remade) are what new piles must not look like
  const fixed = []; for (let lv = 70; lv < from; lv++) fixed.push(Hard.get(lv).tiles);
  const todo = P.levels.filter(l => l.lv >= from && l.lv <= to && !C.levels[l.lv]);
  console.log(`cands: ${todo.length} levels to do (${Object.keys(C.levels).length} done), ${workers} workers`);
  const t0 = Date.now();
  await pool(todo.map(level => ({ level, fixed, near: P.levels.filter(x => Math.abs(x.lv - level.lv) <= NEAR && x.big === level.big).map(x => x.target) })), 'cands', workers, res => {
    const cur = readJ(CANDS_F, C); cur.levels[res.lv] = res.cands; writeJ(CANDS_F, cur); Object.assign(C, cur);
    console.log(`level ${res.lv}: ${res.cands.length} candidates (${res.cands.map(c => c.shape).join(', ')}) ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  });
}

function cmdAssign(from) {
  const P = plan(), C = readJ(CANDS_F, null); if (!C) throw Error('no candidates yet');
  const levels = P.levels.filter(l => l.lv >= from && C.levels[l.lv]);
  const all = []; for (const [lv, cs] of Object.entries(C.levels)) cs.forEach((c, k) => { if (c.m) all.push({ id: lv + ':' + k, made: +lv, c, s: sig(c.board.tiles) }); });
  // the boards the slower first method (variety.js) finished are candidates too (measured with 1200 games)
  const old = readJ(A('variety-progress.json'), { levels: {} });
  for (const [lv, r] of Object.entries(old.levels)) if (r.status === 'done' && +lv >= from) all.push({ id: 'old:' + lv, made: +lv, c: { shape: r.shape, board: r.board, m: r.final }, s: sig(r.board.tiles) });
  const optionsOf = l => all.filter(o => Math.abs(o.made - l.lv) <= NEAR && (o.made % 10 === 0) === l.big).map(o => ({ o, d: distTo(o.c.m, l.target), ok: within(o.c.m, l.target, false) }));
  // hardest first: the levels with the fewest close candidates choose first
  const order = levels.map(l => ({ l, opts: optionsOf(l) })).sort((a, b) => a.opts.filter(x => x.ok).length - b.opts.filter(x => x.ok).length || a.l.lv - b.l.lv);
  const used = new Set(), chosen = {};
  for (const { l, opts } of order) {
    const pick = opts.filter(x => !used.has(x.o.id) && !Object.values(chosen).some(c => c && tooAlike(c.s, x.o.s))).sort((a, b) => a.d - b.d)[0];
    if (!pick) { chosen[l.lv] = null; continue; }
    used.add(pick.o.id); chosen[l.lv] = { id: pick.o.id, made: pick.o.made, shape: pick.o.c.shape, board: pick.o.c.board, m: pick.o.c.m, dist: +pick.d.toFixed(3), ok: pick.ok, s: pick.o.s };
  }
  const out = { made: new Date().toISOString(), from, tol: TOL, novel: NOVEL, levels: {} };
  for (const l of levels) { const c = chosen[l.lv]; out.levels[l.lv] = c ? { ...c, s: undefined, status: c.ok ? 'close' : 'tune' } : { status: 'none' }; }
  writeJ(OUT, out);
  const st = s => Object.values(out.levels).filter(x => x.status === s).length;
  console.log(`assign: ${levels.length} levels: close enough ${st('close')}, to tune ${st('tune')}, no candidate ${st('none')}`);
}

async function cmdTune(workers) {
  const O = readJ(OUT, null);
  const jobs = Object.entries(O.levels).filter(([, x]) => x.status === 'tune' || x.status === 'missed').map(([lv, x]) => ({ lv: +lv, board: x.board, m: x.m, target: target(+lv) }));
  console.log(`tune: ${jobs.length} levels`);
  await pool(jobs, 'tune', workers, res => {
    const cur = readJ(OUT, O), x = cur.levels[res.lv];
    Object.assign(x, { board: res.board, m: res.m, dist: +res.dist.toFixed(3), status: within(res.m, target(res.lv), false) ? 'tuned' : 'tune-failed', final: undefined });
    writeJ(OUT, cur); Object.assign(O, cur);
    console.log(`level ${res.lv}: ${x.status} (off ${x.dist})`);
  });
}

async function cmdValidate(workers) {
  const O = readJ(OUT, null);
  const jobs = Object.entries(O.levels).filter(([, x]) => x.board && !x.final && ['close', 'tuned'].includes(x.status)).map(([lv, x]) => ({ lv: +lv, board: x.board }));
  console.log(`validate: ${jobs.length} levels`);
  await pool(jobs, 'validate', workers, res => {
    const cur = readJ(OUT, O), x = cur.levels[res.lv];
    x.final = res.final; x.status = within(res.final, target(res.lv), true) ? 'ok' : 'missed';
    writeJ(OUT, cur); Object.assign(O, cur);
    console.log(`level ${res.lv}: ${x.status}`);
  });
}

function cmdReport() {
  const P = plan(), O = readJ(OUT, null);
  const st = {}; for (const x of Object.values(O.levels)) st[x.status] = (st[x.status] || 0) + 1;
  console.log('status:', JSON.stringify(st));
  const shapes = {}; for (const x of Object.values(O.levels)) if (x.shape) shapes[x.shape] = (shapes[x.shape] || 0) + 1;
  console.log('shapes:', JSON.stringify(shapes));
  console.log('band      ' + NAMES.map(n => `${n.slice(0, 6)} 1st old/new  ease old/new`).join(' | '));
  for (let a = Math.floor(O.from / 10) * 10; a <= 269; a += 10) {
    const ls = P.levels.filter(l => l.lv >= Math.max(a, O.from) && l.lv < a + 10 && O.levels[l.lv] && O.levels[l.lv].final);
    if (!ls.length) continue;
    const avg = f => ls.reduce((s, l) => s + f(l), 0) / ls.length;
    console.log(`${a}-${a + 9}`.padEnd(10) + NAMES.map(n => `${avg(l => l.target[n].first).toFixed(2)}/${avg(l => O.levels[l.lv].final[n].first).toFixed(2)}       ${avg(l => ease(l.target[n])).toFixed(2)}/${avg(l => ease(O.levels[l.lv].final[n])).toFixed(2)}`).join('      | ') + `   (${ls.length} levels)`);
  }
}

function cmdApply(from) {
  const O = readJ(OUT, null), { Hard, T } = gameModules();
  const take = Object.entries(O.levels).filter(([lv, x]) => +lv >= from && x.status === 'ok').map(([lv, x]) => [+lv, x]);
  const NT = JSON.parse(JSON.stringify(T));
  NT.ratingModels = NT.ratingModels || T.levels.map(() => 'strong');
  for (const [lv, x] of take) {
    NT.levels[lv - NT.from] = Hard.pack({ ...x.board, info: { rate: +x.final['Mrs. Doubtfire'].first.toFixed(2), strong: +x.final.Dennisisdebeste.first.toFixed(2) } });
    NT.ratingModels[lv - NT.from] = 'personal';   // rate = Mrs. Doubtfire, strong = Dennisisdebeste (frozen observer)
  }
  NT.designVersions = [[70, NT.previousVersion || 7], [NT.reorderFrom || 92, NT.v], [from, NT.v + 1]];
  NT.v = NT.v + 1;
  const head = `/* Levels from 70, designed in advance (see hard.js). From ${from}: a new pile shape per level, the\n   difficulty curve as before (analysis/variety2.json, tools/sim/variety/variety2.js). 92-${from - 1}: the 1.54 reorder. */\n`;
  fs.writeFileSync(path.join(ROOT, 'www', 'levels-hard.js'), head + 'const HARD_LEVELS = ' + JSON.stringify(NT) + ';\n');
  const missing = []; for (let lv = from; lv <= 269; lv++) if (!take.some(([l]) => l === lv)) missing.push(lv);
  // the report the tests read
  fs.writeFileSync(A('variety.json'), JSON.stringify({ made: new Date().toISOString(), from, tol: TOL, novel: NOVEL, levels: take.map(([lv, x]) => ({ lv, shape: x.shape, target: target(lv), final: x.final })) }, null, 1));
  console.log(`apply: ${take.length} levels with a new board (v${NT.v})${missing.length ? '; kept the old board on ' + missing.join(', ') : ''}`);
}

if (!isMainThread) {
  const { kind, job } = workerData;
  parentPort.postMessage(kind === 'cands' ? candidates(job) : kind === 'tune' ? tune(job) : validate(job));
} else {
  const [cmd, a1, a2, a3] = process.argv.slice(2);
  (async () => {
    if (cmd === 'cands') await cmdCands(+(a1 || 2), +(a2 || 158), +(a3 || 269));
    else if (cmd === 'assign') cmdAssign(+(a1 || 158));
    else if (cmd === 'tune') await cmdTune(+(a1 || 2));
    else if (cmd === 'validate') await cmdValidate(+(a1 || 2));
    else if (cmd === 'report') cmdReport();
    else if (cmd === 'apply') cmdApply(+(a1 || 158));
    else console.log('usage: cands [workers] [from] [to] | assign [from] | tune [workers] | validate [workers] | report | apply [from]');
  })();
}
