'use strict';
const fs = require('fs'), path = require('path'), M = require('../factory/meter.js'), B = require('./builder.js');
const read = f => JSON.parse(fs.readFileSync(f));
const save = (dir, f, x) => M.atomicJson(path.join(dir, f), x);
function select(boards) {
  const eligible = boards.filter(b => !b.fail && b.family && b.skilled && !(b.design.obst?.keys || []).some(k => b.design.obst.ice?.[k]));
  const bands = [['easy', 2, 6, 24], ['middle', 8, 14, 12], ['hard', 18, 20, 24]], selected = [];
  for (const [band, lo, hi, quota] of bands) {
    const remaining = eligible.filter(b => b.family.exp >= lo && b.family.exp <= hi).sort((a, b) => a.id.localeCompare(b.id));
    const counts = new Map(), geometry = new Map(), structures = new Map();
    while (remaining.length && selected.filter(b => b.band === band).length < quota) {
      const cost = b => (counts.get(b.brief.story) || 0) * 100000 + (structures.get(M.digest([b.design.tiles, b.design.clock.i, b.design.obst])) || 0) * 1000 + (geometry.get(M.digest(b.design.tiles)) || 0) * 10;
      remaining.sort((a, b) => cost(a) - cost(b) || a.id.localeCompare(b.id)); const b = remaining.shift();
      counts.set(b.brief.story, (counts.get(b.brief.story) || 0) + 1);
      const g = M.digest(b.design.tiles), s = M.digest([b.design.tiles, b.design.clock.i, b.design.obst]);
      geometry.set(g, (geometry.get(g) || 0) + 1); structures.set(s, (structures.get(s) || 0) + 1);
      selected.push({ ...b, band });
    }
  }
  return selected;
}
function prepare(dir) {
  const file = path.join(dir, 'selection-plan.json'); if (fs.existsSync(file)) return read(file);
  const source = path.resolve(__dirname, '../../analysis/builder/knobs-v1/boards.json'), boards = select(read(source));
  const pairs = [['keysFarSide', 14], ['clockInSight', 2], ['iceLockClock', 21], ['lockBeside', 28], ['roomInTrayLocked', 1], ['deepClock', 16]];
  const plan = { schema: 'task11-v1', created: new Date().toISOString(), upstream: '1f4e1ad', source: M.digest(read(source)), bot: M.createMeter().fingerprint,
    selection: '24 easy2–6, all12 middle8–14 available without frozen keys,24 hard18–20. Balance stories, then distinct puzzle structures, then geometry; id breaks ties. No frozen key (including chainReaction).',
    traces: { runs: 2, seeds: 1, seed: 4711, maxAttempts: 20, capture: true, profiles: ['family', 'planner-route', 'planner-plain'],
      note: 'Two exact first-campaign streams per profile; both planner styles retained, with the style winning the existing full rating marked separately. These samples do not replace full ratings. No early truncation of retries: retry memory is the study outcome.' },
    classification: { nodes: 30000, ms: 60, cap: 12, depthNodes: 1500,
      note: 'Classify every pre-tap state, including post-error states, with a shared physical-state cache per board. Unknown never means loss. A pure peek is an information-only no-op, not the hypothetical taking of its tile. Report requested losing-option counts and genuine win/lose forks separately. Depth is bounded longest survival after a proven losing action, not exact proof lookahead depth.' },
    ladder: { pairs: pairs.map(([story, layout]) => ({ story, layout, shape: B.LAYOUTS[layout].shape })), ways: [9, 10, 11, 12, 13, 14, 15], seeds: [1, 2, 3], spares: [1, 2],
      targets: { trayRoom: 0, hiddenOnWay: 0, luck: 0, traps: 0, maxDown: 0.3 },
      note: 'Spare1 is built; spare2 changes only the proven minimum-plus-spare clock, preserving the entire puzzle. Recompute forced pressure rather than copying its claim. All actual ways, hidden dig counts and readability failures retained; no board built for a slot.' },
    boards };
  plan.fingerprint = M.digest(plan); save(dir, 'selection-plan.json', plan); return plan;
}
if (require.main === module) { const p = prepare(path.resolve(process.argv[2])); console.log(p.boards.length, 'trace boards;', p.ladder.pairs); }
module.exports = { prepare, select, read, save };
