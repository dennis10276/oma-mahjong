'use strict';
// Smarter picture placement for a constructed board (optional stage of the bank funnel, generate.js --smart).
//   const { smarten } = require('./smarten.js');
//   const r = smarten(design, { spec: { shape, spare }, k, seed, cpuSec: 5 });   // r.design, r.before, r.after, r.changed, r.notes
// Leaves layout, specials (gold/keys/locks/ice), clock tile + clock.n, the stored solution and the whole pre-clock part alone.
// Edits (all on tiles that steer.js does not protect: nothing before/at the clock tap, no trap tile, no key/lock/ice/gold, no
// tile sharing a picture with those):
//   up        face-down tiles turned face-up until the face-down share is <= maxDownShare (default 0.30); the tiles whose
//             hidden tap is the worst gamble (many tiles waiting, hidden twin) go first.
//   relabel   exchange the pictures of two whole late solution pairs (steer's relabelEdit; the stored solution stays valid
//             unless a picture has four copies, replay decides).
//   swap      exchange the pictures of one tile of each of two late pairs: the pairs are re-paired (a1,a2),(b1,b2) -> (a1,b2),(b1,a2).
//             Whole-pair relabelling alone cannot change which tiles are twins, so it cannot reduce "obvious" pairs;
//             this is the one extension over "relabel only". The stored solution must still replay strictly.
// Objective (bot-free, from texture.js, after the clock unless stated): fewer obvious/simultaneous/adjacent/consecutive pairs,
// more real choices, more tray pressure (<= 3 waiting always holds: the stored solution is a strict win), repeated pictures
// overlapping in time, fewer gamble steps. Deterministic: seeded random proposals, strictly improving moves only (greedy hill climb), cpu bounded by opts.cpuSec.
// Every kept state is validated exactly like steer.js (steer.validate): strict replay, clock k unchanged, readable,
// pre-clock fork/trap signature identical, static gates e5-v1. A failed validation falls back to a validated sub-state.
const S = require('./steer.js');
const T = require('./texture.js');
const clone = x => JSON.parse(JSON.stringify(x));
const E = () => S.lib().E;

function rngOf(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const cpuNow = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };
const WEIGHTS = { obvious: 4, simul: 2, adjacent: 1, consecutive: 0.7, choices: 3, choiceCap: 6, tray: 2, trayCap: 0.5, repeat: 0.6, gamble: 3 };

// objective J (higher is better) from a texture result
function score(x, w = WEIGHTS) {
  const a = x.after, rp = x.repeat, st = Math.max(1, a.steps);
  return -w.obvious * (a.obviousShare || 0) - w.simul * (a.simulShare || 0) - w.adjacent * (a.adjacentShare || 0) - w.consecutive * (a.consecutiveShare || 0)
    + w.choices * Math.min(1, (a.hardChoices + a.costChoices) / w.choiceCap) + w.tray * Math.min(w.trayCap, a.tray2Share || 0)
    + w.repeat * (rp.pictures ? rp.overlapping / rp.pictures : 0) - w.gamble * (a.gamble / st) * 4;
}
const texOf = (d, deep, afterOnly) => T.texture(d, deep ? { choices: true, afterOnly: !!afterOnly, wrong: false, nodes: 1000, ms: 10, capNodes: 800 } : { choices: false, wrong: false });

function applyEdit(d, e) {
  if (e.type === 'up') { const c = clone(d); const up = new Set(e.tiles); c.down = c.down.filter(t => !up.has(t)); return c; }
  return S.applyEdit(d, e);
}

function smarten(design, opts = {}) {
  const spec = opts.spec || { shape: opts.shape, spare: opts.spare };
  const cpuSec = opts.cpuSec ?? 5, maxDown = opts.maxDownShare ?? 0.30, rand = rngOf((opts.seed ?? 1) * 7919 + 13);
  const c0 = cpuNow(), notes = [];
  const parent = clone(design), n = parent.tiles.length;
  const out = { design: parent, changed: false, notes, edits: { up: 0, relabel: 0, swap: 0 }, validated: true, iters: 0, accepted: 0 };
  const L = S.ysOf();
  let parentK = opts.k;
  if (!Number.isInteger(parentK)) { const cs = L.E.clockShortest(L.E.game(clone(parent))); parentK = cs && !cs.unsure ? cs.k : null; }
  if (!Number.isInteger(parentK)) { notes.push('k unknown, board untouched'); return finish(out, c0, parent, parent, null); }
  let tex0;
  try { tex0 = texOf(parent, true); } catch (e) { notes.push('texture failed: ' + e.message); return finish(out, c0, parent, parent, null); }
  out.before = T.row(tex0); out.beforeFull = tex0;
  const sig = S.forkSig(parent), prot = S.protectedSet(parent, spec, S.trapTiles(parent, spec));
  const overheadMs = cpuNow() - c0;
  const endAt = c0 + Math.max(cpuSec * 1000 - Math.max(700, overheadMs * 0.5), cpuSec * 1000 * 0.4);
  const check = d => S.validate(parent, clone(d), spec, parentK, sig);

  // ---- 1. face-down share
  let cur = clone(parent); const log = [];
  const target = Math.floor(maxDown * n + 1e-9);
  if (cur.down.length > target) {
    const tl = T.timeline(cur), pairOf = new Map(tl.pairs.flatMap(p => [[p.a, p], [p.b, p]]));
    const cp = tl.cp, cand = cur.down.filter(t => !prot.has(t) && tl.pos.get(t) > cp);
    const w = t => { const p = pairOf.get(t), pos = tl.pos.get(t), tray = tl.states[pos].tray.length, both = p && cur.down.includes(p.a) && cur.down.includes(p.b); return tray * 2 + (both ? 3 : 0) + (tl.free[pos].some(i => !cur.down.includes(i)) ? 0 : 2) + rand(); };
    cand.sort((a, b) => w(b) - w(a));
    const want = cur.down.length - target;
    let take = cand.slice(0, want);
    if (take.length < want) notes.push(`only ${take.length}/${want} face-down tiles are free to turn up`);
    // validate; on failure retry with fewer tiles
    let tries = 0;
    while (take.length && tries < 3) {
      tries++;
      const d2 = applyEdit(cur, { type: 'up', tiles: take }), v = check(d2);
      if (v.valid) { cur = d2; log.push({ type: 'up', tiles: take }); out.edits.up = take.length; break; }
      notes.push('turn-up of ' + take.length + ' rejected: ' + v.why);
      take = take.slice(0, Math.floor(take.length / 2));
    }
  }
  const upState = clone(cur), upLog = log.slice();

  // ---- 2. climb on pictures
  const ctxOf = d => S.ctxOfDesign(d, prot);
  let curTex = texOf(cur, true, true), curJ = score(curTex), best = { d: cur, J: curJ, tex: curTex, log: log.slice() };
  let ctx = ctxOf(cur);
  let hardNo = 0, sigNo = 0;
    while (cpuNow() < endAt) {
    out.iters++;
    const late = ctx.pairs.filter(p => p.late);
    if (late.length < 2) { notes.push('fewer than 2 late pairs'); break; }
    const P = late[Math.floor(rand() * late.length)];
    // partner pair: prefer neighbours in solution time (a swap far apart cannot keep the tray under 4)
    const near = late.filter(q => q !== P && Math.abs(q.hi - P.hi) <= 14), pool = near.length && rand() < 0.85 ? near : late.filter(q => q !== P);
    const Q = pool[Math.floor(rand() * pool.length)];
    if (!Q || P.face === Q.face) continue;
    const kind = rand() < 0.35 ? 'relabel' : 'swap';
    const edit = kind === 'relabel' ? S.relabelEdit(P, Q) : { type: 'swap', tiles: [P.t[Math.floor(rand() * 2)], Q.t[Math.floor(rand() * 2)]] };
    const child = applyEdit(cur, edit);
    if (!E().replay(child, child.solution, { strict: true }).ok) { hardNo++; continue; }
    const t1 = texOf(child, false);
    if (score(t1) < curJ - 0.6) continue; // cheap stage: the choice term can add at most its weight
    const tex = texOf(child, true, true), J = score(tex);
    if (J > curJ + 1e-6) {
      if (S.forkSig(child) !== sig) { sigNo++; continue; }
      cur = child; curTex = tex; curJ = J; ctx = ctxOf(cur); log.push({ ...edit, kind }); out.accepted++;
      if (J > best.J) best = { d: cur, J, tex, log: log.slice() };
    }
  }
  notes.push(`search ${out.iters} proposals, ${out.accepted} accepted, ${hardNo} broke the stored solution, ${sigNo} changed the trap signature`);

  // ---- 3. validate the best state, fall back to validated sub-states
  const candidates = [best.log];
  if (best.log.length > upLog.length) { const h = upLog.length + Math.floor((best.log.length - upLog.length) / 2); if (h > upLog.length) candidates.push(best.log.slice(0, h)); candidates.push(upLog); }
  let final = parent, finalLog = [], seen = new Set();
  for (const lg of candidates) {
    const key = lg.length; if (seen.has(key)) continue; seen.add(key);
    let d = clone(parent); for (const e of lg) d = applyEdit(d, e);
    if (!lg.length) break;
    const v = check(d);
    if (v.valid) { final = d; finalLog = lg; break; }
    notes.push(`state with ${lg.length} edits rejected: ${v.why}`);
  }
  out.edits = { up: finalLog.filter(e => e.type === 'up').reduce((s, e) => s + e.tiles.length, 0), relabel: finalLog.filter(e => e.kind === 'relabel').length, swap: finalLog.filter(e => e.kind === 'swap').length };
  return finish(out, c0, parent, final, finalLog.length);
}

function finish(out, c0, parent, final, nEdits) {
  out.design = final; out.changed = final !== parent && nEdits > 0;
  if (out.changed) { try { const t = texOf(final, true); out.after = T.row(t); out.afterFull = t; out.J = { before: out.beforeFull ? Math.round(score(out.beforeFull) * 1000) / 1000 : null, after: Math.round(score(t) * 1000) / 1000 }; } catch (e) { out.notes.push('after texture failed: ' + e.message); } }
  else { out.after = out.before || null; out.afterFull = out.beforeFull || null; out.J = out.beforeFull ? { before: Math.round(score(out.beforeFull) * 1000) / 1000, after: Math.round(score(out.beforeFull) * 1000) / 1000 } : null; }
  out.cpuMs = Math.round(cpuNow() - c0);
  return out;
}

module.exports = { smarten, score, WEIGHTS };

// CLI: node smarten.js <boardKey|file> [--cpu 5] [--seed 1] [--save out.json]
if (require.main === module) {
  const fs = require('fs'), path = require('path');
  const ROOT = path.resolve(__dirname, '../../../..');
  const a = process.argv.slice(2).filter(x => !x.startsWith('--')), opt = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
  const dir = path.join(ROOT, 'source/analysis/builder/bank/puzzles');
  for (const key of a) {
    const f = fs.existsSync(key) ? key : path.join(dir, fs.readdirSync(dir).find(x => x.startsWith(key)) || key + '.json');
    const p = JSON.parse(fs.readFileSync(f, 'utf8'));
    const r = smarten(p.design, { spec: p.spec, k: p.card.clock.k, seed: +opt('seed', 1), cpuSec: +opt('cpu', 5) });
    const pick = x => x && { down: x.down, obvA: x.obvA, simA: x.simA, adjA: x.adjA, consA: x.consA, chA: x.chA, tray2A: x.tray2A, gambleA: x.gambleA, repOv: x.repOv, rep: x.rep };
    console.log(path.basename(f).slice(0, 10), 'changed', r.changed, 'edits', JSON.stringify(r.edits), 'J', JSON.stringify(r.J), r.cpuMs + 'ms', '\n  before', JSON.stringify(pick(r.before)), '\n  after ', JSON.stringify(pick(r.after)), '\n  ', r.notes.join('; '));
    if (opt('save')) fs.writeFileSync(opt('save'), JSON.stringify({ design: r.design, before: r.before, after: r.after }));
  }
}
