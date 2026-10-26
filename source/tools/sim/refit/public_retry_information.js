'use strict';
const assert = require('assert/strict');
const { explorationWitness } = require('./public_exploration_witness.js');
const { createReusableExploration } = require('./public_reusable_exploration.js');

function retryInformationSearch(primarySearch, options = {}) {
  assert.equal(typeof primarySearch, 'function');
  const milliseconds = options.milliseconds ?? 250, nodeLimit = options.nodes ?? 2000, choices = options.choices ?? 512;
  const peekTrayLimit = options.peekTrayLimit ?? 1;
  const preferActualPeek = options.preferActualPeek ?? false;
  assert(Number.isFinite(milliseconds) && milliseconds > 0 && milliseconds <= 500);
  assert(Number.isInteger(nodeLimit) && nodeLimit > 0);
  assert(Number.isInteger(choices) && choices > 0);
  assert(Number.isInteger(peekTrayLimit) && peekTrayLimit >= 0 && peekTrayLimit <= 2);
  assert.equal(typeof preferActualPeek, 'boolean');
  assert(options.deadEndInformation === undefined || typeof options.deadEndInformation === 'boolean');
  const deadEndInformation = options.deadEndInformation === true;
  assert(options.reusablePlanning === undefined || typeof options.reusablePlanning === 'boolean');
  assert(!options.reusablePlanning || typeof options.contextVersion === 'function' && !preferActualPeek);
  assert(options.continueAfterInformation === undefined || typeof options.continueAfterInformation === 'boolean');
  assert(!options.continueAfterInformation || options.reusablePlanning === true);
  assert(options.prepareCrowded === undefined || typeof options.prepareCrowded === 'boolean');
  assert(!options.prepareCrowded || options.reusablePlanning === true);
  const preparationClockRange = options.preparationClockRange;
  assert(preparationClockRange === undefined || options.prepareCrowded === true
    && Array.isArray(preparationClockRange) && preparationClockRange.length === 2
    && preparationClockRange.every(value => Number.isInteger(value) && value >= 0)
    && preparationClockRange[0] <= preparationClockRange[1]);
  const reusable = options.reusablePlanning ? createReusableExploration() : null;
  let attempt = 0, startKnowledge = null, active = false, stalls = 0;
  const counters = { stalledAttempts: 0, considered: 0, routes: 0, wins: 0, peekRoutes: 0, exposureRoutes: 0,
    nodes: 0, nodeStops: 0, deadlineStops: 0, maximumExtraMs: 0, overruledDeadCertificates: 0, stallsEndedByInformation: 0 };
  if (deadEndInformation) Object.assign(counters, { deadEndConsidered: 0, firstAttemptDeadEndConsidered: 0,
    deadEndRoutes: 0, unresolvedDeadEndReports: 0, confirmedDeadEndReports: 0 });
  if (options.prepareCrowded) Object.assign(counters, { proactiveSearches: 0, firstAttemptPreparations: 0 });
  const fingerprint = memory => {
    const expected = ['down', 'initialRoles', 'pictures', ...(memory.keyIdentities === undefined ? [] : ['keyIdentities'])].sort();
    assert.deepEqual(Object.keys(memory).sort(), expected);
    assert(['down', 'initialRoles', 'pictures'].every(field => Array.isArray(memory[field]) && memory[field].length === memory.pictures.length));
    if (memory.keyIdentities !== undefined) {
      assert(Array.isArray(memory.keyIdentities) && Array.from(memory.keyIdentities).every((index, offset) => Number.isInteger(index)
        && index >= 0 && index < memory.pictures.length && (!offset || index > memory.keyIdentities[offset - 1])));
    }
    return JSON.stringify([memory.pictures, memory.down, memory.initialRoles,
      ...(memory.keyIdentities === undefined ? [] : [memory.keyIdentities])]);
  };
  return {
    beginAttempt(memory) { assert(!active); attempt++; startKnowledge = fingerprint(memory); active = true; },
    observe(memory) {
      assert(active);
      if (stalls && fingerprint(memory) !== startKnowledge) { counters.stallsEndedByInformation++; stalls = 0; }
    },
    finish(status, memory) {
      assert(active);
      assert(['physicalLoss', 'cleared', 'unresolvedBudget', 'unresolvedPublicFrontier', 'unresolved'].includes(status));
      const stalled = status === 'physicalLoss' && fingerprint(memory) === startKnowledge;
      stalls = stalled ? stalls + 1 : 0; counters.stalledAttempts += +stalled; active = false;
    },
    search(game, state, actions, settings = {}) {
      assert(active);
      const began = Date.now(), primary = primarySearch(game, state, actions, settings);
      if (primary.knownWin || primary.safeClockExit) return primary;
      const recoverDeadEnd = deadEndInformation && primary.knownDead;
      const previouslyEligible = recoverDeadEnd || attempt >= 2 && stalls > 0;
      const clockRemaining = game.clock && state.alive[game.clock.i] ? game.clock.n - state.moves : Infinity;
      const proactive = !!options.prepareCrowded && !previouslyEligible && state.tray.length >= 2
        && clockRemaining >= (preparationClockRange?.[0] ?? 10) && clockRemaining <= (preparationClockRange?.[1] ?? Infinity);
      if (!previouslyEligible && !proactive) return primary;
      const unresolvedDeadEnd = reason => {
        counters.unresolvedDeadEndReports++;
        const report = { ...primary };
        delete report.deadCertificate; delete report.provedDeadRoots; delete report.exclusionProof;
        return { ...report, knownDead: false, boundary: true, goal: 'unresolvedPublicInformation',
          deadEndInformation: { attempt, reason, broaderInformationCertificateEstablished: false } };
      };
      const remaining = choices - (state.physicalTaps ?? 0);
      if (remaining <= 0) return recoverDeadEnd ? unresolvedDeadEnd('choice_budget') : primary;
      counters.considered++;
      if (proactive) { counters.proactiveSearches++; counters.firstAttemptPreparations += +(attempt === 1); }
      const publicGame = Object.fromEntries(['tiles', 'nb', 'rules', 'clock', 'publicFrontier', 'publicExposure', 'publicRoleExposure']
        .filter(field => game[field] !== undefined).map(field => [field, game[field]]));
      if (recoverDeadEnd) {
        assert.equal(typeof game.publicInformationExposure, 'function', 'Dead-end recovery requires a public visibility projection');
        publicGame.publicInformationExposure = game.publicInformationExposure;
        counters.deadEndConsidered++; counters.firstAttemptDeadEndConsidered += +(attempt === 1);
      }
      const extraBegan = Date.now();
      const result = (reusable ? reusable.search : explorationWitness)(publicGame, state, actions,
        { nodes: nodeLimit, taps: Math.min(128, remaining), peekTrayLimit, preferActualPeek,
          ...(reusable ? { version: options.contextVersion(), revalidatePublicChanges: true,
            continueAfterInformation: options.continueAfterInformation === true } : {}),
          deadline: Math.min(settings.deadline ?? Infinity, began + 1800, extraBegan + milliseconds) });
      counters.maximumExtraMs = Math.max(counters.maximumExtraMs, Date.now() - extraBegan);
      counters.nodes += result.nodes; counters.nodeStops += +(result.reason === 'node_limit' || result.budgetStopReason === 'node_limit');
      counters.deadlineStops += +(result.reason === 'deadline' || result.budgetStopReason === 'deadline');
      if (!result.path?.length) {
        if (!recoverDeadEnd) return primary;
        if (!result.boundary && result.reason === 'no_known_information_route') {
          counters.confirmedDeadEndReports++;
          return { ...primary, nodes: (primary.nodes ?? 0) + result.nodes,
            deadEndInformation: { attempt, reason: result.reason, broaderInformationCertificateEstablished: true } };
        }
        const unresolved = unresolvedDeadEnd(result.reason);
        return { ...unresolved, nodes: (primary.nodes ?? 0) + result.nodes };
      }
      counters.routes++; counters.wins += +result.knownWin;
      counters.peekRoutes += +(result.kind === 'actualPeekRequired');
      counters.exposureRoutes += +(result.kind === 'newPublicExposure');
      counters.overruledDeadCertificates += +!!primary.knownDead;
      if (recoverDeadEnd) counters.deadEndRoutes++;
      const report = { ...primary };
      delete report.deadCertificate; delete report.provedDeadRoots;
      if (recoverDeadEnd) delete report.exclusionProof;
      return { ...report, index: result.path[0], path: result.path,
        goal: result.knownWin ? 'win' : 'retryInformationWitness', knownWin: result.knownWin, knownDead: false,
        knownProgress: result.knownProgress, safeClockExit: false, clockRoom: 0,
        information: !result.knownWin, boundary: !result.knownWin, nodes: (primary.nodes ?? 0) + result.nodes,
        retryInformationWitness: { attempt, stalls, kind: result.kind, knownPrefixTaps: result.knownPrefixTaps,
          ...(proactive ? { proactive: true, preparationTrayMinimum: 2, preparationClockMinimum: preparationClockRange?.[0] ?? 10,
            ...(preparationClockRange ? { preparationClockMaximum: preparationClockRange[1] } : {}),
            preparationStartedAtClockRemaining: Number.isFinite(clockRemaining) ? clockRemaining : null,
            preparationStartedAtTrayCount: state.tray.length } : {}),
          ...(reusable ? { reusable: result.reusable } : {}),
          ...(peekTrayLimit !== 1 ? { peekTrayLimit } : {}),
          ...(preferActualPeek ? { preferActualPeek, exposureFallbackUsed: result.exposureFallbackUsed,
            budgetStopReason: result.budgetStopReason } : {}),
          boundaryIndex: result.boundaryIndex, newlyExposed: result.newlyExposed, imaginedPicturesAdded: 0,
          source: 'known physical prefix to new public exposure or an actual required peek; no predicted hidden picture' } };
    },
    stats() { return { ...counters, consecutiveStalls: stalls, ...(reusable ? { reusable: reusable.stats() } : {}) }; },
  };
}

module.exports = { retryInformationSearch };
