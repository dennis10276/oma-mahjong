'use strict';
/* feel_retune.js: re-pair the pictures after the clock until a sensible player's tray is as full as asked (bank/feel.js).
   Dennis 2026-11-14: "I didnt feel the tray pressure after the trap ... make it at least 2 instead of the 1 now."
   Anchors from boards he rated (feel.js numbers: mean tiles waiting / share of decisions with 2 or 3 waiting):
     303 as played "make it 2 not 1": 1.05 / 35%     302 as played "didnt feel it": 1.59 / 46% (one tile parked the whole way = "the 1 now")
     blind1-194, 5 stars "very hard but fun hard": 2.2 / 98%     blind1-185, 4 stars: 1.75 / 62%     factory4-175, 5 stars: 1.69 / 53%
   The trap is not touched: only pictures of tiles taken after the clock move (bait pictures frozen), the board, clock, ice, locks, keys and
   face-down set stay. Every accepted board: strict replay of a stored solution, the clock minimum unchanged, readable, the story re-proven,
   no new visible twins, no new blind gamble.
     node source/tools/builder/loop/heavy.js --label feel --cores 4 -- node source/tools/builder/bank/feel_retune.js --levels 302,303 --mean 2.0 --two 0.6 --out <dir> [--ms 90000] [--workers 4]
   Writes <out>/level-<n>.json { level, source, score, design, feel: { before, after, target, met } } (met=false: the best board found, still proven). */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../../../..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };

function tuneFeel(design, opts = {}) {
  const Tl = require('./tail.js'), SEP = require('./separate.js'), { expert } = require('./feel.js');
  const feel = (d, o) => { const r = expert(d, { playouts: Math.max(5, Math.round(o.playouts / 25)), seed: o.seed, wrong: o.playouts >= 400 }); r.pp = +(r.parkAt[1] + r.parkAt[2]).toFixed(1); return r; };
  const t0 = Date.now(), wall = opts.ms ?? 60000, target = opts.target, P = Tl.prepare(design), geo = SEP.geometry(design), c0 = SEP.closeTwins(design, geo), g0 = Tl.gambleFacts(design);
  let seed = (opts.seed ?? 1) >>> 0; const rnd = n => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * n); };
  const frozen = new Set((opts.freeze || []).map(i => design.faces[i])), movable = P.tail.filter(i => !frozen.has(design.faces[i]));
  const fl = d => feel(d, { playouts: opts.playouts ?? 100, seed: 5 });
  // how far from the target (0 = met); three waiting is capped so the tray is full of choices, not one slip from losing all the time
  // target.parks = 'pressure parks': how many times per game an expert has to put a tile in the tray while one or two already wait
  const miss = f => Math.max(0, target.parks - f.pp) / 4 + 3 * Math.max(0, f.waiting[3] - (target.max3 ?? 0.25)) + (f.lostGames ? 2 : 0);
  const before = feel(design, { playouts: 400, seed: 9 });
  let cur = structuredClone(design), curF = fl(cur), curM = miss(curF), best = null, proposals = 0, accepted = 0; const fails = {};
  const fail = k => { fails[k] = (fails[k] || 0) + 1; };
  while (Date.now() - t0 < wall) {
    proposals++;
    const u = movable[rnd(movable.length)], v = movable[rnd(movable.length)];
    if (u === v || cur.faces[u] === cur.faces[v]) continue;
    const d = structuredClone(cur); [d.faces[u], d.faces[v]] = [d.faces[v], d.faces[u]];
    const ct = SEP.closeTwins(d, geo); if (ct.visible > c0.visible || ct.share > Math.max(0.05, c0.share) || ct.four > c0.four) { fail('twins'); continue; }
    if (!Tl.tailReplays(P, d.faces)) { const r = Tl.cappedTail(d, 3, { peek: false, nodes: 10000, ms: 100 }); if (r.result !== 'win') { fail('unsolved'); continue; } d.solution = r.solution; }
    const gm = Tl.gambleFacts(d); if (gm.gamble > g0.gamble || gm.blindOnly > g0.blindOnly) { fail('gamble'); continue; }
    const f = fl(d), m = miss(f);
    if (m < curM || (m === curM && rnd(3) === 0) || (m < curM + 0.05 && rnd(12) === 0)) { cur = d; curF = f; curM = m; accepted++; } else { fail('noGain'); continue; }
    if (m <= 0.1 || (!best || m < best.m - 0.05)) {
      const f2 = feel(d, { playouts: 400, seed: 9 }), m2 = miss(f2);
      if (best && m2 >= best.m) continue;
      const vr = opts.validate ? opts.validate(d) : { ok: true }; if (!vr.ok) { fail('proof:' + vr.why); continue; }
      best = { design: structuredClone(d), feel: f2, m: m2 };
      if (m2 <= 0.1) break;
    }
  }
  return { ok: !!best, met: !!best && best.m <= 0.1, design: best ? best.design : design, before, after: best ? best.feel : before, proposals, accepted, fails, ms: Date.now() - t0 };
}

function one(lv, out) {
  const PR = require('./pressure_retune.js'), R = require('./retune.js'), T = require('../trap_stories.js'), E = require('../engine.js'), PS = require('../../factory/placement_score.js');
  const f = arg('from', null) ? path.join(path.resolve(arg('from')), `level-${lv}.json`) : PR.findLevel(lv), j = JSON.parse(fs.readFileSync(f, 'utf8')), card0 = PR.metadata(j), d = j.design;
  const target = { parks: +arg('parks', 7.5), max3: +arg('max3', 0.25) };
  if (!card0) return { level: lv, ok: false, why: 'older board, kept' };
  const { job } = PR.poolJob(card0), rb = R.rebuild(job, d); if (!rb.r) return { level: lv, ok: false, why: rb.why };
  const r = rb.r, k = r.card.clock.fewestMoves, spare = r.card.clock.spare;
  const validate = x => {
    if (!E.replay(x, x.solution, { strict: true }).ok) return { ok: false, why: 'replay' };
    const cs = E.clockShortest(E.game(structuredClone(x)), { nodes: 300000, ms: 3000, finishNodes: 100000, finishMs: 1000 });
    if (!cs || cs.unsure || cs.k !== k) return { ok: false, why: 'clock' };
    if (!PS.readable(x)) return { ok: false, why: 'readable' };
    return T.reprove('chain', x, r.roles, r.brief, spare, k);
  };
  const res = tuneFeel(d, { target, ms: +arg('ms', 90000), seed: +arg('seed', 1), freeze: r.roles.bait.tiles, validate });
  if (res.ok) fs.writeFileSync(path.join(out, `level-${lv}.json`), JSON.stringify({ level: lv, source: j.source || (j.card && j.card.poolId), score: j.score || (j.difficulty && j.difficulty.score), design: res.design, feel: { before: res.before, after: res.after, target, met: res.met } }));
  return { level: lv, ok: res.ok, met: res.met, before: res.before, after: res.after, proposals: res.proposals, accepted: res.accepted, fails: res.fails };
}
// a board of Codex's trap_mixes.js (chained-v1 examples: { design, brief, roles, card }): proof by its own story
function oneMix(file, out) {
  const M = require('../trap_mixes.js'), j = JSON.parse(fs.readFileSync(file, 'utf8')), d = j.design, name = j.brief.story, spare = j.card.clock.spare, k = d.solution.indexOf(d.clock.i) + 1;
  const roles = { ...j.roles, locks: new Set(j.roles.locks), holderSpecials: new Set(j.roles.holderSpecials) };
  const validate = x => { const rt = M.retime(x, spare); if (!rt.ok) return rt; if (rt.k !== k) return { ok: false, why: 'clock' }; x.solution = rt.design.solution; return M.prove(name, rt.design, roles, { k, spare }, { skipOpening: true }); };
  const target = { parks: +arg('parks', 7.5), max3: +arg('max3', 0.25) }, freeze = [...new Set([...roles.bait.tiles, ...d.obst.keys, ...((roles.bait.repeat && roles.bait.repeat.copies) || [])])];
  const res = tuneFeel(d, { target, ms: +arg('ms', 90000), seed: +arg('seed', 1), freeze, validate }), id = path.basename(file, '.json');
  if (res.ok) fs.writeFileSync(path.join(out, id + '.json'), JSON.stringify({ ...j, design: res.design, feel: { before: res.before, after: res.after, target, met: res.met } }));
  return { level: id, ok: res.ok, met: res.met, before: res.before, after: res.after, proposals: res.proposals, accepted: res.accepted, fails: res.fails };
}
function main() {
  const out = path.resolve(arg('out', path.join(ROOT, 'source/build/traps/feel-out'))); fs.mkdirSync(out, { recursive: true });
  if (arg('one', null)) {
    const mix = /.json$/.test(arg('one')); let res; try { res = mix ? oneMix(path.resolve(arg('one')), out) : one(+arg('one'), out); } catch (e) { res = { level: arg('one'), ok: false, why: String(e.stack || e).slice(0, 300) }; }
    if (mix) res.level = path.basename(arg('one'), '.json');
    fs.writeFileSync(path.join(out, `r-${res.level}.json`), JSON.stringify(res));
    const s = f => f ? `pressure parks ${f.pp} (at 0/1/2 waiting: ${f.parkAt.join('/')}) mean waiting ${f.mean} three: ${f.waiting[3]} wrongPark ${f.wrongPark}` : '';
    console.log(res.level, res.ok ? (res.met ? 'MET ' : 'best ') + s(res.before) + '  ->  ' + s(res.after) : 'FAILED ' + (res.why || JSON.stringify(res.fails))); return;
  }
  const levels = arg('files', null) ? String(arg('files')).split(',') : String(arg('levels', '')).split(',').filter(Boolean).map(Number), W = +arg('workers', 4); let next = 0, run = 0;
  const go = () => { while (run < W && next < levels.length) { const lv = levels[next++]; run++; const c = cp.spawn(process.execPath, [__filename, ...process.argv.slice(2), '--one', String(lv)], { stdio: 'inherit' });
    const tm = setTimeout(() => c.kill(), +arg('ms', 90000) + 240000); c.on('exit', () => { clearTimeout(tm); run--; go(); }); } }; go();
}
if (require.main === module) main();
module.exports = { tuneFeel, one };
