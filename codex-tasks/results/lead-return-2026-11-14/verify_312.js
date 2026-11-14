'use strict';
// Read-only answer to the mechanical part of Dennis's level-312 question.
// This does not infer which moves Dennis made from aggregate try results.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const OUT = __dirname, SHARED = path.resolve(OUT, '../../../..'), CC = path.join(SHARED, 'cc-builder-loop');
const E = require(path.join(CC, 'source/tools/builder/engine.js'));
const lab = JSON.parse(fs.readFileSync(path.join(OUT, 'port8264-served-boards.json'), 'utf8'));
const d = lab.ideas.find(x => x.id === 2041312).board;
const cardFile = path.join(CC, 'source/analysis/builder/bank/chained-v1/examples/lookalikeWay-L14-s3-p1.json');
const original = JSON.parse(fs.readFileSync(cardFile, 'utf8'));
if (JSON.stringify([d.tiles, d.obst, d.clock.i]) !== JSON.stringify([original.design.tiles, original.design.obst, original.design.clock.i])) throw new Error('Historical bait indices cannot be transferred: geometry/specials differ');
const replay = E.replay(d, d.solution, { strict: true });
const k = E.clockShortest(E.game(structuredClone(d)), { nodes: 600000, ms: 8000, finishNodes: 200000, finishMs: 2000 });
const baits = [];
for (const b of original.card.trap.baits) {
  const g = E.game(structuredClone(d)); let s = E.start(g), illegal = null;
  try { for (const i of b.tiles) s = s && E.step(g, s, i); } catch (e) { illegal = String(e); }
  const r = illegal ? { result: 'illegal', reason: illegal } : s ? E.winnable(g, s, { nodes: 1000000, ms: 5000 }) : { result: 'lose', reason: 'immediate loss' };
  baits.push({ offeredTiles: b.tiles, resultAtShippedClock: r.result, nodes: r.nodes || 0, sourceBaitFacesUnchanged: b.tiles.every(i => d.faces[i] === original.design.faces[i]), ...(r.reason ? { reason: r.reason } : {}) });
}
const result = { checkedAtUtc: new Date().toISOString(), labPort: 8264, id: 2041312, level: 312, source: 'chained lookalikeWay-L14-s3-p1',
  designSha256: crypto.createHash('sha256').update(JSON.stringify(d)).digest('hex'), strictReplay: replay,
  clock: { n: d.clock.n, k: k?.k, unresolvedMinimum: !k || !!k.unsure }, designatedBaits: baits,
  limitation: 'The saved localhost ratings contain outcomes, remaining tiles and durations, but no per-move trace of these attempts. A designated bait being losing does not establish that Dennis chose it. His six unsuccessful attempts cannot be attributed from this data.' };
fs.writeFileSync(path.join(OUT, 'level312-mechanical-check.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result, null, 2));
