/* Builder v2, phase 1: which board descriptors (describe.js) separate hard boards from easy ones (helper B, 2026-11-06).
     node source/tools/builder/analyse_descriptors.js            describe every board (cached, resumable), then analyse
     node source/tools/builder/analyse_descriptors.js --only     analyse the cache only
   Input:  analysis/builder/data/training-data.json (1,989 boards; family.exp for all, skilled.exp for 992)
   Cache:  analysis/builder/descriptors.jsonl  ({v, id, kind, flat, exactMs, ms} per board; appended as boards finish).
           Only rows of the current CACHE_V count; v1 (before engine.js) is kept in descriptors-v1.jsonl.
   v2 (engine.js): the peek-aware clock way (frame.kGame, tray.gameWay.*) and decision traps (traps.*) along the stored
   way to the clock; per-move budget 10,000 nodes / 30 ms, depth search 3,000 nodes.
   Output: analysis/builder/descriptors-analysis.json (every number), a summary on stdout.
   Two worker threads (this machine has 2 CPUs). The exact clock way is budgeted (150,000 nodes / 1.5 s per board);
   a board whose search runs out is recorded with k = null and counted.
   Statistics: only medians, Spearman rank correlations and the best single threshold (balanced accuracy: the mean of
   the share of hard boards on the hard side and the share of easy boards on the easy side; 0.5 = no better than a coin). */
'use strict';
const fs = require('fs'), path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const ROOT = path.resolve(__dirname, '..', '..');
const DATA = path.join(ROOT, 'analysis', 'builder', 'data', 'training-data.json');
const CACHE = path.join(ROOT, 'analysis', 'builder', 'descriptors.jsonl');
const OUT = path.join(ROOT, 'analysis', 'builder', 'descriptors-analysis.json');
const CURRENT_BOT = 'f32859281c746f4277ab5ef4c0006d43c76dddcc342741af8b0ff45a1b63d561';   // the bot that rated the skilled boards too
const BUDGET = { exactNodes: +(process.env.EXACT_NODES || 150000), exactMs: +(process.env.EXACT_MS || 1500),
  gameNodes: 150000, gameMs: 1500, trapNodes: +(process.env.TRAP_NODES || 10000), trapMs: +(process.env.TRAP_MS || 30), trapDepthNodes: 3000 };
const CACHE_V = 2;

if (!isMainThread) {
  const { describe } = require('./describe.js');
  const rows = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const byId = new Map(rows.map(r => [r.id, r]));
  parentPort.on('message', id => {
    if (id === null) { process.exit(0); }
    const r = byId.get(id), t = Date.now();
    try {
      const d = describe(r.design, { shape: r.shape, ...BUDGET });
      parentPort.postMessage({ v: CACHE_V, id, kind: r.kind, flat: d.flat, valid: d.valid, exactMs: d.frame.exactMs ?? null, gameMs: d.frame.gameMs ?? null,
        trapMs: d.traps && d.traps.ms != null ? d.traps.ms : null, trapError: d.traps && d.traps.error || null, ms: Date.now() - t,
        place: { clock: d.stage.clock, keys: d.stage.keys } });
    } catch (e) { parentPort.postMessage({ id, kind: r.kind, error: String(e.stack || e), ms: Date.now() - t }); }
  });
  return;
}

// ---------- describing every board (resumable) ----------
function loadCache() {
  if (!fs.existsSync(CACHE)) return new Map();
  const m = new Map();
  for (const line of fs.readFileSync(CACHE, 'utf8').split('\n')) { if (!line.trim()) continue; try { const x = JSON.parse(line); if (!x.error && x.v === CACHE_V) m.set(x.id, x); } catch (e) { /* a cut-off last line */ } }
  return m;
}
function describeAll(rows) {
  const done = loadCache(), todo = rows.filter(r => !done.has(r.id)).map(r => r.id);
  if (!todo.length) return Promise.resolve(done);
  console.error(`describing ${todo.length} boards (${done.size} cached) with 2 workers`);
  const t0 = Date.now(); let finished = 0;
  return new Promise(resolve => {
    let live = 0;
    for (let w = 0; w < 2; w++) {
      const wk = new Worker(__filename); live++;
      const next = () => wk.postMessage(todo.length ? todo.shift() : null);
      wk.on('message', x => {
        fs.appendFileSync(CACHE, JSON.stringify(x) + '\n');
        if (!x.error) done.set(x.id, x); else console.error('error', x.id, x.error.split('\n')[0]);
        if (++finished % 100 === 0) console.error(`${finished} done, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
        next();
      });
      wk.on('exit', () => { if (--live === 0) resolve(done); });
      next();
    }
  });
}

// ---------- simple statistics ----------
const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
function ranks(a) {
  const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = new Array(a.length);
  for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = avg; i = j + 1; }
  return r;
}
function spearman(x, y) {
  const p = []; for (let i = 0; i < x.length; i++) if (x[i] != null && y[i] != null) p.push([x[i], y[i]]);
  if (p.length < 10) return null;
  const rx = ranks(p.map(q => q[0])), ry = ranks(p.map(q => q[1])), n = p.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2; }
  return sxx && syy ? { rho: +(sxy / Math.sqrt(sxx * syy)).toFixed(3), n } : { rho: 0, n };
}
/* The best single threshold: "hard when value >= t" (or "<= t"), maximising balanced accuracy. */
function bestSplit(hard, easy) {
  hard = hard.filter(v => v != null); easy = easy.filter(v => v != null);
  if (hard.length < 5 || easy.length < 5) return null;
  const vals = [...new Set([...hard, ...easy])].sort((a, b) => a - b);
  let best = null;
  for (const t of vals) {
    const hUp = hard.filter(v => v >= t).length, eUp = easy.filter(v => v >= t).length;
    for (const dir of ['>=', '<=']) {
      const hOn = dir === '>=' ? hUp : hard.filter(v => v <= t).length, eOn = dir === '>=' ? eUp : easy.filter(v => v <= t).length;
      const bal = (hOn / hard.length + (easy.length - eOn) / easy.length) / 2;
      if (!best || bal > best.bal + 1e-9) best = { bal: +bal.toFixed(3), rule: `${dir} ${+t.toFixed(3)}`, hardOnSide: `${hOn}/${hard.length}`, easyOnSide: `${eOn}/${easy.length}` };
    }
  }
  return best;
}
/* Per-group Spearman, averaged (weighted by size) over groups with >= 8 boards: does it hold inside one batch? */
function withinGroups(items, key, y) {
  const g = new Map(); for (const it of items) { if (!g.has(it.group)) g.set(it.group, []); g.get(it.group).push(it); }
  let s = 0, w = 0, groups = 0;
  for (const list of g.values()) {
    if (list.length < 8) continue;
    const r = spearman(list.map(it => it.flat[key]), list.map(y)); if (!r || !Number.isFinite(r.rho)) continue;
    const vals = new Set(list.map(it => it.flat[key])); if (vals.size < 2) continue;
    s += r.rho * r.n; w += r.n; groups++;
  }
  return w ? { rho: +(s / w).toFixed(3), groups, n: w } : null;
}

function analyse(items, keys, opts) {
  const { hardOf, easyOf, title } = opts, out = [];
  for (const k of keys) {
    const vals = items.map(it => it.flat[k]).filter(v => v != null);
    if (vals.length < 20 || new Set(vals).size < 2) continue;
    const hard = items.filter(hardOf).map(it => it.flat[k]), easy = items.filter(easyOf).map(it => it.flat[k]);
    const fam = spearman(items.map(it => it.flat[k]), items.map(it => it.family));
    const sk = spearman(items.map(it => it.flat[k]), items.map(it => it.skilled));
    out.push({ key: k, n: vals.length, medHard: median(hard.filter(v => v != null)), medEasy: median(easy.filter(v => v != null)),
      nHard: hard.filter(v => v != null).length, nEasy: easy.filter(v => v != null).length,
      rhoFamily: fam && fam.rho, rhoSkilled: sk && sk.rho, nSkilled: sk && sk.n,
      withinFamily: opts.within ? withinGroups(items, k, it => it.family) : undefined,
      withinSkilled: opts.within ? withinGroups(items.filter(it => it.skilled != null), k, it => it.skilled) : undefined,
      split: bestSplit(hard, easy) });
  }
  out.sort((a, b) => (b.split ? b.split.bal : 0) - (a.split ? a.split.bal : 0));
  return { title, items: items.length, hard: items.filter(hardOf).length, easy: items.filter(easyOf).length, rows: out };
}
function show(res, top = 14) {
  console.log(`\n## ${res.title}  (boards ${res.items}; hard ${res.hard}, easy ${res.easy})`);
  console.log('descriptor | med hard | med easy | rho fam | rho skl | split | bal | hard on side | easy on side');
  for (const r of res.rows.slice(0, top)) console.log([r.key, r.medHard, r.medEasy, r.rhoFamily, r.rhoSkilled, r.split && r.split.rule, r.split && r.split.bal, r.split && r.split.hardOnSide, r.split && r.split.easyOnSide].join(' | '));
}
function showRho(res, field, top = 12) {
  const rs = res.rows.filter(r => r[field] != null).sort((a, b) => Math.abs(b[field]) - Math.abs(a[field]));
  console.log(`  strongest ${field}: ` + rs.slice(0, top).map(r => `${r.key} ${r[field]}` + (r.withinFamily && field === 'rhoFamily' ? ` (in-batch ${r.withinFamily.rho})` : r.withinSkilled && field === 'rhoSkilled' ? ` (in-batch ${r.withinSkilled.rho})` : '')).join('; '));
}

(async () => {
  const rows = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const cache = process.argv.includes('--only') ? loadCache() : await describeAll(rows);
  // The strict exact search (lab/exact.js) is the same in v1 and v2 (k identical on all 1,680 boards both resolved), but the
  // v2 run shared the machine with other helpers and its 1.5 s budget ran out on 59 boards. For those, the strict-way
  // fields that v2 left empty are taken from the v1 run (descriptors-v1.jsonl), which resolved 58 of them.
  const V1 = path.join(ROOT, 'analysis', 'builder', 'descriptors-v1.jsonl');
  let filled = 0;
  if (fs.existsSync(V1)) {
    const v1 = new Map(); for (const line of fs.readFileSync(V1, 'utf8').split('\n')) if (line.trim()) { const x = JSON.parse(line); v1.set(x.id, x); }
    for (const x of cache.values()) {
      const o = v1.get(x.id); if (!o || x.flat['frame.k'] != null || o.flat['frame.k'] == null || !x.flat['frame.hasClock']) continue;
      for (const [k, v] of Object.entries(o.flat)) if (x.flat[k] == null && v != null) x.flat[k] = v;
      for (const k of ['frame.peekSaves']) if (x.flat['frame.kGame'] != null) x.flat[k] = x.flat['frame.k'] - x.flat['frame.kGame'];
      filled++;
    }
  }
  const items = rows.filter(r => cache.has(r.id)).map(r => ({ id: r.id, kind: r.kind, group: r.group, bot: r.family.bot || null, family: r.family.exp, skilled: r.skilled ? r.skilled.exp : null, flat: cache.get(r.id).flat, exactMs: cache.get(r.id).exactMs }));
  const keys = [...new Set(items.flatMap(it => Object.keys(it.flat)))];
  const withClock = items.filter(it => it.flat['frame.hasClock']);
  const unresolved = withClock.filter(it => it.flat['frame.k'] == null);
  const budget = {
    boards: items.length, withClock: withClock.length, unresolved: unresolved.length,
    unresolvedByKind: unresolved.reduce((a, it) => (a[it.kind] = (a[it.kind] || 0) + 1, a), {}),
    strictFilledFromV1: filled,
    exactMsMedian: median(withClock.map(it => it.exactMs).filter(v => v != null)),
    invalid: [...cache.values()].filter(x => x.valid === false).length,
    // v2: the peek-aware way and the traps
    gameUnresolved: withClock.filter(it => it.flat['frame.kGame'] == null).length,
    gameUnsure: withClock.filter(it => it.flat['frame.kGameUnsure']).length,
    peekShorter: withClock.filter(it => it.flat['frame.peekSaves'] > 0).length,
    peekSavesHist: withClock.reduce((a, it) => { const v = it.flat['frame.peekSaves']; if (v != null) a[v] = (a[v] || 0) + 1; return a; }, {}),
    trapsMissing: withClock.filter(it => it.flat['traps.points'] == null).length,
    trapErrors: [...cache.values()].filter(x => x.trapError).length,
    trapUnknownMoves: withClock.reduce((a, it) => a + (it.flat['traps.unknown'] || 0), 0),
    trapUnknownBoards: withClock.filter(it => it.flat['traps.unknown'] > 0).length,
    trapMsMedian: median([...cache.values()].map(x => x.trapMs).filter(v => v != null)),
    gameMsMedian: median([...cache.values()].map(x => x.gameMs).filter(v => v != null)),
    cpuSeconds: Math.round([...cache.values()].reduce((a, x) => a + (x.ms || 0), 0) / 1000),
  };
  console.log('budget', JSON.stringify(budget));
  const H = items.filter(it => it.kind === 'historical'), X = items.filter(it => it.kind !== 'historical');
  const fam = { hardOf: it => it.family >= 9, easyOf: it => it.family <= 4 };
  const skl = { hardOf: it => it.skilled != null && it.skilled >= 2.5, easyOf: it => it.skilled != null && it.skilled <= 1.3 };
  const curve = it => it.family >= 8 && it.family <= 14;
  const gateSet = it => it.family >= 9 && it.family <= 14 && it.skilled != null;
  const res = {
    budget,
    famHistorical: analyse(H, keys, { ...fam, within: true, title: 'Family: >= 9 vs <= 4, historical' }),
    // the historical family ratings come from two bot versions; the older one (ac24aad8..., 202 boards) rates far lower
    // (median 5.3 vs 11.1) and supplies 34 of the 55 easy boards, so the same question on the current bot only:
    famHistoricalCurrentBot: analyse(H.filter(it => it.bot === CURRENT_BOT), keys, { ...fam, within: true, title: 'Family: >= 9 vs <= 4, historical, current family bot only' }),
    famExperiments: analyse(X, keys, { ...fam, title: 'Family: >= 9 vs <= 4, experiments' }),
    sklHistorical: analyse(H.filter(it => it.skilled != null), keys, { ...skl, within: true, title: 'Skilled: >= 2.5 vs <= 1.3, historical' }),
    sklExperiments: analyse(X.filter(it => it.skilled != null), keys, { ...skl, title: 'Skilled: >= 2.5 vs <= 1.3, experiments' }),
    curveHistorical: analyse(H.filter(curve), keys, { hardOf: it => it.family >= 11, easyOf: it => it.family < 11, within: true, title: 'Curve region family 8-14, historical (family >= 11 vs < 11)' }),
    curveExperiments: analyse(X.filter(curve), keys, { hardOf: it => it.family >= 11, easyOf: it => it.family < 11, title: 'Curve region family 8-14, experiments (family >= 11 vs < 11)' }),
    gateHistorical: analyse(H.filter(gateSet), keys, { hardOf: it => it.skilled >= 2.5, easyOf: it => it.skilled < 2.5, within: true, title: 'Gate: family 9-14, skilled >= 2.5 vs < 2.5, historical' }),
    gateAll: analyse(items.filter(gateSet), keys, { hardOf: it => it.skilled >= 2.5, easyOf: it => it.skilled < 2.5, title: 'Gate: family 9-14, skilled >= 2.5 vs < 2.5, all kinds' }),
    perKind: {},
  };
  for (const k of [...new Set(X.map(it => it.kind))]) {
    const s = X.filter(it => it.kind === k);
    res.perKind[k] = { n: s.length, famMedian: median(s.map(it => it.family)), rows: analyse(s, keys, { ...fam, title: k }).rows.filter(r => r.rhoFamily != null).sort((a, b) => Math.abs(b.rhoFamily) - Math.abs(a.rhoFamily)).slice(0, 8).map(r => ({ key: r.key, rhoFamily: r.rhoFamily, rhoSkilled: r.rhoSkilled })) };
  }
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  for (const k of ['famHistorical', 'famHistoricalCurrentBot', 'famExperiments', 'sklHistorical', 'sklExperiments', 'curveHistorical', 'curveExperiments', 'gateHistorical', 'gateAll']) {
    show(res[k]); showRho(res[k], 'rhoFamily'); showRho(res[k], 'rhoSkilled');
  }
  // v2 focus: the trap and game-way descriptors in each comparison
  const focus = keys.filter(k => k.startsWith('traps.') || k.startsWith('tray.gameWay.') || /^frame\.(kGame|spareGame|shareGame|peekSaves|k|spare|share)$/.test(k) || k === 'tray.exactWay.at3');
  res.focus = {};
  for (const k of ['famHistoricalCurrentBot', 'famExperiments', 'sklHistorical', 'gateHistorical', 'curveHistorical']) {
    const rows2 = res[k].rows.filter(r => focus.includes(r.key));
    res.focus[k] = rows2;
    console.log(`\n## focus (traps, game way): ${res[k].title}`);
    console.log('descriptor | med hard | med easy | rho fam | rho skl | in-batch fam | in-batch skl | split | bal | hard on side | easy on side');
    for (const r of rows2.slice().sort((a, b) => Math.max(Math.abs(b.rhoFamily || 0), Math.abs(b.rhoSkilled || 0)) - Math.max(Math.abs(a.rhoFamily || 0), Math.abs(a.rhoSkilled || 0))))
      console.log([r.key, r.medHard, r.medEasy, r.rhoFamily, r.rhoSkilled, r.withinFamily && r.withinFamily.rho, r.withinSkilled && r.withinSkilled.rho, r.split && r.split.rule, r.split && r.split.bal, r.split && r.split.hardOnSide, r.split && r.split.easyOnSide].join(' | '));
  }
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  console.log('\nper kind (strongest rank correlations with family):');
  for (const [k, v] of Object.entries(res.perKind)) console.log(`  ${k} (n ${v.n}, family median ${v.famMedian}): ` + v.rows.map(r => `${r.key} ${r.rhoFamily}`).join('; '));
})();
