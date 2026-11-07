'use strict';
const fs = require('fs'), path = require('path'), M = require('../factory/meter.js'), O = require('../factory/originality.js'), P = require('./task11_plan.js'), S = require('./task10_study.js');
function check(root, ratingRoot) {
  const source = path.resolve(__dirname, '../../analysis/builder/knobs-v1'), plan = P.read(path.join(source, 'baseline-plan.json'));
  const kept = fs.readFileSync(path.join(source, 'levels.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse), previous = O.previousBoards(plan.levels, plan.levelTable).concat(kept);
  const ladder = S.collect(path.join(root, 'ladder-readable')), ratings = ratingRoot ? new Map(S.collect(ratingRoot).boards.map(b => [M.boardKey(b.design), b])) : null;
  const unique = [...new Map(ladder.boards.filter(b => !b.fail).map(b => [M.boardKey(b.design), b])).values()];
  const layouts = new Map();
  const rows = unique.map(b => {
    const r = ratings?.get(M.boardKey(b.design)) || b, layout = O.layoutKey(b.design);
    if (!layouts.has(layout)) {
      const same = previous.find(p => O.layoutKey(p.design) === layout);
      let match = same ? { level: same.level, reason: 'sameLayout' } : null;
      if (!match) for (const p of previous) { const reason = O.compare(b, p); if (reason) { match = { level: p.level, reason }; break; } }
      layouts.set(layout, match);
    }
    const match = layouts.get(layout);
    return { id: b.id, boardKey: M.boardKey(b.design), family: r.family?.exp, skilled: r.skilled?.exp,
      bothBands: !!(r.family && r.skilled && r.family.exp >= 10 && r.family.exp <= 13 && r.skilled.exp >= 2.5 && r.skilled.exp <= 6),
      originality: match || null, freshOrigin: O.checkOrigin(b), originalLayout: !match };
  });
  const out = { rating: ratingRoot ? 'new key-memory candidate' : 'released reference', physicalBoards: rows.length, bothBands: rows.filter(r => r.bothBands).length,
    originalInBothBands: rows.filter(r => r.bothBands && r.originalLayout && !r.freshOrigin).length, rows,
    decision: 'Existing ladder designs only. A reused historical/kept silhouette or missing fresh-design provenance cannot qualify. No bot quality calls are spent on statically rejected boards; no construction is commissioned for missing slots.' };
  P.save(root, ratingRoot ? 'incidental-candidate.json' : 'incidental-reference.json', out);
  if (out.originalInBothBands) throw Error('Original in-band ladder boards require full Task9 quality/fresh/window/phone qualification before handback');
  return out;
}
if (require.main === module) { const r = check(path.resolve(process.argv[2]), process.argv[3] && path.resolve(process.argv[3])); console.log({ physicalBoards: r.physicalBoards, bothBands: r.bothBands, originalInBothBands: r.originalInBothBands }); }
module.exports = { check };
