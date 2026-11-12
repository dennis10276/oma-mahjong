#!/usr/bin/env node
'use strict';
// Texture measures of a board (no bots): how the stored winning solution FEELS to a player.
//   node source/tools/builder/bank/texture.js <board.json | boardKey | dir> ...   [--deep] [--json]
// Board files: bank puzzles ({design}), e5-boards.json entries, lab findings (boardKey -> bank/puzzles).
// All numbers are read along the stored solution (strict rules, no peek pairs), split at the clock tile:
//   before = steps up to and including the clock tap, after = the steps after it. A pair counts as "before" when
//   both its tiles are taken at or before the clock tap, else "after".
//
// 1 obvious pairs   a solution pair is a GIVE-AWAY when both tiles are face-up and free in the same step in which the first
//                   one becomes free (or both visible and free at the start), no third copy of the picture is free then, and
//                   the tray has room (<= 2 waiting) to take it at once. Also: adjacent (twins touch/stack: |dx|<=2,|dy|<=2),
//                   simul (both free in the same step, any competition), rowNear (same row, |dx|<=6), consecutive (second twin taken within 2 steps of the first).
// 2 real choices    at a step, the sensible moves are: a free face-up tile that matches a waiting picture, a free face-up
//                   pair (two visible free copies), and the stored move. They are NOT equivalent when one of them provably
//                   loses (E.winnable 'lose': hard choice) or when after one of them the board is no longer winnable with a
//                   tray of only 2 slots while after another it is (cost choice: costs tray room later). "Proof depth":
//                   complete search of the position after the move, budget `nodes` (default 5000 engine nodes / 20000 for the
//                   2-slot solver); exhausted budgets are counted as `unknown`, never as a loss.
//                   wrong = steps where ANY non-immediately-fatal legal move (also opening an unrelated tile) provably loses.
// 3 planning depth  tray waiting count after each step: max, mean, share of steps with >= 2 waiting, longest wait (steps
//                   a tile sits in the tray).
// 4 luck            face-down share; gamble steps = tray has >= 2 waiting, no safe progress exists (no visible match, no
//                   visible free pair) and the stored move taps a face-down tile; blind-only steps = >= 2 waiting and no
//                   face-up tile is free at all; hiddenTurns = taps of face-down tiles; hiddenPairs = pairs with both tiles
//                   face-down (the twin's place is unknown until the first is turned AND the twin is itself unseen).
// 5 repeated pictures  pictures with 4 copies; windows of their two pairs overlap in time; all four copies free in one step;
//                   repeat choices = choice steps whose non-equivalent options carry the same picture.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../..');
const E = require('../engine.js');
const Lay = global.Layouts;

const r3 = x => x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000;
const share = (a, b) => b ? r3(a / b) : null;
const BUD = { budget: true };

// ---------------------------------------------------------------- 2-slot solver (tray room test)
function aliveKey(s) { let k = ''; for (let i = 0; i < s.alive.length; i += 8) { let b = 0; for (let j = 0; j < 8 && i + j < s.alive.length; j++) if (s.alive[i + j]) b |= 1 << j; k += String.fromCharCode(48 + (b >> 4), 48 + (b & 15)); } return k; }
// 'win' | 'lose' | 'unknown': can the position be won when at most `cap` tiles may wait in the tray?
function solveCap(g, s0, cap, budget) {
  const dead = new Set(); let nodes = 0;
  const key = s => aliveKey(s) + '|' + s.tray.map(t => g.faces[t]).sort((a, b) => a - b).join(',') + (s.clockTaken ? '' : '#' + s.moves);
  function rec(s) {
    if (E.won(g, s)) return true;
    if (++nodes > budget) throw BUD;
    const k = key(s); if (dead.has(k)) return false;
    const tf = new Set(s.tray.map(t => g.faces[t]));
    const acts = E.legal(g, s).filter(a => typeof a === 'number').sort((a, b) => (tf.has(g.faces[b]) ? 1 : 0) - (tf.has(g.faces[a]) ? 1 : 0));
    for (const a of acts) { const s2 = E.step(g, s, a); if (!s2 || s2.tray.length > cap) continue; if (rec(s2)) return true; }
    dead.add(k); return false;
  }
  try { return rec(s0) ? 'win' : 'lose'; } catch (e) { if (e === BUD) return 'unknown'; throw e; }
}

// ---------------------------------------------------------------- timeline of the stored solution
function timeline(d) {
  const g = E.game(d, { strict: true }), sol = d.solution, n = sol.length;
  const states = [], free = [], av = new Array(g.n).fill(-1);
  let s = E.start(g);
  for (let t = 0; t < n; t++) {
    states.push(s);
    const fr = E.legal(g, s).filter(a => typeof a === 'number');
    free.push(fr);
    for (const i of fr) if (av[i] < 0) av[i] = t;
    s = E.step(g, s, sol[t]);
    if (!s) throw new Error('texture: stored solution is not a strict win at step ' + t);
  }
  const pos = new Map(sol.map((t, i) => [t, i]));
  // solution pairs, with the tray wait of every tile
  const tray = [], pairs = [], wait = [];
  sol.forEach((t, i) => {
    const q = tray.findIndex(x => g.faces[x.t] === g.faces[t]);
    if (q >= 0) { const o = tray[q]; pairs.push({ a: o.t, b: t, pa: o.i, pb: i }); wait.push(i - o.i); tray.splice(q, 1); } else tray.push({ t, i });
  });
  return { g, sol, states, free, av, pos, pairs, wait, cp: sol.indexOf(d.clock.i) };
}

// ---------------------------------------------------------------- choice analysis at one step
function choiceAt(tl, t, o) {
  const { g, states, free, sol } = tl, s = states[t], m = sol[t], F = g.faces;
  const trayF = new Set(s.tray.map(x => F[x]));
  const vis = free[t].filter(i => !g.down[i]);
  const macros = new Map(), add = (tiles, tag) => { const k = tiles.join(','); if (!macros.has(k)) macros.set(k, { tiles, tag }); };
  for (const i of vis) if (trayF.has(F[i])) add([i], 'match');
  if (s.tray.length <= 2) for (let a = 0; a < vis.length; a++) for (let b = a + 1; b < vis.length; b++) if (F[vis[a]] === F[vis[b]] && !trayF.has(F[vis[a]])) add([vis[a], vis[b]], 'pair');
  // the stored move: the macro that contains it as its first tile, else the single tap
  let stored = [...macros.values()].find(x => x.tiles[0] === m);
  if (!stored) { add([m], 'stored'); stored = macros.get(String(m)); }
  stored.stored = true;
  const out = { macros: macros.size, hard: false, cost: false, unknown: false, sameFace: false, wrong: false };
  if (macros.size >= 2) {
    const res = [];
    for (const mc of macros.values()) {
      let s2 = s; for (const i of mc.tiles) { s2 = s2 && E.step(g, s2, i); }
      if (!s2) { res.push({ mc, r: 'fatal' }); continue; }
      if (E.won(g, s2)) { res.push({ mc, r: 'win', cap2: 'win' }); continue; }
      const w = E.winnable(g, s2, { nodes: o.nodes, ms: o.ms });
      const e = { mc, r: w.result };
      if (w.result === 'win') e.cap2 = solveCap(g, s2, 2, o.capNodes);
      res.push(e);
    }
    const live = res.filter(x => x.r !== 'fatal');
    if (live.length >= 2) {
      const losers = live.filter(x => x.r === 'lose'), unk = live.filter(x => x.r === 'unknown'), winners = live.filter(x => x.r === 'win');
      if (losers.length && winners.length) out.hard = true;
      else if (winners.length >= 2) {
        const c2 = new Set(winners.map(x => x.cap2));
        if (c2.has('win') && c2.has('lose')) out.cost = true;
        if (c2.has('unknown')) out.unknown = true;
      }
      if (unk.length) out.unknown = true;
      if ((out.hard || out.cost) && live.some((x, i) => live.some((y, j) => j > i && F[x.mc.tiles[0]] === F[y.mc.tiles[0]]))) out.sameFace = true;
    }
  }
  if (o.wrong) { // any non-fatal legal move that provably loses
    for (const a of free[t]) { if (a === m) continue; const s2 = E.step(g, s, a); if (!s2) continue; if (E.won(g, s2)) continue; if (E.winnable(g, s2, { nodes: o.nodes, ms: o.ms }).result === 'lose') { out.wrong = true; break; } }
  }
  return out;
}

// ---------------------------------------------------------------- texture
function texture(design, opts = {}) {
  const o = { nodes: 5000, ms: 100, capNodes: 20000, choices: true, wrong: true, ...opts };
  const d = design, tl = timeline(d), { g, sol, states, free, av, pos, pairs, wait, cp } = tl, F = g.faces, n = g.n;
  const T = d.tiles.map(t => Array.isArray(t) ? { x: t[0], y: t[1], z: t[2] } : t);
  const phaseOfStep = t => t <= cp ? 'before' : 'after';
  const ph = () => ({ steps: 0, pairs: 0, simul: 0, obvious: 0, adjacent: 0, rowNear: 0, consecutive: 0, trayMax: 0, traySum: 0, tray2: 0, longestWait: 0,
    choiceSteps: 0, hard: 0, cost: 0, unknownChoice: 0, repeatChoices: 0, wrongSteps: 0, hiddenTurns: 0, gamble: 0, blindOnly: 0, hiddenPairs: 0 });
  const P = { before: ph(), after: ph() };
  // availability: how many copies of a picture are free at a step (for the "no competing copy" test)
  const freeCount = (t, f) => free[t].reduce((c, i) => c + (F[i] === f ? 1 : 0), 0);
  for (const p of pairs) {
    const k = p.pb <= cp ? 'before' : 'after', X = P[k];
    X.pairs++;
    const lo = Math.min(av[p.a], av[p.b]);
    const up = !g.down[p.a] && !g.down[p.b];
    if (av[p.a] === av[p.b]) X.simul++;
    if (up && av[p.a] === av[p.b] && freeCount(lo, F[p.a]) === 2 && states[lo].tray.length <= 2) X.obvious++;
    const a = T[p.a], b = T[p.b], dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    if (dx <= 2 && dy <= 2) X.adjacent++;
    if (dy <= 1 && dx <= 6) X.rowNear++;
    if (p.pb - p.pa <= 2) X.consecutive++;
    if (g.down[p.a] && g.down[p.b]) X.hiddenPairs++;
    X.longestWait = Math.max(X.longestWait, p.pb - p.pa);
  }
  for (let t = 0; t < sol.length; t++) {
    const X = P[phaseOfStep(t)], s = states[t], m = sol[t];
    X.steps++; X.trayMax = Math.max(X.trayMax, s.tray.length); X.traySum += s.tray.length; if (s.tray.length >= 2) X.tray2++;
    if (g.down[m]) X.hiddenTurns++;
    const vis = free[t].filter(i => !g.down[i]), trayF = new Set(s.tray.map(x => F[x]));
    const safe = vis.some(i => trayF.has(F[i])) || (s.tray.length <= 2 && vis.some((i, a) => vis.some((j, b) => b > a && F[i] === F[j])));
    if (s.tray.length >= 2 && !safe && g.down[m]) X.gamble++;
    if (s.tray.length >= 2 && vis.length === 0) X.blindOnly++;
    if (o.choices && (!o.afterOnly || t > cp)) {
      const c = choiceAt(tl, t, o);
      if (c.hard || c.cost) { X.choiceSteps++; if (c.hard) X.hard++; else X.cost++; if (c.sameFace) X.repeatChoices++; }
      if (c.unknown) X.unknownChoice++;
      if (c.wrong) X.wrongSteps++;
    }
  }
  // repeated pictures
  const byFace = new Map(); for (const p of pairs) { const f = F[p.a]; if (!byFace.has(f)) byFace.set(f, []); byFace.get(f).push(p); }
  const reps = [...byFace.values()].filter(x => x.length > 1);
  let overlap = 0, allFour = 0;
  for (const gp of reps) {
    const w = gp.map(p => [Math.min(av[p.a], av[p.b]), p.pb]);
    if (w.length > 1 && Math.max(w[0][0], w[1][0]) < Math.min(w[0][1], w[1][1])) overlap++;
    const tiles = gp.flatMap(p => [p.a, p.b]);
    if (tiles.length >= 4) for (let t = 0; t < sol.length; t++) { const fs_ = new Set(free[t]); if (tiles.every(i => fs_.has(i))) { allFour++; break; } }
  }
  const fin = k => {
    const X = P[k];
    return { steps: X.steps, pairs: X.pairs,
      simulShare: share(X.simul, X.pairs), obvious: X.obvious, obviousShare: share(X.obvious, X.pairs), adjacentShare: share(X.adjacent, X.pairs), rowNearShare: share(X.rowNear, X.pairs), consecutiveShare: share(X.consecutive, X.pairs),
      trayMax: X.trayMax, trayMean: share(X.traySum, X.steps), tray2Share: share(X.tray2, X.steps), longestWait: X.longestWait,
      choiceSteps: X.choiceSteps, hardChoices: X.hard, costChoices: X.cost, unknownChoices: X.unknownChoice, repeatChoices: X.repeatChoices, wrongSteps: X.wrongSteps,
      hiddenTurns: X.hiddenTurns, gamble: X.gamble, blindOnly: X.blindOnly, hiddenPairs: X.hiddenPairs };
  };
  const down = d.down.length;
  return { tiles: n, clockPos: cp, steps: sol.length, faceDown: down, faceDownShare: r3(down / n),
    before: fin('before'), after: fin('after'),
    repeat: { pictures: reps.length, overlapping: overlap, allFourFree: allFour, repeatChoicesAfter: P.after.repeatChoices, repeatChoicesBefore: P.before.repeatChoices },
    proof: { engineNodes: o.nodes, engineMs: o.ms, twoSlotNodes: o.capNodes } };
}

// flat scalar row for tables
function row(x) {
  const a = x.after, b = x.before;
  return { tiles: x.tiles, down: x.faceDownShare, simA: a.simulShare, obvB: b.obviousShare, obvA: a.obviousShare, adjA: a.adjacentShare, consA: a.consecutiveShare,
    chB: b.hardChoices + b.costChoices, chA: a.hardChoices + a.costChoices, hardA: a.hardChoices, costA: a.costChoices, wrongA: a.wrongSteps, unkA: a.unknownChoices,
    trayMaxA: a.trayMax, trayMeanA: a.trayMean, tray2A: a.tray2Share, waitA: a.longestWait,
    gambleA: a.gamble, blindA: a.blindOnly, hidTurnsA: a.hiddenTurns, hidPairs: a.hiddenPairs + b.hiddenPairs,
    rep: x.repeat.pictures, repOv: x.repeat.overlapping, rep4: x.repeat.allFourFree, repCh: x.repeat.repeatChoicesAfter };
}

module.exports = { texture, row, timeline, solveCap, choiceAt };

// ---------------------------------------------------------------- CLI
function loadAny(arg) {
  const out = [];
  const bank = path.join(ROOT, 'source/analysis/builder/bank/puzzles');
  const pushFile = f => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); if (j.design) out.push({ name: path.basename(f, '.json').slice(0, 10), design: j.design, src: j }); else if (Array.isArray(j)) j.forEach(b => b.design && out.push({ name: b.id, design: b.design, src: b })); };
  if (fs.existsSync(arg) && fs.statSync(arg).isDirectory()) { for (const f of fs.readdirSync(arg).sort()) if (f.endsWith('.json')) pushFile(path.join(arg, f)); }
  else if (fs.existsSync(arg)) pushFile(arg);
  else if (fs.existsSync(path.join(bank, arg + '.json'))) pushFile(path.join(bank, arg + '.json'));
  else { const m = fs.readdirSync(bank).filter(f => f.startsWith(arg)); if (m.length === 1) pushFile(path.join(bank, m[0])); else throw new Error('board not found: ' + arg); }
  return out;
}
if (require.main === module) {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!args.length) { console.log('usage: texture.js <board.json|boardKey|dir|e5-boards.json> ... [--json]'); process.exit(1); }
  const rows = [];
  for (const a of args) for (const b of loadAny(a)) {
    try { const x = texture(b.design); rows.push({ name: b.name, ...row(x), full: x }); }
    catch (e) { console.log(b.name + ': ' + e.message); }
  }
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows.map(r => ({ ...r.full, name: r.name })), null, 1));
  else if (rows.length) {
    const cols = Object.keys(rows[0]).filter(k => k !== 'full');
    console.log(cols.join('\t'));
    for (const r of rows) console.log(cols.map(k => r[k] == null ? '-' : r[k]).join('\t'));
  }
}
