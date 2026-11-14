'use strict';
/* make_batch.js: the first batch of chain-trap levels for 250-289 (40 levels) plus spares. Bot-free: every board is judged by engine proofs and measured facts.
   (Dennis 2026-11-13: "fun and challenging in all kinds of varieties ... You decide how difficult they are ... Place them on the 250+ levels after they are fully done.")

     node source/tools/builder/loop/heavy.js --label batch --cores 8 -- node source/tools/builder/bank/make_batch.js --stage pool  [--wave 1] [--workers 8]
     node source/tools/builder/bank/make_batch.js --stage assign          choose + order the boards, write source/analysis/builder/bank/batch-250-289/ (level-<n>.json, spares/, batch.md, batch.json)
     node source/tools/builder/bank/make_batch.js --stage status          what the pool holds (per shape, per layout, per score band)
   Pool options: --shapes 8,9,11  --layouts 41,18  --seeds 1,2  --dial 5,3  --workers N  --tiers std,hard  --wave N (a preset job list, see WAVES)  --sepwall ms  --tailwall ms
   Resumable: a job whose file exists in source/build/traps/batch-pool/ is skipped (failures leave a small marker with the reason); delete the file to retry.

   A POOL BOARD (one job = shape x layout x seed x pressure dial) goes through:
     1. T.build('chain', ...) with the pressure dial (the right route keeps 2+ tiles waiting for run2 moves and sits at 3 waiting at3 times) - story proof inside: baits proven dearer than
        any unrelated move, every lock and ice matters (idle check), all roles shown at move 0, spare 1 (2 when no spare-1 board is honest)
     2. twins apart (T.separateBoard, up to 4 passes): ZERO visible close twins, at most 5% of the pairs close overall, else the board is discarded
     3. tail tuned (T.tuneTail) into a band: tier std = 0.15-0.40, tier hard = 0.08-0.22 (the hard tier is placed only in the hardest third, levels 276+, when below 0.15)
     4. re-proof of the story + static gates; stored solution a strict win; clock n = proven k + spare; face-down share at most 0.30
     5. facts: winning first moves (exact engine, fewer than 3 = needle, only in the hardest third), pressure facts, difficulty.js score
   ASSIGNMENT (beam search over the pool, level by level), the hard rules: levels 250-255 may use 2-link shapes, from 256 only 3+ links; shapes with needsUi (frozen key / frozen lock
     display fix) are never used (listed as "waiting for the display fix"); a layout (or one sharing > 75% of its tile positions) not within the previous 12 levels; a chain shape not within the
     previous 2 levels and at most 3 times in the batch; the same layout + shape never twice; bank/ledger.js check (3 of 5 signature fields differ from every earlier level); levels 250, 260,
     270, 280 on 96-tile layouts, every other level on 72-88 tiles; needle boards and tail below 0.15 only from level 276 on; no score dip larger than 0.5 against the level before.
   Soft: the score follows the ramp 3.0 (level 250) -> 7.5 (level 289) by the straight line; readable-stacking top half of the layouts; 72-80 tiles over 84-88; layouts not played in the lab;
   another clock cell than the previous 3 levels.
   A level without any board that fits stays a HOLE (listed with the binding rule in batch.md); nothing is relaxed silently.                                                                    */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../../../..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const has = n => process.argv.includes('--' + n);
const BAND = { std: [0.15, 0.40], hard: [0.08, 0.22], easy: [0.30, 0.40], deep: [0.08, 0.13] };
const PLAYED3 = [0, 1, 2, 3, 5, 6, 7, 8, 9, 12, 14, 15, 16, 21, 23, 24, 30, 31, 46];
// a job is shape x layout x seed x pressure dial (x targets variant 'v', x twin repair 'rp'); the variants carry a suffix so the old markers stay valid
const jobName = j => `${j.si}-${j.layout}-${j.seed}-d${j.dial[0]}_${j.dial[1]}${j.v ? '-v' + j.v : ''}${j.repair ? '-rp' : ''}.json`;
const JOBRE = /^(\d+)-(\d+)-(\d+)-d(\d+)_(\d+)(?:-v(\w+))?(?:-rp)?\.json$/;

// ---------------------------------------------------------------- the batch configuration (defaults = batch 1, levels 250-289; every option below changes only what it names)
//   --first N --last N        the level range (default 250-289); big levels (96 tiles) are the ones divisible by 10
//   --out <dir>               where the batch is written (default source/analysis/builder/bank/batch-<first>-<last>)
//   --pool <dir>[,<dir>]      pool folders to read (default source/build/traps/batch-pool; a pool wave writes into the LAST one)
//   --earlier <folder>[,<folder>]   earlier placed levels: every board in them (level-<n>.json, rejected/ too, never spares/) and every layout+shape host they used is excluded; a folder whose files carry a
//                             "source" field is a placed folder (its level numbers are the game's) and gives the look-back for the variety windows (layout 12 levels, shape 2 levels, ledger fields)
//   --ramp a,b                score target at the first and the last level (default 3,7.5)
//   --breather N              every N-th level (index N-2 of each N) is a breather: target 1.25 below the line, a dip of up to 1.75 into it is allowed (default 0 = none)
//   --two-link-to L           levels up to L may use 2-link shapes (default 255; from L+1 only 3+ links)
//   --hardest-from L          needle boards and a tail below 0.15 are allowed from level L (default first + 2/3 of the batch = 276)
//   --needle-gap N            two needle boards at least N levels apart (default 0 = no such rule; the placement rule is then "from --hardest-from")
//   --shape-max N             a chain shape at most N times in the batch (default 3)
//   --layout-window N         the layout (or one sharing > 75% of its positions) is not used again within N levels (default 12)
//   --dip D                   largest allowed score dip against the level before (default 0.5)
//   --stop-at-hole            the batch is consecutive levels from --first: a hole costs more the earlier it lies, and the boards after the first hole are not written as levels (spares/after-hole-<n>.json)
function config(o = {}) {
  const g = (n, d) => o[n] != null ? o[n] : arg(n, d), rd = x => path.resolve(ROOT, x);
  const first = +g('first', 250), last = +g('last', 289), NL = last - first + 1, ramp = String(g('ramp', '3,7.5')).split(',').map(Number);
  const hardestFrom = +g('hardest-from', first + Math.floor(NL * 2 / 3)), breather = +g('breather', 0);
  return { first, last, NL, out: rd(g('out', 'source/analysis/builder/bank/batch-' + first + '-' + last)), pools: String(g('pool', 'source/build/traps/batch-pool')).split(',').map(rd),
    earlier: g('earlier', '') ? String(g('earlier', '')).split(',').map(rd) : [], ramp, breather, twoLinkTo: +g('two-link-to', 255), hardestFrom, needleGap: +g('needle-gap', 0), shapeMax: +g('shape-max', 3), layoutWin: +g('layout-window', 12), dip: +g('dip', 0.5), stopAtHole: !!(o['stop-at-hole'] || has('stop-at-hole')),
    isBig: lv => lv % 10 === 0, isBreather: lv => breather > 0 && (lv - first) % breather === breather - 2,
    target: lv => { const t = ramp[0] + (lv - first) * (ramp[1] - ramp[0]) / (last - first); return breather > 0 && (lv - first) % breather === breather - 2 ? t - 1.25 : t; } };
}
let CFG = config();
const POOL = () => CFG.pools[CFG.pools.length - 1];
const poolFiles = () => CFG.pools.flatMap(d => fs.existsSync(d) ? fs.readdirSync(d).filter(x => JOBRE.test(x)).map(x => ({ dir: d, f: x })) : []);   // every job file of every pool folder
const readJob = pf => JSON.parse(fs.readFileSync(path.join(pf.dir, pf.f), 'utf8'));
const jobExists = j => CFG.pools.some(d => fs.existsSync(path.join(d, jobName(j))));

// ---------------------------------------------------------------- one pool job
function runJob(job) {
  const T = require('../trap_stories.js'), SEP = require('./separate.js'), M = require('../../factory/meter.js'), E = require('../engine.js'), Df = require('./difficulty.js'), B = require('../builder.js');
  const sig = T.CHAIN_SHAPES[job.si], def = T.CHAIN[sig], t0 = Date.now(), name = 'chain';
  const out = { job, shape: sig, links: def.length, needsUi: def.needsUi || null, ok: false, variants: [] };
  if (def.needsUi) { out.why = 'needsUi'; return out; }
  const brief = { chain: sig, layout: job.layout, seed: job.seed, stage: job.stage || 'edge', pressure: { run2: job.dial[0], at3: job.dial[1] }, ...(job.spare || job.frame ? { frame: { ...(job.frame || {}), ...(job.spare ? { spare: job.spare } : {}) } } : {}), ...(job.targets ? { targets: job.targets } : {}) };
  const r = T.build(name, brief, { tries: job.tries || 20, wallMs: job.buildWall || 20000 });
  if (!r.design) { out.why = 'nobuild'; out.ms = Date.now() - t0; return out; }
  const k = r.card.clock.fewestMoves, spare = r.card.clock.spare, n = r.design.tiles.length;
  if (r.design.clock.n !== k + spare) { out.why = 'clockN'; return out; }
  // twins apart
  let sep = null, cur = r.design, swaps = 0;
  for (let pass = 0; pass < (job.passes || 4); pass++) {
    const o = T.separateBoard(name, { ...r, design: cur }, { wallMs: job.sepWall || 30000, seed: job.seed + pass * 7 });
    if (!o.proofOk) break;
    const cc = SEP.closeTwins(o.design), prev = sep ? SEP.closeTwins(sep.design) : null; sep = o; cur = o.design; swaps += o.edits.length;
    if (cc.visible === 0 && cc.share <= 0.05) break; if (prev && cc.visible >= prev.visible && cc.count >= prev.count) break;   // a pass that gains nothing ends the effort
  }
  if (!sep) { out.why = 'proofLostInSeparation'; out.ms = Date.now() - t0; return out; }
  // job.repair: the last one to three visible close twins are repaired by a targeted picture swap with a new proven route (trap_stories.js repairTwins)
  const c0 = SEP.closeTwins(sep.design);
  if (job.repair && c0.visible > 0 && c0.visible <= 3 && c0.share <= 0.05) {
    const rp = T.repairTwins(name, { ...r, design: sep.design }, sep.design, { wallMs: job.repairWall || 60000 });
    out.repair = { before: c0.visible, after: rp.after.visible, swaps: rp.edits.length, tested: rp.tested, withK: rp.withK, why: rp.why, ms: rp.ms };
    if (rp.changed) { sep = { ...sep, design: rp.design, edits: sep.edits.concat(rp.edits) }; swaps += rp.edits.length; }
  }
  const c1 = SEP.closeTwins(sep.design);
  if (c1.visible !== 0 || c1.share > 0.05) { out.why = `twins:${c1.visible} visible, share ${c1.share}`; out.ms = Date.now() - t0; return out; }
  out.ok = true; out.built = { k, spare, tiles: n, ms: Date.now() - t0 };
  const lay = B.LAYOUTS[job.layout];
  for (const tier of job.tiers || ['std', 'hard']) {
    const t1 = Date.now(), band = BAND[tier];
    const tuned = T.tuneTail(name, r, sep.design, { band, wallMs: job.tailWall || 30000, seed: job.seed });
    const fin = tuned.design, rp = T.reprove(name, fin, r.roles, r.brief, spare, k);
    const v = { tier, ok: false };
    if (!rp.ok) { v.why = 'proofLostInTail:' + rp.why; out.variants.push(v); continue; }
    if (!E.replay(fin, fin.solution, { strict: true }).ok) { v.why = 'replay'; out.variants.push(v); continue; }
    const ds = (fin.down || []).length / fin.tiles.length; if (ds > 0.30) { v.why = 'faceDown ' + ds.toFixed(3); out.variants.push(v); continue; }
    const c2 = SEP.closeTwins(fin); if (c2.visible !== 0 || c2.share > 0.05) { v.why = 'twins after tail'; out.variants.push(v); continue; }
    const facts = T.pressureFacts(fin), tc = { ...rp.proof.card, trapType: 'chain:' + sig };
    const card = { schema: 'bank-puzzle-v1-like', trapType: tc.trapType, shape: sig, links: def.length, needsUi: null, layout: job.layout, layoutName: lay.shape, tiles: fin.tiles.length, boardKey: M.boardKey(fin),
      trap: tc, clock: { ...r.card.clock, k, n: fin.clock.n, spare }, spare, faceDownShare: +ds.toFixed(3),
      baits: tc.baits.map(b => ({ name: b.name, tiles: b.tiles, provenResult: b.result, provenCost: b.cost, value: b.value, controlValue: tc.control.value })), control: tc.control,
      firstMoves: { winning: facts.firstMoves.winning, legal: facts.firstMoves.legal, losingOrUnknownTiles: facts.firstMoves.rows, unknown: facts.firstMoves.unknown, atLeast3: facts.firstMoves.atLeast3 },
      pressure: { k: facts.k, occ: facts.occ, peak: facts.peak, run2: facts.run2, at3: facts.at3, moves2plus: facts.moves2plus, waiters: facts.waiters, twinAfterClock: facts.twinAfterClock, capProof: facts.capProof, needsWaiting: facts.needsWaiting },
      tail: { band, tier, before: tuned.before, after: tuned.after, inBand: tuned.inBand, swaps: tuned.swaps, gamble: tuned.gamble },
      closeTwins: { before: SEP.summary(SEP.closeTwins(r.design)), final: SEP.summary(c2), swaps }, see: tc.see };
    const df = Df.score(fin, { ...card, trap: tc, tail: card.tail }, { press: facts });
    v.ok = true; v.ms = Date.now() - t1; v.tail = tuned.after.tailGreedyWin; v.inBand = tuned.inBand; v.score = df.score; v.needle = df.needle;
    v.card = { ...card, difficulty: { score: df.score, parts: df.parts, needle: df.needle, facts: df.facts, weights: df.weights } }; v.design = fin;
    out.variants.push(v);
  }
  out.ms = Date.now() - t0; return out;
}

// ---------------------------------------------------------------- job lists (waves)
function wave(n) {
  const T = require('../trap_stories.js'), jobs = [];
  const sweepHosts = (si, dialOnly) => {
    const d = path.join(ROOT, 'source/build/traps'), hs = new Set();
    for (const p of dialOnly ? ['chain-sweep-dial-top-', 'chain-sweep-dial-'] : ['chain-sweep-dial-top-', 'chain-sweep-dial-', 'chain-sweep-top-', 'chain-sweep-']) { try { for (const l of JSON.parse(fs.readFileSync(d + '/' + p + si + '.json', 'utf8')).hosts) hs.add(l); } catch (e) { /* none */ } }
    return [...hs];
  };
  const shapes3 = T.CHAIN_DEFS.map((d, i) => i).filter(i => !T.CHAIN_DEFS[i].needsUi && T.CHAIN_DEFS[i].length >= 3), shapes2 = T.CHAIN_DEFS.map((d, i) => i).filter(i => T.CHAIN_DEFS[i].length === 2);
  const BIGL = [13, 21, 27, 29, 47];
  if (n === 1) {   // known hosts, two seeds, the standard dial
    for (const si of shapes3.concat(shapes2)) for (const layout of sweepHosts(si)) for (const seed of [1, 2]) jobs.push({ si, layout, seed, dial: [5, 3] });
  } else if (n === 2) {   // the 96-tile layouts for every shape, then every layout for the shapes with few hosts
    for (const si of shapes3.concat(shapes2)) for (const layout of BIGL) jobs.push({ si, layout, seed: 1, dial: [5, 3], buildWall: 15000 });
  } else if (n === 3) {   // every layout, every 3+ link shape, one seed
    for (const si of shapes3) for (let layout = 0; layout < 48; layout++) if (!BIGL.includes(layout)) jobs.push({ si, layout, seed: 1, dial: [5, 3], buildWall: 12000, tries: 12 });
  }
  else if (n === 4) {   // the gentle end of the ramp: weaker dial, spare 2, tail near the top of the band
    for (const si of shapes2.concat(shapes3)) for (const layout of sweepHosts(si)) for (const seed of [1, 2]) jobs.push({ si, layout, seed, dial: [3, 2], spare: 2, tiers: ['easy', 'std'] });
    for (const si of shapes2) for (const layout of BIGL) jobs.push({ si, layout, seed: 1, dial: [3, 2], spare: 2, tiers: ['easy', 'std'], buildWall: 15000 });
  }
  else if (n === 5) {   // 4-link shapes on every layout (the top of the ramp needs them)
    for (const si of shapes3.filter(i => T.CHAIN_DEFS[i].length >= 4)) for (let layout = 0; layout < 48; layout++) jobs.push({ si, layout, seed: 1, dial: [5, 3], tiers: ['std', 'hard', 'deep'], buildWall: 12000, tries: 12 });
  } else if (n === 6) {   // a harder dial on every known host of the 3+ link shapes
    for (const si of shapes3) for (const layout of sweepHosts(si)) for (const seed of [1, 2]) jobs.push({ si, layout, seed, dial: [8, 4], tiers: ['hard', 'deep'] });
  }
  else if (n === 7) {   // more seeds for the shapes that built on few layouts or died in the twin separation
    for (const si of [13, 14, 15, 36, 38, 30, 31, 32, 10]) for (let layout = 0; layout < 48; layout++) for (const seed of [2, 3]) jobs.push({ si, layout, seed, dial: [5, 3], tiers: ['std', 'hard'], buildWall: 20000, tries: 24 });
  } else if (n === 8) {   // shapes that never built: a longer search and the weaker dial
    for (const si of [24, 25, 34, 37, 39, 40]) for (let layout = 0; layout < 48; layout++) for (const seed of [1, 2]) jobs.push({ si, layout, seed, dial: [3, 2], tiers: ['std', 'hard'], buildWall: 25000, tries: 30 });
  }
  else if (n === 11 || n === 12) {   // pairs that built but kept ONE visible close twin (usually the story's own bait pair lying close): another seed puts it elsewhere
    const okp = new Set(), near = new Map();
    for (const pf of poolFiles()) { const fl = pf.f, m = JOBRE.exec(fl); if (!m || m[6]) continue; const j = readJob(pf), k = m[1] + '/' + m[2];
      if (j.ok && j.variants.some(v => v.ok)) okp.add(k); else { const mm = /^twins:(\d+) visible/.exec(j.why || ''); if (mm && +mm[1] <= 1 && !near.has(k)) near.set(k, [+m[1], +m[2], [+m[4], +m[5]]]); } }
    for (const [k, [si, layout, dial]] of near) if (!okp.has(k) && !T.CHAIN_DEFS[si].needsUi && T.CHAIN_DEFS[si].length >= 3) jobs.push({ si, layout, seed: n === 11 ? 6 : 7, dial, tiers: ['std', 'hard'], buildWall: 25000, tries: 30 });
  }
  else if (n === 9 || n === 10) {   // search-limited hosts: every (shape, layout) whose earlier builds ran into the time limit (not the structural 'noChain'), new seeds, longer search, the weaker dial
    const done = new Map(); for (const pf of poolFiles()) { const m = JOBRE.exec(pf.f); if (!m || m[6]) continue; const j = readJob(pf), k = m[1] + '/' + m[2], o = done.get(k) || { ok: false, slow: false }; if (j.ok) o.ok = true; else if (j.why === 'nobuild' && (j.ms || 0) >= 3000) o.slow = true; done.set(k, o); }
    for (const si of shapes3) for (let layout = 0; layout < 48; layout++) { const o = done.get(si + '/' + layout); if (!o || !o.slow || o.ok) continue; for (const seed of [n === 9 ? 4 : 5]) jobs.push({ si, layout, seed, dial: [3, 2], tiers: ['std', 'hard'], buildWall: 40000, tries: 40 }); }
  }
  else if (n >= 20 && n <= 29) {   // the second batch (levels 303-342, harder): 3+ link shapes only, tiers hard / deep, the last visible close twins repaired (job.repair)
    const info = hostInfo(), sh3 = shapes3, hard = ['hard', 'deep'];
    const near = ([k, h]) => h.ok || (h.minVisible != null && h.minVisible <= 3), quick = { passes: 2, sepWall: 20000 }, rank = h => h.ok ? 0 : h.minVisible;   // the most promising hosts first; two separation passes (the third and fourth gained nothing in the sample)
    if (n === 20) {   // every old twins marker with 1 to 3 visible close twins, the same build parameters, now with the repair
      for (const pf of poolFiles()) { const m = JOBRE.exec(pf.f); if (!m || m[6] || pf.f.includes('-rp')) continue; const j = readJob(pf), mm = /^twins:(\d+) visible, share ([\d.]+)/.exec(j.why || ''); if (!mm || +mm[1] < 1 || +mm[1] > 3 || +mm[2] > 0.05) continue;
        if (T.CHAIN_DEFS[j.job.si].needsUi || T.CHAIN_DEFS[j.job.si].length < 3) continue; jobs.push({ ...j.job, repair: true, tiers: hard }); }
    } else if (n === 21 || n === 22) {   // the pressure dial 8/4 (21) and 10/5 (22) with the repair, on every host that built, nearly built (<= 3 visible twins) or ran out of search time; two seeds
      for (const [k, h] of [...info].sort((a, b) => rank(a[1]) - rank(b[1]))) { const [si, layout] = k.split('/').map(Number); if (!sh3.includes(si) || !near([k, h])) continue; for (const seed of [1, 2]) jobs.push({ si, layout, seed, dial: n === 21 ? [8, 4] : [10, 5], repair: true, tiers: hard, buildWall: 25000, tries: 24, ...quick }); }
    } else if (n === 23) {   // new seeds on every shape x layout that never built: the cheap structural failures cost milliseconds, the proof failures a search
      for (const si of sh3) for (let layout = 0; layout < 48; layout++) { const h = info.get(si + '/' + layout); if (h && h.ok) continue; for (const seed of [3, 4, 5, 6]) jobs.push({ si, layout, seed, dial: [8, 4], repair: true, tiers: hard, buildWall: 25000, tries: 24, ...quick }); }
    } else if (n === 25) {   // the 96-tile layouts (levels 310, 320, 330, 340 need them): every 3+ link shape, three seeds, the dials 8/4 and 5/3, with the repair
      for (const dial of [[8, 4], [5, 3]]) for (const seed of [1, 2, 3]) for (const layout of BIGL) for (const si of sh3) jobs.push({ si, layout, seed, dial, repair: true, tiers: hard, buildWall: 30000, tries: 24, ...quick });
    } else if (n === 27 || n === 28) {   // layouts that carry no board of a 3+ link shape at all (the layout window, not the host count, limits a batch): 27 = new seeds as in 23, 28 = the loosened targets as in 24
      const has = new Set(); for (const [k, h] of info) if (h.ok && sh3.includes(+k.split('/')[0])) has.add(+k.split('/')[1]);
      const tg = { rightCost: 9, digBefore: [3, 9], minWay: 4, keyCover: [1, 4] };
      for (let layout = 0; layout < 48; layout++) { if (has.has(layout)) continue; for (const si of sh3) for (const seed of n === 27 ? [3, 4, 5, 6] : [1, 2]) jobs.push(n === 27 ? { si, layout, seed, dial: [8, 4], repair: true, tiers: hard, buildWall: 25000, tries: 24, ...quick } : { si, layout, seed, dial: [8, 4], v: 'A', targets: tg, repair: true, tiers: hard, buildWall: 25000, tries: 24, ...quick }); }
    } else if (n === 26) {   // another stage (where the clock tile sits: centre / top instead of edge) on the pairs whose search ran out of time (the structural failures cost nothing and do not depend on it)
      for (const [k, h] of info) { const [si, layout] = k.split('/').map(Number); if (!sh3.includes(si) || h.ok || !h.slow) continue; for (const [v, stage] of [['C', 'centre'], ['T', 'top']]) jobs.push({ si, layout, seed: 1, dial: [8, 4], v, stage, repair: true, tiers: hard, buildWall: 25000, tries: 24, ...quick }); }
    } else if (n === 24) {   // the loosened placement targets (rightCost 9, dig before the first key 3-9, shortest way 4, key cover 1-4) on the shapes x layouts that never built
      const tg = { rightCost: 9, digBefore: [3, 9], minWay: 4, keyCover: [1, 4] };
      for (const si of sh3) for (let layout = 0; layout < 48; layout++) { const h = info.get(si + '/' + layout); if (h && h.ok) continue; for (const seed of [1, 2]) jobs.push({ si, layout, seed, dial: [8, 4], v: 'A', targets: tg, repair: true, tiers: hard, buildWall: 25000, tries: 24, ...quick }); }
    }
  }
  return jobs;
}
// one row per host (shape/layout) over every pool folder: did a board come out, the fewest visible close twins of a twins failure, a search that ran out of time
function hostInfo() {
  const m = new Map();
  for (const pf of poolFiles()) { const x = JOBRE.exec(pf.f); if (!x) continue; const j = readJob(pf), k = x[1] + '/' + x[2], h = m.get(k) || { ok: false, minVisible: null, slow: false, jobs: 0 }; h.jobs++;
    if (j.ok && j.variants.some(v => v.ok)) h.ok = true; else { const mm = /^twins:(\d+) visible/.exec(j.why || ''); if (mm) h.minVisible = h.minVisible == null ? +mm[1] : Math.min(h.minVisible, +mm[1]); if (j.why === 'nobuild' && (j.ms || 0) >= 3000) h.slow = true; } m.set(k, h); }
  return m;
}
function parent() {
  fs.mkdirSync(POOL(), { recursive: true });
  let jobs = arg('wave', null) ? wave(+arg('wave')) : [];
  if (!jobs.length) {
    const T = require('../trap_stories.js'), shapes = arg('shapes', null) ? arg('shapes').split(',').map(Number) : [...T.CHAIN_SHAPES.keys()], layouts = arg('layouts', null) ? arg('layouts').split(',').map(Number) : [...Array(48).keys()];
    const seeds = (arg('seeds', '1')).split(',').map(Number), dial = arg('dial', '5,3').split(',').map(Number), tiers = arg('tiers', 'std,hard').split(',');
    for (const si of shapes) for (const layout of layouts) for (const seed of seeds) jobs.push({ si, layout, seed, dial, tiers, ...(arg('spare', null) ? { spare: +arg('spare') } : {}) });
  }
  if (has('reverse')) jobs.reverse();
  for (const j of jobs) { if (arg('sepwall', null)) j.sepWall = +arg('sepwall'); if (arg('tailwall', null)) j.tailWall = +arg('tailwall'); }
  const todo = jobs.filter(j => !jobExists(j));
  const W = Math.max(1, +arg('workers', 8)), jf = path.join(POOL(), '_jobs-' + process.pid + '.json'); fs.writeFileSync(jf, JSON.stringify(todo));
  console.log(`pool: ${jobs.length} jobs, ${todo.length} to do, ${W} workers`);
  let done = 0; const t0 = Date.now(); let running = 0;
  const kids = [];
  for (let w = 0; w < W; w++) {
    const c = cp.spawn(process.execPath, [__filename, ...process.argv.slice(2), '--worker', String(w), '--of', String(W), '--jobs', jf], { stdio: ['ignore', 'inherit', 'inherit'] }); kids.push(c); running++;
    c.on('exit', () => { running--; if (!running) { fs.rmSync(jf, { force: true }); console.log('pool done in', Math.round((Date.now() - t0) / 1000), 's'); } });
  }
}
function worker() {
  const w = +arg('worker', 0), W = +arg('of', 1), jobs = JSON.parse(fs.readFileSync(arg('jobs'), 'utf8')).filter((j, i) => i % W === w);
  for (const j of jobs) {
    const f = path.join(POOL(), jobName(j)); if (jobExists(j)) continue;
    let res; try { res = runJob(j); } catch (e) { res = { job: j, ok: false, why: 'crash: ' + String(e && e.stack || e).slice(0, 300) }; }
    fs.writeFileSync(f, JSON.stringify(res));
    console.log(jobName(j), res.ok ? 'ok ' + res.variants.map(v => v.tier + ':' + (v.ok ? v.score + '/t' + v.tail + (v.inBand ? '' : '(out)') + (v.needle ? '/needle' : '') : v.why)).join(' ') : res.why, (res.ms / 1000 | 0) + 's');
  }
}

// ---------------------------------------------------------------- the pool, filtered
function loadPool() {
  const Df = require('./difficulty.js');
  const cands = [], fails = {};
  let jobs = 0;
  for (const pf of poolFiles()) {
    const f = pf.f; jobs++;
    const j = readJob(pf);
    if (!j.ok) { const why = String(j.why).replace(/[:0-9].*$/, ''); fails[why] = (fails[why] || 0) + 1; continue; }
    for (const v of j.variants) {
      if (!v.ok) { const why = 'variant:' + String(v.why).replace(/[:0-9].*$/, ''); fails[why] = (fails[why] || 0) + 1; continue; }
      const t = v.tail, ok = t >= 0.08 && t <= 0.40 && v.inBand;
      if (ok) { const ds = Df.score(v.design, v.card, { facts: v.card.difficulty.facts }); v.card.difficulty = { score: ds.score, parts: ds.parts, needle: ds.needle, facts: ds.facts, weights: ds.weights }; v.score = ds.score; }   // always the current weights
      if (!ok) { fails['tailOutOfBand'] = (fails['tailOutOfBand'] || 0) + 1; continue; }
      cands.push({ id: f.replace('.json', '') + '-' + v.tier, file: f, tier: v.tier, shapeIndex: j.job.si, shape: j.shape, links: j.links, layout: j.job.layout, seed: j.job.seed, tiles: v.card.tiles, score: v.card.difficulty.score,
        needle: v.card.difficulty.needle, tail: t, spare: v.card.spare, down: v.card.faceDownShare, rec: v });
    }
  }
  return { cands, fails, jobs };
}

// ---------------------------------------------------------------- earlier placed levels (--earlier)
const designKey = d => JSON.stringify([d.tiles, d.clock, d.obst && d.obst.locks, d.obst && d.obst.keys, d.down]);   // the board without its pictures (the game may deal the pictures per level; assemble_250.js uses the same key)
function loadEarlier(C) {
  const L = require('./ledger.js'), boards = new Set(), hosts = new Set(), meta = new Map(), placed = [];
  for (const dir of C.earlier) {
    for (const sub of ['', 'rejected']) {
      const d = path.join(dir, sub); if (!fs.existsSync(d)) continue;   // spares/ is never read: a spare was not placed
      for (const f of fs.readdirSync(d)) {
        if (!/^level-\d+\.json$/.test(f)) continue;
        const j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); if (!j.design || !j.design.tiles) continue;
        const key = designKey(j.design), card = j.card || {}; boards.add(key);
        if (card.layoutId != null && card.shapeIndex != null) { hosts.add(card.layoutId + '/' + card.shapeIndex); meta.set(key, { layout: card.layoutId, shape: card.shape, shapeIndex: card.shapeIndex }); }
        if (j.source != null && j.level != null) placed.push({ level: j.level, key, design: j.design, score: j.score != null ? j.score : (j.difficulty && j.difficulty.score) });
      }
    }
  }
  // a placed folder (files with "source") gives the game's level numbers; layout and shape of its boards come from the batch folders listed with it (same board key)
  const pre = placed.sort((a, b) => a.level - b.level).map(p => { const m = meta.get(p.key) || {}; if (m.layout != null) hosts.add(m.layout + '/' + m.shapeIndex); return { level: p.level, layout: m.layout ?? null, shape: m.shape || null, score: p.score, sig: L.signature(p.design, { layout: m.layout ?? null, trapType: m.shape || null }) }; });
  return { boards, hosts, pre };
}

// ---------------------------------------------------------------- assignment
let A_SA = null, A_DFS = null;
function assign(opts = {}) {
  const L = require('./ledger.js'), T = require('../trap_stories.js'), R = JSON.parse(fs.readFileSync(path.join(ROOT, 'source/build/traps/readable-layouts.json'), 'utf8')), rank = {};
  R.ranked.forEach(r => { rank[r.layout] = r.rank; });
  const C = opts.cfg ? config(opts.cfg) : CFG, FIRST = C.first, LAST = C.last, NL = C.NL, target = C.target;
  const pool0 = opts.pool || loadPool(), fails = pool0.fails, jobs = pool0.jobs;
  // earlier placed levels: their boards and layout+shape hosts are not available; their last 12 levels are the look-back of the variety windows
  const earlier = opts.earlier || loadEarlier(C); let cands = pool0.cands, excluded = { boards: 0, hosts: 0 };
  if (earlier.boards.size || earlier.hosts.size) cands = cands.filter(c => { if (earlier.hosts.has(c.layout + '/' + c.shapeIndex)) { excluded.hosts++; return false; } if (earlier.boards.has(designKey(c.rec.design))) { excluded.boards++; return false; } return true; });
  for (const c of cands) if (!c.sig) c.sig = L.signature(c.rec.design, { layout: c.layout, trapType: c.shape });
  // the look-back, per board: the latest earlier level sharing its layout (or > 75% of the positions), the latest with the same shape, and whether an earlier level within 12 levels is too alike by the ledger fields
  for (const c of cands) { c.preLayoutLv = null; c.preShapeLv = null; c.preDiffBad = []; for (const x of earlier.pre) { if (L.sameLayout(c.sig, x.sig)) c.preLayoutLv = Math.max(c.preLayoutLv ?? -1, x.level); if (x.shape && x.shape === c.shape) c.preShapeLv = Math.max(c.preShapeLv ?? -1, x.level); if (L.diffCount(c.sig, x.sig) < L.RULES.minDiff) c.preDiffBad.push(x.level); } }
  const preBlocked = (lv, c) => { const hit = []; if (c.preLayoutLv != null && lv - c.preLayoutLv <= C.layoutWin) hit.push('layoutWithin12Levels'); if (c.preShapeLv != null && lv - c.preShapeLv <= L.RULES.trapWindow) hit.push('shapeWithin2Levels'); if (c.preDiffBad.some(x => lv - x <= C.layoutWin)) hit.push('ledgerFewerThan3FieldsDiffer'); return hit; };
  const dipAllowed = (lvCur, sPrev, sCur) => sCur >= sPrev - (C.isBreather(lvCur) ? 1.75 : C.dip);
  // pair facts are cached: same layout (or > 75% shared positions), same layout + shape, number of signature fields that differ (bank/ledger.js)
  cands.forEach((c, i) => { c.ix = i; }); const pairMemo = new Map();
  const pair = (a, b) => { const k = a.ix < b.ix ? a.ix * 65536 + b.ix : b.ix * 65536 + a.ix; let p = pairMemo.get(k); if (!p) { p = { sameLay: a.layout === b.layout || L.overlap(a.sig, b.sig) > L.RULES.overlap, sameLS: a.layout === b.layout && a.shape === b.shape, diff: L.diffCount(a.sig, b.sig), sameShape: a.shape === b.shape }; pairMemo.set(k, p); } return p; };
  const unaryBase = (lv, c) => { const big = C.isBig(lv); if ((c.tiles === 96) !== big) return false; if (!big && (c.tiles < 72 || c.tiles > 88)) return false; if (lv > C.twoLinkTo && c.links < 3) return false; if ((c.needle || c.tail < 0.15) && lv < C.hardestFrom) return false; return true; };
  const unary = (lv, c) => unaryBase(lv, c) && !preBlocked(lv, c).length;
  const dom = Array.from({ length: NL }, (_, i) => cands.filter(c => unary(FIRST + i, c)));
  if (opts.frozen) for (const [lv, id] of Object.entries(opts.frozen)) dom[lv - FIRST] = dom[lv - FIRST].filter(c => c.id === id);   // a level fixed in advance (the scarce 96-tile levels)
  // A = array of NL entries (a candidate, or null = not assigned / hole). The hard rules of one entry against all others, in both directions:
  const okAt = (i, c, A) => {
    if (!unary(FIRST + i, c)) return false;
    const drop = opts.drop || [];   // diagnosis only: which rule to leave out to see what binds (never used for the real batch)
    if (!drop.includes('dip')) { if (i > 0 && A[i - 1] && !dipAllowed(FIRST + i, A[i - 1].score, c.score)) return false; if (i < NL - 1 && A[i + 1] && !dipAllowed(FIRST + i + 1, c.score, A[i + 1].score)) return false; }
    let shapeCount = 0;
    for (let j = 0; j < NL; j++) {
      const x = A[j]; if (!x || j === i) continue; if (x === c || x.id === c.id) return false;
      const p = pair(c, x), dist = Math.abs(i - j); if (!drop.includes('pairLS') && p.sameLS) return false; if (!drop.includes('ledger') && p.diff < L.RULES.minDiff) return false;
      if (!drop.includes('layoutWindow') && dist <= C.layoutWin && p.sameLay) return false; if (!drop.includes('shapeWindow') && dist <= 2 && p.sameShape) return false; if (p.sameShape) shapeCount++;
      if (C.needleGap && c.needle && x.needle && dist < C.needleGap) return false;
    }
    return drop.includes('shapeMax') || shapeCount < C.shapeMax;
  };
  let softW = 1; const costAt = (i, c, A) => {
    let x = (c.score - target(FIRST + i)) ** 2;
    if (c.tiles > 80 && c.tiles < 96) x += 0.15; if (rank[c.layout] > 24) x += 0.25; if (PLAYED3.includes(c.layout)) x += 0.1;
    for (let d = -3; d <= 3; d++) { const p = A[i + d]; if (d && p && p.sig.clock === c.sig.clock) x += 0.3 / 2; }
    const prev = A[i - 1]; if (prev && c.score < prev.score && !C.isBreather(FIRST + i)) x += 0.5 * (prev.score - c.score);
    if (C.isBreather(FIRST + i)) x *= 3;   // a breather has to sit 1 to 1.5 below the line
    return x * softW;
  };
  const HOLE = 25, holeAt = i => C.stopAtHole ? HOLE * (1 + 2 * (NL - i) / NL) : HOLE, total = A => { let t = 0; for (let i = 0; i < NL; i++) { const c = A[i]; t += !c ? holeAt(i) : costAt(i, c, A) + (okAt(i, c, A) ? 0 : 200); } return t; };
  const rng = seed => { let a = seed; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; };
  // 1. depth-first search with the smallest-domain-first rule (the scarce levels, such as the four 96-tile ones, are placed first), forward checking and random restarts:
  //    finds a COMPLETE sequence when one exists; when none is found a hole budget grows (a hole costs HOLE, nothing is relaxed)
  let best = null, restarts = 0, deepest = 0; const rnd0 = rng(777), tD = Date.now(), dfsMs = opts.init ? 0 : (opts.dfsMs ?? 60000);
  while (Date.now() - tD < dfsMs) {
    restarts++; const noise = restarts === 1 ? 0 : [0.3, 1, 3, 8][restarts % 4] * (0.5 + rnd0()), holesMax = Math.floor(restarts / 25) % 4, A = Array(NL).fill(null), hole = Array(NL).fill(false); let nodes = 0;
    const rec = () => {
      if (nodes++ > 300 || Date.now() - tD > dfsMs) return false;
      const nf = A.filter(Boolean).length; if (nf > deepest) deepest = nf;
      let pick = -1, pv = null; for (let i = 0; i < NL; i++) { if (A[i] || hole[i]) continue; const v = dom[i].filter(c => okAt(i, c, A)); if (!pv || v.length < pv.length) { pick = i; pv = v; if (!v.length) break; } }
      if (pick < 0) return true;
      if (!pv.length) { if (hole.filter(Boolean).length >= holesMax) return false; hole[pick] = true; if (rec()) return true; hole[pick] = false; return false; }
      const vals = pv.map(c => ({ c, w: costAt(pick, c, A) + noise * rnd0() })).sort((x, y) => x.w - y.w).slice(0, 8);
      for (const o of vals) { A[pick] = o.c; if (rec()) return true; A[pick] = null; if (nodes > 300) return false; }
      return false;
    };
    if (rec()) { const h = A.filter(x => !x).length, tot = total(A); if (!best || h < best.holes || (h === best.holes && tot < best.cost)) { best = { A: A.slice(), cost: tot, holes: h }; if (opts.verbose) console.log('dfs: holes', h, 'cost', tot.toFixed(2), 'restart', restarts); } }
  }
  A_DFS = { restarts, holes: best ? best.holes : null, deepest }; if (opts.verbose) console.log('dfs', JSON.stringify(A_DFS));
  // 2. simulated annealing from the best sequence (swaps and replacements; a violation costs 200, a hole 25). Phase A fills as many levels as the rules allow (the ramp counts little),
  //    phase B then fits the ramp (the ramp counts fully; a hole still costs more than any ramp gain, so no level is given up for it)
  let cur = opts.init ? opts.init.map(id => id && cands.find(c => c.id === id) || null) : opts.frozen ? Array.from({ length: NL }, (_, i) => dom[i].length === 1 && opts.frozen[FIRST + i] ? dom[i][0] : null) : best ? best.A.slice() : Array(NL).fill(null), curC = 0, bestSeq = cur.slice(), bestC = 0, it = 0;
  let keepC = Infinity; const rnd = rng(opts.seed ?? 12345), anneal = (ms, w, T1) => {
    softW = w; curC = total(cur); bestSeq = cur.slice(); bestC = curC; const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      it++; const T0 = T1 * (1 - (Date.now() - t0) / ms) + 0.05, nx = cur.slice(), i = Math.floor(rnd() * NL), r = rnd();
      if (r < 0.03) nx[i] = null;
      else if (r < 0.75) { const v = dom[i]; if (!v.length) continue; nx[i] = rnd() < 0.5 ? v.slice().sort((a, b) => Math.abs(a.score - target(FIRST + i)) - Math.abs(b.score - target(FIRST + i)))[Math.floor(rnd() * Math.min(12, v.length))] : v[Math.floor(rnd() * v.length)]; if (nx.some((x, j) => j !== i && x && x.id === nx[i].id)) continue; }
      else { const j = Math.floor(rnd() * NL); if (i === j) continue; const a = nx[i], b = nx[j]; if ((b && !unary(FIRST + i, b)) || (a && !unary(FIRST + j, a))) continue; nx[i] = b; nx[j] = a; }
      const c2 = total(nx); if (c2 <= curC || rnd() < Math.exp((curC - c2) / T0)) { cur = nx; curC = c2; if (curC < bestC) { bestC = curC; bestSeq = cur.slice(); } }
    }
    cur = bestSeq.slice();
  };
  const saMs = opts.saMs ?? 60000, rounds = opts.rounds ?? 6; let keep = opts.init ? cur.slice() : null; keepC = opts.init ? total(cur) : keepC;
  for (let r = 0; r < rounds; r++) {   // phase A in rounds, each from the best so far with 15% of the levels thrown out (the fill count is what counts)
    if (keep) { cur = keep.slice(); for (let i = 0; i < NL; i++) if (rnd() < 0.15) cur[i] = null; }
    anneal(saMs * 0.6 / rounds, 0.05, 6); const fill = cur.filter(Boolean).length, kf = keep ? keep.filter(Boolean).length : -1;
    if (opts.verbose) console.log('anneal A round', r, 'filled', fill); if (fill > kf || (fill === kf && bestC < keepC)) { keep = cur.slice(); keepC = bestC; }
  }
  cur = keep.slice();
  // ejection repair: put a board into a hole, throw out the (at most 2) levels it conflicts with, and refill those from the pool; kept when more levels end up filled
  const refill = (A, levels, depth) => {   // fill the levels (in order of fewest options) from the pool; returns true when all are filled
    if (!levels.length) return true; if (depth > 40) return false;
    const opts = levels.map(i => ({ i, v: dom[i].filter(c => okAt(i, c, A)) })).sort((a, b) => a.v.length - b.v.length), o = opts[0]; if (!o.v.length) return false;
    for (const c of o.v.map(c => ({ c, w: costAt(o.i, c, A) })).sort((a, b) => a.w - b.w).slice(0, 4)) { A[o.i] = c.c; if (refill(A, levels.filter(x => x !== o.i), depth + 1)) return true; A[o.i] = null; }
    return false;
  };
  let improved = true; const t1 = Date.now();
  while (improved && Date.now() - t1 < (opts.repairMs ?? 60000)) {
    improved = false;
    for (let h = 0; h < NL && !improved; h++) {
      if (cur[h]) continue;
      for (const c of dom[h]) {
        const A = cur.slice(); A[h] = c; const bad = []; for (let j = 0; j < NL; j++) if (j !== h && A[j] && !okAt(j, A[j], A)) bad.push(j);
        if (bad.length > 2) continue; for (const j of bad) A[j] = null;
        if (!okAt(h, c, A)) continue;   // still in conflict with something (the shape count, say): not this board
        const gone = bad.concat(A.map((x, i) => x ? -1 : i).filter(i => i >= 0 && i !== h && !bad.includes(i)));
        const B = A.slice(); if (refill(B, bad, 0)) { cur = B; improved = true; break; }
      }
    }
  }
  if (opts.verbose) console.log('after repair: filled', cur.filter(Boolean).length);
  anneal(saMs * 0.4, 1, 1.5);
  A_SA = { iterations: it, cost: bestC };
  // holes instead of any remaining violation (nothing is relaxed)
  const seq = bestSeq.slice(); for (let i = 0; i < NL; i++) if (seq[i] && !okAt(i, seq[i], seq)) seq[i] = null;
  const used = new Set(seq.filter(Boolean).map(c => c.id));
  // spares: the best-fitting unused boards, distinct layouts and shapes first
  const spares = []; const rest = cands.filter(c => !used.has(c.id) && (c.tiles >= 72 && c.tiles <= 88) && c.links >= 3).sort((a, b) => a.score - b.score);
  const pickSpares = rest.slice().sort((a, b) => (rank[a.layout] || 99) - (rank[b.layout] || 99));
  for (const c of pickSpares) { if (spares.length >= 8) break; if (spares.some(s => s.layout === c.layout || s.shape === c.shape)) continue; spares.push(c); }
  for (const c of pickSpares) { if (spares.length >= 8) break; if (!spares.includes(c) && !spares.some(s => s.layout === c.layout)) spares.push(c); }
  // why each hole stays a hole: of the boards that fit the level by tiles / links / needle rules, how many each hard rule blocks (a board may be blocked by several)
  const holes = []; seq.forEach((h, i) => { if (h) return; const lv = FIRST + i, blocked = { layoutWithin12Levels: 0, shapeThirdUse: 0, shapeWithin2Levels: 0, layoutAndShapeTwice: 0, ledgerFewerThan3FieldsDiffer: 0, boardUsedElsewhere: 0, scoreDipOver05: 0 }, d = cands.filter(c => unaryBase(lv, c)); let free = 0;
    for (const c of d) { let any = false, shapeCount = 0; const hit = new Set(); for (const h2 of preBlocked(lv, c)) hit.add(h2);   // the look-back into the earlier placed levels counts as part of the same windows
      if (i > 0 && seq[i - 1] && !dipAllowed(lv, seq[i - 1].score, c.score)) hit.add('scoreDipOver05'); if (i < NL - 1 && seq[i + 1] && !dipAllowed(lv + 1, c.score, seq[i + 1].score)) hit.add('scoreDipOver05');
      seq.forEach((x, j) => { if (!x || j === i) return; const p = pair(c, x), dist = Math.abs(i - j); if (x.id === c.id) hit.add('boardUsedElsewhere'); if (p.sameLS) hit.add('layoutAndShapeTwice'); if (p.diff < L.RULES.minDiff) hit.add('ledgerFewerThan3FieldsDiffer'); if (dist <= C.layoutWin && p.sameLay) hit.add('layoutWithin12Levels'); if (dist <= 2 && p.sameShape) hit.add('shapeWithin2Levels'); if (p.sameShape) shapeCount++; });
      if (shapeCount >= C.shapeMax) hit.add('shapeThirdUse'); for (const k of hit) blocked[k]++; if (!hit.size) free++; }
    holes.push({ level: lv, boardsThatFitTheLevel: d.length, blockedBy: blocked, fitWithoutConflict: free, layoutsAmongThem: new Set(d.map(c => c.layout)).size, shapesAmongThem: new Set(d.map(c => c.shape)).size }); });
  return { seq, cost: bestC, spares, target, fails, jobs, cands, rank, holes, cfg: C, excluded, earlierLevels: earlier.pre.length };
}

function write(A) {
  const T = require('../trap_stories.js'), C = A.cfg || CFG, FIRST = C.first, LAST = C.last, OUT = C.out;
  // --stop-at-hole: a batch has to be consecutive levels from the first one; the boards after the first hole are not written as levels (they go to spares/after-hole-<level>.json)
  let firstHole = -1; if (C.stopAtHole) firstHole = A.seq.findIndex(c => !c);
  const cut = firstHole < 0 ? A.seq.length : firstHole, tail0 = A.seq.slice(cut).map((c, i) => c ? { c, level: FIRST + cut + i } : null).filter(Boolean);
  if (firstHole >= 0) { A = { ...A, seq: A.seq.slice(0, cut) }; }   // the hole analysis keeps every hole: the first one is where the batch stops
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, 'spares'), { recursive: true });
  const rows = [], lvl = i => FIRST + i, LASTW = FIRST + A.seq.length - 1;
  const wrap = (c, level) => ({ schema: 'bank-puzzle-v1-like', level: level || null, design: c.rec.design, card: { ...c.rec.card, whatToSee: c.rec.card.see, layoutId: c.layout, layoutName: c.rec.card.layoutName, shapeIndex: c.shapeIndex, tier: c.tier, poolId: c.id }, difficulty: c.rec.card.difficulty });
  A.seq.forEach((c, i) => {
    const level = lvl(i); if (!c) { rows.push({ level, hole: true }); return; }
    fs.writeFileSync(path.join(OUT, `level-${level}.json`), JSON.stringify(wrap(c, level), null, 1));
    const cd = c.rec.card, df = cd.difficulty;
    rows.push({ level, layout: c.layout, layoutName: cd.layoutName, tiles: c.tiles, shapeIndex: c.shapeIndex, chain: c.shape, links: c.links, score: df.score, win: cd.firstMoves.winning + '/' + cd.firstMoves.legal, needle: df.needle, tail: c.tail, spare: c.rec.card.spare, down: cd.faceDownShare, run2: cd.pressure.run2, at3: cd.pressure.at3, baits: cd.baits.length, id: c.id, see: cd.see });
  });
  const filledRows = rows.filter(r => !r.hole), bandOf = (a, b) => { const x = filledRows.filter(r => r.level >= a && r.level <= b); return x.length ? `${a}-${b}: ${x.length} levels, score ${Math.min(...x.map(r => r.score))} to ${Math.max(...x.map(r => r.score))}, mean ${(x.reduce((s2, r) => s2 + r.score, 0) / x.length).toFixed(2)}, links ${[...new Set(x.map(r => r.links))].join('/')}` : `${a}-${b}: none`; };
  const countBy = k => { const m = {}; for (const r of filledRows) m[r[k]] = (m[r[k]] || 0) + 1; return m; };
  const third = Math.max(1, Math.floor((LASTW - FIRST + 1) / 4)), bandsR = [0, 1, 2, 3].map(q => [FIRST + q * third, q === 3 ? LASTW : FIRST + (q + 1) * third - 1]).filter(([a, b]) => b >= a);
  const summary = { bands: (FIRST === 250 && LAST === 289 ? [[250, 255], [256, 265], [266, 275], [276, 289]] : bandsR).map(([a, b]) => bandOf(a, b)), shapes: countBy('shapeIndex'), layouts: countBy('layout'), needleLevels: filledRows.filter(r => r.needle).map(r => r.level), maxDip: Math.max(0, ...filledRows.map((r, i) => i && filledRows[i - 1].level === r.level - 1 ? filledRows[i - 1].score - r.score : 0)).toFixed(2) };
  A.spares.forEach((c, i) => { fs.writeFileSync(path.join(OUT, 'spares', `spare-${i + 1}.json`), JSON.stringify(wrap(c, null), null, 1)); });
  for (const t of tail0) fs.writeFileSync(path.join(OUT, 'spares', `after-hole-${t.level}.json`), JSON.stringify(wrap(t.c, null), null, 1));
  const spareRows = A.spares.map((c, i) => ({ spare: i + 1, layout: c.layout, tiles: c.tiles, chain: c.shape, links: c.links, score: c.score, win: c.rec.card.firstMoves.winning + '/' + c.rec.card.firstMoves.legal, tail: c.tail, spareClock: c.rec.card.spare, id: c.id }));
  const waiting = T.CHAIN_DEFS.map((d, i) => ({ i, d })).filter(x => x.d.needsUi).map(x => `${x.i} ${T.CHAIN_SHAPES[x.i]}`);
  fs.writeFileSync(path.join(OUT, 'batch.json'), JSON.stringify({ made: new Date().toISOString().slice(0, 10), config: { first: C.first, last: C.last, filledTo: LASTW, ramp: C.ramp, breather: C.breather, twoLinkTo: C.twoLinkTo, hardestFrom: C.hardestFrom, needleGap: C.needleGap, shapeMax: C.shapeMax, dip: C.dip, earlier: C.earlier.map(x => path.relative(ROOT, x)), pools: C.pools.map(x => path.relative(ROOT, x)) }, excludedFromPool: A.excluded, earlierLevelsUsedAsLookBack: A.earlierLevels, levels: rows, spares: spareRows, waitingForDisplayFix: waiting, summary, holes: A.holes, poolJobs: A.jobs, poolCandidates: A.cands.length, poolFails: A.fails, cost: A.cost }, null, 1));
  const f = x => x == null ? '' : x;
  const md = [`# Batch for levels ${FIRST}-${LAST} (chain traps, bot-free)`, '', `Pool: ${A.jobs} jobs, ${A.cands.length} finished boards (after leaving out ${A.excluded ? A.excluded.boards : 0} boards and ${A.excluded ? A.excluded.hosts : 0} boards of hosts used in earlier placed levels). Levels filled: ${rows.filter(r => !r.hole).length} of ${rows.length}${LASTW < LAST ? ` (the batch stops at ${LASTW}: the boards after the first hole are in spares/after-hole-*.json)` : ''}. Score ramp target ${C.ramp[0]} -> ${C.ramp[1]} (difficulty.js)${C.breather ? `, a breather 1.25 below the line every ${C.breather}th level (levels ${rows.filter(r => C.isBreather(r.level)).map(r => r.level).join(', ')})` : ''}.`, '',
    '| level | layout | tiles | chain (shape index) | links | score | winning first moves | tailGreedyWin | clock spare | face-down | needle |', '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(r => r.hole ? `| ${r.level} | HOLE | | | | | | | | | |` : `| ${r.level} | ${r.layout} ${r.layoutName} | ${r.tiles} | ${r.shapeIndex}: ${r.chain} | ${r.links} | ${r.score} | ${r.win} | ${r.tail} | ${r.spare} | ${r.down} | ${r.needle ? 'needle' : ''} |`), '',
    '## Spares', '', '| spare | layout | tiles | chain | links | score | winning first moves | tailGreedyWin | clock spare |', '|---|---|---|---|---|---|---|---|---|', ...spareRows.map(r => `| ${r.spare} | ${r.layout} | ${r.tiles} | ${r.chain} | ${r.links} | ${r.score} | ${r.win} | ${r.tail} | ${r.spareClock} |`), '',
    '## Summary', '', ...summary.bands.map(x => '- ' + x), `- shapes used (index: levels): ${Object.entries(summary.shapes).map(([k, v]) => k + ': ' + v).join(', ')}`, `- layouts used (id: levels): ${Object.entries(summary.layouts).map(([k, v]) => k + ': ' + v).join(', ')}`, `- needle boards (fewer than 3 winning first moves), allowed from level ${C.hardestFrom}${C.needleGap ? ' and at least ' + C.needleGap + ' levels apart' : ''}: ${summary.needleLevels.join(', ') || 'none'}`, `- largest score dip between neighbouring levels: ${summary.maxDip}`, '',
    `## Holes (a hole is a level for which no board in the pool fits next to the others without breaking a hard rule; nothing was relaxed)${LASTW < LAST ? ' - the first one, level ' + (LASTW + 1) + ', is where the batch stops' : ''}`, '', ...(A.holes.length ? A.holes.map(h => `- level ${h.level}: ${h.boardsThatFitTheLevel} boards fit the level's tile count / link / needle rules (${h.layoutsAmongThem} layouts, ${h.shapesAmongThem} shapes); blocked by: ${Object.entries(h.blockedBy).filter(([, v]) => v).map(([k, v]) => k + ' ' + v).join(', ') || 'nothing'}; fit without any conflict: ${h.fitWithoutConflict}`) : ['- none']), '',
    '## Waiting for the display fix (frozen key / frozen lock shapes, card.trap.needsUi)', '', ...waiting.map(x => '- ' + x), '', '## Pool failures (reason: count)', '', ...Object.entries(A.fails).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`), ''];
  fs.writeFileSync(path.join(OUT, 'batch.md'), md.join('\n'));
  return rows;
}
// independent re-check of the written level files (no pool, no builder): strict replay, clock n = k + spare with k the engine's proven minimum, twins, face-down share, tail, winning first moves, ledger
function verify() {
  const E = require('../engine.js'), SEP = require('./separate.js'), Tl = require('./tail.js'), L = require('./ledger.js'), C = CFG, FIRST = C.first, LAST = C.last, earlier = loadEarlier(C), bad = [], sigs = [], shapeUse = {}, needleAt = [];
  const hostsEarlier = earlier.hosts, boardsEarlier = earlier.boards;
  for (const x of earlier.pre) sigs.push({ ...x.sig, level: x.level, score: x.score, earlier: true });   // the look-back: the earlier placed levels count for the windows (layout 12, shape 2, ledger fields within 12 levels)
  for (let lv = FIRST; lv <= LAST; lv++) {
    const f = path.join(C.out, 'level-' + lv + '.json'); if (!fs.existsSync(f)) { console.log(lv, 'HOLE'); continue; }
    const j = JSON.parse(fs.readFileSync(f, 'utf8')), d = j.design, c = j.card, why = [];
    if (!E.replay(d, d.solution, { strict: true }).ok) why.push('replay');
    const cs = E.clockShortest(E.game(JSON.parse(JSON.stringify(d))), { nodes: 300000, ms: Infinity, finishNodes: 100000, finishMs: Infinity });
    if (!cs || cs.unsure || cs.k !== c.clock.k || d.clock.n !== cs.k + c.spare) why.push('clock k ' + (cs && cs.k) + ' n ' + d.clock.n + ' spare ' + c.spare);
    const ct = SEP.closeTwins(d); if (ct.visible !== 0 || ct.share > 0.05) why.push('twins ' + ct.visible + '/' + ct.share);
    if ((d.down || []).length / d.tiles.length > 0.30) why.push('faceDown');
    const tl = Tl.measure(d, { seed: 977, playouts: 800 }).tailGreedyWin; if (tl < 0.08 || tl > 0.40) why.push('tail ' + tl); if (tl < 0.15 && lv < C.hardestFrom) why.push('low tail before ' + C.hardestFrom);
    if (c.firstMoves.winning < 3 && lv < C.hardestFrom) why.push('needle before ' + C.hardestFrom);
    if (c.firstMoves.winning < 3) { if (C.needleGap && needleAt.some(x => lv - x < C.needleGap)) why.push('needle boards closer than ' + C.needleGap + ' levels'); needleAt.push(lv); }
    if (c.needsUi) why.push('needsUi'); if (lv > C.twoLinkTo && c.links < 3) why.push('links');
    if ((d.tiles.length === 96) !== C.isBig(lv)) why.push('tiles ' + d.tiles.length);
    if (hostsEarlier.has(c.layoutId + '/' + c.shapeIndex)) why.push('host ' + c.layoutId + '/' + c.shapeIndex + ' used in an earlier placed level'); if (boardsEarlier.has(designKey(d))) why.push('board used in an earlier placed level');
    const sig = L.signature(d, { layout: c.layout, trapType: c.shape }); sig.level = lv;   // windows count LEVELS (a hole is a level that is filled from elsewhere), not entries
    for (const x of sigs) { const dist = lv - x.level; if (dist <= C.layoutWin && L.sameLayout(sig, x)) why.push('layout (or >75% of it) of level ' + x.level + ' within ' + dist + ' levels'); if (dist <= L.RULES.trapWindow && x.trap && x.trap === sig.trap) why.push('shape of level ' + x.level + ' within ' + dist + ' levels'); if (!x.earlier && x.layout === sig.layout && x.trap === sig.trap) why.push('layout+shape twice with level ' + x.level); if ((!x.earlier || dist <= C.layoutWin) && L.diffCount(sig, x) < L.RULES.minDiff) why.push('only ' + L.diffCount(sig, x) + ' of 5 signature fields differ from level ' + x.level); }
    shapeUse[c.shape] = (shapeUse[c.shape] || 0) + 1; if (shapeUse[c.shape] > C.shapeMax) why.push('shape used more than ' + C.shapeMax + ' times');
    const prev = sigs[sigs.length - 1]; if (prev && !prev.earlier && prev.level === lv - 1 && j.difficulty.score < prev.score - (C.isBreather(lv) ? 1.75 : C.dip)) why.push('score dip over ' + (C.isBreather(lv) ? 1.75 : C.dip)); sig.score = j.difficulty.score;
    sigs.push(sig); console.log(lv, why.length ? 'FAIL ' + why.join(' | ') : 'ok k ' + cs.k + ' tail ' + tl + ' score ' + j.difficulty.score); if (why.length) bad.push(lv);
  }
  console.log(bad.length ? 'FAILED: ' + bad.join(',') : 'all level files verified'); return bad;
}
function status() {
  const { cands, fails, jobs } = loadPool(), by = (k) => cands.reduce((m, c) => { m[c[k]] = (m[c[k]] || 0) + 1; return m; }, {});
  console.log('jobs', jobs, 'candidates', cands.length, 'fails', JSON.stringify(fails));
  console.log('by shape', JSON.stringify(by('shapeIndex'))); console.log('by layout', JSON.stringify(by('layout')));
  const bands = {}; for (const c of cands) { const b = Math.floor(c.score); bands[b] = (bands[b] || 0) + 1; } console.log('score bands', JSON.stringify(bands));
  console.log('96-tile:', cands.filter(c => c.tiles === 96).length, 'needle:', cands.filter(c => c.needle).length, 'tail<0.15:', cands.filter(c => c.tail < 0.15).length);
}

module.exports = { runJob, loadPool, assign, wave, jobName, config, loadEarlier };
if (require.main === module) {
  const st = arg('stage', null);
  if (has('worker')) worker();
  else if (st === 'pool') parent();
  else if (st === 'assign') { const A = assign({ beam: +arg('beam', 300), saMs: +arg('sams', 60000), dfsMs: +arg('dfsms', 20000), rounds: +arg('rounds', 6), seed: +arg('seed', 12345), verbose: true, ...(arg('init', null) ? { init: JSON.parse(fs.readFileSync(arg('init'), 'utf8')).ids } : {}) }), rows = write(A); for (const r of rows) console.log(r.hole ? r.level + ' HOLE' : [r.level, r.layout, r.tiles, r.shapeIndex, r.links, r.score, r.win, r.tail, r.spare, r.needle ? 'needle' : ''].join('\t')); console.log('filled', rows.filter(r => !r.hole).length + '/' + rows.length); }
  else if (st === 'status') status();
  else if (st === 'verify') verify();
  else if (st === 'job') { const j = { si: +arg('si'), layout: +arg('layout'), seed: +arg('seed', 1), dial: arg('dial', '5,3').split(',').map(Number), ...(has('repair') ? { repair: true } : {}), ...(arg('tiers', null) ? { tiers: arg('tiers').split(',') } : {}), ...(arg('targets', null) ? { targets: JSON.parse(arg('targets')) } : {}), ...(arg('frame', null) ? { frame: JSON.parse(arg('frame')) } : {}) }; const t0 = Date.now(), r = runJob(j); console.log(r.ok, r.why, JSON.stringify(r.repair || null), r.variants.map(v => v.tier + ' ' + (v.ok ? v.score + ' t' + v.tail : v.why)), (Date.now() - t0) / 1000); }
  else console.log('usage: --stage pool|assign|status|job');
}
