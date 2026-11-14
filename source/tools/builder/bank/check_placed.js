#!/usr/bin/env node
'use strict';
// Quick independent check of a folder of placed levels (level-<n>.json with a design): strict replay, clock n against the
// engine's proven shortest clock route, specials face-up, visible close twins, face-down share. No story proof code.
//   node source/tools/builder/bank/check_placed.js <folder> [<reference folder for the spare>]
const fs = require('fs'), path = require('path');
const E = require('../engine.js'), SEP = require('./separate.js');
const dir = path.resolve(process.argv[2]), ref = process.argv[3] && path.resolve(process.argv[3]);
let bad = 0; const rows = [];
for (const f of fs.readdirSync(dir).filter(f => /^level-\d+\.json$/.test(f)).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), d = j.design, why = [];
  if (!E.replay(d, d.solution, { strict: true }).ok) why.push('replay');
  const cs = E.clockShortest(E.game(JSON.parse(JSON.stringify(d))), { nodes: 400000, ms: 30000 });
  const spare = cs && !cs.unsure ? d.clock.n - cs.k : null;
  if (spare === null) why.push('k unsure'); else if (spare < 1) why.push('spare ' + spare);
  if (ref && fs.existsSync(path.join(ref, f))) { const o = JSON.parse(fs.readFileSync(path.join(ref, f), 'utf8')).design; if (o.clock.n !== d.clock.n || o.clock.i !== d.clock.i) why.push('clock changed'); if (JSON.stringify(o.obst) !== JSON.stringify(d.obst) || JSON.stringify(o.tiles) !== JSON.stringify(d.tiles)) why.push('board changed'); }
  const sp = new Set([d.clock.i, ...(d.obst.locks || []), ...(d.obst.keys || []), ...Object.keys(d.obst.ice || {}).map(Number)]);
  if ((d.down || []).some(i => sp.has(i))) why.push('special face-down');
  const ds = (d.down || []).length / d.tiles.length; if (ds > 0.3001) why.push('faceDown ' + ds.toFixed(3));
  let vis = null; if (/^batch/.test(j.source || 'batch')) { vis = SEP.closeTwins(d).visible; if (vis) why.push('visible twins ' + vis); }
  if (why.length) bad++;
  rows.push(`${f} ${j.source || ''} n=${d.clock.n} spare=${spare} down=${ds.toFixed(3)} ${why.length ? 'FAIL ' + why.join(', ') : 'ok'}`);
}
console.log(rows.join('\n')); console.log(bad ? bad + ' level(s) fail' : 'all ok'); process.exit(bad ? 1 : 0);
