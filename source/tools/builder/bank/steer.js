#!/usr/bin/env node
'use strict';
// Measured steering for a banked puzzle (Dennis 2026-11-12: "a nice trap idea, the rest is easy; steer it harder after the trap").
//   node source/tools/builder/loop/heavy.js --label steer -- node source/tools/builder/bank/steer.js --puzzle c6b10b7f [--goal second-act|fewer-repeats]
//        [--rounds 8] [--proposals 8] [--seed 1] [--target-D x] [--wall-min 8] [--finalize] [--fresh]
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
const TOL = { B7: 0.02, minGain: 0.015, band: [0.30, 0.50], B7max: 0.3, Dnoise: 1.0 };

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
function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296; }
function propose(d, spec, prot, count, goal, rand, tried, hints) {
  const pos = posOf(d), cov = coverOf(d), pairs = movablePairs(d, prot);
  const gap = (a, b) => Math.abs(pos.get(a) - pos.get(b));
  const cost = (a, b) => gap(a, b) / 10 + Math.abs(cov[a] - cov[b]); // late tray cost proxy: a twin far away / buried while its partner is free
  const cands = [];
  if (pairs.length < 2) return [];
  for (let n = 0; n < 4000 && cands.length < 600; n++) {
    const A = pairs[Math.floor(rand() * pairs.length)], B = pairs[Math.floor(rand() * pairs.length)];
    if (A === B) continue;
    const i = Math.floor(rand() * 2), j = Math.floor(rand() * 2), u = A[i], v = B[j], uo = A[1 - i], vo = B[1 - j];
    const key = u < v ? u + '-' + v : v + '-' + u;
    if (tried.has(key) || cands.some(c => c.key === key)) continue;
    const before = cost(A[0], A[1]) + cost(B[0], B[1]), after = cost(uo, v) + cost(vo, u);
    const kind = goal === 'fewer-repeats' && hints.length && ([u, v, uo, vo].some(t => hints.includes(t))) ? 'c' : (Math.min(gap(A[0], A[1]), gap(B[0], B[1])) <= 3 && gap(uo, v) + gap(vo, u) > gap(A[0], A[1]) + gap(B[0], B[1]) ? 'b' : 'a');
    cands.push({ key, move: kind, tiles: [u, v], pairsBefore: [[...A], [...B]], pairsAfter: [[uo, v], [vo, u]], gain: r3(after - before), score: (after - before) + rand() * 2 });
  }
  if (goal === 'fewer-repeats' && hints.length) cands.forEach(c => { if (c.move === 'c') c.score += 100; });
  cands.sort((p, q) => q.score - p.score);
  // mix: top-scored plus a few random ones so the climb does not only follow the heuristic
  const out = cands.slice(0, Math.ceil(count * 0.75));
  const rest = cands.slice(out.length);
  while (out.length < count && rest.length) out.push(rest.splice(Math.floor(rand() * rest.length), 1)[0]);
  return out;
}
const applySwap = (d, u, v) => { const c = clone(d); [c.faces[u], c.faces[v]] = [c.faces[v], c.faces[u]]; return c; };

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
      const parent = input.parent, child = applySwap(parent, input.tiles[0], input.tiles[1]);
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
  const targetD = arg('target-D') != null ? +arg('target-D') : null, wallMs = +arg('wall-min', 8) * 60000, started = Date.now();
  fs.mkdirSync(BUILD, { recursive: true });
  const stateFile = path.join(BUILD, `steer-${key8}.state.json`), logFile = path.join(BUILD, `steer-${key8}.jsonl`);
  const log = o => fs.appendFileSync(logFile, JSON.stringify(o) + '\n');
  let st = !flag('fresh') && fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
  if (!st) { st = { goal, base: base.card.boardKey, swaps: [], steps: [], round: 0, noImprove: 0, tried: [], cpuSec: 0, wallSec: 0, counts: { proposals: 0, invalid: 0, valid: 0, accepted: 0, rejectedAtConfirm: 0 }, parent: null, done: false, finalized: false }; if (fs.existsSync(logFile)) fs.unlinkSync(logFile); }
  const save = () => { st.wallSec = (st.wallSecBase || 0) + (Date.now() - started) / 1000; fs.writeFileSync(stateFile, JSON.stringify(st)); };
  st.wallSecBase = st.wallSec || 0;
  const designOfSwaps = swaps => swaps.reduce((d, [u, v]) => applySwap(d, u, v), base.design);
  const spec = base.spec;
  let cur = designOfSwaps(st.swaps);
  if (st.swaps.length) cur.solution = st.solution || cur.solution;
  const curK = base.card.clock.k;
  console.log(`[steer] ${key8} goal ${goal}, state: round ${st.round}, ${st.swaps.length} accepted swaps, done=${st.done}`);

  if (!flag('finalize') && !st.done) {
    // parent baselines on both blocks
    if (!st.parent) {
      const [a, b] = await pool([{ task: 'measure', design: cur, block: 'A' }, { task: 'measure', design: cur, block: 'B' }], 2);
      st.cpuSec += a._cpuSec + b._cpuSec; st.parent = { A: a.m, B: b.m };
      console.log(`[steer] parent A: D ${a.m.D} B6 ${a.m.B6.value} B7 ${a.m.B7.value} | B: D ${b.m.D} B6 ${b.m.B6.value} B7 ${b.m.B7.value}`);
      log({ event: 'parent', A: a.m.s, B: b.m.s }); save();
    }
    if (reached(goal, st.parent.A, st.parent.B)) st.done = true;
    const hints = []; // goal fewer-repeats move (c): tiles named by repeated first-error examples that are editable
    for (let r = 0; r < maxRounds && !st.done; r++) {
      if (Date.now() - started > wallMs - 90000) { console.log('[steer] wall budget reached, state saved; rerun to resume'); break; }
      st.round++;
      const trap = trapTiles(cur, spec), prot = protectedSet(cur, spec, trap), sig = forkSig(cur);
      if (goal === 'fewer-repeats') for (const e of (st.parent.A.examples || [])) if (e.repeated && Number.isInteger(e.move) && !prot.has(e.move)) hints.push(e.move);
      const rand = rng(seed * 1000003 + st.round * 7919 + st.swaps.length);
      const props = propose(cur, spec, prot, P * 5, goal, rand, new Set(st.tried), hints);
      console.log(`[steer] round ${st.round}: ${props.length} candidate swaps (movable pairs ${movablePairs(cur, prot).length}, protected ${prot.size}), validating then measuring up to ${P}`);
      if (!props.length) { st.noImprove = 99; st.done = true; save(); break; }
      const vres = await pool(props.map(p => ({ task: 'proposal', validateOnly: true, parent: cur, tiles: p.tiles, spec, k: curK, sig })), 8);
      const validIdx = []; const rows = [];
      props.forEach((p, i) => { const x = vres[i]; st.cpuSec += x._cpuSec || 0; st.counts.proposals++; st.tried.push(p.key);
        if (!x.valid) { st.counts.invalid++; log({ event: 'proposal', round: st.round, move: p.move, tiles: p.tiles, pairsBefore: p.pairsBefore, pairsAfter: p.pairsAfter, heuristicGain: p.gain, valid: false, invalidWhy: x.why }); }
        else { st.counts.valid++; validIdx.push(i); } });
      const why = {}; props.forEach((p, i) => { if (!vres[i].valid) { const k = (vres[i].why || '').replace(/[0-9>-]+/g, '#'); why[k] = (why[k] || 0) + 1; } });
      console.log('  invalid:', JSON.stringify(why), ' valid:', validIdx.length);
      const pick = validIdx.slice(0, P);
      const mres = await pool(pick.map(i => { const c = applySwap(cur, props[i].tiles[0], props[i].tiles[1]); c.solution = vres[i].solution; return { task: 'measure', design: c, block: 'A' }; }), 8);
      pick.forEach((i, n) => {
        const p = props[i], x = { valid: true, route: vres[i].route, solution: vres[i].solution, A: mres[n].m, _cpuSec: mres[n]._cpuSec }; st.cpuSec += x._cpuSec || 0;
        const j = judge(goal, st.parent.A, x.A, targetD);
        log({ event: 'proposal', round: st.round, move: p.move, tiles: p.tiles, pairsBefore: p.pairsBefore, pairsAfter: p.pairsAfter, heuristicGain: p.gain, valid: true, route: x.route, A: x.A.s, judged: { ok: j.ok, why: j.why, value: r3(j.value) } });
        rows.push({ p, x, j });
        console.log(`  ${p.move} ${p.tiles.join('<->')} D ${x.A.D} B6 ${x.A.B6.value} B7 ${x.A.B7.value} B1 ${x.A.B1.pass} B2 ${x.A.B2.pass} B5 ${x.A.B5.pass} -> ${j.ok ? 'ok ' + r3(j.value) : 'no ' + j.why}`);
      });
      const good = rows.filter(r => r.x.valid && r.j.ok && r.j.value >= TOL.minGain).sort((a, b) => b.j.value - a.j.value);
      let accepted = null;
      for (const g of good.slice(0, 2)) {
        const child = applySwap(cur, g.p.tiles[0], g.p.tiles[1]); child.solution = g.x.solution;
        const [c] = await pool([{ task: 'measure', design: child, block: 'B' }], 1); st.cpuSec += c._cpuSec || 0;
        const j = judge(goal, st.parent.B, c.m, targetD), okB = j.ok && j.value > 0;
        log({ event: 'confirm', round: st.round, tiles: g.p.tiles, B: c.m.s, judged: { ok: j.ok, why: j.why, value: r3(j.value) }, confirmed: okB });
        console.log(`  confirm ${g.p.tiles.join('<->')} on block B: D ${c.m.D} B6 ${c.m.B6.value} B7 ${c.m.B7.value} -> ${okB ? 'CONFIRMED' : 'rejected ' + (j.why || 'no gain')}`);
        if (okB) { accepted = { g, child, mB: c.m }; break; } else st.counts.rejectedAtConfirm++;
      }
      if (accepted) {
        const { g, child, mB } = accepted;
        st.steps.push({ move: g.p.move, tiles: g.p.tiles, pairsBefore: g.p.pairsBefore, pairsAfter: g.p.pairsAfter, before: { A: st.parent.A.s, B: st.parent.B.s }, after: { A: g.x.A.s, B: mB.s }, route: g.x.route });
        st.swaps.push(g.p.tiles); st.solution = child.solution; cur = child; st.parent = { A: g.x.A, B: mB }; st.counts.accepted++; st.noImprove = 0; st.tried = [];
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
