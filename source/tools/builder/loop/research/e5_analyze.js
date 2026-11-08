#!/usr/bin/env node
/* E5 analysis: joins e5-boards.json, e5-static.jsonl, e5-traces.jsonl; prints tables and writes e5-gate-calibration.json (data only). */
'use strict';
const fs = require('fs'), path = require('path');
const OUT = path.resolve(__dirname, '..', '..', '..', '..', 'analysis/builder/process-v1');
const rl = f => fs.readFileSync(f, 'utf8').trim().split(/\r?\n/).map(l => JSON.parse(l));
const boards = JSON.parse(fs.readFileSync(path.join(OUT, 'e5-boards.json'), 'utf8'));
const S = Object.fromEntries(rl(path.join(OUT, 'e5-static.jsonl')).map(r => [r.id, r])), T = Object.fromEntries(rl(path.join(OUT, 'e5-traces.jsonl')).map(r => [r.id, r]));
const grp = b => b.stars >= 4 ? 'liked' : b.stars >= 1 && b.stars <= 2 ? 'disliked' : b.stars === 3 ? 'mid' : 'unrated';
const med = a => { a = a.filter(x => x != null && Number.isFinite(x)).sort((x, y) => x - y); return a.length ? (a[a.length >> 1] + a[(a.length - 1) >> 1]) / 2 : null; };
const rows = boards.map(b => {
  const s = S[b.id], t = T[b.id], g = s?.gates || {}, d7 = g.A7?.detail || {};
  return { id: b.id, set: b.set, level: b.level, stars: b.stars, tries: b.tries, group: grp(b), kinds: b.kinds,
    A: Object.fromEntries(Object.entries(g).map(([a, v]) => [a, v.pass])),
    A7: { room: d7.unrelieved === 0, tb: d7.tightBlind != null && d7.tightBlind <= 1, deals: d7.dealsPass, unrelieved: d7.unrelieved, tightBlind: d7.tightBlind, deals_lost: (d7.results || []).filter(x => x === 'lose').length, deals_n: (d7.results || []).length },
    B: t && !t.crash ? { D: t.D, pass: t.pass, B1: t.B1.pass, B1v: t.B1.value, B2: t.B2.pass, B2v: t.B2.value, B3: t.B3.pass, B3v: t.B3.value, B4: t.B4.pass, B4v: t.B4.value, B5: t.B5.pass, B5v: t.B5.value, B6: t.B6.pass, B6v: t.B6.value,
      B7v: t.B7.value, losses: t.counts.losses, proved: t.counts.provedFirstErrors, coverage: t.B2.coverage, tempting: t.counts.temptingMoves, forkStates: t.counts.forkStates } : { crash: t?.crash || 'missing' } };
});
const cnt = (arr, f) => arr.filter(f).length;
const out = { rows, groups: {}, gateByGroup: {}, metricMedians: {} };
for (const gname of ['liked', 'disliked', 'mid', 'unrated']) {
  const R = rows.filter(r => r.group === gname); out.groups[gname] = R.length; out.gateByGroup[gname] = {};
  for (const a of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9']) out.gateByGroup[gname][a] = cnt(R, r => r.A[a] === true);
  out.gateByGroup[gname].A7room = cnt(R, r => r.A7.room && r.A7.tb); out.gateByGroup[gname].A7unrel0 = cnt(R, r => r.A7.room); out.gateByGroup[gname].A7deals = cnt(R, r => r.A7.deals === true);
  out.gateByGroup[gname].Apass = cnt(R, r => S[r.id]?.pass);
  for (const k of ['B1', 'B2', 'B3', 'B4', 'B5', 'B6']) out.gateByGroup[gname][k] = cnt(R, r => r.B[k] === true) + '/' + cnt(R, r => r.B[k] === false) + '/' + cnt(R, r => r.B[k] === null);
  out.metricMedians[gname] = {}; for (const k of ['D', 'B1v', 'B2v', 'B3v', 'B4v', 'B5v', 'B6v', 'B7v']) out.metricMedians[gname][k] = med(R.map(r => r.B[k]));
}
fs.writeFileSync(path.join(OUT, 'e5-gate-calibration.json'), JSON.stringify(out, null, 1));
const f = x => x == null ? '  - ' : typeof x === 'number' ? String(Math.round(x * 100) / 100).padStart(5) : String(x).padStart(5);
console.log('id                       grp   *  A-pass  A1 A2 A3 A4 A5 A6 A7 | A7: unrel tb deals | D     B1v   B2v   B3v   B4  B5v   B6v   B7v  cov  loss');
for (const r of rows) console.log(r.id.padEnd(22), r.group.padEnd(8), String(r.stars ?? '-').padEnd(2), ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'].map(a => r.A[a] ? ' +' : ' -').join(' '), ' |', f(r.A7.unrelieved), f(r.A7.tightBlind), `${r.A7.deals_n - r.A7.deals_lost}/${r.A7.deals_n}`.padStart(4), '|', ['D', 'B1v', 'B2v', 'B3v', 'B4v', 'B5v', 'B6v', 'B7v', 'coverage', 'losses'].map(k => f(r.B[k])).join(' '), r.B.B2 === false ? 'B2-' : '', r.B.B5 === false ? 'B5-' : '', r.kinds.join(','));
console.log(JSON.stringify(out.groups), '\n', JSON.stringify(out.gateByGroup, null, 0), '\n', JSON.stringify(out.metricMedians));
