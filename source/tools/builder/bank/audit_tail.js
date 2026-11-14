'use strict';
// node .../audit_tail.js <out.json> <folder> [<folder> ...]
// Heavy jobs: invoke through loop/heavy.js. Per-query wall and node limits.
const fs = require('fs'), path = require('path'), Tl = require('./tail.js');
function main() {
  const [out, ...dirs] = process.argv.slice(2), rows = [];
  if (!out || !dirs.length) throw new Error('usage: audit_tail.js <out.json> <folder> ...');
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  for (const dir of dirs) for (const file of fs.readdirSync(dir).filter(f => /^level-\d+\.json$/.test(f)).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const full = Tl.forcedPressure(j.design, { scope: process.env.TAIL_SCOPE || 'board', nodes: 200000, ms: 1200 }), { solution, path: acts, ...forced } = full;
    const row = { level: j.level, dir, file, source: j.source || j.card?.poolId, forced, occupancy: Tl.occupancy(j.design) };
    rows.push(row); fs.writeFileSync(out, JSON.stringify(rows, null, 1) + '\n');
    console.log(j.level, forced.cap1.result, forced.cap2.result, 'episodes', forced.episodes.lowerBound + '..' + forced.episodes.upperBound, forced.targetMet ? 'PASS' : 'needs work');
  }
}
if (require.main === module) main();
