/* From a measured grid (rates dir): per player, how well each setting matches the real first-try wins
   per level band (calibration) and the likelihood of all tries.  RATES=rates4 node calib_rates.js */
'use strict';
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, process.env.RATES || 'rates4');
const R = {}; for (const f of fs.readdirSync(DIR)) Object.assign(R, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
const A = require('./attempts.json').filter(a => R[a.key]);
const cfgs = Object.keys(Object.values(R).find(x => x.clock).r);
const get = (k, c) => { const r = R[k].r; if (r[c] !== undefined) return r[c]; const q = c.split('|'); q[2] = '0'; return r[q.join('|')]; };
const bands = [[10, 29], [30, 49], [50, 74], [75, 79], [80, 89], [90, 104]];
const out = {};
for (const name of ['Dennisisdebeste', 'Mrs. Doubtfire', 'Gerda', 'PUK']) {
  const F = A.filter(a => a.name === name && a.at === 1);
  const rows = cfgs.map(c => {
    let err = 0; const b = [];
    for (const [lo, hi] of bands) {
      const L = F.filter(a => a.lv >= lo && a.lv <= hi); if (!L.length) continue;
      const real = L.filter(a => a.r === 'win').length / L.length, pred = L.reduce((s, a) => s + get(a.key, c), 0) / L.length;
      err += L.length * (real - pred) ** 2; b.push(`${lo}-${hi}:${real.toFixed(2)}/${pred.toFixed(2)}`);
    }
    let ll = 0; for (const a of F) { const p = (get(a.key, c) * 100 + 0.5) / 101; ll += Math.log(a.r === 'win' ? p : 1 - p); }
    return { c, err: +err.toFixed(3), ll1: +ll.toFixed(1), b: b.join(' ') };
  });
  rows.sort((x, y) => x.err - y.err);
  out[name] = rows.slice(0, 6);
  console.log('\n' + name + ' (first tries ' + F.length + ')  best by calibration [real/test player]:');
  for (const r of rows.slice(0, 6)) console.log(`  ${r.c.padEnd(14)} err ${r.err}  ll1 ${r.ll1}  ${r.b}`);
  const byLL = rows.slice().sort((x, y) => y.ll1 - x.ll1)[0];
  console.log(`  best by likelihood: ${byLL.c} ll1 ${byLL.ll1} err ${byLL.err}`);
}
