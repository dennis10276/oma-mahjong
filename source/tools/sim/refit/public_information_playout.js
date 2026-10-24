'use strict';
const assert = require('assert/strict');
const { observeBoard } = require('./human_board_visibility.js');

function informationPlayout({ game, session, candidate, memory, createPolicy, roleAt, deadline, now = Date.now }) {
  assert(Number.isInteger(candidate) && Number.isFinite(deadline));
  assert.equal(typeof createPolicy, 'function'); assert.equal(typeof roleAt, 'function');
  const size = game.tiles.length, path = [];
  let rejected = 0, decisions = 0, policy = null, observedTap = -1;
  const startLeft = session.view().state.alive.reduce((sum, alive) => sum + alive, 0);
  const summarize = status => {
    const frame = session.view(), left = frame.state.alive.reduce((sum, alive) => sum + alive, 0);
    return { kind: 'informationPlayout', status, path, decisions, rejected,
      removed: startLeft - left, remaining: left, observedFact: false };
  };
  if (now() >= deadline) return summarize('unresolved');
  const initial = session.view(), accepted = initial.legalTiles.includes(candidate);
  if (accepted) { session.tap(candidate); path.push(candidate); }
  const initialize = frame => {
    policy = createPolicy(deadline);
    policy.rememberPublic(memory); policy.beginAttempt();
    if (frame.state.physicalTaps > 0) policy.observe({ alive: Array(size).fill(1), tray: [], moves: 0,
      openPeek: -1, relieved: false, arriving: [], physicalTaps: 0 },
    { pictures: Array(size).fill(null), down: Array(size).fill(null), roles: Array(size).fill(null), clock: game.clock });
  };
  for (;;) {
    const frame = session.view();
    if (frame.type === 'productionPhysicalEnd-v1') return summarize(frame.win ? 'cleared' : frame.computationCensored ? 'unresolved' : 'lost');
    if (now() >= deadline || decisions >= 512 || rejected >= size * 2) return summarize('unresolved');
    if (!policy) initialize(frame);
    if (frame.state.physicalTaps !== observedTap) {
      const physical = Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps']
        .map(field => [field, frame.state[field]]));
      const observation = observeBoard(game.tiles, frame.state, game.clock,
        { picture: index => game.faces[index], role: index => roleAt(game, frame.state, index) });
      policy.observe(physical, observation); observedTap = frame.state.physicalTaps;
    }
    if (!accepted && decisions === 0) { policy.acknowledge(candidate, false); rejected++; }
    const selected = policy.decide(); decisions++;
    if (!selected || now() >= deadline) return summarize('unresolved');
    const index = selected.plan.index, allowed = frame.legalTiles.includes(index);
    policy.acknowledge(index, allowed);
    if (allowed) { session.tap(index); path.push(index); }
    else rejected++;
  }
}

module.exports = { informationPlayout };
