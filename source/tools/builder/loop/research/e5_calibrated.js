'use strict';
// E5: re-score the stored per-board values under the proposed calibrated thresholds (no new engine/bot work).
const fs = require('fs'), path = require('path');
const OUT = path.resolve(__dirname, '..', '..', '..', '..', 'analysis/builder/process-v1');
const C = JSON.parse(fs.readFileSync(path.join(OUT, 'e5-gate-calibration.json'), 'utf8')), rl = f => fs.readFileSync(f, 'utf8').trim().split(/\r?\n/).map(l => JSON.parse(l));
const S = Object.fromEntries(rl(path.join(OUT, 'e5-static.jsonl')).map(r => [r.id, r]));
const TH = { B1: 0.15, B2: 0.20, B3: [0.08, 0.60], B4: 10, B5: 0.10, B6: 0.65 };
const trace = r => { const b = r.B; if (b.B1v == null) return null; const cov = b.coverage ?? 0;
  const ok = { B1: b.B1v >= TH.B1, B2: cov >= 0.5 ? b.B2v >= TH.B2 : null, B3: cov >= 0.5 ? b.B3v >= TH.B3[0] && b.B3v <= TH.B3[1] : null, B4: cov >= 0.5 && b.B4v != null ? b.B4v <= TH.B4 : null, B5: b.B5v == null ? null : b.B5v <= TH.B5, B6: b.B6v == null ? null : b.B6v <= TH.B6 };
  const v = Object.values(ok); return { ok, pass: v.includes(false) ? false : v.includes(null) ? null : true }; };
const a4 = r => { const ps = Object.values(S[r.id].gates.A4.detail.perSpare || {}); return ps.some(p => p.ok); };
const out = { thresholds: TH, rows: [], byGroup: {} };
for (const r of C.rows) { const t = trace(r), st = a4(r) && S[r.id].gates.A6.pass === true; out.rows.push({ id: r.id, group: r.group, stars: r.stars, trace: t?.pass ?? null, failed: t ? Object.keys(t.ok).filter(k => t.ok[k] === false) : null, staticCalibrated: st }); }
for (const g of ['liked', 'disliked', 'mid', 'unrated']) { const R = out.rows.filter(r => r.group === g); out.byGroup[g] = { n: R.length, tracePass: R.filter(r => r.trace === true).length, traceFail: R.filter(r => r.trace === false).length, traceUndecided: R.filter(r => r.trace === null).length, staticCalPass: R.filter(r => r.staticCalibrated).length, both: R.filter(r => r.trace === true && r.staticCalibrated).length }; }
out.lateSqueeze = out.rows.filter(r => C.rows.find(x => x.id === r.id).kinds.includes('lateSqueeze'));
out.q225 = out.rows.find(r => r.id.startsWith('q225'));
fs.writeFileSync(path.join(OUT, 'e5-calibrated-rescore.json'), JSON.stringify(out, null, 1)); console.log(JSON.stringify({ byGroup: out.byGroup, lateSqueeze: out.lateSqueeze, q225: out.q225, likedRows: out.rows.filter(r => r.group === 'liked'), disRows: out.rows.filter(r => r.group === 'disliked') }));
