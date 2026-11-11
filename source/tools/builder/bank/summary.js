#!/usr/bin/env node
'use strict';
// Reads source/build/bank/census-*.jsonl; prints and writes source/analysis/builder/bank/census-summary.{md,json}.
//   node source/tools/builder/bank/summary.js [--dir source/build/bank]
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../..');
const i = process.argv.indexOf('--dir');
const DIR = i < 0 ? path.join(ROOT, 'source/build/bank') : path.resolve(process.argv[i + 1]);
const OUT = path.join(ROOT, 'source/analysis/builder/bank');
const STAGES = ['construct', 'dedupe', 'static', 'dScreen', 'stability', 'full', 'band', 'trace'];
const CPU_STAGES = ['construct', 'dedupe', 'static', 'dScreen', 'stability', 'full', 'trace'];

const rows = [];
for (const f of fs.existsSync(DIR) ? fs.readdirSync(DIR) : []) {
  if (!/^census-.*\.jsonl$/.test(f)) continue;
  for (const l of fs.readFileSync(path.join(DIR, f), 'utf8').split('\n')) {
    if (!l.trim()) continue;
    try { rows.push(JSON.parse(l)); } catch (e) { /* partial line */ }
  }
}
const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), k = (s.length - 1) * p, lo = Math.floor(k), hi = Math.ceil(k); return s[lo] + (s[hi] - s[lo]) * (k - lo); };
const f2 = x => x == null ? '-' : (Math.round(x * 100) / 100).toString();
const pct = x => x == null ? '-' : Math.round(x * 100) + '%';

// funnel: entered / failed / reasons per stage
const funnel = {};
let entered = rows.length;
for (const s of STAGES) {
  const failed = rows.filter(r => r.failStage === s);
  const reasons = {};
  for (const r of failed) reasons[r.failReason] = (reasons[r.failReason] || 0) + 1;
  funnel[s] = { entered, failed: failed.length, passed: entered - failed.length, reasons };
  entered -= failed.length;
}
const banked = rows.filter(r => r.banked);
const cpu = Object.fromEntries(CPU_STAGES.map(s => {
  const ms = rows.reduce((a, r) => a + (r.cpuMs?.[s] || 0), 0), n = rows.filter(r => r.cpuMs?.[s] != null).length;
  return [s, { cpuSec: ms / 1000, runs: n, perRunSec: n ? ms / 1000 / n : null }];
}));
const totalCpuSec = Object.values(cpu).reduce((a, c) => a + c.cpuSec, 0);
const perHour = totalCpuSec ? banked.length / (totalCpuSec / 3600) : null;

// knob tables for candidates that reached the D screen (they have dScreen measured)
const reached = rows.filter(r => r.dScreen);
const bucketDown = r => { const d = r.downCount ?? 0; return d === 0 ? '0' : d <= 10 ? '1-10' : d <= 20 ? '11-20' : d <= 30 ? '21-30' : '31+'; };
const knobs = {
  spare: r => r.knobs.spare, maxDown: bucketDown, hiddenOnWay: r => r.knobs.hiddenOnWay, traps: r => r.knobs.traps,
  depth: r => r.knobs.depth == null ? 'default' : r.knobs.depth, layout: r => `${r.knobs.layout} ${r.knobs.shape} (${r.knobs.tiles})`
};
const tables = {};
for (const [name, fn] of Object.entries(knobs)) {
  const g = {};
  for (const r of reached) (g[fn(r)] = g[fn(r)] || []).push(r);
  tables[name] = Object.keys(g).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })).map(k => {
    const rs = g[k], Spass = rs.filter(r => r.sScreen && r.sScreen.S >= 1.8 && r.sScreen.S <= 7).length, D = rs.map(r => r.dScreen.D40).filter(Number.isFinite);
    return { value: String(k), n: rs.length, sPassRate: rs.length ? Spass / rs.length : null, d40q1: q(D, 0.25), d40med: q(D, 0.5), d40q3: q(D, 0.75) };
  });
}
// the S screen precedes D, so a candidate reaching dScreen already passed the S screen; also show S-screen reach by knob over all that got an S measurement.
const sMeasured = rows.filter(r => r.sScreen);
const sTables = {};
for (const [name, fn] of Object.entries(knobs)) {
  const g = {};
  for (const r of sMeasured) (g[fn(r)] = g[fn(r)] || []).push(r);
  sTables[name] = Object.keys(g).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })).map(k => {
    const rs = g[k], S = rs.map(r => r.sScreen.S).filter(Number.isFinite);
    return { value: String(k), n: rs.length, sPassRate: rs.filter(r => r.sScreen.S >= 1.8 && r.sScreen.S <= 7).length / rs.length, Sq1: q(S, 0.25), Smed: q(S, 0.5), Sq3: q(S, 0.75) };
  });
}
const list = banked.map(r => ({ key: r.boardKey, layout: `${r.knobs.layout} ${r.knobs.shape}`, tiles: r.spec.tiles, D20: r.dFull.D20, D40: r.dFull.D40, S: r.sFull.S, band: r.band }));

const json = { candidates: rows.length, funnel, cpu, totalCpuSec, bankedCount: banked.length, bankedPerCpuHour: perHour, dScreenKnobTables: tables, sScreenKnobTables: sTables, banked: list };

let md = `# Puzzle bank census summary\n\nCandidates: ${rows.length} (census files in ${path.relative(ROOT, DIR)})\n\n## Funnel\n\n| stage | entered | failed | passed | failure reasons |\n|---|---|---|---|---|\n`;
for (const s of STAGES) {
  const f = funnel[s];
  md += `| ${s} | ${f.entered} | ${f.failed} | ${f.passed} | ${Object.entries(f.reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join('; ') || '-'} |\n`;
}
md += `\nBanked: ${banked.length}\n\n## CPU\n\n| stage | cpu-sec total | runs | cpu-sec per run |\n|---|---|---|---|\n`;
for (const s of CPU_STAGES) md += `| ${s} | ${f2(cpu[s].cpuSec)} | ${cpu[s].runs} | ${f2(cpu[s].perRunSec)} |\n`;
md += `| total | ${f2(totalCpuSec)} | ${rows.length} | ${f2(rows.length ? totalCpuSec / rows.length : null)} |\n\nBanked puzzles per cpu-hour: ${f2(perHour)}\n`;
const tbl = (title, t, cols) => {
  let s = `\n### ${title}\n\n| ${cols.map(c => c[0]).join(' | ')} |\n|${cols.map(() => '---').join('|')}|\n`;
  for (const r of t) s += `| ${cols.map(c => c[1](r)).join(' | ')} |\n`;
  return s;
};
md += `\n## Knob tables, candidates that reached the D screen (n = ${reached.length}; D = D40, cap 40, 40 campaigns)\n`;
for (const [name, t] of Object.entries(tables)) md += tbl(name, t, [[name, r => r.value], ['n', r => r.n], ['S pass rate', r => pct(r.sPassRate)], ['D q1', r => f2(r.d40q1)], ['D median', r => f2(r.d40med)], ['D q3', r => f2(r.d40q3)]]);
md += `\n## Knob tables, all candidates with an S screen (n = ${sMeasured.length}; S = B3 20 campaigns)\n`;
for (const [name, t] of Object.entries(sTables)) md += tbl(name, t, [[name, r => r.value], ['n', r => r.n], ['S pass rate (1.8-7)', r => pct(r.sPassRate)], ['S q1', r => f2(r.Sq1)], ['S median', r => f2(r.Smed)], ['S q3', r => f2(r.Sq3)]]);
md += `\n## Banked puzzles\n\n| key | layout | tiles | D20 | D40 | S | band |\n|---|---|---|---|---|---|---|\n`;
for (const b of list) md += `| ${b.key.slice(0, 16)} | ${b.layout} | ${b.tiles} | ${f2(b.D20)} | ${f2(b.D40)} | ${f2(b.S)} | ${b.band} |\n`;
if (!list.length) md += '| (none) | | | | | | |\n';

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'census-summary.md'), md);
fs.writeFileSync(path.join(OUT, 'census-summary.json'), JSON.stringify(json, null, 1));
console.log(md);
