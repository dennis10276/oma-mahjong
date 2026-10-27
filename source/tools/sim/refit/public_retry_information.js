'use strict';
const assert = require('assert/strict');
const { explorationWitness } = require('./public_exploration_witness.js');
const { createReusableExploration } = require('./public_reusable_exploration.js');
const { legal, advance } = require('./known_tray_plan.js');
const { createExposureFrontier } = require('./public_exposure_frontier.js');

// A constructive prefix is a plan, never a source of imagined observations.
function createRetainedInformationRoute() {
  let pending = null;
  const physical = state => JSON.stringify(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving']
    .map(field => state[field] ?? null));
  return {
    clear() { pending = null; },
    remember(game, state, result) {
      pending = null;
      if (!result.path || result.path.length < 2 || !Number.isInteger(result.knownPrefixTaps) || result.knownPrefixTaps < 1
        || !['newPublicExposure', 'actualPeekRequired'].includes(result.kind)) return;
      const moved = advance(game, state, result.path[0]);
      if (moved.uncertain || moved.lost) return;
      pending = { expected: physical(moved.state), expectedTaps: Number.isInteger(state.physicalTaps) ? state.physicalTaps + 1 : null, result: { ...result,
        path: result.path.slice(1), knownPrefixTaps: result.knownPrefixTaps - 1 } };
    },
    take(game, state, actions, deadline, peekTrayLimit) {
      const saved = pending; pending = null;
      if (!saved || saved.expected !== physical(state) || saved.expectedTaps !== null && state.physicalTaps !== saved.expectedTaps
        || !actions.some(action => action.index === saved.result.path[0])) return null;
      let position = state;
      for (const index of saved.result.path.slice(0, saved.result.knownPrefixTaps)) {
        if (Date.now() >= deadline) return null;
        const allowed = legal(game, position);
        if (!allowed.free.includes(index) || allowed.uncertain?.includes(index)) return null;
        const moved = advance(game, position, index);
        if (moved.uncertain || moved.lost) return null;
        position = moved.state;
      }
      let newlyExposed = [], boundaryIndex = null;
      if (saved.result.kind === 'newPublicExposure') {
        const exposure = createExposureFrontier(game.tiles, state, 'all');
        newlyExposed = Array.from(game.publicInformationExposure ? game.publicInformationExposure(position)
          : new Set([...exposure(position), ...(game.publicRoleExposure?.(position) ?? [])]));
        if (position.tray.length > 2 || !newlyExposed.length) return null;
      } else if (saved.result.kind === 'actualPeekRequired') {
        boundaryIndex = saved.result.path.at(-1);
        const allowed = legal(game, position);
        if (!allowed.free.includes(boundaryIndex) || allowed.uncertain?.includes(boundaryIndex)
          || position.pictures[boundaryIndex] !== null || position.down[boundaryIndex] !== 1
          || position.tray.length > peekTrayLimit || game.clock && position.alive[game.clock.i]
            && game.clock.n - position.moves <= 2) return null;
      } else return null;
      if (Date.now() >= deadline) return null;
      return { ...saved.result, newlyExposed, boundaryIndex, nodes: 0, retainedRoute: true,
        knownProgress: state.alive.reduce((total, alive, index) => total + +(alive && !position.alive[index]), 0) };
    },
  };
}

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
  assert(options.retainInvestedWork === undefined || typeof options.retainInvestedWork === 'boolean');
  assert(!options.retainInvestedWork || options.reusablePlanning === true);
  assert(options.warmPlanning === undefined || typeof options.warmPlanning === 'boolean');
  assert(!options.warmPlanning || options.reusablePlanning === true && options.continueAfterInformation === true);
  assert(options.retainRoute === undefined || typeof options.retainRoute === 'boolean');
  assert(!options.retainRoute || options.reusablePlanning === true);
  assert(options.simplifyPrefixes === undefined || typeof options.simplifyPrefixes === 'boolean');
  assert(!options.simplifyPrefixes || options.reusablePlanning === true);
  const retainedRoute = options.retainRoute ? createRetainedInformationRoute() : null;
  let lastKnowledge = null;
  const reusable = options.reusablePlanning ? createReusableExploration({ preferInvestedWork: options.retainInvestedWork }) : null;
  let attempt = 0, startKnowledge = null, active = false, stalls = 0;
  const counters = { stalledAttempts: 0, considered: 0, routes: 0, wins: 0, peekRoutes: 0, exposureRoutes: 0,
    nodes: 0, nodeStops: 0, deadlineStops: 0, maximumExtraMs: 0, overruledDeadCertificates: 0, stallsEndedByInformation: 0 };
  if (deadEndInformation) Object.assign(counters, { deadEndConsidered: 0, firstAttemptDeadEndConsidered: 0,
    deadEndRoutes: 0, unresolvedDeadEndReports: 0, confirmedDeadEndReports: 0 });
  if (options.prepareCrowded) Object.assign(counters, { proactiveSearches: 0, firstAttemptPreparations: 0 });
  if (options.warmPlanning) Object.assign(counters, { warmSearches: 0, warmInformationHeld: 0, warmKnownWins: 0 });
  if (retainedRoute) counters.retainedRouteTaps = 0;
  if (options.simplifyPrefixes) Object.assign(counters,{simplifiedRouteOffers:0,redundantPeeksRemovedFromOffers:0});
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
    beginAttempt(memory) { assert(!active); attempt++; startKnowledge = fingerprint(memory); lastKnowledge = startKnowledge; retainedRoute?.clear(); active = true; },
    observe(memory) {
      assert(active);
      if (retainedRoute) {
        const knowledge = fingerprint(memory);
        if (knowledge !== lastKnowledge) retainedRoute.clear();
        lastKnowledge = knowledge;
      }
      if (stalls && fingerprint(memory) !== startKnowledge) { counters.stallsEndedByInformation++; stalls = 0; }
    },
    finish(status, memory) {
      assert(active);
      retainedRoute?.clear();
      assert(['physicalLoss', 'cleared', 'unresolvedBudget', 'unresolvedPublicFrontier', 'unresolved'].includes(status));
      const stalled = status === 'physicalLoss' && fingerprint(memory) === startKnowledge;
      stalls = stalled ? stalls + 1 : 0; counters.stalledAttempts += +stalled; active = false;
    },
    search(game, state, actions, settings = {}) {
      assert(active);
      const began = Date.now(), primary = primarySearch(game, state, actions, settings);
      if (primary.knownWin || primary.safeClockExit) { retainedRoute?.clear(); return primary; }
      const recoverDeadEnd = deadEndInformation && primary.knownDead;
      const previouslyEligible = recoverDeadEnd || attempt >= 2 && stalls > 0;
      const clockRemaining = game.clock && state.alive[game.clock.i] ? game.clock.n - state.moves : Infinity;
      const proactive = !!options.prepareCrowded && !previouslyEligible && state.tray.length >= 2
        && clockRemaining >= (preparationClockRange?.[0] ?? 10) && clockRemaining <= (preparationClockRange?.[1] ?? Infinity);
      const warmOnly = !!options.warmPlanning && !previouslyEligible && !proactive;
      const retained = retainedRoute?.take(game, state, actions, Math.min(settings.deadline ?? Infinity, began + 1800), peekTrayLimit);
      if (!previouslyEligible && !proactive && !warmOnly && !retained) return primary;
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
      if (warmOnly) counters.warmSearches++;
      const publicGame = Object.fromEntries(['tiles', 'nb', 'rules', 'clock', 'publicFrontier', 'publicExposure', 'publicRoleExposure']
        .filter(field => game[field] !== undefined).map(field => [field, game[field]]));
      if (recoverDeadEnd) {
        assert.equal(typeof game.publicInformationExposure, 'function', 'Dead-end recovery requires a public visibility projection');
        publicGame.publicInformationExposure = game.publicInformationExposure;
        counters.deadEndConsidered++; counters.firstAttemptDeadEndConsidered += +(attempt === 1);
      }
      const extraBegan = Date.now();
      const result = retained ?? (reusable ? reusable.search : explorationWitness)(publicGame, state, actions,
        { nodes: nodeLimit, taps: Math.min(128, remaining), peekTrayLimit, preferActualPeek,
          ...(reusable ? { version: options.contextVersion(), revalidatePublicChanges: true,
            continueAfterInformation: options.continueAfterInformation === true,
            ...(options.simplifyPrefixes ? {simplifyPrefixes:true} : {}),
            ...(warmOnly ? { consumeInformation: false } : {}) } : {}),
          deadline: Math.min(settings.deadline ?? Infinity, began + 1800, extraBegan + milliseconds) });
      counters.maximumExtraMs = Math.max(counters.maximumExtraMs, Date.now() - extraBegan);
      counters.nodes += result.nodes; counters.nodeStops += +(result.reason === 'node_limit' || result.budgetStopReason === 'node_limit');
      counters.deadlineStops += +(result.reason === 'deadline' || result.budgetStopReason === 'deadline');
      if (warmOnly) {
        if (!result.knownWin) { counters.warmInformationHeld += +!!result.path?.length; return primary; }
        counters.warmKnownWins++;
      }
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
      retainedRoute?.remember(publicGame, state, result);
      if (!retained && result.removedKnownPeeks) { counters.simplifiedRouteOffers++; counters.redundantPeeksRemovedFromOffers+=result.removedKnownPeeks; }
      if (retained) counters.retainedRouteTaps++;
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
          ...(retained ? { retainedRoute: true } : {}),
          ...(result.removedKnownPeeks ? {removedKnownPeeks:result.removedKnownPeeks} : {}),
          ...(warmOnly ? { warmedCompleteWin: true } : {}),
          ...(peekTrayLimit !== 1 ? { peekTrayLimit } : {}),
          ...(preferActualPeek ? { preferActualPeek, exposureFallbackUsed: result.exposureFallbackUsed,
            budgetStopReason: result.budgetStopReason } : {}),
          boundaryIndex: result.boundaryIndex, newlyExposed: result.newlyExposed, imaginedPicturesAdded: 0,
          source: 'known physical prefix to new public exposure or an actual required peek; no predicted hidden picture' } };
    },
    stats() { return { ...counters, consecutiveStalls: stalls, ...(reusable ? { reusable: reusable.stats() } : {}) }; },
  };
}

module.exports = { retryInformationSearch, createRetainedInformationRoute };
