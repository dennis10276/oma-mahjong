'use strict';
const assert = require('assert/strict');
const physical = require('./known_tray_plan.js');

function describeKnownPath(game, state, path) {
  let position = state, maximumTray = state.tray.length;
  for (const [offset, index] of path.entries()) {
    const moved = physical.advance(game, position, index);
    if (moved.uncertain) return { safe: moved.reason === 'unseenPicture' && offset === path.length - 1,
      maximumTray, finalTray: position.tray.length, frontier: index, reason: moved.reason };
    if (moved.lost) return { safe: false, maximumTray: Math.max(maximumTray, moved.state.tray.length), finalTray: moved.state.tray.length, frontier: null };
    position = moved.state; maximumTray = Math.max(maximumTray, position.tray.length);
  }
  return { safe: true, maximumTray, finalTray: position.tray.length, frontier: null };
}

function guardedSearch(search, options = {}) {
  assert.equal(typeof search, 'function'); assert(Object.keys(options).every(key => ['progressEscape', 'safeInformationEscape'].includes(key)));
  const progressEscape = options.progressEscape ?? false; assert.equal(typeof progressEscape, 'boolean');
  return (game, state, actions, settings = {}) => {
    const safeInformationEscape = settings.safeInformationEscape ?? options.safeInformationEscape ?? false;
    assert.equal(typeof safeInformationEscape, 'boolean');
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
    let nodes = primary.nodes, selected = null, selectedSafety = null, allExcludedDead = true, tested = 0;
    const proofReports = [primary];
    const primarySafety = safeInformationEscape && state.tray.length >= 2 && !(game.clock && state.alive[game.clock.i])
      ? describeKnownPath(game, state, primary.path) : null;
    const informationEscapeEligible = !!(primarySafety && (!primarySafety.safe || primarySafety.finalTray >= 3));
    const canProveWitness = !!(game.clock && state.alive[game.clock.i])
      || state.pictures.every((picture, index) => !state.alive[index] || picture !== null);
    const immediatelyLoses = progressEscape && physical.advance(game, state, primary.index).lost;
    for (const action of excluded) {
      if (!canProveWitness && !progressEscape && !informationEscapeEligible) { allExcludedDead = false; break; }
      if (nodes >= limit) { allExcludedDead = false; break; }
      const alternative = search(game, state, [action], { ...settings, nodes: limit - nodes });
      proofReports.push(alternative);
      nodes += alternative.nodes; tested++; allExcludedDead &&= alternative.knownDead;
      if (alternative.knownWin || alternative.safeClockExit) { selected = alternative; selectedSafety = null; break; }
      if (informationEscapeEligible && alternative.information && alternative.knownProgress > 0 && !alternative.knownDead) {
        const safety = describeKnownPath(game, state, alternative.path);
        const better = !selectedSafety || safety.finalTray < selectedSafety.finalTray
          || safety.finalTray === selectedSafety.finalTray && (safety.maximumTray < selectedSafety.maximumTray
            || safety.maximumTray === selectedSafety.maximumTray && (alternative.knownProgress > selected.knownProgress
              || alternative.knownProgress === selected.knownProgress && alternative.path.length < selected.path.length));
        if (safety.safe && safety.finalTray <= 2 && better) { selected = alternative; selectedSafety = safety; }
      }
      if (immediatelyLoses && alternative.knownProgress > 0 && !alternative.knownDead && !selected) selected = alternative;
    }
    const result = selected || primary, knownDead = result.knownDead && allExcludedDead && tested === excluded.length;
    const continuationProofs = proofReports.filter(report => report.continuationProof).map(report => report.continuationProof);
    return { ...result, nodes, knownDead, deadCertificate: knownDead ? result.deadCertificate : null,
      ...(continuationProofs.length ? { continuationProof: Object.fromEntries(['calls', 'nodes', 'bounded', 'certified']
        .map(key => [key, continuationProofs.reduce((sum, report) => sum + report[key], 0)])) } : {}),
      goal: result.knownDead && !knownDead ? 'unresolvedHeuristicRootPruning' : result.goal,
      boundary: result.boundary || tested < excluded.length && !selected,
      reopenAudit: { tested, excluded: excluded.map(action => action.index), selected: selected?.index ?? null,
        primaryIndex: primary.index, primaryKnownDead: primary.knownDead, sharedNodeLimit: limit,
        ...(safeInformationEscape ? { safeInformation: { eligible: informationEscapeEligible, primary: primarySafety, selected: selectedSafety } } : {}),
        note: 'Known reopens require a constructive win/clock-exit witness, or optionally guaranteed progress instead of an immediate physical loss. '
          + (safeInformationEscape ? 'Optional nonclock information escape requires a safe known prefix, real removal progress and a final tray of at most2 instead of the primary crowded endpoint. ' : '')
          + 'All probes share the original node budget. A heuristic root exclusion alone cannot certify a dead end.' } };
  };
}

module.exports = { guardedSearch, describeKnownPath };
