#!/usr/bin/env node
'use strict';
// Second-act rule (trap-design-2026-11-12.md, "Second-act rule"), bot-free.
//   const SA = require('./second_act.js');
//   SA.secondAct(design, { spec: {shape, spare}, k, seed, cpuSec, smart: true, nodes, wallMs }) -> { ok, checks, fork, design, notes, tex }
//   node source/tools/builder/bank/second_act.js <boardKey|file> ... [--cpu 3] [--no-smarten] [--json]
// Steps: (a) smarten (trap tiles protected); (b) look 15-60% into the part AFTER the clock tap along the stored route for a visible
// pair/match whose taking provably loses (detour.priceMove exact) or costs tray room (2-slot solver, texture.solveCap), judged by
// publicfork.fairFork (with minLeft 0: a tail state cannot have 60% of the tiles left); (c) a four-copy picture whose two pairs overlap in
// time; (d) face-down share <= 0.30, gamble steps 0, obvious pairs after the clock not above the pre-smarten value; (e) fork tiles
// visible before the clock tap (face-up, or freed/turned by then).
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../..');
const E = require('../engine.js'), D = require('../loop/detour.js'), P = require('../loop/publicfork.js');
const T = require('./texture.js'), SM = require('./smarten.js');
const clone = x => JSON.parse(JSON.stringify(x));
const LIM = { from: 0.15, to: 0.60, down: 0.30 };

// (b) the tail-fork search on a design's stored route
function tailFork(design, o = {}) {
  const nodes = o.nodes ?? 60000, w = D.work(o.totalNodes ?? 1500000, o.wallMs ?? 25000);
  const tl = T.timeline(design), cp = tl.cp, sol = design.solution, tail = sol.length - 1 - cp;
  const C = D.clockGames(design), g = C.free, nShipMax = design.clock.n;
  const lo = cp + 1 + Math.floor(LIM.from * tail), hi = cp + Math.floor(LIM.to * tail);
  // states along the stored route in the unrestricted (peek) game, so tempting moves are the visible pairs/matches
  const states = []; let s = E.start(g);
  for (let t = 0; t < sol.length; t++) { states.push(s); s = E.step(g, s, sol[t]); if (!s) break; }
  const out = { range: [lo, hi], tail, cp, states: 0, candidates: 0, proven: [], unknown: 0, budgetHit: false };
  const freeSoFar = new Set(); for (let t = 0; t <= cp && t < tl.free.length; t++) tl.free[t].forEach(i => freeSoFar.add(i));
  for (let t = lo; t <= hi && t < states.length; t++) {
    const st = states[t]; if (!st) break;
    out.states++;
    const sOpen = new Set(); for (let u = 0; u <= t; u++) tl.free[u].forEach(i => sOpen.add(i));
    const unseen = (design.down || []).filter(i => !sOpen.has(i));
    let capOk = null;
    for (const mv of D.temptingMoves(g, st)) {
      if (mv.peek) continue;
      out.candidates++;
      const pr = D.priceMove(C, st, mv, { nShipMax, nodes, w });
      let kind = null;
      if (pr.instant) continue; // a fourth waiting tile: the tray overflows at once, not a fork
      if (pr.result === 'lose' && pr.exact) kind = 'lose';
      else if (pr.result === 'unknown') out.unknown++;
      else if (pr.result === 'win' && pr.after) { // costs tray room: wins, but not with 2 tray slots, while the position before does
        if (capOk == null) capOk = T.solveCap(g, st, 2, 20000) === 'win';
        if (capOk && T.solveCap(g, pr.after, 2, 20000) === 'lose') kind = 'cost';
      }
      if (w.over()) { out.budgetHit = true; }
      if (!kind) continue;
      const ff = P.fairFork(C, st, mv, { nShipMax, unseen, minLeft: 0, w, nodes });
      const visible = mv.take.every(i => !design.down.includes(i) || freeSoFar.has(i));
      const left = st.alive.reduce((a, b) => a + b, 0) / design.tiles.length;
      out.proven.push({ state: t, share: +((t - cp) / tail).toFixed(3), tiles: mv.take.slice(), take: mv.kind, kind, cost: pr.cost, tilesLeft: +left.toFixed(3),
        fair: ff.fair, unfair: ff.unfair, unknown: ff.unknown, why: ff.why, visibleBeforeClock: visible, faces: mv.take.map(i => design.faces[i]) });
    }
    if (out.budgetHit) break;
  }
  // relaxed form (texture.choiceAt, stored-route relative): a step in the window where one sensible move provably loses or costs tray room versus another
  out.choiceSteps = [];
  for (let t = lo; t <= hi && t < sol.length; t++) { const c = T.choiceAt(tl, t, { nodes: 1000, ms: 10, capNodes: 800 }); if (c.hard || c.cost) out.choiceSteps.push({ state: t, kind: c.hard ? 'hard' : 'cost', sameFace: c.sameFace }); }
  // prefer fair + visible, then not unfair + visible, then anything proven
  const rank = f => (f.fair ? 0 : f.unfair ? 4 : 2) + (f.visibleBeforeClock ? 0 : 1) + (f.kind === 'lose' ? 0 : 0.5);
  out.best = out.proven.slice().sort((a, b) => rank(a) - rank(b) || a.state - b.state)[0] || null;
  return out;
}

function secondAct(design0, o = {}) {
  const notes = [], spec = o.spec || {};
  let design = clone(design0), sm = null, beforeObv = null;
  const tex0 = (() => { try { return T.row(T.texture(design, { choices: false, wrong: false })); } catch (e) { return null; } })();
  if (o.smart !== false && spec.shape) {
    try { sm = SM.smarten(design, { spec, k: o.k, seed: o.seed ?? 1, cpuSec: o.cpuSec ?? 3 }); design = sm.design; notes.push(...(sm.notes || []).slice(0, 3)); beforeObv = sm.before ? sm.before.obvA : null; }
    catch (e) { notes.push('smarten failed: ' + e.message); }
  } else if (o.smart !== false) notes.push('no spec.shape: smarten skipped');
  if (beforeObv == null && tex0) beforeObv = tex0.obvA;
  const texFull = T.texture(design, { choices: false, wrong: false }), row = T.row(texFull);
  const tf = tailFork(design, o), best = tf.best;
  const checks = {
    fork: !!best && !best.unfair,
    forkRelaxed: tf.choiceSteps.length > 0,
    forkFair: !!best && best.fair,
    repeatOverlap: texFull.repeat.overlapping >= 1,
    faceDown: texFull.faceDownShare <= LIM.down + 1e-9,
    gamble: row.gambleA === 0 && texFull.before.gamble === 0,
    obvious: beforeObv == null || (row.obvA || 0) <= beforeObv + 1e-9,
    forkVisible: !!best && best.visibleBeforeClock,
  };
  const ok = !!((checks.fork || (o.relaxed && checks.forkRelaxed)) && checks.repeatOverlap && checks.faceDown && checks.gamble && checks.obvious && (checks.forkVisible || (o.relaxed && checks.forkRelaxed)));
  return { ok, checks, fork: best && { state: best.state, share: best.share, tiles: best.tiles, kind: best.kind, proven: best.kind === 'lose' ? 'lose (exact)' : 'costs tray room (2-slot solver)', fair: best.fair, why: best.why, tilesLeft: best.tilesLeft },
    search: { range: tf.range, statesLooked: tf.states, candidates: tf.candidates, provenForks: tf.proven.length, choiceSteps: tf.choiceSteps.length, unknown: tf.unknown, budgetHit: tf.budgetHit },
    numbers: { faceDownShare: texFull.faceDownShare, gambleA: row.gambleA, obvA: row.obvA, obvBefore: beforeObv, repOverlap: texFull.repeat.overlapping, rep: texFull.repeat.pictures, smartened: !!(sm && sm.changed) },
    design, notes };
}
module.exports = { secondAct, tailFork, LIM };

// ---------------------------------------------------------------- CLI
if (require.main === module) {
  const a = process.argv.slice(2).filter((x, i, arr) => !x.startsWith('--') && !(i && ['--cpu', '--seed'].includes(arr[i - 1])));
  const opt = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
  const dir = path.join(ROOT, 'source/analysis/builder/bank/puzzles');
  const files = a.length ? a : fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const results = [];
  for (const key of files) {
    const f = fs.existsSync(key) ? key : path.join(dir, fs.readdirSync(dir).find(x => x.startsWith(key)) || key + '.json');
    const p = JSON.parse(fs.readFileSync(f, 'utf8'));
    let r;
    try { r = secondAct(p.design, { spec: p.spec, k: p.card && p.card.clock && p.card.clock.k, seed: +opt('seed', 1), cpuSec: +opt('cpu', 3), smart: !process.argv.includes('--no-smarten'), relaxed: process.argv.includes('--relaxed') }); }
    catch (e) { r = { ok: false, error: e.message, checks: {} }; }
    const id = path.basename(f, '.json').slice(0, 8);
    results.push({ id, story: p.card && p.card.story, ok: r.ok, checks: r.checks, fork: r.fork, search: r.search, numbers: r.numbers, error: r.error });
    if (!process.argv.includes('--json')) console.log(id, p.card && p.card.story, r.ok ? 'PASS' : 'fail', JSON.stringify(r.checks), r.fork ? `fork@${r.fork.state} ${r.fork.kind} tiles ${r.fork.tiles} fair=${r.fork.fair}` : 'no fork', JSON.stringify(r.search), r.error || '');
  }
  if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 1));
  else {
    const n = results.length, c = k => results.filter(r => r.checks && r.checks[k]).length;
    console.log(`\n${n} boards: all ${results.filter(r => r.ok).length}; ` + ['fork', 'forkRelaxed', 'forkFair', 'repeatOverlap', 'faceDown', 'gamble', 'obvious', 'forkVisible'].map(k => `${k} ${c(k)}`).join(', '));
  }
}
