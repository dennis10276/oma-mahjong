#!/usr/bin/env node
'use strict';
// Puzzle bank generator ("bank and place", first half). No difficulty target anywhere.
//   node source/tools/builder/loop/heavy.js --label bank -- node source/tools/builder/bank/generate.js --seed 1 --wall-min 5
// Options: --seed N  --max-candidates N  --wall-min M  --big (only 96-tile layouts)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../..');
const M = require('../../factory/meter.js');
const C = require('../../builder-next/components.js');
const PSEQ = require('../../builder-next/plan_sequence.js');
const { createYardstick } = require('../../builder-next/yardstick.js');
const SG = require('../loop/static_gates.js');
const GP = require('../loop/gate_profile.js');
const T = require('../loop/traces.js');
const S = require('./specs.js');
const MS = require('./measure.js');

const CENSUS_DIR = path.join(ROOT, 'source/build/bank');
const PUZZLE_DIR = path.join(ROOT, 'source/analysis/builder/bank/puzzles');
const THR = { D_SCREEN_MIN: 4.5, STABLE_RATIO: 0.55, BAND: [1.75, 6], FALLBACK_MIN: 1.75, B7_MAX: 0.3 };
// fixed measurement seeds; screen and full seeds are disjoint, and none is a CURVE/ACCEPT seed.
const SEEDS = { S_SCREEN: 90001, D_SCREEN: 90002, S_FULL: [91001, 91002], D_FULL: [92001, 92002, 92003, 92004] };

function arg(name, def) { const i = process.argv.indexOf('--' + name); return i < 0 ? def : process.argv[i + 1]; }
const flag = n => process.argv.includes('--' + n);

function loadCensus() {
  const rows = [];
  if (!fs.existsSync(CENSUS_DIR)) return rows;
  for (const f of fs.readdirSync(CENSUS_DIR)) {
    if (!/^census-.*\.jsonl$/.test(f)) continue;
    for (const l of fs.readFileSync(path.join(CENSUS_DIR, f), 'utf8').split('\n')) {
      if (!l.trim()) continue;
      try { rows.push({ file: f, ...JSON.parse(l) }); } catch (e) { /* partial last line */ }
    }
  }
  return rows;
}

const cpuMs = u => (u.user + u.system) / 1000;

function main() {
  const seed = +arg('seed', 1), maxC = +arg('max-candidates', 1e9), wallMs = +arg('wall-min', 1e9) * 60000, big = flag('big'), focus = flag('focus'), small = flag('small');
  const started = Date.now();
  fs.mkdirSync(CENSUS_DIR, { recursive: true }); fs.mkdirSync(PUZZLE_DIR, { recursive: true });
  const censusFile = path.join(CENSUS_DIR, `census-${seed}${big ? '-big' : ''}${focus ? '-focus' : ''}${small ? '-small' : ''}.jsonl`);
  const all = loadCensus();
  const done = new Set(all.filter(r => r.file === path.basename(censusFile)).map(r => r.index));
  const boardKeys = new Set(all.map(r => r.boardKey).filter(Boolean)), bodyKeys = new Set(all.map(r => r.matchingBodyKey).filter(Boolean));
  const ys = createYardstick({ protocol: 'extended-40-v1' });
  const profile = GP.loadProfile('e5-v1');
  const srcHash = M.sourceHash(__filename);
  const ident = { protocol: ys.protocol, family: ys.meters.family.fingerprint, skilled: ys.meters.planner.fingerprint, gateProfile: profile.fingerprint, source: srcHash };
  console.log(`[bank] seed ${seed}${big ? ' big' : ''}, resume skips ${done.size} candidates, census ${censusFile}`);

  let n = 0, banked = 0;
  for (let i = 0; n < maxC && Date.now() - started < wallMs; i++) {
    if (done.has(i)) continue;
    n++;
    const spec = S.specAt(seed, i, { big, focus, small });
    const rec = { id: spec.id, index: i, seed, spec, knobs: { spare: spec.spare, depth: spec.depth, traps: spec.traps, maxDown: spec.maxDown, hiddenOnWay: spec.hiddenOnWay, trayRoom: spec.trayRoom, tailPairWidth: spec.tailPairWidth, buildSeed: spec.buildSeed, story: spec.story, stage: spec.stage, layout: spec.layout, shape: spec.shape, tiles: spec.tiles, big: spec.big },
      cpuMs: {}, stages: [], at: new Date().toISOString() };
    let design = null, stageName = null, c0 = null;
    const begin = name => { stageName = name; c0 = process.cpuUsage(); };
    const end = () => { rec.cpuMs[stageName] = Math.round(cpuMs(process.cpuUsage(c0))); rec.stages.push(stageName); };
    const fail = (stage, reason, extra) => { rec.failStage = stage; rec.failReason = reason; if (extra) rec.failDetail = extra; };
    try {
      run: {
        // (a) construct
        begin('construct');
        const r = C.buildCandidate(spec.layout, spec.shape, spec.buildSeed, S.recipeOf(spec), { wallMs: 20000 });
        end();
        if (!r.ok) { fail('construct', String(r.fail), r.detail ? JSON.stringify(r.detail).slice(0, 300) : undefined); break run; }
        design = r.design;
        rec.k = r.k; rec.clockN = r.clockN; rec.downCount = design.down.length;
        rec.boardKey = M.boardKey(design); rec.matchingBodyKey = PSEQ.matchingBodyKey(design);
        // (b) dedupe
        begin('dedupe');
        const dupB = boardKeys.has(rec.boardKey), dupM = bodyKeys.has(rec.matchingBodyKey);
        end();
        if (dupB || dupM) { fail('dedupe', dupB ? 'boardKey' : 'matchingBodyKey'); break run; }
        boardKeys.add(rec.boardKey); bodyKeys.add(rec.matchingBodyKey);
        // (c) static gates e5-v1
        begin('static');
        const raw = SG.staticGates(design, { shape: spec.shape, stopEarly: false });
        const stat = GP.applyStatic(raw, profile);
        const unresolved = GP.unresolvedStatic(stat, profile, { spare: spec.spare });
        end();
        const okSpare = stat.shipSpares.includes(spec.spare);
        rec.static = { pass: stat.pass === true, shipSpares: stat.shipSpares, unresolved };
        if (!(stat.pass === true && okSpare && !unresolved.length)) {
          const failed = profile.static.required.filter(k => stat.gates[k]?.pass !== true);
          fail('static', failed.length ? failed.join('+') : unresolved.length ? 'unresolved:' + unresolved.join('+') : 'spareNotShippable'); break run;
        }
        // (d) D screen first (v2): family ruler, 40 campaigns, cap 40. The census showed ~95% of readable boards rate D < 6.
        begin('dScreen');
        const d1 = MS.family(ys.meters.family, design, [{ runs: 40, seed: SEEDS.D_SCREEN }], 40);
        end();
        rec.dScreen = d1;
        if (!d1.ok) { fail('dScreen', 'D_invalid'); break run; }
        if (d1.D40 < THR.D_SCREEN_MIN) { fail('dScreen', 'D<' + THR.D_SCREEN_MIN); break run; }
        // (e) stability (v2): the same board with 1 and 2 more clock moves, same seed. A board whose difficulty
        // collapses when the clock gives one or two moves more sits on a cliff: its D is not a property of the puzzle.
        begin('stability');
        const stab = [1, 2].map(e => { const dd = JSON.parse(JSON.stringify(design)); dd.clock.n = design.clock.n + e;
          const m = MS.family(ys.meters.family, dd, [{ runs: 40, seed: SEEDS.D_SCREEN }], 40); return { extra: e, ok: m.ok, D20: m.D20, D40: m.D40 }; });
        end();
        rec.stability = { base: d1.D40, steps: stab, ratio: Math.round(Math.min(...stab.map(x => x.D40)) / d1.D40 * 100) / 100 };
        if (!stab.every(x => x.ok)) { fail('stability', 'D_invalid'); break run; }
        if (rec.stability.ratio < THR.STABLE_RATIO) { fail('stability', 'cliff'); break run; }
        // (f) full measure on fresh seeds
        begin('full');
        const sF = MS.skilled(ys.meters.planner, design, SEEDS.S_FULL.map(sd => ({ runs: 40, seed: sd })));
        const dF = MS.family(ys.meters.family, design, SEEDS.D_FULL.map(sd => ({ runs: 40, seed: sd })), 40);
        end();
        rec.sFull = sF; rec.dFull = dF;
        if (!sF.ok || !dF.ok || !Number.isFinite(sF.S)) { fail('full', !sF.ok ? 'S_invalid' : 'D_invalid'); break run; }
        // (g) band (uses only the full S measure, so it runs before the costlier trace)
        const Sv = sF.S;
        if (Sv >= THR.BAND[0] && Sv <= THR.BAND[1]) rec.band = 'normal';
        else if (Sv >= THR.FALLBACK_MIN && Sv < THR.BAND[0]) rec.band = 'fallback';
        else if (Sv < THR.FALLBACK_MIN) rec.band = 'below'; // v2: kept and labelled; placement decides (Dennis's band needs S >= 2.5)
        else { fail('band', 'S>6'); break run; }
        // (h) trace gates (80 campaigns on the CURVE sub-blocks, cap 40)
        begin('trace');
        const tr = T.traceGates(design, GP.traceOptions({ ys, spare: null, campaigns: 80, cap: ys.pins.cap, maxAttempts: ys.pins.cap, protocol: ys.protocol }, profile));
        end();
        rec.trace = { pass: tr.pass, D: tr.D, campaigns: tr.campaigns, wonOn: tr.wonOn, valid: tr.valid, ruler: tr.ruler,
          gates: Object.fromEntries(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'].map(k => [k, tr[k]])), counts: tr.counts, errorKinds: tr.errorKinds, lossKinds: tr.lossKinds, examples: tr.examples };
        if (tr.valid !== true) { fail('trace', 'trace_invalid'); break run; }
        if (tr.pass !== true) { fail('trace', ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'].filter(k => tr[k]?.pass !== true).map(k => k + (tr[k]?.pass == null ? '?' : '')).join('+') || 'pass_not_true'); break run; }
        // Dennis 2026-11-12 (later the same day): a high repeated-blunder share is a trigger to steer the puzzle, not a rejection.
        if (!(tr.B7 && typeof tr.B7.value === 'number' && tr.B7.value <= THR.B7_MAX)) rec.steer = ['B7'];
        rec.banked = true;
      }
    } catch (e) {
      if (stageName && rec.cpuMs[stageName] == null) rec.cpuMs[stageName] = Math.round(cpuMs(process.cpuUsage(c0)));
      fail(stageName || 'init', 'exception: ' + String((e && e.message) || e).slice(0, 200));
    }
    if (rec.banked) {
      banked++;
      const d = design, sp = d.obst || {};
      const card = { boardKey: rec.boardKey, matchingBodyKey: rec.matchingBodyKey, layout: spec.layout, shape: spec.shape, tiles: d.tiles.length, big: spec.big,
        specials: { gold: (d.gold || []).length, locks: (sp.locks || []).length, keys: (sp.keys || []).length, ice: Object.keys(sp.ice || {}).length },
        clock: { n: d.clock.n, k: rec.k, spare: d.clock.n - rec.k, tile: d.clock.i }, faceDown: d.down.length,
        story: spec.story, stage: spec.stage, knobs: rec.knobs,
        stability: rec.stability, steer: rec.steer || [], stats: { S: rec.sFull.S, S_se: rec.sFull.se, band: rec.band, D20: rec.dFull.D20, D40: rec.dFull.D40, median: rec.dFull.median, censoredShare: rec.dFull.censoredShare, D_se: rec.dFull.se, nS: rec.sFull.n, nD: rec.dFull.n },
        traceGates: rec.trace.gates, lossCauseMix: rec.trace.lossKinds, errorKinds: rec.trace.errorKinds,
        fingerprints: { family: rec.dFull.fingerprint, skilled: rec.sFull.fingerprint, gateProfile: profile.fingerprint }, protocol: ys.protocol, sourceHash: srcHash };
      M.atomicJson(path.join(PUZZLE_DIR, rec.boardKey + '.json'), { schema: 'bank-puzzle-v1', card, design: d, spec, measurements: { sFull: rec.sFull, dFull: rec.dFull, dScreen: rec.dScreen, stability: rec.stability, trace: rec.trace }, ident });
    }
    fs.appendFileSync(censusFile, JSON.stringify(rec) + '\n');
    const ms = Object.values(rec.cpuMs).reduce((a, b) => a + b, 0);
    console.log(`[bank] #${i} L${spec.layout}/${spec.tiles} ${spec.story} ${rec.banked ? 'BANKED ' + rec.band + ' S=' + rec.sFull.S + ' D40=' + rec.dFull.D40 : 'x ' + rec.failStage + ': ' + rec.failReason} ${ms}ms`);
  }
  console.log(`[bank] done: ${n} candidates, ${banked} banked, ${((Date.now() - started) / 1000).toFixed(0)}s wall`);
}
main();
