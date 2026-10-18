'use strict';
const { visibleKnowledge, exitsOf } = require('./physical_tray_audit.js');

function pairFollowThroughSamples(game, frames, decisions) {
  if (game.faces.some(face => face >= 100) || frames.length !== decisions.length) return [];
  const known = game.memory ? [...game.memory] : game.faces.map(() => 0), samples = [];
  let state = { alive: game.faces.map(() => 1), tray: [], openPeek: -1, moves: 0 }, relieved = false;
  for (const [position, frame] of frames.entries()) {
    visibleKnowledge(game, state, known);
    const before = exitsOf(game, state, known, relieved);
    relieved = before.relieved;
    const decision = decisions[position], feature = decision.F[decision.k], next = frames[position + 1];
    if (next && feature?.[19] && frame.kind === 'flip' && known[frame.index] && frame.openPeek === frame.index
      && (!game.clock || !frame.alive[game.clock.i])) {
      const twins = before.pairs.filter(pair => pair.includes(frame.index)).map(pair => pair.find(index => index !== frame.index));
      if (twins.length) samples.push({ tray: frame.tray.length, followed: next.kind === 'take'
        && (next.index === frame.index || twins.includes(next.index)) && !next.alive[next.index],
        completed: next.kind === 'take' && twins.includes(next.index) && !next.alive[frame.index] && !next.alive[next.index] });
    }
    known[frame.index] = 1;
    for (let index = 0; index < frame.alive.length; index++) if (state.alive[index] && !frame.alive[index]) known[index] = 1;
    visibleKnowledge(game, frame, known);
    state = frame;
  }
  return samples;
}

module.exports = { pairFollowThroughSamples };
