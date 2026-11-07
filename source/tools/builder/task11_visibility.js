'use strict';
// Read-only check of the earlier ratings; no new bot calls or edited boards.
const path = require('path'), fs = require('fs'), M = require('../factory/meter.js'), P = require('./task11_plan.js'), K = require('./task11_keys.js'), A = require('./task11_analyze.js'), R = require('./task11_report.js');
function run(root) {
  const source = P.read(path.resolve(__dirname, '../../analysis/builder/knobs-v1/boards.json')), plan = P.read(path.join(root, 'selection-plan.json'));
  if (M.digest(source) !== plan.source) throw Error('Prior measured dataset changed');
  const eligible = source.filter(b => !b.fail && b.family && b.skilled && !b.design.obst.keys.some(k => b.design.obst.ice[k]));
  const rows = eligible.map(b => ({ id: b.id, story: b.brief.story, family: b.family.exp, skilled: b.skilled.exp, way: b.card.clock.fewestMoves,
    ...K.features(b.design), keysTakenBeforeClock: b.design.obst.keys.length > 0 && b.design.obst.keys.every(k => b.design.solution.indexOf(k) < b.design.solution.indexOf(b.design.clock.i)) }));
  const aggregate = a => ({ n: a.length, familyMedian: A.median(a.map(x => x.family)), skilledMedian: A.median(a.map(x => x.skilled)),
    family18plus: a.filter(x => x.family >= 18).length, family18plusShare: A.share(a.filter(x => x.family >= 18).length, a.length), familyWayRankCorrelation: R.spearman(a.map(x => x.way), a.map(x => x.family)) });
  const visibility = {}, beforeClock = {}, wayStrata = [];
  for (const shown of [0, 1, 2]) { visibility[shown] = aggregate(rows.filter(r => r.hasKeys && r.keysShownAtStart === shown)); beforeClock[shown] = aggregate(rows.filter(r => r.hasKeys && r.keysTakenBeforeClock && r.keysShownAtStart === shown));
    for (const [lo, hi] of [[0, 11], [12, 14], [15, 17], [18, 99]]) wayStrata.push({ shown, ways: [lo, hi], ...aggregate(rows.filter(r => r.hasKeys && r.keysShownAtStart === shown && r.way >= lo && r.way <= hi)) });
  }
  const result = { sourceRequests: source.length, ratedWithoutFrozenKeys: rows.length, noKeys: rows.filter(r => !r.hasKeys).length, visibility, keysTakenBeforeClock: beforeClock, wayStrata, rows,
    note: 'Existing full Task10 ratings only; all actually frozen keys excluded. Actual public key glyphs, not merely a potentially visible role-overlay region. No-key boards are separate. Later key goals after the clock are separated from keys taken before it on the stored route. Capped ties use average ranks. These are descriptive associations, not a new causal effect or a claim about humans.' };
  P.save(root, 'key-visibility-recheck.json', result);
  const lines = ['# Key visibility: recheck of the earlier full ratings', '', result.note, '',
    '| visible keys at start | boards | family median | skilled median | family18+ | share18+ | within-group family/way rank correlation |', '|---|---:|---:|---:|---:|---:|---:|'];
  for (const [k, x] of Object.entries(visibility)) lines.push(`| ${k} | ${x.n} | ${x.familyMedian} | ${x.skilledMedian} | ${x.family18plus} | ${x.family18plusShare} | ${x.familyWayRankCorrelation} |`);
  lines.push('', 'The JSON also repeats these comparisons only for keys taken before the clock and splits each visibility group by actual route length. Source-request failures have no fabricated ratings. All later-key goals and no-key boards remain identifiable.', '');
  fs.writeFileSync(path.join(root, 'KEY-VISIBILITY.md'), lines.join('\n')); return result;
}
if (require.main === module) console.log(run(path.resolve(process.argv[2])).visibility);
module.exports = { run };
