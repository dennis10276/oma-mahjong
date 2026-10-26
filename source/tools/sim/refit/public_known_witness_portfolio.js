'use strict';
const assert = require('assert/strict');
const { legal, advance } = require('./known_tray_plan.js');
const { clockExitPrefix } = require('./public_clock_retry_exploration.js');

function createKnownWitnessPortfolio(primarySearch, options = {}, secondarySearch = primarySearch) {
  assert.equal(typeof primarySearch, 'function'); assert.equal(typeof secondarySearch, 'function');
  const milliseconds = options.milliseconds ?? 250, nodeLimit = options.nodes ?? 4096, choices = options.choices ?? 512;
  assert(Number.isFinite(milliseconds) && milliseconds > 0 && milliseconds <= 500);
  assert(Number.isInteger(nodeLimit) && nodeLimit > 0);
  assert(Number.isInteger(choices) && choices > 0);
  const counters = { considered: 0, incomplete: 0, searched: 0, wins: 0, clockExits: 0,
    rejectedWitnesses: 0, deadlineStops: 0, extraNodes: 0, maximumExtraMs: 0 };
  const search = (game, state, actions, settings = {}) => {
    const began = Date.now(), deadline = Math.min(settings.deadline ?? Infinity, began + 1800);
    const primary = primarySearch(game, state, actions, settings);
    if (primary.knownWin || primary.safeClockExit || primary.knownDead) return primary;
    counters.considered++;
    if (state.alive.some((alive, index) => alive && (state.pictures[index] === null || state.down[index] === null))) {
      counters.incomplete++; return primary;
    }
    const remaining = choices - (state.physicalTaps ?? 0);
    if (remaining <= 0 || Date.now() >= deadline) return primary;
    const extraBegan = Date.now(), extraDeadline = Math.min(deadline, extraBegan + milliseconds);
    const alternative = secondarySearch(game, state, actions, { ...settings, decisionMs: undefined,
      deadline: extraDeadline, nodes: nodeLimit, diverseWitness: false, diverseBeam: true,
      finishKnownMaxTaps: Math.min(256, remaining) });
    assert(Number.isInteger(alternative.nodes) && alternative.nodes >= 0 && alternative.nodes <= nodeLimit);
    counters.searched++; counters.extraNodes += alternative.nodes;
    let verified = null;
    const eligible = Array.isArray(alternative.path) && alternative.path.length > 0
      && alternative.path.length <= remaining && alternative.path[0] === alternative.index
      && actions.some(action => action.index === alternative.index);
    if (eligible && alternative.knownWin) {
      let position = state, valid = true;
      for (const index of alternative.path) {
        if (Date.now() >= extraDeadline || !legal(game, position).free.includes(index)) { valid = false; break; }
        const moved = advance(game, position, index);
        if (moved.uncertain || moved.lost) { valid = false; break; }
        position = moved.state;
      }
      if (valid && Date.now() < extraDeadline && !position.alive.some(Boolean) && position.tray.length === 0) {
        verified = { ...alternative, knownWin: true, knownDead: false, safeClockExit: false,
          goal: 'win', information: false, boundary: false }; counters.wins++;
      }
    }
    if (!verified && eligible && alternative.safeClockExit && game.clock && state.alive[game.clock.i]) {
      const proof = clockExitPrefix(game, state, alternative.path, extraDeadline);
      if (proof && Date.now() < extraDeadline && proof.path.length <= remaining) {
        verified = { ...alternative, index: proof.path[0], path: proof.path, knownWin: false,
          knownDead: false, safeClockExit: true, goal: 'clockExit', information: false, boundary: false };
        counters.clockExits++;
      }
    }
    counters.rejectedWitnesses += +(!verified && !!(alternative.knownWin || alternative.safeClockExit));
    counters.deadlineStops += +(Date.now() >= extraDeadline);
    counters.maximumExtraMs = Math.max(counters.maximumExtraMs, Date.now() - extraBegan);
    return { ...(verified ?? primary), nodes: (primary.nodes ?? 0) + alternative.nodes,
      knownWitnessPortfolio: { selected: !!verified, primaryIndex: primary.index, alternativeIndex: alternative.index,
        primaryNodes: primary.nodes ?? 0, extraNodes: alternative.nodes, extraNodeLimit: nodeLimit,
        source: 'secondary diverse beam through fully known public pictures/orientations; only a validated complete win or safe clock-exit prefix replaces the primary' } };
  };
  return { search, stats: () => ({ ...counters }) };
}

module.exports = { createKnownWitnessPortfolio };
