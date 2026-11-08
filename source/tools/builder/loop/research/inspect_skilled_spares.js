#!/usr/bin/env node
'use strict';
// Read-only diagnostic on one frozen puzzle. Run via heavy.js; no candidate is accepted by this script.
const fs = require('fs'), path = require('path');
const L = require('../library.js'), GP = require('../gate_profile.js'), T = require('../traces.js'), CF = require('../counterfactual.js');
function main() {
  const a = {}; for (let i=2;i<process.argv.length;i++) if(process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[++i];
  if (!a.lib || !a.out) throw Error('Usage: heavy.js --label skilled-spares -- node inspect_skilled_spares.js --lib directory --key content-key --out report.json');
  const root = path.resolve(__dirname, '../../../../..');
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'source/build/heavy.lock/owner.json'), 'utf8'));
  if (lock.pid !== process.ppid) throw Error('Run this diagnostic through heavy.js');
  const rows = L.readJsonl(path.join(a.lib, 'library.jsonl')), e = a.key ? rows.find(e=>e.key===a.key) : rows.length===1 ? rows[0] : null;
  if (!e || L.contentKey(e.design)!==e.key) throw Error('Select an unaltered frozen candidate');
  if (fs.existsSync(a.out)) throw Error('Diagnostic output already exists; preserve the existing result');
  const ys = CF.rulerYardstick(), before = GP.digest(e.design), cpu0 = process.cpuUsage(), wall0 = Date.now();
  const spares = [...new Set([e.S?.spare, ...(e.shipSpares || [])])].filter(Number.isInteger).sort();
  const ratings = spares.map(spare => {
    const at = T.atSpare(e.design, spare);
    if (at.fail) return {spare, valid:false, fail:at.fail};
    const p = ys.planner(at.design);
    return {spare, clockN:at.design.clock.n, S:p.S, valid:p.valid, fingerprint:p.fingerprint, styles:p.styles,
      normalBand:p.valid===true&&p.S>=2.5&&p.S<=6, fallbackBand:p.valid===true&&p.S>=2&&p.S<=6};
  });
  if (GP.digest(e.design)!==before) throw Error('Diagnostic mutated the frozen design');
  const cpu = process.cpuUsage(cpu0), out = {at:new Date().toISOString(), key:e.key, entryDigest:GP.digest(e),
    oldRating:e.S, shippableSpares:e.shipSpares, ratings, fingerprint:ys.pins.planner.fingerprint,
    cpuS:(cpu.user+cpu.system)/1e6, wallS:(Date.now()-wall0)/1000,
    note:'Clock-specific skilled diagnostic only. No fresh ACCEPT campaigns, special proof or batch qualification is implied.'};
  fs.writeFileSync(a.out,JSON.stringify(out,null,2)+'\n'); console.log(JSON.stringify(out));
}
if (require.main===module) main();
