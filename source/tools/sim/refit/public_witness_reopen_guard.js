'use strict';
const assert = require('assert/strict');
const physical = require('./known_tray_plan.js');

function guardedSearch(search, options = {}) {
  assert.equal(typeof search, 'function'); assert(Object.keys(options).every(key => key === 'progressEscape'));
  const progressEscape = options.progressEscape ?? false; assert.equal(typeof progressEscape, 'boolean');
  return (game, state, actions, settings = {}) => {
    const primary = search(game, state, actions, settings);
    if (primary.knownWin || primary.safeClockExit) return primary;
    const hasOther = actions.some(action => !action.inspect || state.pictures[action.index] === null
      || state.tray.includes(state.pictures[action.index]) || state.openPeek >= 0 && action.index !== state.openPeek
      && state.pictures[action.index] === state.pictures[state.openPeek]);
    const excluded = hasOther ? actions.filter(action => action.inspect && state.pictures[action.index] !== null
      && !state.tray.includes(state.pictures[action.index]) && !(state.openPeek >= 0 && action.index !== state.openPeek
        && state.pictures[action.index] === state.pictures[state.openPeek])) : [];
    if (!excluded.length) return primary;
    excluded.sort((left, right) => +(right.index === game.clock?.i) - +(left.index === game.clock?.i));
    const limit = settings.nodes ?? 1024; assert(Number.isInteger(limit) && limit > 0);
    let nodes = primary.nodes, selected = null, allExcludedDead = true, tested = 0;
    const canProveWitness = !!(game.clock && state.alive[game.clock.i])
      || state.pictures.every((picture, index) => !state.alive[index] || picture !== null);
    const immediatelyLoses = progressEscape && physical.advance(game, state, primary.index).lost;
    for (const action of excluded) {
      if (!canProveWitness && !progressEscape) { allExcludedDead = false; break; }
      if (nodes >= limit) { allExcludedDead = false; break; }
      const alternative = search(game, state, [action], { ...settings, nodes: limit - nodes });
      nodes += alternative.nodes; tested++; allExcludedDead &&= alternative.knownDead;
      if (alternative.knownWin || alternative.safeClockExit) { selected = alternative; break; }
      if (immediatelyLoses && alternative.knownProgress > 0 && !alternative.knownDead && !selected) selected = alternative;
    }
    const result = selected || primary, knownDead = result.knownDead && allExcludedDead && tested === excluded.length;
    return { ...result, nodes, knownDead, deadCertificate: knownDead ? result.deadCertificate : null,
      goal: result.knownDead && !knownDead ? 'unresolvedHeuristicRootPruning' : result.goal,
      boundary: result.boundary || tested < excluded.length && !selected,
      reopenAudit: { tested, excluded: excluded.map(action => action.index), selected: selected?.index ?? null,
        primaryIndex: primary.index, primaryKnownDead: primary.knownDead, sharedNodeLimit: limit,
        note: 'Known reopens require a constructive win/clock-exit witness, or optionally guaranteed progress instead of an immediate physical loss. All probes share the original node budget. A heuristic root exclusion alone cannot certify a dead end.' } };
  };
}

module.exports = { guardedSearch };
