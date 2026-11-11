'use strict';
// Joins the ledger (source/build/real-v2/ledger-170-239.json) with ratings.jsonl; writes process-v2/real-170-239.json
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../../..');
const B = path.join(ROOT, 'source/build/real-v2');
const L = JSON.parse(fs.readFileSync(path.join(B, 'ledger-170-239.json'), 'utf8'));
const R = {};
for (const l of fs.readFileSync(path.join(B, 'ratings.jsonl'), 'utf8').trim().split('\n')) { const r = JSON.parse(l); (R[r.lv] = R[r.lv] || {})[r.what] = r; }
const W = { Dennis: 2, Gerda: 1, MrsD: 2 }, CAP = 20;
const rows = [];
for (let lv = 170; lv <= 239; lv++) {
  const seq = {}; for (const s of L.sequences) if (s.lv === lv && W[s.who]) seq[s.who] = s;
  const v = s => Math.min(CAP, s.won ? s.tries : s.tries + 1);
  const ws = Object.keys(seq); const wsum = ws.reduce((a, w) => a + W[w], 0);
  const Y = wsum ? ws.reduce((a, w) => a + W[w] * v(seq[w]), 0) / wsum : null;
  const r = R[lv] || {};
  rows.push({ lv, tiles: r.D20 ? r.D20.tiles : null, D20: r.D20 && +r.D20.D.toFixed(2), D40: r.D40 && +r.D40.D.toFixed(2), S: r.S && r.S.S, Sstyles: r.S && r.S.styles,
    Y: Y == null ? null : +Y.toFixed(2), nPlayers: ws.length, allThree: ws.length === 3, censored: ws.some(w => !seq[w].won),
    Dennis: seq.Dennis ? v(seq.Dennis) : null, DennisWon: seq.Dennis ? seq.Dennis.won : null, Gerda: seq.Gerda ? v(seq.Gerda) : null, MrsD: seq.MrsD ? v(seq.MrsD) : null });
}
const rank = a => { const idx = a.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = Array(a.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; };
const pear = (a, b) => { const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };
const spear = (a, b) => pear(rank(a), rank(b));
function sp(rs, x, y) {
  const f = rs.filter(r => r[x] != null && r[y] != null); if (f.length < 4) return { n: f.length, rho: null };
  const rho = spear(f.map(r => r[x]), f.map(r => r[y]));
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; const bs = [];
  for (let b = 0; b < 1000; b++) { const s = f.map(() => f[Math.floor(rnd() * f.length)]); const c = spear(s.map(r => r[x]), s.map(r => r[y])); if (!isNaN(c)) bs.push(c); }
  bs.sort((p, q) => p - q); return { n: f.length, rho: +rho.toFixed(2), lo: +bs[Math.floor(bs.length * .05)].toFixed(2), hi: +bs[Math.floor(bs.length * .95)].toFixed(2) };
}
function pav(pts) {
  const s = [...pts].sort((a, b) => a[0] - b[0]); const out = [];
  for (const p of s) { out.push({ x0: p[0], w: 1, m: p[1] }); while (out.length > 1 && out[out.length - 2].m > out[out.length - 1].m) { const q = out.pop(), o = out.pop(); out.push({ x0: o.x0, w: o.w + q.w, m: (o.m * o.w + q.m * q.w) / (o.w + q.w) }); } }
  return x => { let r = out[0].m; for (const b of out) if (x >= b.x0) r = b.m; return r; };
}
function isoMap(rs, xk, yk, grid) {
  const f = rs.filter(r => r[xk] != null && r[yk] != null); const pts = f.map(r => [r[xk], r[yk]]); const m = pav(pts);
  let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; const bs = grid.map(() => []);
  for (let b = 0; b < 1000; b++) { const mm = pav(pts.map(() => pts[Math.floor(rnd() * pts.length)])); grid.forEach((g, i) => bs[i].push(mm(g))); }
  return { n: f.length, map: grid.map((g, i) => { const a = bs[i].sort((p, q) => p - q); return { D: g, Y: +m(g).toFixed(2), lo: +a[Math.floor(a.length * .05)].toFixed(2), hi: +a[Math.floor(a.length * .95)].toFixed(2) }; }) };
}
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const have = rows.filter(r => r.D20 != null);
const G = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const out = { generated: new Date().toISOString(), levelsRated: have.length, rows,
  playersPerLevel: { Dennis: rows.filter(r => r.Dennis != null).length, Gerda: rows.filter(r => r.Gerda != null).length, MrsD: rows.filter(r => r.MrsD != null).length, allThree: rows.filter(r => r.allThree).length, twoPlus: rows.filter(r => r.nPlayers >= 2).length },
  spearman: {
    D20_vs_Y_all: sp(rows, 'D20', 'Y'), D40_vs_Y_all: sp(rows, 'D40', 'Y'),
    D20_vs_Y_2plus: sp(rows.filter(r => r.nPlayers >= 2), 'D20', 'Y'), D20_vs_Y_allThree: sp(rows.filter(r => r.allThree), 'D20', 'Y'),
    D20_vs_Dennis: sp(rows, 'D20', 'Dennis'), D40_vs_Dennis: sp(rows, 'D40', 'Dennis'), S_vs_Dennis: sp(rows, 'S', 'Dennis'), S_vs_Y_all: sp(rows, 'S', 'Y'),
    D20_vs_Gerda: sp(rows, 'D20', 'Gerda'), D20_vs_MrsD: sp(rows, 'D20', 'MrsD'),
    Dennis_vs_Gerda: sp(rows, 'Dennis', 'Gerda'), Dennis_vs_MrsD: sp(rows, 'Dennis', 'MrsD'),
    D20_vs_Y_170_199: sp(rows.filter(r => r.lv < 200), 'D20', 'Y'), D20_vs_Dennis_200_239: sp(rows.filter(r => r.lv >= 200), 'D20', 'Dennis'),
    tiles_vs_Dennis: sp(rows, 'tiles', 'Dennis') },
  iso_D20_to_Y: isoMap(rows, 'D20', 'Y', G), iso_D40_to_Y: isoMap(rows, 'D40', 'Y', G), iso_D20_to_Dennis: isoMap(rows, 'D20', 'Dennis', G),
  bands: [], D10: null, dennisLevel: null };
for (let a = 170; a < 240; a += 10) {
  const rs = rows.filter(r => r.lv >= a && r.lv < a + 10); const m = k => { const v = rs.map(r => r[k]).filter(x => x != null); return v.length ? +mean(v).toFixed(2) : null; };
  out.bands.push({ band: `${a}-${a + 9}`, D20: m('D20'), D40: m('D40'), S: m('S'), Y: m('Y'), Dennis: m('Dennis'), Gerda: m('Gerda'), MrsD: m('MrsD'), nY: rs.filter(r => r.Y != null).length });
}
const nearD = rows.filter(r => r.D20 != null && r.D20 >= 8 && r.D20 <= 12 && r.Y != null);
const dn = nearD.filter(r => r.Dennis != null);
out.D10 = { n: nearD.length, levels: nearD.map(r => ({ lv: r.lv, D20: r.D20, D40: r.D40, Y: r.Y, nPlayers: r.nPlayers, Dennis: r.Dennis })), meanY: nearD.length ? +mean(nearD.map(r => r.Y)).toFixed(2) : null, meanDennis: dn.length ? +mean(dn.map(r => r.Dennis)).toFixed(2) : null };
const hiD = rows.filter(r => r.D20 != null && r.lv >= 200 && r.Dennis != null);
out.dennisLevel = { '200-239': { meanD20: +mean(hiD.map(r => r.D20)).toFixed(2), medianD20: hiD.map(r => r.D20).sort((a, b) => a - b)[Math.floor(hiD.length / 2)], meanD40: +mean(hiD.map(r => r.D40)).toFixed(2), meanDennis: +mean(hiD.map(r => r.Dennis)).toFixed(2), n: hiD.length, meanY: +mean(hiD.map(r => r.Y)).toFixed(2) } };
const mY = pav(rows.filter(r => r.D20 != null && r.Y != null).map(r => [r.D20, r.Y]));
const res = rows.filter(r => r.D20 != null && r.Y != null).map(r => ({ lv: r.lv, D20: r.D20, Y: r.Y, nPlayers: r.nPlayers, Dennis: r.Dennis, resid: +(r.Y - mY(r.D20)).toFixed(2) })).sort((a, b) => b.resid - a.resid);
out.worstReal_harderThanBot = res.slice(0, 8); out.worstReal_easierThanBot = res.slice(-8).reverse();
const rk = rows.filter(r => r.D20 != null && r.Y != null); const rD = rank(rk.map(r => r.D20)), rY = rank(rk.map(r => r.Y));
const rg = rk.map((r, i) => ({ lv: r.lv, D20: r.D20, Y: r.Y, nPlayers: r.nPlayers, rankGap: +((rY[i] - rD[i]) / rk.length).toFixed(2) })).sort((a, b) => b.rankGap - a.rankGap);
out.rankGap_realHarder = rg.slice(0, 6); out.rankGap_realEasier = rg.slice(-6).reverse();
fs.mkdirSync(path.join(ROOT, 'source/analysis/builder/process-v2'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'source/analysis/builder/process-v2/real-170-239.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ n: have.length, players: out.playersPerLevel, sp: out.spearman, bands: out.bands, D10: out.D10, dl: out.dennisLevel, isoD20Y: out.iso_D20_to_Y.map, isoDen: out.iso_D20_to_Dennis.map, hard: out.worstReal_harderThanBot.slice(0, 5), easy: out.worstReal_easierThanBot.slice(0, 5) }));
