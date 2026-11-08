#!/usr/bin/env node
/* E7: re-dial or replace the kept 200-225 boards (process-design-synthesis.md section 7).
   heavy.js --label e7 -- node .../e7_rework.js run     -> OUT/e7-boards.jsonl (one row per board, resumable)
   node .../e7_rework.js report                          -> OUT/e7-rework.json + .md
   Per board: static gates (rows of e5-static.jsonl, same tool, same boards; judged with the E5 calibrated gate set),
   dial curve spares 0-3 (CURVE block), planner S at spare 2, traces (calibrated thresholds) at each spare that could ship,
   C1 at those spares, C2/C3 once. Read-only on the game; changes nothing. */
'use strict';
const fs = require('fs'), path = require('path');
const SRC = path.resolve(__dirname, '..', '..', '..', '..'), OUT = path.join(SRC, 'analysis/builder/process-v1');
const rl = f => fs.readFileSync(f, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
const FILE = path.join(OUT, 'e7-boards.jsonl');
const qual = () => rl(path.join(SRC, 'analysis/builder/data/qualified-200-225.jsonl'));
const SKILLED_MIN = 2.5 - 0.3;   // run_pipeline DEFAULTS skilledFloor - plannerMargin
const r2 = x => x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100;

function run() {
  const Y = require('../yardstick.js'), DC = require('../dial_curve.js'), TR = require('../traces.js'), CF = require('../counterfactual.js');
  const cal = JSON.parse(fs.readFileSync(path.join(SRC, 'analysis/builder/library/gates-calibrated.json'), 'utf8')).asThresholdsOption['traces.thresholds'];
  const ys = CF.rulerYardstick({});
  const st = Object.fromEntries(rl(path.join(OUT, 'e5-static.jsonl')).map(r => [r.id, r]));
  const done = new Set(fs.existsSync(FILE) ? rl(FILE).map(r => r.id) : []);
  for (const q of qual()) {
    const id = 'q' + q.level + '-' + q.id.slice(0, 6); if (done.has(id)) continue;
    const t0 = Date.now(), row = { id, level: q.level, target: q.target, n: q.n, storedClockN: q.design.clock?.n ?? null };
    try {
      const sg = st[id]; row.static = sg ? { k: sg.k, shipSpares: sg.shipSpares, gates: Object.fromEntries(Object.entries(sg.gates).map(([a, g]) => [a, { pass: g.pass, why: g.detail?.why ?? null, okSpares: g.detail?.okSpares ?? null }])) } : null;
      row.storedSpare = sg && sg.k != null && row.storedClockN != null ? row.storedClockN - sg.k : null;
      const curve = DC.measureCurve(q.design, ys, { spares: [0, 1, 2, 3] });
      row.curve = { k: curve.k, shippable: curve.shippable, shippableOpeningRule: curve.shippableOpeningRule, ratio13: curve.ratio13, diallable: curve.diallable, monotone: curve.monotone,
        points: curve.points.map(p => ({ spare: p.spare, clockN: p.clockN, D: r2(p.D), pHat: r2(p.pHat), se: r2(p.se), valid: p.valid, fail: p.fail || null, probe: p.probe || null })),
        verdicts: Object.fromEntries(Object.entries(curve.verdicts).map(([s, v]) => [s, { canShip: v.canShip, reasons: v.reasons }])) };
      const pl = ys.planner(q.design, { spare: 2 });
      row.planner = { S: r2(pl.S), valid: pl.valid, styles: pl.styles ?? null };
      const a4 = row.static?.gates?.A4?.okSpares || row.static?.shipSpares || [];
      row.a4Spares = a4;
      const cand = (curve.shippable || []).filter(s => a4.includes(s));
      row.candidateSpares = cand; row.traces = {}; row.C1 = {};
      for (const s of cand) {
        const t = TR.traceGates(q.design, { spare: s, ys, campaigns: 40, thresholds: cal });
        row.traces[s] = { fail: t.fail || null, pass: t.pass ?? null, D: r2(t.D), gates: Object.fromEntries(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'].map(b => [b, t[b] ? { pass: t[b].pass ?? null, value: t[b].value ?? t[b].v ?? null, detail: t[b].detail ?? null } : null])) };
        const c = CF.c1(q.design, { spare: s, ys });
        row.C1[s] = { pass: c.pass, keyMemory: c.keyMemory, reference: c.reference, tolerance: c.tolerance };
      }
      const c2 = CF.c2c3(q.design, { ys, plannerSpare: 2 });
      row.C2 = c2.C2 ?? null; row.C3 = c2.C3 ?? null;
    } catch (e) { row.crash = String(e.stack || e.message).slice(0, 500); }
    row.ms = Date.now() - t0;
    fs.appendFileSync(FILE, JSON.stringify(row) + '\n'); console.log('e7', id, row.crash || 'ok', row.ms, 'ms');
  }
}
if (process.argv[2] === 'run') run(); else if (process.argv[2] !== 'report') console.log('usage: run | report');

// ---------- verdicts and report ----------
function verdict(r) {
  if (r.crash) return { verdict: 'unresolved', reason: 'tool crashed: ' + r.crash.split('\n')[0] };
  const T = r.target, tol = Math.max(1, 0.10 * T), g = r.static?.gates || {}, Dat = s => r.curve.points.find(p => p.spare === s)?.D;
  const flags = [];
  for (const a of ['A1', 'A2', 'A5', 'A7']) if (g[a]?.pass === false) flags.push(a);
  const hard = ['A6', 'A8', 'A9'].filter(a => g[a]?.pass === false);
  if (hard.length) return { verdict: 'replace', reason: `fails static gate ${hard.join(', ')}`, flags };
  if (!(r.planner.S >= SKILLED_MIN)) return { verdict: 'replace', reason: `planner S ${r.planner.S} is under the skilled floor ${SKILLED_MIN}`, flags };
  if (!r.candidateSpares.length) {
    const why = Object.values(r.curve.verdicts).filter(v => v.reasons?.length).length && !r.curve.shippable.length ? 'the dial curve has no spare that could ship (' + [...new Set(Object.values(r.curve.verdicts).flatMap(v => v.reasons))].join(', ') + ')'
      : `no spare is both curve-shippable (${JSON.stringify(r.curve.shippable)}) and allowed by A4 (${JSON.stringify(r.a4Spares)})`;
    return { verdict: 'replace', reason: why, flags };
  }
  const ok = r.candidateSpares.filter(s => r.traces[s] && !r.traces[s].fail && r.traces[s].pass !== false && r.C1[s]?.pass !== false);
  if (!ok.length) {
    const why = r.candidateSpares.map(s => `s${s}: ` + (r.traces[s].fail || ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'].filter(b => r.traces[s].gates[b]?.pass === false).concat(r.C1[s]?.pass === false ? ['C1'] : []).join('+') || 'undecided')).join('; ');
    return { verdict: 'replace', reason: `every shippable spare fails the trace or counterfactual gates (${why})`, flags };
  }
  const best = ok.slice().sort((a, b) => Math.abs(Dat(a) - T) - Math.abs(Dat(b) - T))[0], gap = Dat(best) - T;
  const within = Math.abs(gap) <= tol, far = Math.abs(gap) > 2.5 * tol;
  if (far) return { verdict: 'replace', reason: `best spare ${best} gives D ${Dat(best)} against target ${T} (gap ${r2(gap)}, over 2.5 x tolerance ${r2(2.5 * tol)})`, flags, best };
  const planned = r.storedSpare === best;
  const base = `D ${Dat(best)} at spare ${best} vs target ${T}`;
  return { verdict: planned ? 'keep' : 're-dial', spare: best, reason: (planned ? 'stored spare passes the gates: ' : `stored spare is ${r.storedSpare}; `) + base + (within ? ` (within tolerance ${r2(tol)})` : ` (outside tolerance ${r2(tol)}; closest available)`), flags, gap: r2(gap), within };
}
function report() {
  const rows = rl(FILE).map(r => ({ ...r, ...verdict(r) }));
  fs.writeFileSync(path.join(OUT, 'e7-rework.json'), JSON.stringify(rows, null, 1));
  const cnt = rows.reduce((a, r) => (a[r.verdict] = (a[r.verdict] || 0) + 1, a), {});
  console.log(cnt); for (const r of rows) console.log(r.level, r.target, r.verdict, r.spare ?? '', '|', r.reason, '| flags', (r.flags || []).join(','));
}
if (process.argv[2] === 'report') report();
