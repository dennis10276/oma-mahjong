#!/usr/bin/env node
'use strict';
// Measured steering for a banked puzzle (Dennis 2026-11-12: "a nice trap idea, the rest is easy; steer it harder after the trap").
//   node source/tools/builder/loop/heavy.js --label steer -- node source/tools/builder/bank/steer.js --puzzle c6b10b7f [--goal second-act|fewer-repeats]
//        [--moves down,relabel,obstacle|weave|spread|swap] [--dry] [--jobs 3] [--rounds 8] [--proposals 8] [--seed 1] [--target-D x] [--wall-min 8] [--finalize] [--fresh]
// Edit move: swap the faces of two tiles that the stored solution takes AFTER the clock tile, so the pairs (a1,a2),(b1,b2)
// become (a1,b1),(a2,b2). The clock tile, the stored solution up to and including the clock tile, keys, locks, ice, gold, every
// tile in a designed trap (static forks + engine forks) and every tile sharing a face with those are never touched; layout,
// face-down flags and clock.n are never touched. A valid child must: keep the clock minimum k, replay strictly (the old
// solution if it still wins, else a new clockShortest path with the same pre-clock tile set), be readable, keep the trap
// signature (engine forks before the clock) identical, and pass the static gates of profile e5-v1. Only then is it measured.
// Hill climb: best improving valid proposal per round, confirmed on a second seed block before it becomes the parent.
// State is saved after every round (source/build/bank/steer-<key8>.state.json), so a run can be resumed.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../../../..');
const BANK = path.join(ROOT, 'source/analysis/builder/bank/puzzles'), OUT = path.join(ROOT, 'source/analysis/builder/bank/steered'), BUILD = path.join(ROOT, 'source/build/bank');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const flag = n => process.argv.includes('--' + n);
const clone = x => JSON.parse(JSON.stringify(x));
const r3 = x => x == null || !Number.isFinite(x) ? x ?? null : Math.round(x * 1000) / 1000;

// seed blocks used for steering; disjoint from the generate.js screen/full seeds and from the CURVE seeds
const BLOCK = { A: [93001, 93002, 93003, 93004].map(seed => ({ seed, runs: 20 })), B: [93005, 93006, 93007, 93008].map(seed => ({ seed, runs: 20 })) };
const BUDGET = { nodes: 30000, ms: 60, cap: 12, depthNodes: 1500 };
const TOL = { B7: 0.02, minGain: 0.05, screen: 0.05, band: [0.30, 0.50], B7max: 0.3, Dnoise: 1.0 };

// ---------------------------------------------------------------- shared machinery (lazy: the main process needs little)
let _lib = null;
function lib() {
  if (_lib) return _lib;
  const R = p => require(path.join(ROOT, 'source/tools', p));
  const E = R('builder/engine.js'), PS = R('factory/placement_score.js'), M = R('factory/meter.js'), SG = R('builder/loop/static_gates.js'), GP = R('builder/loop/gate_profile.js'),
    T = R('builder/loop/traces.js'), MS = R('builder/bank/measure.js'), { createYardstick } = R('builder-next/yardstick.js');
  return (_lib = { E, PS, M, SG, GP, T, MS, createYardstick, ys: null, profile: null });
}
const ysOf = () => { const L = lib(); if (!L.ys) { L.ys = L.createYardstick({ protocol: 'extended-40-v1' }); L.profile = L.GP.loadProfile('e5-v1'); } return L; };

const posOf = d => new Map(d.solution.map((t, i) => [t, i]));
const clockPos = d => d.solution.indexOf(d.clock.i);
function trapTiles(d, spec) {
  const L = lib(), s = new Set();
  const raw = L.SG.staticGates(d, { shape: spec.shape, stopEarly: false });
  for (const f of raw.forks || []) for (const t of f.tempting || []) for (const x of [].concat(t.move)) if (Number.isInteger(x)) s.add(x);
  for (const f of L.T.defaultForks(L.E.game(d), BUDGET)) for (const t of f.tempting) for (const x of [].concat(t.move)) if (Number.isInteger(x)) s.add(x);
  return s;
}
function forkSig(d) {
  const L = lib();
  return JSON.stringify(L.T.defaultForks(L.E.game(d), BUDGET).map(f => [f.moves, f.tempting.map(t => [[].concat(t.move).sort((a, b) => a - b), t.kind, t.result]).sort()]));
}
function protectedSet(d, spec, trap) {
  const p = new Set([d.clock.i, ...(d.gold || []), ...(d.obst?.keys || []), ...(d.obst?.locks || []), ...Object.keys(d.obst?.ice || {}).map(Number), ...trap]);
  const cp0 = clockPos(d);
  for (let i = 0; i <= cp0; i++) p.add(d.solution[i]);
  return p;
}
function groupsOf(d) { const g = new Map(); d.faces.forEach((f, t) => { if (!g.has(f)) g.set(f, []); g.get(f).push(t); }); return g; }
// movable pair groups: size 2, both tiles late in the stored solution and unprotected
function movablePairs(d, prot) {
  const pos = posOf(d), cp0 = clockPos(d);
  return [...groupsOf(d).values()].filter(g => g.length === 2 && g.every(t => !prot.has(t) && pos.get(t) > cp0));
}
function coverOf(d) {
  const T = d.tiles, c = new Array(T.length).fill(0);
  for (let i = 0; i < T.length; i++) for (let j = 0; j < T.length; j++) if (T[j][2] > T[i][2] && Math.abs(T[j][0] - T[i][0]) < 2 && Math.abs(T[j][1] - T[i][1]) < 2) c[i]++;
  return c;
}

// ---------------------------------------------------------------- proposals (main process)
// Edit kinds (design edits; all leave the clock tile, the solution prefix through the clock, keys, locks, ice, trap tiles and clock.n alone):
//   swap     legacy: cross-swap faces of two late solution pairs
//   down     turn 1-3 late (after the clock) tiles face-down
//   weave    relabel whole late solution pairs so the two pairs of a repeated picture are open together
//   spread   relabel whole late solution pairs: swap a repeated picture's pair with a pair of an unrepeated picture
//   obstacle ice (strength 1 or 2) on a late tile whose ice-neighbours are gone in time in the stored solution
// (A second lock needs its own keys; the engine has one shared key set per board, so a late lock/keys obstacle is not offered.)
const MOVES_ALL = ['down', 'weave', 'spread', 'obstacle', 'swap'], MOVES_DEFAULT = ['down', 'weave', 'spread', 'obstacle'];
function parseMoves(s) {
  if (!s) return MOVES_DEFAULT.slice();
  const out = [];
  for (const t of String(s).split(',').map(x => x.trim()).filter(Boolean)) {
    const add = t === 'relabel' ? ['weave', 'spread'] : t === 'all' ? MOVES_DEFAULT : [t];
    for (const m of add) { if (!MOVES_ALL.includes(m)) throw Error('unknown move ' + m + ' (down, relabel|weave|spread, obstacle, swap)'); if (!out.includes(m)) out.push(m); }
  }
  return out;
}
function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296; }
const sortedKey = a => a.slice().sort((x, y) => x - y).join(',');
// solution pairs: how the tray matches the stored solution (earliest waiting twin)
function solPairs(d) {
  const tray = [], pairs = [];
  for (const t of d.solution) { const q = tray.findIndex(x => d.faces[x] === d.faces[t]); if (q >= 0) { pairs.push([tray[q], t]); tray.splice(q, 1); } else tray.push(t); }
  return pairs;
}
// avail[t]: first solution step after which t is free (takeable) when tiles leave in stored order
function availOf(d) {
  const L = lib(), g = L.E.game(clone(d)), n = d.tiles.length, alive = new Uint8Array(n).fill(1), init = alive.slice(), av = new Array(n).fill(-1);
  const can = i => alive[i] && (g.rules ? global.Layouts.takeable(i, alive, g.nb, g.rules, init) : global.Layouts.isFree(i, alive, g.nb));
  for (let s = 0; s <= d.solution.length; s++) {
    for (let i = 0; i < n; i++) if (av[i] < 0 && can(i)) av[i] = s;
    if (s < d.solution.length) alive[d.solution[s]] = 0;
  }
  return av;
}
function ctxOfDesign(d, prot) {
  const pos = posOf(d), cp0 = clockPos(d), cov = coverOf(d), av = availOf(d), L = lib();
  const protFaces = new Set([...prot].map(t => d.faces[t]));
  const pairs = solPairs(d).map(p => { const lo = Math.min(av[p[0]], av[p[1]]), hi = Math.max(pos.get(p[0]), pos.get(p[1])); return { t: p, lo, hi, face: d.faces[p[0]], late: p.every(t => pos.get(t) > cp0 && !prot.has(t)) && !protFaces.has(d.faces[p[0]]) }; });
  const byFace = new Map(); for (const p of pairs) { if (!byFace.has(p.face)) byFace.set(p.face, []); byFace.get(p.face).push(p); }
  const iceNb = L.E.game(clone(d)).iceNb;
  return { pos, cp0, cov, av, pairs, byFace, iceNb, prot };
}
const overlap = (a, b) => Math.max(0, Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo));
// report: repeated pictures and where their pairs sit
function repeatReport(d, ctx) {
  const rep = [...ctx.byFace.values()].filter(g => g.length > 1);
  const pre = rep.reduce((s, g) => s + g.filter(p => !p.t.every(t => ctx.pos.get(t) > ctx.cp0)).length, 0), post = rep.reduce((s, g) => s + g.length, 0) - pre;
  return { repeatedPictures: rep.length, repeatedPairsBeforeClock: pre, repeatedPairsAfterClock: post, movableLatePairs: ctx.pairs.filter(p => p.late).length,
    movableRepeated: rep.filter(g => g.some(p => p.late)).length, repeatedWindows: rep.map(g => ({ face: g[0].face, windows: g.map(p => [p.lo, p.hi]), overlap: g.length > 1 ? overlap(g[0], g[1]) : 0 })) };
}
function relabelEdit(P, Q) { // exchange the pictures of two whole pairs
  return { type: 'relabel', assign: [[P.t[0], Q.face], [P.t[1], Q.face], [Q.t[0], P.face], [Q.t[1], P.face]] };
}
function genMove(kind, d, ctx, count, rand, tried) {
  const out = [], seen = new Set(), push = c => { if (!tried.has(c.key) && !seen.has(c.key)) { seen.add(c.key); out.push(c); } };
  const late = ctx.pairs.filter(p => p.late), rep = [...ctx.byFace.values()].filter(g => g.length > 1);
  const pick = a => a[Math.floor(rand() * a.length)];
  for (let n = 0; n < count * 40 && out.length < count; n++) {
    if (kind === 'down') {
      const cand = [...Array(d.tiles.length).keys()].filter(t => ctx.pos.get(t) > ctx.cp0 && !ctx.prot.has(t) && !d.down.includes(t));
      if (!cand.length) break;
      const k = 1 + Math.floor(rand() * 3), pool = cand.map(t => ({ t, w: 1 + (ctx.cov[t] > 0 ? 3 : 0) + rand() * 2 })).sort((a, b) => b.w - a.w);
      const chosen = [];
      if (rand() < 0.5) { const p = pick(late); if (p) for (const t of p.t) if (cand.includes(t) && chosen.length < k) chosen.push(t); } // twins of a late pair
      for (const x of pool) { if (chosen.length >= k) break; if (!chosen.includes(x.t) && rand() < 0.6) chosen.push(x.t); }
      if (!chosen.length) continue;
      push({ key: 'down:' + sortedKey(chosen), move: 'down', edit: { type: 'down', tiles: chosen }, tiles: chosen, score: chosen.reduce((s, t) => s + (ctx.cov[t] > 0 ? 1 : 0), 0) + rand() });
    } else if (kind === 'weave') {
      const g = pick(rep); if (!g) break;
      const [A, B] = g.length > 1 ? [g[0], g[1]] : [g[0], g[0]];
      const moved = rand() < 0.5 ? B : A, fixed = moved === B ? A : B;
      if (!moved.late) continue;
      const C = pick(late.filter(p => p !== moved && p.face !== moved.face)); if (!C) continue;
      const gain = overlap(fixed, C) - overlap(fixed, moved), key = 'rl:' + sortedKey([...moved.t, ...C.t]);
      push({ key, move: 'weave', edit: relabelEdit(moved, C), tiles: [...moved.t, ...C.t], pairsBefore: [moved.t, C.t], pairsAfter: [[moved.face, C.face]], gain, score: gain + rand() * 2 });
    } else if (kind === 'spread') {
      const g = pick(rep.filter(r => r.some(p => p.late))); if (!g) break;
      const P = pick(g.filter(p => p.late)), Q = pick(late.filter(p => ctx.byFace.get(p.face).length === 1)); if (!Q) continue;
      const gain = Math.abs(P.hi - Q.hi), key = 'rl:' + sortedKey([...P.t, ...Q.t]);
      push({ key, move: 'spread', edit: relabelEdit(P, Q), tiles: [...P.t, ...Q.t], pairsBefore: [P.t, Q.t], pairsAfter: [[P.face, Q.face]], gain, score: gain / 10 + rand() * 2 });
    } else if (kind === 'obstacle') {
      const cand = [...Array(d.tiles.length).keys()].filter(t => ctx.pos.get(t) > ctx.cp0 && !ctx.prot.has(t) && !d.down.includes(t) && ctx.iceNb[t].length > 0);
      if (!cand.length) break;
      const t = pick(cand), h = rand() < 0.5 ? 1 : 2, gone = ctx.iceNb[t].filter(j => ctx.pos.get(j) < ctx.pos.get(t)).length;
      if (h > ctx.iceNb[t].length || gone < h) continue; // stored solution would break
      push({ key: 'ice:' + t + ':' + h, move: 'obstacle', edit: { type: 'ice', tile: t, h }, tiles: [t], h, score: gone - h + rand() * 2 });
    } else if (kind === 'swap') {
      if (late.length < 2) break;
      const A = pick(late), B = pick(late); if (A === B) continue;
      const i = Math.floor(rand() * 2), j = Math.floor(rand() * 2), u = A.t[i], v = B.t[j];
      push({ key: 'sw:' + sortedKey([u, v]), move: 'swap', edit: { type: 'swap', tiles: [u, v] }, tiles: [u, v], pairsBefore: [A.t, B.t], score: rand() * 2 });
    }
  }
  out.sort((a, b) => b.score - a.score);
  const top = out.slice(0, Math.ceil(count * 0.75)), rest = out.slice(top.length);
  while (top.length < count && rest.length) top.push(rest.splice(Math.floor(rand() * rest.length), 1)[0]);
  return top;
}
function propose(d, ctx, moves, total, rand, tried) {
  const per = Math.ceil(total / moves.length), out = [];
  for (const m of moves) out.push(...genMove(m, d, ctx, per, rand, tried));
  return out;
}
function applyEdit(d, e) {
  const c = clone(d);
  if (e.type === 'swap') [c.faces[e.tiles[0]], c.faces[e.tiles[1]]] = [c.faces[e.tiles[1]], c.faces[e.tiles[0]]];
  else if (e.type === 'down') c.down = c.down.concat(e.tiles);
  else if (e.type === 'relabel') for (const [t, f] of e.assign) c.faces[t] = f;
  else if (e.type === 'ice') { c.obst = clone(c.obst || {}); c.obst.ice = { ...(c.obst.ice || {}), [e.tile]: e.h }; }
  else throw Error('bad edit ' + e.type);
  return c;
}


// ---------------------------------------------------------------- validation (worker)
function validate(parent, child, spec, parentK, parentSig) {
  const L = ysOf(), E = L.E;
  const cp0 = clockPos(parent), pre = new Set(parent.solution.slice(0, cp0 + 1));
  let ok = E.replay(child, child.solution, { strict: true }).ok, route = 'old solution';
  if (!ok) {
    const cs = E.clockShortest(E.game(clone(child)), { nodes: 300000, ms: Infinity, finishNodes: 100000, finishMs: Infinity });
    if (!cs || cs.unsure || !cs.path) return { valid: false, why: 'witness lost, no new route' };
    const sol = E.flatten(cs.path);
    const cpn = sol.indexOf(child.clock.i);
    if (cpn !== cp0 || !sol.slice(0, cpn + 1).every(t => pre.has(t))) return { valid: false, why: 'new route changes the clock route tiles' };
    const c2 = clone(child); c2.solution = sol;
    if (!E.replay(c2, sol, { strict: true }).ok) return { valid: false, why: 'new route not strict' };
    child.solution = sol; route = 'new route';
  }
  const cs = E.clockShortest(E.game(clone(child)));
  if (!cs || cs.unsure) return { valid: false, why: 'k unproven' };
  if (cs.k !== parentK) return { valid: false, why: 'k changed ' + parentK + '->' + cs.k };
  if (!L.PS.readable(child)) return { valid: false, why: 'unreadable' };
  if (forkSig(child) !== parentSig) return { valid: false, why: 'trap signature changed' };
  const raw = L.SG.staticGates(child, { shape: spec.shape, stopEarly: false }), stat = L.GP.applyStatic(raw, L.profile);
  const unresolved = L.GP.unresolvedStatic(stat, L.profile, { spare: spec.spare });
  if (!(stat.pass === true && stat.shipSpares.includes(spec.spare) && !unresolved.length)) return { valid: false, why: 'static: ' + (L.profile.static.required.filter(k => stat.gates[k]?.pass !== true).join('+') || 'unresolved ' + unresolved.join('+')) };
  return { valid: true, route };
}
function metrics(d, block, campaigns, secondAct = true) {
  const L = ysOf(), blocks = Array.isArray(block) ? block : BLOCK[block];
  const tr = L.T.traceGates(d, L.GP.traceOptions({ ys: L.ys, spare: null, campaigns, cap: L.ys.pins.cap, maxAttempts: L.ys.pins.cap, protocol: L.ys.protocol, secondAct, subBlocks: blocks.map(b => ({ ...b, maxAttempts: L.ys.pins.cap })) }, L.profile));
  return { valid: tr.valid === true, D: tr.D, B1: tr.B1, B2: tr.B2, B3: tr.B3, B4: tr.B4, B5: tr.B5, B6: tr.B6, B7: tr.B7, errorKinds: tr.errorKinds, lossKinds: tr.lossKinds, counts: tr.counts, examples: tr.examples, pass: tr.pass,
    s: { B1: tr.B1.pass, B2: tr.B2.pass, B5: tr.B5.pass, B6: r3(tr.B6.value), B7: r3(tr.B7.value), D: tr.D } };
}

// ---------------------------------------------------------------- worker entry
async function worker() {
  const input = JSON.parse(fs.readFileSync(0, 'utf8')), t0 = process.cpuUsage();
  let res;
  try {
    if (input.task === 'proposal') {
      const parent = input.parent, child = applyEdit(parent, input.edit);
      const v = validate(parent, child, input.spec, input.k, input.sig);
      res = { ...v };
      if (v.valid && input.validateOnly) res.solution = child.solution;
      else if (v.valid) { res.A = metrics(child, 'A', 80); res.solution = child.solution; }
    } else if (input.task === 'measure') res = { m: metrics(input.design, input.block, 80) };
    else if (input.task === 'full-S') { const L = ysOf(); res = { sFull: L.MS.skilled(L.ys.meters.planner, input.design, [91001, 91002].map(sd => ({ runs: 40, seed: sd }))) }; }
    else if (input.task === 'full-D') { const L = ysOf(); res = { dFull: L.MS.family(L.ys.meters.family, input.design, input.seeds.map(sd => ({ runs: 40, seed: sd })), 40) }; }
    else if (input.task === 'full-stab') {
      const L = ysOf(), design = input.design;
      res = { steps: [0, 1, 2].map(e => { const dd = clone(design); dd.clock.n = design.clock.n + e; const m = L.MS.family(L.ys.meters.family, dd, [{ runs: 40, seed: 90002 }], 40); return { extra: e, ok: m.ok, D20: m.D20, D40: m.D40 }; }) };
    } else if (input.task === 'full-trace') {
      const L = ysOf(), tr = L.T.traceGates(input.design, L.GP.traceOptions({ ys: L.ys, spare: null, campaigns: 80, cap: L.ys.pins.cap, maxAttempts: L.ys.pins.cap, protocol: L.ys.protocol, secondAct: !!input.secondAct }, L.profile));
      res = { trace: { pass: tr.pass, D: tr.D, campaigns: tr.campaigns, wonOn: tr.wonOn, valid: tr.valid, ruler: tr.ruler, gates: Object.fromEntries(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'].map(k => [k, tr[k]])), counts: tr.counts, errorKinds: tr.errorKinds, lossKinds: tr.lossKinds, examples: tr.examples } };
    }
  } catch (e) { res = { valid: false, why: 'exception: ' + String(e && e.message || e).slice(0, 200) }; }
  const u = process.cpuUsage(t0);
  res._cpuSec = (u.user + u.system) / 1e6;
  process.stdout.write('\n@@RESULT@@' + JSON.stringify(res) + '\n');
}

// ---------------------------------------------------------------- pool (main)
function runJob(input) {
  return new Promise(resolve => {
    const p = cp.spawn(process.execPath, [__filename, '--worker'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('close', () => {
      const i = out.lastIndexOf('@@RESULT@@');
      if (i < 0) return resolve({ valid: false, why: 'worker crashed: ' + err.slice(-200), _cpuSec: 0 });
      try { resolve(JSON.parse(out.slice(i + 10))); } catch (e) { resolve({ valid: false, why: 'worker output unreadable', _cpuSec: 0 }); }
    });
    p.stdin.end(JSON.stringify(input));
  });
}
async function pool(inputs, n = 8) {
  const res = new Array(inputs.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, inputs.length) }, async () => { while (next < inputs.length) { const i = next++; res[i] = await runJob(inputs[i]); } }));
  return res;
}

// ---------------------------------------------------------------- objective
// Returns { ok, why, value } for a child measured on a block against the parent measured on the same block.
function judge(goal, pm, cm, targetD) {
  const reasons = [];
  if (!cm.valid) return { ok: false, why: 'trace invalid' };
  if (cm.B1.pass !== true) reasons.push('B1');
  if (cm.B2.pass !== true) reasons.push('B2');
  if (cm.B5.pass !== true) reasons.push('B5');
  const dHi = targetD != null ? targetD : pm.D + 2;
  if (goal === 'second-act') {
    if (cm.D < pm.D - TOL.Dnoise) reasons.push('D below parent (noise tolerance ' + TOL.Dnoise + ')');
    if (cm.D > dHi) reasons.push('D above ' + dHi);
    if (cm.B7.value > pm.B7.value + TOL.B7) reasons.push('B7 rose');
    if (cm.B6.value > TOL.band[1]) reasons.push('B6 above band');
    return { ok: !reasons.length, why: reasons.join('+'), value: cm.B6.value - pm.B6.value };
  }
  if (cm.D < pm.D - 2) reasons.push('D fell more than 2');
  if (cm.D > dHi) reasons.push('D above ' + dHi);
  if (cm.B6.value > 0.40) reasons.push('B6 above 0.40');
  return { ok: !reasons.length, why: reasons.join('+'), value: pm.B7.value - cm.B7.value };
}
const reached = (goal, a, b) => goal === 'second-act'
  ? [a, b].every(m => m.B6.value >= TOL.band[0] && m.B6.value <= TOL.band[1])
  : [a, b].every(m => m.B7.value <= TOL.B7max);

// ---------------------------------------------------------------- main
async function main() {
  const prefix = arg('puzzle'); if (!prefix) throw Error('--puzzle <boardKey prefix> required');
  const file = fs.readdirSync(BANK).find(f => f.startsWith(prefix)); if (!file) throw Error('no banked puzzle ' + prefix);
  const base = JSON.parse(fs.readFileSync(path.join(BANK, file), 'utf8'));
  const key8 = base.card.boardKey.slice(0, 8), goal = arg('goal', 'second-act'), maxRounds = +arg('rounds', 8), P = +arg('proposals', 8), seed = +arg('seed', 1);
  const moves = parseMoves(arg('moves')), targetD = arg('target-D') != null ? +arg('target-D') : null, wallMs = +arg('wall-min', 8) * 60000, started = Date.now();
  if (flag('dry')) { // generate and VALIDATE proposals only: no state, no log, no measurement
    const d0 = base.design, spec0 = base.spec, k0 = base.card.clock.k, N = +arg('proposals', 60), jobs = +arg('jobs', 3);
    const trap = trapTiles(d0, spec0), prot = protectedSet(d0, spec0, trap), sig = forkSig(d0), ctx = ctxOfDesign(d0, prot);
    console.log('[dry] ' + key8 + ' tiles ' + d0.tiles.length + ' clock pos ' + ctx.cp0 + ' k ' + k0 + ' protected ' + prot.size + ' (trap ' + trap.size + ') down ' + d0.down.length);
    console.log('[dry] repeats ' + JSON.stringify({ ...repeatReport(d0, ctx), repeatedWindows: undefined }));
    console.log('[dry] repeated windows [open..taken] per picture ' + JSON.stringify(repeatReport(d0, ctx).repeatedWindows));
    const rep0 = repeatReport(d0, ctx);
    if (rep0.repeatedPairsBeforeClock === 0) console.log('[dry] all repeated pictures already sit after the clock; spread/weave can only move repetition between late pairs (' + rep0.movableLatePairs + ' movable late pairs)');
    for (const m of moves) {
      const t0 = Date.now(), props = genMove(m, d0, ctx, N, rng(seed * 1000003 + 17), new Set());
      const res = await pool(props.map(p => ({ task: 'proposal', validateOnly: true, parent: d0, edit: p.edit, spec: spec0, k: k0, sig })), jobs);
      const why = {}; let valid = 0, cpu = 0; const ex = [];
      res.forEach((x, i) => { cpu += x._cpuSec || 0; if (x.valid) { valid++; if (ex.length < 3) ex.push({ tiles: props[i].tiles, edit: props[i].edit, route: x.route }); } else { const k = (x.why || '').replace(/(?<![A-Z])[0-9>-]+/g, '#'); why[k] = (why[k] || 0) + 1; } });
      console.log('[dry] ' + m + ': proposed ' + props.length + ' valid ' + valid + ' invalid ' + (props.length - valid) + ' ' + JSON.stringify(why) + ' cpu ' + Math.round(cpu) + 's (' + (props.length ? (cpu / props.length).toFixed(1) : 0) + 's each), wall ' + Math.round((Date.now() - t0) / 1000) + 's');
      for (const e of ex) console.log('[dry]   example ' + JSON.stringify(e));
    }
    return;
  }
  fs.mkdirSync(BUILD, { recursive: true });
  const stateFile = path.join(BUILD, `steer-${key8}.state.json`), logFile = path.join(BUILD, `steer-${key8}.jsonl`);
  const log = o => fs.appendFileSync(logFile, JSON.stringify(o) + '\n');
  let st = !flag('fresh') && fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
  if (!st) { st = { goal, base: base.card.boardKey, edits: [], steps: [], round: 0, noImprove: 0, tried: [], cpuSec: 0, wallSec: 0, counts: { proposals: 0, invalid: 0, valid: 0, accepted: 0, rejectedAtConfirm: 0 }, parent: null, done: false, finalized: false }; if (fs.existsSync(logFile)) fs.unlinkSync(logFile); }
  const save = () => { st.wallSec = (st.wallSecBase || 0) + (Date.now() - started) / 1000; fs.writeFileSync(stateFile, JSON.stringify(st)); };
  st.wallSecBase = st.wallSec || 0;
  if (st.swaps) { st.edits = st.swaps.map(t => ({ type: 'swap', tiles: t })); delete st.swaps; }
  const designOfEdits = edits => edits.reduce((d, e) => applyEdit(d, e), base.design);
  const spec = base.spec;
  let cur = designOfEdits(st.edits);
  if (st.edits.length) cur.solution = st.solution || cur.solution;
  const curK = base.card.clock.k;
  console.log(`[steer] ${key8} goal ${goal}, state: round ${st.round}, ${st.edits.length} accepted edits, done=${st.done}`);

  if (!flag('finalize') && !st.done) {
    // parent baselines on both blocks
    if (!st.parent) {
      const [a, b] = await pool([{ task: 'measure', design: cur, block: 'A' }, { task: 'measure', design: cur, block: 'B' }], 2);
      st.cpuSec += a._cpuSec + b._cpuSec; st.parent = { A: a.m, B: b.m };
      console.log(`[steer] parent A: D ${a.m.D} B6 ${a.m.B6.value} B7 ${a.m.B7.value} | B: D ${b.m.D} B6 ${b.m.B6.value} B7 ${b.m.B7.value}`);
      log({ event: 'parent', A: a.m.s, B: b.m.s }); save();
    }
    if (reached(goal, st.parent.A, st.parent.B)) st.done = true;
    for (let r = 0; r < maxRounds && !st.done; r++) {
      if (Date.now() - started > wallMs - 90000) { console.log('[steer] wall budget reached, state saved; rerun to resume'); break; }
      st.round++;
      const trap = trapTiles(cur, spec), prot = protectedSet(cur, spec, trap), sig = forkSig(cur);
      const rand = rng(seed * 1000003 + st.round * 7919 + st.edits.length);
      const ctx = ctxOfDesign(cur, prot), props = propose(cur, ctx, moves, P * 5, rand, new Set(st.tried));
      console.log(`[steer] round ${st.round}: ${props.length} candidate edits [${moves.join(',')}] (movable late pairs ${ctx.pairs.filter(p => p.late).length}, protected ${prot.size}), validating then measuring up to ${P}`);
      if (!props.length) { st.noImprove = 99; st.done = true; save(); break; }
      const vres = await pool(props.map(p => ({ task: 'proposal', validateOnly: true, parent: cur, edit: p.edit, spec, k: curK, sig })), 8);
      const validIdx = []; const rows = [];
      props.forEach((p, i) => { const x = vres[i]; st.cpuSec += x._cpuSec || 0; st.counts.proposals++; st.tried.push(p.key);
        if (!x.valid) { st.counts.invalid++; log({ event: 'proposal', round: st.round, move: p.move, edit: p.edit, tiles: p.tiles, heuristicGain: p.gain, valid: false, invalidWhy: x.why }); }
        else { st.counts.valid++; validIdx.push(i); } });
      const why = {}; props.forEach((p, i) => { if (!vres[i].valid) { const k = (vres[i].why || '').replace(/(?<![A-Z])[0-9>-]+/g, '#'); why[k] = (why[k] || 0) + 1; } });
      console.log('  invalid:', JSON.stringify(why), ' valid:', validIdx.length);
      const byMove = {}; validIdx.forEach(i => (byMove[props[i].move] ||= []).push(i));
      const pick = []; for (let n = 0; pick.length < Math.min(P, validIdx.length); n++) for (const m of Object.keys(byMove)) if (byMove[m][n] != null && pick.length < P) pick.push(byMove[m][n]); // mix the kinds
      const mres = await pool(pick.map(i => { const c = applyEdit(cur, props[i].edit); c.solution = vres[i].solution; return { task: 'measure', design: c, block: 'A' }; }), 8);
      pick.forEach((i, n) => {
        const p = props[i], x = { valid: true, route: vres[i].route, solution: vres[i].solution, A: mres[n].m, _cpuSec: mres[n]._cpuSec }; st.cpuSec += x._cpuSec || 0;
        const j = judge(goal, st.parent.A, x.A, targetD);
        log({ event: 'proposal', round: st.round, move: p.move, edit: p.edit, tiles: p.tiles, heuristicGain: p.gain, valid: true, route: x.route, A: x.A.s, judged: { ok: j.ok, why: j.why, value: r3(j.value) } });
        rows.push({ p, x, j });
        console.log(`  ${p.move} ${p.tiles.join('<->')} D ${x.A.D} B6 ${x.A.B6.value} B7 ${x.A.B7.value} B1 ${x.A.B1.pass} B2 ${x.A.B2.pass} B5 ${x.A.B5.pass} -> ${j.ok ? 'ok ' + r3(j.value) : 'no ' + j.why}`);
      });
      const kindRows = {}; for (const r of rows) { const k = kindRows[r.p.move] ||= { measured: 0, ok: 0, best: null }; k.measured++; if (r.j.ok) k.ok++; if (r.j.value != null && (k.best == null || r.j.value > k.best)) k.best = r3(r.j.value); }
      log({ event: 'roundKinds', round: st.round, kinds: kindRows });
      const good = rows.filter(r => r.x.valid && r.j.ok && r.j.value >= TOL.screen).sort((a, b) => b.j.value - a.j.value);
      let accepted = null;
      for (const g of good.slice(0, 2)) {
        const child = applyEdit(cur, g.p.edit); child.solution = g.x.solution;
        const [c] = await pool([{ task: 'measure', design: child, block: 'B' }], 1); st.cpuSec += c._cpuSec || 0;
        const j = judge(goal, st.parent.B, c.m, targetD), okB = j.ok && j.value >= TOL.minGain; // confirmed gain on the second seed block must be at least 0.05
        log({ event: 'confirm', round: st.round, move: g.p.move, tiles: g.p.tiles, B: c.m.s, judged: { ok: j.ok, why: j.why, value: r3(j.value) }, confirmed: okB });
        console.log(`  confirm ${g.p.tiles.join('<->')} on block B: D ${c.m.D} B6 ${c.m.B6.value} B7 ${c.m.B7.value} -> ${okB ? 'CONFIRMED' : 'rejected ' + (j.why || 'gain ' + r3(j.value) + ' < ' + TOL.minGain)}`);
        if (okB) { accepted = { g, child, mB: c.m }; break; } else st.counts.rejectedAtConfirm++;
      }
      if (accepted) {
        const { g, child, mB } = accepted;
        st.steps.push({ move: g.p.move, edit: g.p.edit, tiles: g.p.tiles, pairsBefore: g.p.pairsBefore, pairsAfter: g.p.pairsAfter, before: { A: st.parent.A.s, B: st.parent.B.s }, after: { A: g.x.A.s, B: mB.s }, route: g.x.route });
        st.edits.push(g.p.edit); st.solution = child.solution; cur = child; st.parent = { A: g.x.A, B: mB }; st.counts.accepted++; st.noImprove = 0; st.tried = [];
        if (reached(goal, st.parent.A, st.parent.B)) st.done = true;
      } else { st.noImprove++; if (st.noImprove >= 2) st.done = true; }
      console.log(`[steer] round ${st.round} ${accepted ? 'ACCEPTED' : 'no improvement'} (noImprove ${st.noImprove}), parent A: D ${st.parent.A.D} B6 ${st.parent.A.B6.value} B7 ${st.parent.A.B7.value}; B6 B-block ${st.parent.B.B6.value}`);
      save();
    }
    if (st.round >= maxRounds + (st.roundsAtStart || 0) && !st.done) { /* round cap hit */ }
    save();
    if (st.done) console.log(`[steer] search finished: goal ${reached(goal, st.parent.A, st.parent.B) ? 'REACHED' : 'NOT reached'}; run again with --finalize`);
    return;
  }

  // ---- finalize: full measurement as generate.js does for a banked puzzle
  if (!st.steps.length) { console.log('[steer] nothing improved, nothing to finalize'); return; }
  const design = cur; design.solution = st.solution || design.solution;
  const ys = ysOf();
  const jobs = [{ task: 'full-S', design }, { task: 'full-D', design, seeds: [92001, 92002] }, { task: 'full-D', design, seeds: [92003, 92004] }, { task: 'full-stab', design }, { task: 'full-trace', design, secondAct: goal === 'second-act' }];
  console.log('[steer] finalize: ' + jobs.length + ' parallel workers');
  const [S, D1, D2, STAB, TR] = await pool(jobs, 8);
  st.cpuSec += [S, D1, D2, STAB, TR].reduce((s, x) => s + (x._cpuSec || 0), 0);
  const MS = ys.MS, raw = [...D1.dFull.raw, ...D2.dFull.raw];
  const dFull = { ok: D1.dFull.ok && D2.dFull.ok, calls: [...D1.dFull.calls, ...D2.dFull.calls], raw, fingerprint: D1.dFull.fingerprint, ...MS.stats(raw, 40) };
  const sFull = S.sFull, steps = STAB.steps.slice(1), base0 = STAB.steps[0];
  const stability = { base: base0.D40, steps, ratio: Math.round(Math.min(...steps.map(x => x.D40)) / base0.D40 * 100) / 100 };
  const tr = TR.trace;
  const bandOk = Number.isFinite(sFull.S) && sFull.S >= 1.75 && sFull.S <= 6;
  const summary = { S: sFull.S, D40: dFull.D40, D20: dFull.D20, B6: tr.gates.B6.value, B7: tr.gates.B7.value, B1: tr.gates.B1.value, B2: tr.gates.B2.value, B5: tr.gates.B5.value, stability: stability.ratio, bandOk };
  console.log('[steer] final', JSON.stringify(summary));
  log({ event: 'final', ...summary, B1pass: tr.gates.B1.pass, B2pass: tr.gates.B2.pass, B5pass: tr.gates.B5.pass });
  if (!sFull.ok || !dFull.ok || !tr.valid) { console.log('[steer] FAILURE: full measurement invalid'); st.final = { failure: 'invalid', summary }; save(); return; }
  if (!bandOk) { console.log('[steer] FAILURE: skilled S ' + sFull.S + ' outside 1.75-6; not saving'); st.final = { failure: 'S band', summary }; save(); return; }
  const M = ys.M, newKey = M.boardKey(design);
  const pc = base.card, ident = base.ident;
  const card = { ...clone(pc), boardKey: newKey, matchingBodyKey: undefined, parent: pc.boardKey, stability,
    steering: { goal, steps: st.steps, rounds: st.round, cpuSec: Math.round(st.cpuSec), counts: st.counts, seedBlocks: BLOCK },
    stats: { S: sFull.S, S_se: sFull.se, band: sFull.S >= 2.5 ? 'normal' : 'fallback', D20: dFull.D20, D40: dFull.D40, median: dFull.median, censoredShare: dFull.censoredShare, D_se: dFull.se, nS: sFull.n, nD: dFull.n },
    traceGates: tr.gates, lossCauseMix: tr.lossKinds, errorKinds: tr.errorKinds, steer: tr.gates.B7.value <= TOL.B7max ? [] : ['B7'] };
  delete card.matchingBodyKey;
  fs.mkdirSync(OUT, { recursive: true });
  M.atomicJson(path.join(OUT, newKey + '.json'), { schema: 'bank-puzzle-v1', card, design, spec, measurements: { sFull, dFull, stability, trace: tr }, ident });
  console.log('[steer] saved ' + path.join(OUT, newKey + '.json'));
  st.final = { newKey, summary }; save();
}

if (process.argv.includes('--worker')) worker(); else main().catch(e => { console.error(e); process.exit(1); });
