'use strict';
const assert = require('assert/strict');
const { observeBoard } = require('./human_board_visibility.js');

function createInformationPlayout({ game, session, candidate, memory, createPolicy, roleAt, deadline, now = Date.now }) {
  assert(Number.isInteger(candidate) && Number.isFinite(deadline));
  assert.equal(typeof createPolicy, 'function'); assert.equal(typeof roleAt, 'function');
  const size = game.tiles.length, path = [], visits = new Set();
  let rejected = 0, decisions = 0, policy = null, observedTap = -1;
  const startLeft = session.view().state.alive.reduce((sum, alive) => sum + alive, 0);
  const summarize = (status, reason = null) => {
    const frame = session.view(), left = frame.state.alive.reduce((sum, alive) => sum + alive, 0);
    return { kind: 'informationPlayout', status, path: path.slice(), decisions, rejected,
      removed: startLeft - left, remaining: left, observedFact: false, reason };
  };
  function* steps() {
    if (now() >= deadline) return summarize('unresolved');
    const accepted = session.view().legalTiles.includes(candidate);
    if (accepted) { session.tap(candidate); path.push(candidate); }
    if (session.view().type === 'productionPhysicalEnd-v1') {
      const terminal = session.view();
      return summarize(terminal.win ? 'cleared' : terminal.computationCensored ? 'unresolved' : 'lost');
    }
    yield;
    for (;;) {
      const frame = session.view();
      if (frame.type === 'productionPhysicalEnd-v1') return summarize(frame.win ? 'cleared' : frame.computationCensored ? 'unresolved' : 'lost');
      if (now() >= deadline || decisions >= 512 || rejected >= size * 2) return summarize('unresolved');
      if (!policy) {
        policy = createPolicy(deadline); policy.rememberPublic(memory); policy.beginAttempt();
        if (frame.state.physicalTaps > 0) policy.observe({ alive: Array(size).fill(1), tray: [], moves: 0,
          openPeek: -1, relieved: false, arriving: [], physicalTaps: 0 },
        { pictures: Array(size).fill(null), down: Array(size).fill(null), roles: Array(size).fill(null), clock: game.clock });
      }
      if (frame.state.physicalTaps !== observedTap) {
        const physical = Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps']
          .map(field => [field, frame.state[field]]));
        policy.observe(physical, observeBoard(game.tiles, frame.state, game.clock,
          { picture: index => game.faces[index], role: index => roleAt(game, frame.state, index) }));
        observedTap = frame.state.physicalTaps;
      }
      if (!accepted && decisions === 0) { policy.acknowledge(candidate, false); rejected++; }
      const selected = policy.decide(); decisions++;
      if (!selected || now() >= deadline) return summarize('unresolved');
      const index = selected.plan.index, allowed = frame.legalTiles.includes(index);
      const identity = JSON.stringify([frame.state.alive, frame.state.tray, frame.state.moves, frame.state.openPeek,
        frame.state.relieved, frame.state.arriving, policy.knowledgeSignature(), index]);
      if (visits.has(identity)) return summarize('unresolved', 'repeatedPublicChoice');
      visits.add(identity); policy.acknowledge(index, allowed);
      if (allowed) { session.tap(index); path.push(index); }
      else rejected++;
      if (session.view().type === 'productionPhysicalEnd-v1') {
        const terminal = session.view();
        return summarize(terminal.win ? 'cleared' : terminal.computationCensored ? 'unresolved' : 'lost');
      }
      yield;
    }
  }
  const iterator = steps();
  return { next: () => iterator.next(), snapshot: () => summarize('unresolved') };
}

function interleavePlayouts(runners, { deadline, now = Date.now }) {
  assert(Array.isArray(runners) && runners.length > 0 && Number.isFinite(deadline));
  const reports = Array(runners.length).fill(null), started = new Set();
  let pending = runners.length, rounds = 0;
  while (pending && now() < deadline) {
    rounds++;
    for (const [index, runner] of runners.entries()) {
      if (reports[index] || now() >= deadline) continue;
      const step = runner.next(); started.add(index);
      if (step.done) {
        reports[index] = now() < deadline ? step.value : { ...step.value, status: 'unresolved' };
        pending--;
      }
    }
  }
  return { reports: reports.map((report, index) => report || runners[index].snapshot()),
    allStarted: started.size === runners.length, rounds };
}

module.exports = { createInformationPlayout, interleavePlayouts };
