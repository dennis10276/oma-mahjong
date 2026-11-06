'use strict';
const E = require('./engine.js');

// Change one construction parameter while preserving the complete puzzle and its witness.
// Derived losing-choice counts can change with the deadline; these are effects, not extra edits.
function clockSpare(design, spare, options = {}) {
  if (!Number.isInteger(spare) || spare < 0) return { fail: 'invalidSpare' };
  if (!design.clock) return { fail: 'noClock' };
  const copy = JSON.parse(JSON.stringify(design));
  const way = E.clockShortest(E.game(copy), { nodes: options.nodes ?? 400000, ms: options.ms ?? 5000 });
  if (!way || way.unsure) return { fail: 'minimumUnproven' };
  const before = copy.clock.n;
  copy.clock.n = way.k + spare;
  const witness = E.replay(copy, copy.solution);
  if (!witness.ok) return { fail: 'witnessWouldChange', detail: witness };
  return { design: copy, descriptor: 'frame.spareGame', before: before - way.k, after: spare,
    proof: { minimum: way.k, witness: true, changed: ['clock.n'] } };
}
module.exports = { clockSpare };
