#!/usr/bin/env node
'use strict';
// Compare two generate.js runs from their census files (no bots).
//   node source/tools/builder/bank/smart_compare.js <smartGlob> <controlGlob>      e.g. census-50?-focus-small-smart  census-52?-focus-small
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../..'), DIR = path.join(ROOT, 'source/build/bank');
const re = g => new RegExp('^' + g.replace(/\?/g, '[0-9]').replace(/\*/g, '.*') + '\\.jsonl$');
const load = g => fs.readdirSync(DIR).filter(f => re(g).test(f)).flatMap(f => fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean));
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const r2 = x => x == null ? '-' : Math.round(x * 100) / 100;
function summarize(name, rows) {
  const stages = {}, fails = {};
  for (const r of rows) { stages[r.failStage || 'banked'] = (stages[r.failStage || 'banked'] || 0) + 1; }
  const reached = st => rows.filter(r => r.stages && r.stages.includes(st));
  const out = { name, candidates: rows.length, constructed: reached('construct').filter(r => r.boardKey).length, staticPass: reached('dScreen').length, dScreenPass: reached('stability').length,
    full: rows.filter(r => r.sFull && r.dFull).length, banked: rows.filter(r => r.banked).length, failStage: stages };
  const ds = rows.filter(r => r.dScreen && r.dScreen.ok).map(r => r.dScreen.D40), full = rows.filter(r => r.sFull && r.dFull && Number.isFinite(r.sFull.S));
  out.dScreen = { n: ds.length, mean: r2(mean(ds)), median: r2(med(ds)), p75: r2(q(ds, .75)), p90: r2(q(ds, .9)), share_ge_4_5: r2(ds.filter(x => x >= 4.5).length / (ds.length || 1)), share_ge_7: r2(ds.filter(x => x >= 7).length / (ds.length || 1)) };
  out.fullD = { n: full.length, meanD40: r2(mean(full.map(r => r.dFull.D40))), medianD40: r2(med(full.map(r => r.dFull.D40))), D5to10: full.filter(r => r.dFull.D40 >= 5 && r.dFull.D40 <= 10).length };
  out.fullS = { meanS: r2(mean(full.map(r => r.sFull.S))), medianS: r2(med(full.map(r => r.sFull.S))), over175: full.filter(r => r.sFull.S > 1.75).length, over175share: r2(full.filter(r => r.sFull.S > 1.75).length / (full.length || 1)), S1_75to6: full.filter(r => r.sFull.S >= 1.75 && r.sFull.S <= 6).length, aboveSix: full.filter(r => r.sFull.S > 6).length };
  const cpu = rows.map(r => Object.values(r.cpuMs || {}).reduce((s, x) => s + x, 0));
  out.cpuSecPerCandidate = r2(mean(cpu) / 1000);
  const tx = rows.filter(r => r.texture && r.texture.before);
  if (tx.length) {
    const f = (k, w) => r2(mean(tx.map(r => (r.texture[w] || {})[k]).filter(x => x != null)));
    out.textureBeforeAfter = {}; for (const k of ['down', 'obvA', 'simA', 'adjA', 'consA', 'chA', 'tray2A', 'gambleA', 'repOv']) out.textureBeforeAfter[k] = f(k, 'before') + ' -> ' + f(k, 'after');
    out.smartenChanged = tx.filter(r => r.texture.changed).length + '/' + tx.length;
  }
  return out;
}
const [sg, cg] = process.argv.slice(2);
for (const [n, g] of [['smart', sg], ['control', cg]]) console.log(JSON.stringify(summarize(n, load(g)), null, 1));
