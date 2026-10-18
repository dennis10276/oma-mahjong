/* Level variety (Dennis, 2026-10-18): levels that nobody has reached get a new pile shape each, with
   the SAME difficulty as the board they replace. Offline; never deploys. See analysis/variety-plan.md.

     node source/tools/sim/variety/variety.js plan  [from=157] [to=269]   targets + shape order
     node source/tools/sim/variety/variety.js build [workers=2] [only levels, e.g. 157,158]   resumable
     node source/tools/sim/variety/variety.js status
     node source/tools/sim/variety/variety.js apply   writes www/levels-hard.js + analysis/variety.json

   Difficulty: the frozen calibrated observer (tools/sim/honest) with both personal players
   (Dennisisdebeste, Mrs. Doubtfire), first try / within 2 / within 4 tries with memory, exactly as
   the 1.54 reorder measured it. Target per level: analysis/reorder-92.json moves[lv].primary (the
   board that is at that level now). A new board is accepted when, for both players, a 300-game
   search measurement and then an independent 1200-game measurement (other seeds) are within
   TOL of the target. Shape: a pile from tools/sim/variety/piles.js that is unlike every other
   designed level (NOVEL). Progress is saved after every level (analysis/variety-progress.json):
   any agent can stop and resume with the same command. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const A = f => path.join(ROOT, 'analysis', f);
const BASE = A('levels-before-variety.js');                 // the table before this change (kept)
const PLAN = A('variety-plan.json'), PROGRESS = A('variety-progress.json'), REPORT = A('variety.json');
const NAMES = ['Dennisisdebeste', 'Mrs. Doubtfire'];
const SEARCH = { runs: 300 }, FINAL = { runs: 1200, seed: 55001 };
const TOL = { first: 0.05, two: 0.06, four: 0.05, ease: 0.03 };
const NOVEL = { pos: 0.6, foot: 0.65 };                     // max share of the same spots / outline with any other level (today: ~0.94 / 0.97)
const hash = x => crypto.createHash('sha256').update(x).digest('hex').slice(0, 16);
const textHash = f => hash(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
const readJ = (f, d) => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d;
const writeJ = (f, x) => { fs.writeFileSync(f + '.tmp', JSON.stringify(x, null, 1)); fs.renameSync(f + '.tmp', f); };

// ---------- the game's designer and level table (www), the frozen observer (honest) ----------
function gameModules(tableFile) {
  const L = require(path.join(ROOT, 'www', 'layouts.js'));
  global.Layouts = L;
  global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(tableFile, 'utf8') + ';HARD_LEVELS');
  const Hard = require(path.join(ROOT, 'www', 'hard.js'));
  return { L, Hard, T: global.HARD_LEVELS };
}
const tilesOf = d => d.tiles.map(([x, y, z]) => ({ x, y, z }));
const tilePx = tiles => { let l = 1e9, r = -1e9, t0 = 1e9, b = -1e9; for (const t of tiles) { const x = t.x / 2 - t.z * 0.14, y = t.y / 2 * 1.24 - t.z * 0.14; l = Math.min(l, x); r = Math.max(r, x + 1); t0 = Math.min(t0, y); b = Math.max(b, y + 1.24); } return Math.min(384 / (r - l + 0.125), 592 / (b - t0 + 0.16)); };
// ---------- how alike two piles are (shifted to 0,0; also mirrored left-right) ----------
const norm = t => { const mx = Math.min(...t.map(a => a[0])), my = Math.min(...t.map(a => a[1])); return t.map(([x, y, z]) => [x - mx, y - my, z]); };
const mir = t => { const w = Math.max(...t.map(a => a[0])); return t.map(([x, y, z]) => [w - x, y, z]); };
const sig = t => { const n = norm(t), m = norm(mir(t)); return { pos: [new Set(n.map(a => a.join(','))), new Set(m.map(a => a.join(',')))], foot: [new Set(n.map(a => a[0] + ',' + a[1])), new Set(m.map(a => a[0] + ',' + a[1]))] }; };
const overlap = (A1, B) => { let c = 0; for (const k of A1) if (B.has(k)) c++; return c / Math.max(A1.size, B.size); };
const alike = (sa, sb) => ({ pos: Math.max(overlap(sa.pos[0], sb.pos[0]), overlap(sa.pos[1], sb.pos[0])), foot: Math.max(overlap(sa.foot[0], sb.foot[0]), overlap(sa.foot[1], sb.foot[0])) });

// ---------- plan ----------
function plan(from, to) {
  if (!fs.existsSync(BASE)) fs.copyFileSync(path.join(ROOT, 'www', 'levels-hard.js'), BASE);
  const { Hard, L } = gameModules(BASE);
  const R = JSON.parse(fs.readFileSync(A('reorder-92.json'), 'utf8'));
  const { SHAPE_NAMES } = require('./piles');
  const levels = [];
  for (let lv = from; lv <= to; lv++) {
    const m = R.moves.find(x => x.lv === lv); if (!m) throw Error('no reorder target for ' + lv);
    const d = Hard.get(lv), tiles = tilesOf(d), nb = L.neighbors(tiles), al = new Uint8Array(tiles.length).fill(1);
    let free = 0; for (let i = 0; i < tiles.length; i++) if (L.isFree(i, al, nb)) free++;
    // shapes in a rotation that spreads them out (7 and 31 have no common factor)
    const order = SHAPE_NAMES.map((_, k) => SHAPE_NAMES[((lv - from) * 7 + k * 11) % SHAPE_NAMES.length]).filter((s, i, a) => a.indexOf(s) === i);
    levels.push({ lv, big: lv % 10 === 0, tiles: tiles.length, layers: Math.max(...tiles.map(t => t.z)) + 1, free, down: d.down.length, clock: !!d.clock,
      target: Object.fromEntries(NAMES.map(n => [n, { first: m.primary[n].first, two: m.primary[n].two, four: m.primary[n].four }])), shapes: order });
  }
  const P = { made: new Date().toISOString(), from, to, base: 'analysis/levels-before-variety.js', baseHash: textHash(BASE),
    engine: textHash(path.join(ROOT, 'tools', 'sim', 'honest', 'hard.js')), reorder: textHash(A('reorder-92.json')), search: SEARCH, final: FINAL, tol: TOL, novel: NOVEL, levels };
  writeJ(PLAN, P);
  console.log(`plan: levels ${from}-${to} (${levels.length}), targets from reorder-92.json`);
}

// ---------- one level (worker) ----------
function buildLevel(job) {
  const { Hard, L } = gameModules(BASE);
  const H2 = require(path.join(ROOT, 'tools', 'sim', 'honest', 'hard.js')), L2 = require(path.join(ROOT, 'tools', 'sim', 'honest', 'layouts.js'));
  const profiles = require(path.join(ROOT, 'tools', 'sim', 'honest', 'players.json')).bots;
  const { pile } = require('./piles');
  const P = job.level, lv = P.lv, minPx = P.big ? 48 : 54;
  const fixed = job.fixed.map(t => sig(t));
  const log = [];
  // a board as the observer's game (as reorder_honest.js builds it)
  const obsGame = b => { const tiles = tilesOf(b), down = new Uint8Array(tiles.length); b.down.forEach(i => down[i] = 1); const o = b.obst;
    return { tiles, nb: L2.neighbors(tiles), down, faces: b.faces, rules: o ? { iceNb: L2.iceNeighbors(tiles), ice: o.ice || {}, locks: new Set(o.locks || []), keys: o.keys || [] } : null, clock: b.clock }; };
  const gameG = b => { const tiles = tilesOf(b), o = b.obst; const rules = o && (Object.keys(o.ice || {}).length || (o.keys || []).length) ? { iceNb: L.iceNeighbors(tiles), ice: o.ice || {}, locks: (o.keys || []).length ? new Set(o.locks) : null, keys: o.keys || [] } : null;
    return { tiles, nb: L.neighbors(tiles), faces: b.faces, rules, clock: b.clock }; };
  const measure = (b, runs, seed) => { const g = obsGame(b), out = {}; for (const n of NAMES) { const p = { ...H2.P, ...profiles[n].persona }; const r = H2.rateChain(g, runs, seed, p, p.memory, 4); out[n] = { first: r.first, two: r.within[1], four: r.within[3] }; } return out; };
  const ease = m => 0.5 * m.first + 0.25 * m.two + 0.25 * m.four;
  const dist = m => NAMES.reduce((s, n) => s + Math.abs(m[n].first - P.target[n].first) + 0.5 * Math.abs(m[n].two - P.target[n].two) + 0.5 * Math.abs(m[n].four - P.target[n].four), 0);
  const within = (m, ez) => NAMES.every(n => Math.abs(m[n].first - P.target[n].first) <= TOL.first && Math.abs(m[n].two - P.target[n].two) <= TOL.two && Math.abs(m[n].four - P.target[n].four) <= TOL.four && (!ez || Math.abs(ease(m[n]) - ease(P.target[n])) <= TOL.ease));
  // validity, as the game's boards: the stored way through works (ice, locks, tray, clock) and no
  // face-down tile is free at the start (the designer's "never the only way out" rule is about its
  // own dealing order, not the stored way through: today's boards do not keep it there either)
  const valid = b => { const g = gameG(b); if (!Hard.validSolution(g, b.solution)) return false; const al = new Uint8Array(b.tiles.length).fill(1);
    return b.down.every(i => !L.isFree(i, al, g.nb)); };
  // 1. piles: the planned shapes in turn, settings varied; keep the ones that fit and are new
  // A shape only shows with a smaller base and a taller pile (more layers, towers): with 80-96 tiles
  // that must stay big enough on a phone, a wide flat base is a block whatever its shape. Of the new
  // piles per shape, the one with the fewest free tiles at the start (closest to the old board).
  const piles = [];
  for (const shape of P.shapes) {
    const found = [];
    for (let s = 0; s < 8; s++) for (const bf of [0.2, 0.25, 0.3, 0.36]) for (const ly of [P.layers, P.layers + 1, P.layers + 2, P.layers + 3]) for (const st of [0.2, 0.4, 0.6]) {
      if (ly > 8) continue;
      const p = pile({ shape, seed: lv * 7907 + s * 131 + ly, target: P.tiles, layers: ly, aspect: 1.6, baseFrac: bf, stack: st, keep: [0.6, 0.85], twin: 0.35 });
      if (!p || p.tiles.length !== P.tiles || tilePx(p.tiles) < minPx) continue;
      const mz = Math.max(...p.tiles.map(t => t.z)) + 1; if (mz < P.layers - 1 || mz > P.layers + 4) continue;
      const nb = L.neighbors(p.tiles), al = new Uint8Array(p.tiles.length).fill(1); let fr = 0; for (let i = 0; i < p.tiles.length; i++) if (L.isFree(i, al, nb)) fr++;
      const t3 = p.tiles.map(t => [t.x, t.y, t.z]), sg = sig(t3);
      let worst = { pos: 0, foot: 0 }; for (const f of fixed) { const a = alike(sg, f); worst = { pos: Math.max(worst.pos, a.pos), foot: Math.max(worst.foot, a.foot) }; if (worst.pos > NOVEL.pos || worst.foot > NOVEL.foot) break; }
      if (worst.pos > NOVEL.pos || worst.foot > NOVEL.foot) continue;
      found.push({ shape, tiles: p.tiles, base: p.base, free: fr, layers: mz, alike: { pos: +worst.pos.toFixed(3), foot: +worst.foot.toFixed(3) } });
    }
    found.sort((a, b) => Math.abs(a.free - P.free) - Math.abs(b.free - P.free) || a.alike.pos - b.alike.pos);
    if (found.length) piles.push(found[0]);
    if (piles.length >= 3) break;
  }
  if (!piles.length) return { lv, status: 'failed', reason: 'no new pile fits', log };
  // 2. designs on every pile (other deals and clock tiles), all screened quickly; only the closest
  //    ones are tuned (a design that starts far off rarely gets there). A level that had a clock keeps one.
  const SCREEN = 120, DESIGNS = 4, TUNE = 3, T0 = Date.now(), MAX_MIN = 25;
  const designs = [];
  for (const [pi, pl] of piles.entries()) for (let k = 0; k < DESIGNS; k++) {
    const x = Hard.makeNow(lv, 1.6, 1, pi * DESIGNS + k, { tiles: pl.tiles });
    if (!x.solution || !valid(x) || (P.clock && !x.clock)) continue;
    const c = { tiles: x.tiles, faces: x.faces.slice(), down: x.down.slice(), gold: (x.gold || []).slice(), obst: x.obst, clock: x.clock ? { ...x.clock } : null, solution: x.solution.slice() };
    designs.push({ pi, pl, b: c, d: dist(measure(c, SCREEN, 31 + lv)) });
  }
  designs.sort((a, b2) => a.d - b2.d);
  log.push(`${designs.length} designs on ${piles.length} piles, closest off ${designs.map(x => x.d.toFixed(2)).slice(0, 4).join(', ')}`);
  if (!designs.length) return { lv, status: 'failed', reason: 'designer gave no valid board', log };
  for (const [di, ds] of designs.slice(0, TUNE).entries()) {
    const pi = ds.pi, pl = ds.pl; let b = ds.b;
    const r = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(lv * 9973 + di);
    const n = b.tiles.length, al = new Uint8Array(n).fill(1), nb0 = L.neighbors(tilesOf(b));
    const ob = b.obst || {}, banned = new Set([...(b.gold || []), ...Object.keys(ob.ice || {}).map(Number), ...(ob.locks || []), ...(ob.keys || []), ...(b.clock ? [b.clock.i] : [])]);
    const downOK = i => !banned.has(i) && !L.isFree(i, al, nb0);
    const d0 = b.down.length, base = b.clock ? b.solution.indexOf(b.clock.i) + 1 : 0;
    // too easy (> 0) or too hard (< 0): the average gap over both players and the three numbers
    const gap = mm => NAMES.reduce((s, x) => s + (mm[x].first - P.target[x].first) + (mm[x].two - P.target[x].two) + (mm[x].four - P.target[x].four), 0) / 6;
    const free = c => { const out = []; for (let i = 0; i < n; i++) if (downOK(i) && !c.down.includes(i)) out.push(i); return out; };
    // a change: when too easy mostly the harder ones (a face-down tile more, the clock a move shorter),
    // when too hard the other way; picture swaps both ways (several at once while far off)
    const propose = (dir, far) => {
      const c = { ...b, faces: b.faces.slice(), down: b.down.slice(), clock: b.clock ? { ...b.clock } : null };
      const k = r();
      if (k < 0.55) { for (let s = 0; s < (far ? 1 + Math.floor(r() * 3) : 1); s++) { const a = Math.floor(r() * n), z = Math.floor(r() * n); if (c.faces[a] !== c.faces[z]) [c.faces[a], c.faces[z]] = [c.faces[z], c.faces[a]]; } }
      else if (k < 0.7 && c.clock) { const nn = c.clock.n + (dir > 0 ? -1 : 1); if (nn < base + 1 || nn > base + 4) return null; c.clock.n = nn; }
      else if (k < 0.82) { const f = free(c); if (!f.length) return null; c.down[Math.floor(r() * c.down.length)] = f[Math.floor(r() * f.length)]; }
      else if (dir > 0) { if (c.down.length >= d0 + 4) return null; const f = free(c); if (!f.length) return null; c.down.push(f[Math.floor(r() * f.length)]); }
      else { if (c.down.length <= d0 - 4) return null; c.down.splice(Math.floor(r() * c.down.length), 1); }
      return valid(c) ? c : null;
    };
    let seed = 17011 + lv * 101 + pi * 7, m = measure(b, SEARCH.runs, seed), dd = dist(m), evals = 1;
    for (let it = 0; it < 40; it++) {
      if (it === 20 && dd > 0.25) break;   // far off half way: another pile
      if ((Date.now() - T0) / 60000 > MAX_MIN) { log.push(`stopped after ${MAX_MIN} minutes`); return { lv, status: 'failed', reason: 'time limit', log }; }
      const dir = gap(m), far = dd > 0.25;
      if (within(m, false)) {
        const mf = measure(b, FINAL.runs, FINAL.seed + lv * 101);
        evals += 4;
        if (within(mf, true)) return { lv, status: 'done', shape: pl.shape, pileBase: pl.base, alike: pl.alike, free: pl.free, board: b, search: m, final: mf, evals, log };
        log.push(`pile ${pi} ${pl.shape}: final check missed after ${it} steps (${NAMES.map(x => mf[x].first.toFixed(2)).join('/')} vs ${NAMES.map(x => P.target[x].first.toFixed(2)).join('/')})`);
        seed += 1000003; m = measure(b, SEARCH.runs, seed); dd = dist(m); evals++;   // other games, keep tuning
      }
      if (it && it % 9 === 0) { seed += 1000003; m = measure(b, SEARCH.runs, seed); dd = dist(m); evals++; }   // fresh games now and then (no tuning to one sample)
      let best = null;
      // each change first with a quick look (SCREEN games), the best one measured properly
      for (let q = 0; q < 4; q++) { const c = propose(dir, far); if (!c) continue; const mc = measure(c, SCREEN, seed); evals += SCREEN / SEARCH.runs; const dc = dist(mc); if (!best || dc < best.d) best = { c, d: dc }; }
      if (best && best.d < dd + 0.05) { const mc = measure(best.c, SEARCH.runs, seed); evals++; const dc = dist(mc); if (dc < dd) { b = best.c; m = mc; dd = dc; } }
    }
    log.push(`pile ${pi} ${pl.shape}: no match (off ${dd.toFixed(3)}, ${gap(m) > 0 ? 'too easy' : 'too hard'})`);
  }
  return { lv, status: 'failed', reason: 'difficulty not matched', log };
}

// ---------- build (resumable) ----------
function build(workers, only) {
  const P = readJ(PLAN, null); if (!P) throw Error('run plan first');
  if (P.baseHash !== textHash(BASE) || P.engine !== textHash(path.join(ROOT, 'tools', 'sim', 'honest', 'hard.js'))) throw Error('inputs changed since the plan; make a new plan');
  const prog = readJ(PROGRESS, { plan: P.made, levels: {} });
  if (prog.plan !== P.made) throw Error('progress belongs to another plan (move analysis/variety-progress.json away to start over)');
  const { Hard } = gameModules(BASE);
  // the levels that stay: 70 up to the first remade one, plus every remade one so far
  const fixedTiles = () => { const out = []; for (let lv = 70; lv < P.from; lv++) out.push(Hard.get(lv).tiles); for (let lv = P.to + 1; lv <= 269; lv++) out.push(Hard.get(lv).tiles); for (const r of Object.values(prog.levels)) if (r.status === 'done') out.push(r.board.tiles); return out; };
  const todo = P.levels.filter(l => (!only || only.includes(l.lv)) && !(prog.levels[l.lv] && prog.levels[l.lv].status === 'done'));
  console.log(`build: ${todo.length} levels to do, ${Object.values(prog.levels).filter(r => r.status === 'done').length} done, ${workers} workers`);
  let active = 0, idx = 0;
  const next = () => {
    if (idx >= todo.length) { if (!active) console.log('build: finished this round; `status` for the summary'); return; }
    const level = todo[idx++]; active++;
    const w = new Worker(__filename, { workerData: { level, fixed: fixedTiles() } });
    const t0 = Date.now();
    w.on('message', res => {
      res.minutes = +((Date.now() - t0) / 60000).toFixed(1); res.at = new Date().toISOString();
      const cur = readJ(PROGRESS, prog); cur.levels[res.lv] = res; Object.assign(prog, cur); writeJ(PROGRESS, cur);
      console.log(`level ${res.lv}: ${res.status}${res.shape ? ' (' + res.shape + ', alike ' + res.alike.pos + '/' + res.alike.foot + ')' : ''} ${res.reason || ''} ${res.minutes} min`);
    });
    w.on('error', e => { console.error('level', level.lv, 'error', e.stack); });
    w.on('exit', () => { active--; next(); });
  };
  for (let k = 0; k < Math.max(1, workers); k++) next();
}

function status() {
  const P = readJ(PLAN, null), prog = readJ(PROGRESS, { levels: {} });
  if (!P) return console.log('no plan yet');
  const rows = P.levels.map(l => prog.levels[l.lv] || { lv: l.lv, status: 'todo' });
  const c = s => rows.filter(r => r.status === s).length;
  console.log(`levels ${P.from}-${P.to}: done ${c('done')}, failed ${c('failed')}, todo ${c('todo')}`);
  const shapes = {}; rows.filter(r => r.status === 'done').forEach(r => shapes[r.shape] = (shapes[r.shape] || 0) + 1);
  console.log('shapes used:', JSON.stringify(shapes));
  const failed = rows.filter(r => r.status === 'failed'); if (failed.length) console.log('failed:', failed.map(r => r.lv + ' (' + r.reason + ')').join(', '));
}

// ---------- apply: the new table (not deployed) ----------
function apply() {
  const P = readJ(PLAN, null), prog = readJ(PROGRESS, { levels: {} });
  const done = P.levels.filter(l => prog.levels[l.lv] && prog.levels[l.lv].status === 'done');
  if (done.length !== P.levels.length && !process.argv.includes('--partial')) throw Error(`only ${done.length} of ${P.levels.length} levels done (--partial to write anyway)`);
  const { Hard, T } = gameModules(BASE);
  const NT = JSON.parse(JSON.stringify(T));
  NT.ratingModels = NT.ratingModels || T.levels.map(() => 'strong');
  for (const l of done) {
    const r = prog.levels[l.lv], b = r.board;
    NT.levels[l.lv - NT.from] = Hard.pack({ ...b, info: { rate: +r.final['Mrs. Doubtfire'].first.toFixed(2), strong: +r.final.Dennisisdebeste.first.toFixed(2) } });
    NT.ratingModels[l.lv - NT.from] = 'personal';   // rate = Mrs. Doubtfire, strong = Dennisisdebeste (frozen observer)
  }
  // saved half-played boards of a changed level start fresh: a design version per level range
  NT.designVersions = [[70, NT.previousVersion || 7], [NT.reorderFrom || 92, NT.v], [P.from, NT.v + 1]];
  NT.v = NT.v + 1;
  const head = `/* Levels from 70, designed in advance (see hard.js). ${P.from}-${P.to}: a new pile shape per level with the\n   difficulty of the board it replaced (analysis/variety.json, tools/sim/variety). 92-${P.from - 1}: the 1.54 reorder. */\n`;
  fs.writeFileSync(path.join(ROOT, 'www', 'levels-hard.js'), head + 'const HARD_LEVELS = ' + JSON.stringify(NT) + ';\n');
  const rep = { made: new Date().toISOString(), from: P.from, to: P.to, done: done.length, tol: TOL, novel: NOVEL, search: SEARCH, final: FINAL,
    levels: done.map(l => { const r = prog.levels[l.lv]; return { lv: l.lv, shape: r.shape, alike: r.alike, target: l.target, final: r.final, tiles: r.board.tiles.length, down: r.board.down.length, clock: r.board.clock }; }) };
  writeJ(REPORT, rep);
  console.log(`apply: ${done.length} levels written to www/levels-hard.js (v${NT.v}); report analysis/variety.json`);
}

if (!isMainThread) { parentPort.postMessage(buildLevel(workerData)); }
else {
  const [cmd, a1, a2] = process.argv.slice(2);
  if (cmd === 'plan') plan(+(a1 || 157), +(a2 || 269));
  else if (cmd === 'build') build(+(a1 || 2), a2 ? a2.split(',').map(Number) : null);
  else if (cmd === 'status') status();
  else if (cmd === 'apply') apply();
  else console.log('usage: plan [from] [to] | build [workers] [levels] | status | apply [--partial]');
}
