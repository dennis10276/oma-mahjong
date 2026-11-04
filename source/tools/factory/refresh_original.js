'use strict';
const fs = require('fs'), path = require('path');
const { checkOrigin, layoutKey } = require('./originality.js');
const { atomicJson } = require('./meter.js');
function refresh(planFile, sources, output) {
  const plan = JSON.parse(fs.readFileSync(planFile));
  const piles = JSON.parse(fs.readFileSync(path.resolve(path.dirname(planFile), plan.piles)));
  const layouts = new Map(piles.map(p => [p.level, layoutKey(p)])), rows = new Map();
  for (const file of sources) if (fs.existsSync(file)) for (const r of JSON.parse(fs.readFileSync(file))) {
    if (checkOrigin(r)) throw Error('Pool rejected nonoriginal source: ' + file);
    // A replaced whole layout invalidates all of its earlier tuning siblings.
    if (r.origin.initialLayout !== layouts.get(r.origin.creationSlot ?? r.origin.intendedLevel)) continue;
    rows.set(r.id, r);
  }
  atomicJson(output, [...rows.values()]); return rows.size;
}
module.exports = { refresh };
if (require.main === module) console.log(refresh(process.argv[2], process.argv.slice(4), process.argv[3]), 'fresh candidates');
