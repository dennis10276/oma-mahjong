/* A person's habits at a moment in time: what kind of move they make per situation (turn a tile over,
   pair, single, fatal 4th), from their recorded decisions before that moment, newest games weighted
   (half-life in games), pulled towards the family's rates (PRIOR decisions' worth).
   Before their first recording: only earlier family recordings, otherwise the engine defaults.
     const { kindsAt } = require('./kinds.js'); kindsAt('Gerda', Date.now()) */
'use strict';
const fs = require('fs'), path = require('path');
const FILES = { Dennisisdebeste: 'Dennisisdebeste', 'Mrs. Doubtfire': 'Mrs_Doubtfire', PUK: 'PUK', Gerda: 'Gerda' };
const KINDS = ['flip', 'pair', 'single', 'fatal'], PRIOR = 2;
const D = {};
for (const [n, f] of Object.entries(FILES)) {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'mimic', f + '.json'), 'utf8')), ix = Object.fromEntries(d.feat.map((x, i) => [x, i]));
  const kindOf = F => F[ix.flip] ? 'flip' : F[ix.overflow] ? 'fatal' : F[ix.isPair] ? 'pair' : 'single';
  // per game: counts per situation
  D[n] = d.games.map(g => {
    const tab = {};
    for (const dc of g.decisions) {
      if (dc.k < 0) continue;
      const ks = dc.F.map(kindOf), t = Math.min(3, dc.tray);
      const key = 't' + t + (ks.includes('pair') ? 'p' : 'n') + (ks.includes('flip') ? '' : '-');
      const r = tab[key] || (tab[key] = { n: 0 }); r.n++; const c = ks[dc.k]; r[c] = (r[c] || 0) + 1;
    }
    return { t: g.availableAt || g.t, tab };
  }).sort((a, b) => a.t - b.t);
}
function table(n, t, half) {
  const G = D[n].filter(g => g.t < t);
  const N = G.length, tab = {};
  G.forEach((g, i) => { const rw = half ? 0.5 ** ((N - 1 - i) / half) : 1; for (const [k, r] of Object.entries(g.tab)) { const a = tab[k] || (tab[k] = { n: 0 }); a.n += rw * r.n; for (const c of KINDS) a[c] = (a[c] || 0) + rw * (r[c] || 0); } });
  return tab;
}
const cache = new Map();
function kindsAt(name, t, half = 20) {
  const ck = name + '|' + t + '|' + half; if (cache.has(ck)) return cache.get(ck);
  const tabs = Object.fromEntries(Object.keys(FILES).map(n => [n, table(n, t, half)]));
  const fam = {};
  for (const tab of Object.values(tabs)) for (const [k, r] of Object.entries(tab)) if (r.n > 0) (fam[k] || (fam[k] = [])).push(Object.fromEntries(KINDS.map(c => [c, (r[c] || 0) / r.n])));
  const out = {};
  for (const [k, v] of Object.entries(fam)) {
    const f = Object.fromEntries(KINDS.map(c => [c, v.reduce((a, x) => a + x[c], 0) / v.length])), mine = tabs[name][k] || { n: 0 };
    out[k] = Object.fromEntries(KINDS.map(c => [c, +(((mine[c] || 0) + PRIOR * f[c]) / (mine.n + PRIOR)).toFixed(4)]));
  }
  cache.set(ck, out);
  return out;
}
const lastRecording = name => D[name][D[name].length - 1].t;
module.exports = { kindsAt, lastRecording, KINDS };
