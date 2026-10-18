'use strict';
const Hard = require('../../../www/hard.js');
const { visibleKnowledge, exitsOf } = require('./physical_tray_audit.js');

function trayGoalSamples(game, frames, decisions, limit = 8) {
  if (game.faces.some(face => face >= 100) || frames.length !== decisions.length) return [];
  const known = game.memory ? Array.from(game.memory) : game.faces.map(() => 0), samples = [];
  let state = { alive: game.faces.map(() => 1), tray: [], openPeek: -1, moves: 0, relieved: false }, cue = null;
  for (const [position, frame] of frames.entries()) {
    visibleKnowledge(game, state, known);
    state.relieved = exitsOf(game, state, known, state.relieved).relieved;
    const decision = decisions[position], action = { index: frame.index, inspect: !!decision.F[decision.k]?.[19] };
    if (cue) {
      const info = Hard.trayGoalInfo(game, state, known, cue.face);
      if (info) {
        if (info.legal.actions.length !== decision.F.length || info.legal.actions[decision.k].index !== frame.index
          || info.legal.actions[decision.k].inspect !== action.inspect) throw new Error('Tray-goal choices differ from physical policy instrumentation');
        const allowed = info.legal.actions.map(candidate => (candidate.inspect ? info.inspect : info.take).has(candidate.index));
        if (allowed.some(Boolean) && allowed.some(value => !value)) samples.push({ tray: state.tray.length,
          age: Math.min(2, cue.age), depth: info.depth, followed: allowed[decision.k],
          context: Hard.trayGoalContext(state.tray.length, cue.age, info.depth, allowed.filter(Boolean).length / allowed.length),
          completed: !frame.tray.includes(cue.face), allowed, selected: decision.k, decision: position });
      }
    }
    const after = { ...frame, relieved: state.relieved };
    cue = Hard.advanceTrayGoal(game, state, after, known, cue, action, limit);
    known[frame.index] = 1;
    for (let index = 0; index < frame.alive.length; index++) if (state.alive[index] && !frame.alive[index]) known[index] = 1;
    visibleKnowledge(game, after, known);
    state = after;
  }
  return samples;
}

module.exports = { trayGoalSamples };
