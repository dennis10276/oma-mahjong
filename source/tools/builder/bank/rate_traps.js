#!/usr/bin/env node
'use strict';
// Measurement only: deliberately bypass every generator rejection filter.
// Snapshot first, then run --phase measure / trace under heavy.js (optionally via par.js).
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../..');
const M = require('../../factory/meter.js'), MS = require('./measure.js');
const PSEQ = require('../../builder-next/plan_sequence.js');
const { createYardstick } = require('../../builder-next/yardstick.js');
const T = require('../loop/traces.js'), GP = require('../loop/gate_profile.js');
const E = require('../engine.js'), F = require('../task11_physics.js');
const SEEDS = { S_FULL: [91001, 91002], D_FULL: [92001, 92002, 92003, 92004], D_SCREEN: 90002 };
const RESULTS = path.join(ROOT, 'codex-tasks/results/rate-traps-v1');
const INPUT = path.join(RESULTS, 'inputs');
const OUT = path.join(ROOT, 'source/analysis/builder/bank/traps');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));

function snapshot() {
  const from = path.resolve(arg('from', path.join(ROOT, '../cc-builder-loop/source/build/traps')));
  fs.mkdirSync(INPUT, { recursive: true });
  const labs = [4, 5].map(n => read(path.join(ROOT, `source/analysis/builder/process-v2/lab-findings-2026-11-13-lab${n}.json`)).ratings);
  const legacy = { 'keyOnClock-7.json': 281, 'wrongMelt-0.json': 286, 'wrongMelt-3.json': 287 };
  for (const dir of ['examples', 'examples2', 'examples3']) {
    if (!fs.existsSync(path.join(from, dir))) continue;
    for (const f of fs.readdirSync(path.join(from, dir)).filter(f => f.endsWith('.json')).sort()) {
      const j = read(path.join(from, dir, f));
      if (!j.design?.tiles) continue;
      const level = dir === 'examples' ? legacy[f] : Object.keys(labs[1]).find(k => labs[1][k].file === f);
      const rating = (dir === 'examples' ? labs[0] : labs[1])[level];
      const dennis = rating && (rating.tries > 0 || rating.stars > 0) ? { level: +level, stars: rating.stars, tries: rating.tries, note: rating.note } : null;
      const name = `${dir}--${f}`;
      const payload = { source: { directory: dir, file: f, level: level ? +level : null }, dennis, original: j };
      const dest = path.join(INPUT, name);
      if (fs.existsSync(dest) && JSON.stringify(read(dest)) !== JSON.stringify(payload)) throw Error('Input changed: ' + name);
      M.atomicJson(dest, payload);
      console.log('snapshot ' + name);
    }
  }
}

function measure() {
  const phase = arg('phase', 'measure');
  if (!['measure', 'trace', 'bait'].includes(phase)) throw Error('phase must be measure, trace or bait');
  const [shard, shards] = arg('shard', '0/1').split('/').map(Number);
  const only = arg('only', '');
  const files = fs.readdirSync(INPUT).filter(f => f.endsWith('.json')).sort().filter((f, i) => i % shards === shard && (!only || f.includes(only)));
  const ys = createYardstick({ protocol: 'extended-40-v1' }), profile = GP.loadProfile('e5-v1');
  const sourceHash = M.sourceHash(__filename);
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of files) {
    const input = read(path.join(INPUT, f)), j = input.original, d = j.design;
    const boardKey = M.boardKey(d), dest = path.join(OUT, boardKey + '.json');
    const existing = fs.existsSync(dest) ? read(dest) : null;
    const rec = existing?.measurements || {};
    const save = () => {
      const ob = d.obst || {}, S = rec.sFull?.S;
      const card = { boardKey, matchingBodyKey: PSEQ.matchingBodyKey(d), layout: j.layout, shape: j.layoutShape || j.shape,
        tiles: d.tiles.length, big: d.tiles.length >= 96,
        specials: { gold: (d.gold || []).length, locks: (ob.locks || []).length, keys: (ob.keys || []).length, ice: Object.keys(ob.ice || {}).length },
        clock: { n: d.clock.n, k: j.card.k, spare: j.card.spare, tile: d.clock.i }, faceDown: d.down.length,
        story: j.story, stage: 'trap-measurement', knobs: {}, trap: j.card, trapType: j.trapType || j.trap, dennis: input.dennis,
        stability: rec.stability, steer: rec.trace?.B7?.value > 0.3 ? ['B7'] : [],
        stats: { S, S_se: rec.sFull?.se, band: S < 1.75 ? 'below' : S > 6 ? 'above' : 'normal', D20: rec.dFull?.D20, D40: rec.dFull?.D40,
          median: rec.dFull?.median, censoredShare: rec.dFull?.censoredShare, D_se: rec.dFull?.se, nS: rec.sFull?.n, nD: rec.dFull?.n },
        traceGates: rec.trace && Object.fromEntries(['B1','B2','B3','B4','B5','B6','B7'].map(k => [k, rec.trace[k]])),
        lossCauseMix: rec.trace?.lossKinds, errorKinds: rec.trace?.errorKinds,
        fingerprints: { family: ys.meters.family.fingerprint, skilled: ys.meters.planner.fingerprint, gateProfile: profile.fingerprint }, protocol: ys.protocol, sourceHash };
      M.atomicJson(dest, { schema: 'bank-puzzle-v1', card, design: d, spec: { ...input.source, trapType: card.trapType }, measurements: rec,
        ident: { protocol: ys.protocol, ...card.fingerprints, source: sourceHash }, input: { file: f, originalBoardKey: j.boardKey }, complete: !!(rec.dFull && rec.sFull && rec.stability && rec.trace) });
    };
    const stage = (name, fn) => { if (rec[name]) return; console.log(`${f} ${name} start`); const t = Date.now(); rec[name] = fn(); save(); console.log(`${f} ${name} done ${Date.now()-t}ms`); };
    if (phase === 'measure') {
      stage('dScreen', () => MS.family(ys.meters.family, d, [{ runs: 40, seed: SEEDS.D_SCREEN }], 40));
      stage('stability', () => {
        const steps = [1, 2].map(extra => { const dd = structuredClone(d); dd.clock.n += extra;
          const m = MS.family(ys.meters.family, dd, [{ runs: 40, seed: SEEDS.D_SCREEN }], 40); return { extra, ...m }; });
        return { base: rec.dScreen.D40, steps, ratio: Math.round(Math.min(...steps.map(x => x.D40)) / rec.dScreen.D40 * 100) / 100 };
      });
      stage('sFull', () => MS.skilled(ys.meters.planner, d, SEEDS.S_FULL.map(seed => ({ runs: 40, seed }))));
      stage('dFull', () => MS.family(ys.meters.family, d, SEEDS.D_FULL.map(seed => ({ runs: 40, seed })), 40));
    } else if (phase === 'trace') stage('trace', () => T.traceGates(d, GP.traceOptions({ ys, spare: null, campaigns: 80, cap: ys.pins.cap, maxAttempts: ys.pins.cap, protocol: ys.protocol }, profile)));
    else stage('bait', () => baitEvidence(d, j, rec));
    save();
  }
}

// Supplementary first-try evidence on the FULL seeds. Classify bait in its actual
// state, because taking the same tile later on the right route is not a blunder.
function baitEvidence(d, j, rec) {
  if (!rec.sFull) throw Error('measure phase required before bait');
  const g = E.game(d), cache = new Map();
  const bait = new Set(j.bait || j.card.bait?.tiles || []);
  const classify = s => {
    const key = F.stateKey(g, s);
    if (!cache.has(key)) cache.set(key, E.classify(g, s, T.BUDGET));
    return cache.get(key);
  };
  const summarize = (bot, setting, seeds, style) => {
    const rows = [];
    for (const seed of seeds) {
      const r = bot.measureHuman(M.boardOf(d), { setting, plannerStyle: style, seed, seeds: 1, runs: 40, maxAttempts: setting === 'family' ? 40 : 20, capture: true,
        ...(setting === 'planner' ? { allResults: true } : {}) });
      if (!r.valid || r.results.length !== 40) throw Error('invalid bait capture');
      for (const [campaign, c] of r.results.entries()) {
        const a = c.attempts[0], hits = [];
        for (const [index, x] of a.decisions.entries()) {
          if (!x.state.alive[d.clock.i] || !bait.has(x.index)) continue;
          const after = a.decisions[index + 1]?.state || a.terminal.state;
          const ev = F.event(g, x.state, after, x.index, a.why);
          if (!ev.removed.length) continue;
          const s = F.state(g, x.state), choices = classify(s);
          const chosen = choices.find(o => F.same(o.move, ev.move));
          hits.push({ tile: x.index, removal: x.state.moves, result: chosen?.result || 'unknown', winningAlternative: choices.some(o => o.result === 'win') });
        }
        rows.push({ seed, campaign, win: a.win, why: a.why, phase: a.phase, wonOn: c.wonOn,
          prefix: a.decisions.filter(x => x.state.alive[d.clock.i]).map(x => x.index), hits });
      }
    }
    const harmful = rows.filter(r => r.hits.some(h => h.result === 'lose' && h.winningAlternative));
    return { setting, style, campaigns: rows.length, firstTryWins: rows.filter(r => r.win).length,
      baitTaken: rows.filter(r => r.hits.length).length, provedHarmfulBait: harmful.length,
      harmfulBaitFirstTryWins: harmful.filter(r => r.win).length, rows };
  };
  const skilled = summarize(require('../../../analysis/skilled-bot-b3/candidate_bot.js'), 'planner', SEEDS.S_FULL, rec.sFull.bestStyle);
  const family = summarize(require('../../sim/refit/human_bot_key_memory_v1_fast.js'), 'family', SEEDS.D_FULL);
  for (const [sample, full, cap] of [[skilled, rec.sFull, 20], [family, rec.dFull, 40]]) {
    if (!full || sample.rows.some((r, i) => (r.wonOn ?? cap) !== full.raw[i]?.tries)) throw Error('Bait capture drifted from full measurement');
  }
  return { budget: T.BUDGET, bait: [...bait], skilled, family, parityWithFullMeasure: true,
    note: 'Actual first-try bait choices, not causal attribution to search versus random choice.' };
}
if (require.main === module) { if (process.argv.includes('--snapshot')) snapshot(); else measure(); }
module.exports = { SEEDS, snapshot, measure };
