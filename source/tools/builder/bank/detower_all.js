#!/usr/bin/env node
'use strict';
// Try every de-tower method per level (greedy moves, restack, trim from the released board) and keep the first that passes.
//   MECH=1 NARROW_TRAP=core node detower_all.js 253,255,...   -> footprint60/detower/level-<n>.json (+ summary line per level)
const D = require('./detower.js'), fs = require('fs'), path = require('path');
const OUT = path.resolve(__dirname, '../../../analysis/builder/footprint60/detower');
for (const lv of process.argv[2].split(',').map(Number)) {
  const t0 = Date.now(), log = [];
  let r = null;
  for (const [name, fn] of [['greedy', () => D.run(lv)], ['greedy-loose', () => D.run(lv, { loose: true })], ['restack', () => D.restackRun(lv)], ['trim', () => D.trimRun(lv)], ['trim-route', () => D.trimRun(lv, { routeMoves: true })]]) {
    try { r = fn(); } catch (e) { log.push(name + ': error ' + e.message.slice(0, 120)); r = null; continue; }
    log.push(name + ': ' + (r.ok ? 'OK' : (r.tried || []).map(t => (t.why || (t.errors || []).join(',')) + (t.shape ? ' straight ' + t.shape.straight : '')).join(' | ')));
    if (r.ok) { r.method = r.method || name; fs.writeFileSync(path.join(OUT, `level-${lv}.json`), JSON.stringify({ ...r, log }, null, 1)); break; }
  }
  if (!r || !r.ok) fs.writeFileSync(path.join(OUT, `level-${lv}.json`), JSON.stringify({ level: lv, ok: false, log }, null, 1));
  console.log(JSON.stringify({ level: lv, ok: !!(r && r.ok), method: r && r.ok ? r.method : null, shape: r && r.ok ? (r.shape.after || r.shape) : null, s: Math.round((Date.now() - t0) / 1000), log: r && r.ok ? undefined : log }));
}
