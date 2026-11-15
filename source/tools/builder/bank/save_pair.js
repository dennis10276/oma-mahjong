#!/usr/bin/env node
'use strict';
/* save_pair.js: a new wrong idea for chained boards, added to a finished board by moving pictures only.
   Dennis 2026-11-14: "You should come up with more chained ideas for 300+ as well more AHA moments", and on the easy leftover chains:
   "These can be made into slightly harder ones to fit 300+".

   THE WRONG IDEA ("a free pair is always safe"): two free tiles show the same picture at the start, so pairing them is the most natural
   move in the game. But a third tile with that picture lies in the dig to the clock, and the fourth is buried deep. Pair the two free
   ones and the third has to sit in the tray until the fourth comes out: proven lost. The right play keeps one free copy for the tile in
   the dig ("save one for later") and leaves the other for the buried one.
   What the player has to see: the same picture a third time, face-up, on the way to the clock.

   How it is made (geometry, ice, locks, keys, clock tile and face-down set unchanged):
     w = an ordinary tile the route to the clock has to take whose twin comes out long after the clock (it waits in the tray today);
     a, b = two free, face-up, ordinary tiles at the start that are not next to each other;  x = an ordinary tile taken near the end.
     a, b, w, x get one picture; the three displaced twins are re-paired (a's twin with b's twin, x's twin with w's twin).
   Accepted only when, by the exact engine: taking a and b first is LOST; the board is still won with the same shortest clock route
   (trap_mixes.retime); the board's own trap proof still holds (trap_mixes.prove); no visible twins lie together and the four copies are
   not close; w's picture can be seen at the start; at least 3 first moves still win.
     node source/tools/builder/loop/heavy.js --label savepair --cores 8 -- node source/tools/builder/bank/save_pair.js --files a.json,b.json --out <dir> [--ms 120000] [--workers 8] */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };

function inject(j, opts = {}) {
  const E = require('../engine.js'), M = require('../trap_mixes.js'), SEP = require('./separate.js'), B = require('../builder.js');
  const { tileVisibility } = require('../../sim/refit/human_board_visibility.js');
  const t0 = Date.now(), wall = opts.ms ?? 120000, d = j.design, n = d.tiles.length, F = d.faces, C = opts.ctx || mixCtx(j), spare = C.spare;
  const g = E.game(structuredClone(d)), s0 = E.start(g), pos = new Array(n).fill(-1); d.solution.forEach((t, i) => { pos[t] = i; });
  const ci = pos[d.clock.i], k = ci + 1, geo = SEP.geometry(d), ctx = B.context(d.tiles);
  const vis = tileVisibility(g.tiles, { ...s0, down: g.down, openPeek: -1 }, null).tiles;
  const count = {}; F.forEach(f => { count[f] = (count[f] || 0) + 1; });
  const twin = i => { for (let t = 0; t < n; t++) if (t !== i && F[t] === F[i]) return t; return -1; };
  const role = new Set([d.clock.i, ...d.obst.keys, ...d.obst.locks, ...Object.keys(d.obst.ice).map(Number), ...C.roleTiles]);
  const down = new Set(d.down), plain = i => !role.has(i) && count[F[i]] === 2 && !role.has(twin(i));
  const free0 = E.legal(g, s0).filter(Number.isInteger).filter(i => !down.has(i) && plain(i));
  // w: taken before the clock, seen at the start, twin far behind the clock
  const W = []; for (let i = 0; i < n; i++) if (plain(i) && pos[i] < ci && !down.has(i) && vis[i] && vis[i].picture) W.push(i);
  const X = []; for (let i = 0; i < n; i++) if (plain(i) && pos[i] > n * 0.7 && pos[twin(i)] > n * 0.55 && !free0.includes(i)) X.push(i);
  const AB = []; for (let p = 0; p < free0.length; p++) for (let q = p + 1; q < free0.length; q++) { const a = free0[p], b = free0[q]; if (F[a] !== F[b] && !geo.close[a][b]) AB.push([a, b]); }
  const stats = { free0: free0.length, w: W.length, x: X.length, ab: AB.length, tried: 0, fails: {} }, fail = r => { stats.fails[r] = (stats.fails[r] || 0) + 1; };
  if (!W.length || !X.length || !AB.length) return { ok: false, why: 'no candidates', stats };
  let seed = (opts.seed ?? 1) >>> 0; const rnd = m => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * m); };
  const c0 = SEP.closeTwins(d, geo);
  while (Date.now() - t0 < wall && stats.tried < 4000) {
    stats.tried++;
    const w = W[rnd(W.length)], x = X[rnd(X.length)], [a, b] = AB[rnd(AB.length)], a2 = twin(a), b2 = twin(b), w2 = twin(w), x2 = twin(x);
    if (new Set([a, b, w, x, a2, b2, w2, x2]).size !== 8) { fail('overlap'); continue; }
    const d2 = structuredClone(d), Q = F[a];
    // the three displaced twins and a's twin are re-paired in one of three ways
    const way = rnd(3), rest = way === 0 ? [[a2, b2], [w2, x2]] : way === 1 ? [[a2, w2], [b2, x2]] : [[a2, x2], [b2, w2]];
    d2.faces[b] = Q; d2.faces[w] = Q; d2.faces[x] = Q; d2.faces[rest[0][0]] = F[b]; d2.faces[rest[0][1]] = F[b]; d2.faces[rest[1][0]] = F[w]; d2.faces[rest[1][1]] = F[w];
    const ct = SEP.closeTwins(d2, geo); if (ct.visible > c0.visible || ct.four > 0 || ct.share > Math.max(0.05, c0.share)) { fail('twins'); continue; }
    // the bait: pair the two free copies first
    const g2 = E.game(structuredClone(d2)); let s; try { s = E.step(g2, E.step(g2, E.start(g2), a), b); } catch (e) { fail('baitIllegal'); continue; }
    const br = E.winnable(g2, s, { nodes: 400000, ms: 4000 }); if (br.result !== 'lose') { fail('bait:' + br.result); continue; }
    const rt = M.retime(d2, spare); if (!rt.ok) { fail('retime'); continue; } if (rt.k !== k) { fail('k ' + rt.k); continue; }
    const fin = rt.design, pr = C.prove(fin, k); if (!pr.ok) { fail('proof:' + pr.why); continue; }
    // the right play must really use a free copy for w: w is matched within 3 moves of being taken on the stored route
    const p2 = new Array(n).fill(-1); fin.solution.forEach((t, i) => { p2[t] = i; });
    const mate = [a, b, x].filter(t => t !== w).map(t => p2[t]).sort((u, v) => Math.abs(u - p2[w]) - Math.abs(v - p2[w]))[0];
    if (Math.abs(mate - p2[w]) > 4) { fail('wStillWaits'); continue; }
    // not a needle
    const g3 = E.game(structuredClone(fin)), s3 = E.start(g3); let wins = 0, legal = 0;
    for (const act of E.legal(g3, s3)) { legal++; let r; try { r = E.winnable(g3, E.step(g3, s3, act), { nodes: 150000, ms: 1500 }); } catch (e) { continue; } if (r.result === 'win') wins++; }
    if (wins < 3) { fail('needle ' + wins + '/' + legal); continue; }
    return { ok: true, design: fin, savePair: { free: [a, b], inTheDig: w, buried: x, picture: Q, baitResult: 'lose', firstMoves: { winning: wins, legal } }, stats, ms: Date.now() - t0 };
  }
  return { ok: false, why: 'none proven', stats, ms: Date.now() - t0 };
}

// proof context of a board of Codex's trap_mixes.js ...
function mixCtx(j) {
  const M = require('../trap_mixes.js'), name = j.brief.story, spare = j.card.clock.spare, roles = { ...j.roles, locks: new Set(j.roles.locks), holderSpecials: new Set(j.roles.holderSpecials) }, b = roles.bait;
  return { spare, freeze: [...(b.tiles || []), ...((b.repeat && b.repeat.copies) || [])], roleTiles: [...(b.tiles || []), ...(b.twins || []), ...(b.wrong || []), ...((b.repeat && b.repeat.copies) || []), ...(b.mix && b.mix.originalClock != null ? [b.mix.originalClock] : [])], prove: (x, k) => M.prove(name, x, roles, { k, spare }, { skipOpening: true }) };
}
// ... and of a chain board of trap_stories.js (level file with source 'batch N' / 'batch2 N'): roles from re-running its pool job
function chainCtx(j) {
  const PR = require('./pressure_retune.js'), R = require('./retune.js'), T = require('../trap_stories.js'), card0 = PR.metadata(j) || j.card, { job } = PR.poolJob(card0), rb = R.rebuild(job, j.design);
  if (!rb.r) throw new Error('rebuild: ' + rb.why);
  const r = rb.r, spare = r.card.clock.spare, b = r.roles.bait || {};
  return { spare, freeze: [...(b.tiles || [])], roleTiles: [...(b.tiles || []), ...(b.twins || []), ...(b.wrong || []), ...Object.values(r.roles).filter(Number.isInteger)], prove: (x, k) => T.reprove('chain', x, r.roles, r.brief, spare, k), card0 };
}
function one(file, out) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8')), mix = !!(j.brief && j.roles), id = mix ? path.basename(file, '.json') : String(j.source || path.basename(file, '.json')).replace(/ /g, '-'), C = mix ? mixCtx(j) : chainCtx(j), res = inject(j, { ms: +arg('ms', 120000), seed: +arg('seed', 1), ctx: C });
  if (!res.ok) return { id, ok: false, why: res.why, stats: res.stats };
  const E = require('../engine.js'), M = require('../trap_mixes.js'), { tuneFeel } = require('./feel_retune.js'), sp = res.savePair, d = res.design, spare = C.spare, k = d.solution.indexOf(d.clock.i) + 1;
  const validate = x => { const rt = M.retime(x, spare); if (!rt.ok) return rt; if (rt.k !== k) return { ok: false, why: 'clock' }; x.solution = rt.design.solution;
    const g = E.game(structuredClone(x)); if (E.winnable(g, E.step(g, E.step(g, E.start(g), sp.free[0]), sp.free[1]), { nodes: 150000, ms: 1500 }).result !== 'lose') return { ok: false, why: 'baitNotLost' };
    return C.prove(rt.design, k); };
  const freeze = [...new Set([...C.freeze, ...d.obst.keys, ...sp.free, sp.inTheDig, sp.buried])];
  const tuned = tuneFeel(d, { target: { parks: +arg('parks', 1.5), parksMax: +arg('parks-max', 3.2), max3: 0.12 }, ms: +arg('tail-ms', 60000), seed: 1, freeze, validate });
  const fin = tuned.ok ? tuned.design : d, card = { ...(j.card || C.card0 || {}), wrongIdea: [...new Set([...((j.card && j.card.wrongIdea) || (C.card0 ? C.card0.trap.baits.map(b => b.name) : [])), 'savePair'])].sort(), savePair: sp, feel: tuned.after };
  card.trap = { ...(card.trap || {}), see: ((card.trap && card.trap.see) || card.see || '') + ' And: the free pair is not free: the same picture lies in the dig, so keep one of the two for it.' };
  fs.writeFileSync(path.join(out, id.replace(/-s(\d+)-/, '-s$1sp-') + '.json'), JSON.stringify({ ...j, design: fin, card, savedFrom: id }));
  return { id, ok: true, savePair: sp, pp: tuned.after && tuned.after.pp, tailMet: tuned.met, stats: res.stats };
}
function main() {
  const out = path.resolve(arg('out', path.resolve(__dirname, '../../../analysis/builder/bank/chained-v3-savepair'))); fs.mkdirSync(out, { recursive: true });
  if (arg('one', null)) { let r; try { r = one(path.resolve(arg('one')), out); } catch (e) { r = { id: path.basename(arg('one'), '.json'), ok: false, why: String(e.stack || e).slice(0, 400) }; }
    fs.appendFileSync(path.join(out, 'report.jsonl'), JSON.stringify(r) + '\n'); console.log(r.id, r.ok ? `OK free ${r.savePair.free} dig ${r.savePair.inTheDig} buried ${r.savePair.buried} first moves ${r.savePair.firstMoves.winning}/${r.savePair.firstMoves.legal} pp ${r.pp}` : 'no: ' + r.why + ' ' + JSON.stringify(r.stats || {})); return; }
  const files = String(arg('files', '')).split(',').filter(Boolean), W = +arg('workers', 8); let next = 0, run = 0;
  const go = () => { while (run < W && next < files.length) { const f = files[next++]; run++; const c = cp.spawn(process.execPath, [__filename, ...process.argv.slice(2), '--one', f], { stdio: 'inherit' });
    const tm = setTimeout(() => c.kill(), +arg('ms', 120000) + +arg('tail-ms', 60000) + 120000); c.on('exit', () => { clearTimeout(tm); run--; go(); }); } }; go();
}
if (require.main === module) main();
module.exports = { inject, mixCtx, chainCtx };
