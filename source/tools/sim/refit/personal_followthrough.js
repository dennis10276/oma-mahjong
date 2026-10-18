'use strict';
const { visibleKnowledge, exitsOf } = require('./physical_tray_audit.js');

function followThroughSamples(game, frames, decisions) {
  if (game.faces.some(face => face >= 100) || frames.length !== decisions.length) return [];
  const known = game.faces.map(() => 0), samples = [];
  let state = { alive: game.faces.map(() => 1), tray: [], openPeek: -1, moves: 0 }, relieved = false;
  for (const [position, frame] of frames.entries()) {
    visibleKnowledge(game, state, known);
    const before = exitsOf(game, state, known, relieved), frozen = known.slice();
    relieved = before.relieved;
    const decision = decisions[position], feature = decision.F[decision.k], next = frames[position + 1];
    const after = exitsOf(game, frame, frozen, relieved);
    relieved = after.relieved;
    if (next && feature && !feature[19] && frame.kind === 'take' && frame.tray.length > 0 && frame.tray.length < 4
      && (!game.clock || !frame.alive[game.clock.i]) && after.matches.length) {
      samples.push({ tray: frame.tray.length, followed: next.kind === 'take' && after.matches.includes(next.index) });
    }
    known[frame.index] = 1;
    for (let index = 0; index < frame.alive.length; index++) if (state.alive[index] && !frame.alive[index]) known[index] = 1;
    visibleKnowledge(game, frame, known);
    state = frame;
  }
  return samples;
}

module.exports = { followThroughSamples };
