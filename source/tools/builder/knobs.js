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
// Reframe an existing matching puzzle instead of rebuilding its pictures around
// a new clock route. Only the clock and the solver's witness may change. This is
// a construction control; the new board still needs static/trace/bot checks.
function clockTile(design, tile, spare, options = {}) {
  if (!design.clock) return { fail: 'noClock' };
  if (!Number.isInteger(tile) || tile < 0 || tile >= design.tiles.length) return { fail: 'invalidClockTile' };
  if (!Number.isInteger(spare) || spare < 1 || spare > 3) return { fail: 'invalidSpare' };
  if ((design.down || []).includes(tile)) return { fail: 'clockWouldBeHidden' };
  const copy = JSON.parse(JSON.stringify(design));
  copy.clock = { i: tile, n: 99 };
  const limits = { nodes: 400000, ms: Infinity, finishNodes: 300000, finishMs: Infinity, ...options };
  const gameWay = E.clockShortest(E.game(copy), limits);
  if (!gameWay || gameWay.unsure) return { fail: 'minimumUnproven' };
  if (gameWay.k + spare > 19) return { fail: 'clockTooDeep', minimum: gameWay.k };
  const strict = E.clockShortest(E.game(copy, { strict: true }), limits);
  if (!strict || strict.unsure) return { fail: 'strictMinimumUnproven' };
  if (strict.k !== gameWay.k) return { fail: 'peekShortcut', gameMinimum: gameWay.k, strictMinimum: strict.k };
  copy.clock.n = gameWay.k + spare;
  copy.solution = E.flatten(strict.path);
  if (!E.replay(copy, copy.solution).ok || !E.replay(copy, copy.solution, { strict: true }).ok) return { fail: 'witnessUnproven' };
  return { design: copy, descriptor: 'frame.clockTile', before: design.clock.i, after: tile,
    proof: { minimum: gameWay.k, strictMinimum: strict.k, spare, witness: true, changed: ['clock', 'solution'],
      preserved: ['tiles', 'faces', 'down', 'gold', 'obst'], scope: 'legal construction, not difficulty or quality acceptance' } };
}
module.exports = { clockSpare, clockTile };
