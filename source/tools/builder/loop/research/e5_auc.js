'use strict';
// E5 add-on: AUC (liked vs disliked) per metric, threshold sweeps, A4 logic-only, late-squeeze rows. Writes e5-auc.json.
const fs = require('fs'), path = require('path');
const OUT = path.resolve(__dirname, '..', '..', '..', '..', 'analysis/builder/process-v1');
const C = JSON.parse(fs.readFileSync(path.join(OUT, 'e5-gate-calibration.json'), 'utf8')), rows = C.rows;
const rl = f => fs.readFileSync(f, 'utf8').trim().split(/\r?\n/).map(l => JSON.parse(l));
const S = Object.fromEntries(rl(path.join(OUT, 'e5-static.jsonl')).map(r => [r.id, r]));
const liked = rows.filter(r => r.group === 'liked'), dis = rows.filter(r => r.group === 'disliked');
const auc = (f, hiGood = true) => { let w = 0, n = 0; for (const a of liked) for (const b of dis) { const x = f(a), y = f(b); if (x == null || y == null) continue; n++; w += x === y ? .5 : ((x > y) === hiGood ? 1 : 0); } return n ? Math.round(w / n * 100) / 100 : null; };
const m = {
  D: r => r.B.D, B1v: r => r.B.B1v, B2v: r => r.B.B2v, B3v: r => r.B.B3v, B4v: r => r.B.B4v, B5v: r => r.B.B5v, B6v: r => r.B.B6v, B7v: r => r.B.B7v,
  A7_unrelieved: r => r.A7.unrelieved, A7_tightBlind: r => r.A7.tightBlind, A7_dealsLost: r => r.A7.deals_lost,
};
const res = { n: { liked: liked.length, disliked: dis.length }, aucLikedHigher: {} };
for (const [k, f] of Object.entries(m)) res.aucLikedHigher[k] = auc(f);
// B2 sweeps: pass share at thresholds for liked / disliked / all decided
res.B2sweep = {}; for (const t of [0.5, 0.3, 0.2, 0.15, 0.1]) res.B2sweep[t] = { liked: liked.filter(r => r.B.B2v >= t).length, disliked: dis.filter(r => r.B.B2v >= t).length, all46: rows.filter(r => r.B.B2v != null && r.B.B2v >= t).length };
res.B1sweep = {}; for (const t of [0.15, 0.3, 0.5]) res.B1sweep[t] = { liked: liked.filter(r => r.B.B1v >= t).length, disliked: dis.filter(r => r.B.B1v >= t).length };
res.B4sweep = {}; for (const t of [6, 8, 10, 12]) res.B4sweep[t] = { liked: liked.filter(r => r.B.B4v <= t).length, disliked: dis.filter(r => r.B.B4v <= t).length, all: rows.filter(r => r.B.B4v != null && r.B.B4v <= t).length };
// A4 logic-only: ok at every shippable spare in perSpare, ignoring the clock.n <= 19 cut that empties okSpares
const a4 = r => { const d = S[r.id].gates.A4.detail; const ps = d.perSpare ? Object.values(d.perSpare) : []; return ps.length ? ps.some(p => p.ok) : null; };
res.A4logicOnly = { liked: liked.filter(a4).length, disliked: dis.filter(a4).length, all: rows.filter(a4).length, A4asShipped: { liked: liked.filter(r => r.A.A4).length, disliked: dis.filter(r => r.A.A4).length, all: rows.filter(r => r.A.A4).length } };
res.kLarge = rows.filter(r => S[r.id].k > 16).map(r => r.id);
res.lateSqueeze = rows.filter(r => r.kinds.includes('lateSqueeze')).map(r => ({ id: r.id, B5v: r.B.B5v, B5: r.B.B5, B2: r.B.B2, B4v: r.B.B4v, B6v: r.B.B6v, Bpass: rows.find(x => x.id === r.id).B.pass }));
res.pass = { staticAll: rows.filter(r => S[r.id].pass).length, traceAll: rows.filter(r => r.B.pass === true).length, traceFalse: rows.filter(r => r.B.pass === false).length, traceNull: rows.filter(r => r.B.pass === null).length };
res.q225 = rows.find(r => r.id.startsWith('q225')); 
res.likedTrace = liked.map(r => ({ id: r.id, pass: r.B.pass, B1: r.B.B1, B2: r.B.B2, B3: r.B.B3, B4: r.B.B4, B5: r.B.B5, B6: r.B.B6 }));
fs.writeFileSync(path.join(OUT, 'e5-auc.json'), JSON.stringify(res, null, 1)); console.log(JSON.stringify(res));
