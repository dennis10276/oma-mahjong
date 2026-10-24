'use strict';
const assert = require('assert/strict');
const physical = require('./known_tray_plan.js');
const deadEnd = require('./public_dead_end.js');
const { guardedSearch } = require('./public_witness_reopen_guard.js');
const { frontierFor, recoveryDepth, trayRecoveryBurden } = require('./public_goal_frontier.js');
const { aliveSignature } = require('./public_alive_signature.js');
const { createPairFlexibility } = require('./public_pair_flexibility.js');
const { goalRoutes, createGoalRouteCache } = require('./public_goal_routes.js');
const { informationTraySafe } = require('./public_information_tray_safety.js');
const { opensKnownFrontier } = require('./public_reopen_frontier.js');
const { selectBeam } = require('./public_diverse_beam.js');
const { diverseWitnessSearch } = require('./public_diverse_witness.js');
const { informationInCone } = require('./public_exposure_frontier.js');
const { queuePath } = require('./public_path_budget.js');
const { keyRecoveryPath } = require('./public_key_recovery.js');
const { knownRecovery } = require('./public_known_recovery.js');
const PARAMETERS = Object.freeze({ taps: 20, nodes: 1024, beam: 24, progress: 8, pruneDead: true, proofNodes: 128,
  pairProgress: false, finishKnown: false, trayRecovery: false, trayRecoveryMin: 0, trayRecoveryClockMin: null });

function clockCone(game, state) {
  if (!game.clock || !state.alive[game.clock.i]) return new Set();
  const target = game.clock.i, cone = new Set([target]), stack = [target];
  while (stack.length) {
    const current = stack.pop();
    for (const above of game.nb.above[current]) {
      if (state.alive[above] && !cone.has(above)) { cone.add(above); stack.push(above); }
    }
  }
  const sideTiles = rows => {
    const visited = new Set([target]), list = [];
    let current = target;
    for (;;) {
      const next = rows[current].find(index => state.alive[index] && !visited.has(index));
      if (next === undefined) return list;
      visited.add(next); list.push(next); current = next;
    }
  };
  const leftList = sideTiles(game.nb.left), rightList = sideTiles(game.nb.right);
  const shorter = leftList.length <= rightList.length ? leftList : rightList;
  for (const index of shorter) {
    if (!cone.has(index)) {
      cone.add(index); stack.push(index);
      while (stack.length) {
        const current = stack.pop();
        for (const above of game.nb.above[current]) {
          if (state.alive[above] && !cone.has(above)) { cone.add(above); stack.push(above); }
        }
      }
    }
  }
  return cone;
}

function coveredCount(game, state, root) {
  let count = 0;
  for (let i = 0; i < game.nb.above.length; i++) {
    if (state.alive[i] && game.nb.above[i].includes(root)) count++;
  }
  return count;
}

const REFERENCE_PARAMETERS = Object.freeze({ ...PARAMETERS, nodes: 4096, beam: 32,
  pairProgress: true, finishKnown: true, trayRecovery: true, trayRecoveryMin: 2, continuationPruning: true });

function unproductiveReopen(game, state, index, allowed, progressiveReopens = false) {
  const picture = state.pictures[index];
  const reopening = !!state.down[index] && state.openPeek !== index && picture !== null
    && !state.tray.includes(picture)
    && !(state.openPeek >= 0 && state.pictures[state.openPeek] === picture);
  if (!reopening || allowed.uncertain?.includes(index)) return false;
  if (allowed.free.some(mate => mate !== index && !allowed.uncertain?.includes(mate) && state.pictures[mate] === picture)) return false;
  return !progressiveReopens || !opensKnownFrontier(game, state, index, allowed);
}

function keyOf(game, state, knowledge = false) {
  const active = !!(game.clock && state.alive[game.clock.i]);
  return aliveSignature(state.alive) + '|' + state.tray.slice().sort((left, right) => left - right).join(',')
    + '|' + state.openPeek + '|' + (active ? state.moves : '-') + '|' + +state.relieved
    + '|' + (state.arriving || []).slice().sort((left, right) => left - right).join(',')
    + (knowledge ? '|' + state.pictures.map((picture, index) => state.alive[index] ? picture === null ? '?' : picture : '-').join(',') : '');
}

function clockDistance(game, state) {
  if (!game.clock || !state.alive[game.clock.i]) return 0;
  const target = game.clock.i, seen = new Set([target]), pending = [target];
  while (pending.length) for (const above of game.nb.above[pending.pop()]) if (state.alive[above] && !seen.has(above)) {
    seen.add(above); pending.push(above);
  }
  const side = rows => {
    const visited = new Set([target]); let current = target, count = 0;
    for (;;) {
      const next = rows[current].find(index => state.alive[index] && !visited.has(index));
      if (next === undefined) return count;
      visited.add(next); current = next; count++;
    }
  };
  const keys = game.rules?.locks?.has(target) && !state.relieved ? (game.rules.keys || []).filter(index => state.alive[index]).length : 0;
  return seen.size + Math.min(side(game.nb.left), side(game.nb.right)) + keys;
}

function roomOf(game, state) {
  const allowed = physical.legal(game, state);
  const uncertain = new Set(allowed.uncertain || []);
  const match = allowed.free.some(index => !uncertain.has(index) && state.pictures[index] !== null && state.tray.includes(state.pictures[index]));
  return { room: 4 - state.tray.length, safe: state.tray.length <= 2 || state.tray.length === 3 && match,
    pressure: +(state.tray.length >= 3 && !match), allowed };
}

function compare(left, right) {
  for (let part = 0; part < left.length; part++) if (left[part] !== right[part]) return left[part] - right[part];
  return 0;
}

function recoveryOf(game, state) {
  const allowed = physical.legal(game, state), uncertain = new Set(allowed.uncertain || []);
  const free = new Set(allowed.free.filter(index => !uncertain.has(index)));
  let immediate = 0, stranded = 0;
  for (const picture of state.tray) {
    const mates = state.pictures.flatMap((candidate, index) => state.alive[index] && candidate === picture ? [index] : []);
    if (mates.some(index => free.has(index))) immediate++;
    else stranded++;
  }
  return { immediate, stranded };
}

function searchKnown(game, state, actions, options = PARAMETERS) {
  const settings = { ...PARAMETERS, ...options };
  const deadline = settings.deadline ?? Infinity;
  const cachePublicAnalysis = settings.cachePublicAnalysis ?? false;
  const knownPairMacros = settings.knownPairMacros ?? false;
  const keyRecoveryMacros = settings.keyRecoveryMacros ?? false;
  const shortInformation = settings.shortInformation ?? false;
  const informationDominance = settings.informationDominance ?? false;
  const informationWidth = settings.informationWidth ?? 0;
  const progressiveReopens = settings.progressiveReopens ?? false;
  const diverseBeam = settings.diverseBeam ?? false;
  const exposureFrontier = game.publicExposure;
  const immediateRoles = settings.passiveInformation === 'immediateRoles', firstExposures = new Map();
  const eligibleExposure = (exposed, path) => {
    if (settings.passiveInformation === 'shortRoles') return path.length <= 3 ? exposed : [];
    if (!immediateRoles) return exposed;
    if (path.length === 1) firstExposures.set(path[0], exposed.slice().sort((left, right) => left - right));
    const first = firstExposures.get(path[0]) || [];
    return exposed.filter(index => first.includes(index));
  };
  const stateIdentity = (position, path) => keyOf(game, position)
    + (immediateRoles ? '|firstExposure:' + (firstExposures.get(path[0]) || []).join(',') : '');
  assert(exposureFrontier === undefined || typeof exposureFrontier === 'function');
  assert.equal(typeof cachePublicAnalysis, 'boolean');
  assert.equal(typeof knownPairMacros, 'boolean');
  assert.equal(typeof keyRecoveryMacros, 'boolean');
  assert([false, true, 'carrierAware', 'recoveryAware'].includes(shortInformation));
  assert.equal(typeof informationDominance, 'boolean');
  assert(Number.isInteger(informationWidth) && informationWidth >= 0 && informationWidth <= 4);
  assert.equal(typeof progressiveReopens, 'boolean');
  assert.equal(typeof diverseBeam, 'boolean');
  const metricsCache = new Map(), proofCache = new Map();
  const routePlanner = cachePublicAnalysis ? createGoalRouteCache(game) : goalRoutes;
  let metricsHits = 0, proofHits = 0, boundedProofHits = 0, macroPairs = 0, macroKeys = 0;
  assert(Number.isInteger(settings.taps) && settings.taps > 0 && settings.taps <= 96);
  assert(Number.isInteger(settings.nodes) && settings.nodes > 0 && Number.isInteger(settings.beam) && settings.beam > 0);
  assert(Number.isInteger(settings.progress) && settings.progress > 0);
  assert(typeof settings.pruneDead === 'boolean' && Number.isInteger(settings.proofNodes) && settings.proofNodes > 0);
  assert(typeof settings.pairProgress === 'boolean');
  assert(typeof settings.finishKnown === 'boolean' && typeof settings.trayRecovery === 'boolean');
  assert(Number.isInteger(settings.trayRecoveryMin) && settings.trayRecoveryMin >= 0 && settings.trayRecoveryMin <= 3);
  assert(settings.trayRecoveryClockMin === null || Number.isInteger(settings.trayRecoveryClockMin)
    && settings.trayRecoveryClockMin >= 0 && settings.trayRecoveryClockMin <= 3);
  const continuationPruning = settings.continuationPruning ?? false, continuationTrayMin = settings.continuationTrayMin ?? 3;
  assert(typeof continuationPruning === 'boolean'); assert(Number.isInteger(continuationTrayMin) && continuationTrayMin >= 2 && continuationTrayMin <= 3);
  const obstacleFrontier = settings.obstacleFrontier ?? false, goalRecovery = settings.goalRecovery ?? false;
  assert(typeof obstacleFrontier === 'boolean' && typeof goalRecovery === 'boolean');
  const alternativeGoalRoutes = settings.alternativeGoalRoutes ?? false;
  assert.equal(typeof alternativeGoalRoutes, 'boolean');
  const alternativeRecoveryRoutes = settings.alternativeRecoveryRoutes ?? false;
  assert.equal(typeof alternativeRecoveryRoutes, 'boolean');
  const riskFirstRecovery = settings.riskFirstRecovery ?? false;
  assert.equal(typeof riskFirstRecovery, 'boolean');
  const goalRecoveryMin = settings.goalRecoveryMin ?? 0;
  const balancedTrayRecovery = settings.balancedTrayRecovery ?? false;
  assert.equal(typeof balancedTrayRecovery, 'boolean');
  const preservePairFlexibility = settings.preservePairFlexibility ?? false;
  assert.equal(typeof preservePairFlexibility, 'boolean');
  const pairFlexibility = preservePairFlexibility ? createPairFlexibility(game, state.pictures) : null;
  assert(Number.isInteger(goalRecoveryMin) && goalRecoveryMin >= 0 && goalRecoveryMin <= 3);
  const goalRecoveryActive = goalRecovery;
  physical.featuresOf(game, state, [], { taps: 1, nodes: 1, progress: 1 });
  assert(Array.isArray(actions) && actions.length > 0);
  const roots = new Set(actions.map(action => action.index)), initialAllowed = physical.legal(game, state), initialFree = initialAllowed.free;
  assert([...roots].every(index => initialFree.includes(index)));
  const initialLeft = state.alive.reduce((sum, value) => sum + value, 0), clocked = !!(game.clock && state.alive[game.clock.i]);
  const detectedRecovery = shortInformation === 'recoveryAware' && !clocked ? knownRecovery(game, state, 2, deadline) : null;
  const informationRecovery = detectedRecovery && roots.has(detectedRecovery.path[0]) ? detectedRecovery : null;
  const shortInformationActive = shortInformation === 'recoveryAware' ? !clocked && !informationRecovery : !!shortInformation;
  const cone = clocked ? alternativeGoalRoutes ? routePlanner(game, state, game.clock.i).frontier
    : obstacleFrontier ? frontierFor(game, state, game.clock.i) : clockCone(game, state) : null;
  const initialKnown = state.pictures.filter((picture, index) => state.alive[index] && picture !== null).length;
  const finishKnown = settings.finishKnown && initialKnown === initialLeft;
  const tapLimit = finishKnown ? Math.min(96, Math.max(settings.taps,
    initialLeft + state.down.filter((value, index) => value && state.alive[index]).length)) : settings.taps;
  let best = null, beam = [{ state, path: [] }], nodes = 0, boundary = false, unknown = 0, unsupported = 0, hasSafeRemoval = false, deadPrunes = 0;
  let dominanceStop = null;
  const provedDeadRoots = new Set();
  const continuationProof = { calls: 0, nodes: 0, bounded: 0, certified: 0 };
  const recoveryRankWidths = new Set();
  const visited = new Map([[stateIdentity(state, []), 0]]);

  const evaluate = (position, path, information = false, targetIndex = -1, executesUnknownTap = false, informationTargets = null) => {
    const metricsKey = cachePublicAnalysis ? keyOf(game, position) : null;
    let metrics = cachePublicAnalysis ? metricsCache.get(metricsKey) : null;
    if (metrics) metricsHits++;
    else {
      metrics = { room: roomOf(game, position), left: position.alive.reduce((sum, value) => sum + value, 0),
        recovery: recoveryOf(game, position),
        pairDebt: !clocked && pairFlexibility ? pairFlexibility(position) : 0,
        depth: !clocked && goalRecoveryActive && position.tray.length >= goalRecoveryMin
          ? recoveryDepth(game, position, alternativeRecoveryRoutes, riskFirstRecovery, routePlanner) : { unknownWaiting: 0, knownCost: 0 },
        clockDistance: clocked && position.alive[game.clock.i]
          ? alternativeGoalRoutes ? routePlanner(game, position, game.clock.i).cost : clockDistance(game, position) : 0 };
      if (cachePublicAnalysis) metricsCache.set(metricsKey, metrics);
    }
    const { room, left, recovery } = metrics;
    const won = left === 0 && position.tray.length === 0, exit = clocked && !position.alive[game.clock.i];
    const progress = initialLeft - left;
    const matchedTiles = initialLeft + state.tray.length - left - position.tray.length;
    const inCone = informationInCone(cone, targetIndex, informationTargets);

    const passiveRiskNeutral = informationTargets === null || position.tray.length <= state.tray.length;
    const safeInfo = information && passiveRiskNeutral && informationTraySafe(position, targetIndex, executesUnknownTap, room.allowed);

    const goal = won ? 'win' : exit && room.safe ? 'safeClockExit'
      : (!clocked && progress >= settings.progress && !position.tray.length) ? 'knownProgress'
      : safeInfo ? 'information' : 'boundedProgress';

    const tier = won ? 6
      : exit && room.safe ? 5
      : exit ? 3
      : safeInfo ? 2
      : 1;

    let rank;
    if (won) {
      rank = [tier, room.room, -path.length];
    } else if (exit) {
      rank = [tier, -room.pressure, room.room, -path.length, progress, -recovery.stranded, recovery.immediate];
    } else if (clocked) {
      rank = [tier, inCone ? 1 : 0, -room.pressure, -metrics.clockDistance, safeInfo ? -path.length : progress, room.room, safeInfo ? progress : -path.length];
      const recoveryMin = settings.trayRecoveryClockMin !== null ? settings.trayRecoveryClockMin : settings.trayRecoveryMin;
      if (settings.trayRecovery && (!clocked || !position.alive[game.clock.i])) rank.splice(2, 0, position.tray.length >= recoveryMin ? -recovery.stranded : 0,
        position.tray.length >= recoveryMin ? recovery.immediate : 0);
    } else {
      rank = settings.pairProgress
        ? [tier, -room.pressure, matchedTiles, room.room, progress, -path.length]
        : [tier, -room.pressure, progress, room.room, -path.length, 0];
      if (settings.trayRecovery) rank.splice(2, 0, position.tray.length >= settings.trayRecoveryMin ? -recovery.stranded : 0,
        position.tray.length >= settings.trayRecoveryMin ? -recovery.immediate : 0);
      if (goalRecoveryActive) {
        const depth = metrics.depth;
        const burden = trayRecoveryBurden(depth, recovery, position.tray.length);
        rank.splice(2, 0, ...(riskFirstRecovery ? [-(depth.maximumOverflow ?? 0)] : []),
          ...(balancedTrayRecovery ? [-burden.burden, -burden.carried] : [-depth.unknownWaiting, -depth.knownCost]));
        recoveryRankWidths.add(rank.length);
      }
      if (pairFlexibility) rank.splice(2 + (settings.trayRecovery ? 2 : 0) + (goalRecoveryActive ? riskFirstRecovery ? 3 : 2 : 0), 0, -metrics.pairDebt);
      if (shortInformationActive && safeInfo) rank.splice(2 + +(goalRecoveryActive && riskFirstRecovery), 0,
        -path.length - (shortInformation === 'carrierAware' ? 2 * metrics.depth.unknownWaiting : 0));
      if (informationWidth && safeInfo) rank.splice(2 + +(goalRecoveryActive && riskFirstRecovery), 0,
        Math.min(informationWidth, room.allowed.free.filter(index => !room.allowed.uncertain?.includes(index)
          && position.pictures[index] === null && position.down[index] !== null).length));
    }

    const candidate = { state: position, path, rank, goal, won, safeClockExit: exit && room.safe, clockRoom: exit ? room.room : 0, progress, matchedTiles, information };
    if (path.length && (progress > 0 || information || won || exit) && (!best || compare(rank, best.rank) > 0)) best = candidate;
    return candidate;
  };

  const hasOther = actions.some(action => !unproductiveReopen(game, state, action.index, initialAllowed, progressiveReopens));
  const excludedRoots = hasOther ? actions.filter(action => unproductiveReopen(game, state, action.index, initialAllowed, progressiveReopens)).map(action => action.index) : [];

  for (let depth = 0; depth < tapLimit && beam.length; depth++) {
    const next = new Map();
    let completedLayer = true;
    for (const node of beam) {
      if (nodes >= settings.nodes || Date.now() >= deadline) { boundary = true; completedLayer = false; break; }
      if (node.path.length >= tapLimit) { boundary = true; continue; }
      nodes++;
      const allowed = physical.legal(game, node.state), settled = { ...node.state, relieved: allowed.relieved };
      const indices = allowed.free.filter(index => node.path.length || roots.has(index) && !excludedRoots.includes(index));
      const priority = index => {
        if (settled.pictures[index] !== null && settled.tray.includes(settled.pictures[index])) return 0;
        if (game.clock?.i === index) return 1;
        if (settled.openPeek >= 0 && index !== settled.openPeek && settled.pictures[index] === settled.pictures[settled.openPeek]) return 2;
        if (cone && cone.has(index)) return settled.pictures[index] === null ? 3 : 4;
        if (settled.pictures[index] === null) return 5;
        return 6;
      };
      indices.sort((left, right) => {
        const pDiff = priority(left) - priority(right);
        if (pDiff !== 0) return pDiff;
        // Tie-breaker: covered count (more is better), then height z (higher is better)
        const cDiff = coveredCount(game, settled, right) - coveredCount(game, settled, left);
        if (cDiff !== 0) return cDiff;
        const zDiff = (game.tiles[right].z || 0) - (game.tiles[left].z || 0);
        if (zDiff !== 0) return zDiff;
        return left - right;
      });

      for (const index of indices) {
        if (Date.now() >= deadline) { boundary = true; completedLayer = false; break; }
        const moved = physical.advance(game, settled, index), path = node.path.concat(index);
        if (moved.uncertain) {
          if (!['unseenPicture', 'unobservedObstacleRole', 'unobservedOrientation'].includes(moved.reason)) { unsupported++; continue; }
          unknown++;
          const executesUnknownTap = moved.reason !== 'unseenPicture' || !!settled.down[index];
          const sequence = executesUnknownTap ? path : node.path;
          if (sequence.length) evaluate(settled, sequence, true, index, executesUnknownTap);
          continue;
        }
        if (moved.lost) continue;
        hasSafeRemoval ||= moved.removed > 0;
        const exposed = exposureFrontier ? exposureFrontier(moved.state) : [];
        assert(Array.isArray(exposed));
        const eligible = eligibleExposure(exposed, path), passiveInformation = eligible.length > 0;
        if (settings.pruneDead && moved.removed > 0 && !moved.win && (moved.state.tray.length >= (continuationPruning ? continuationTrayMin : 3)
          || game.clock && moved.state.alive[game.clock.i] && game.clock.n - moved.state.moves <= 2)) {
          const nextActions = physical.legal(game, moved.state).free.map(index => ({ index }));
          const proofKey = cachePublicAnalysis ? keyOf(game, moved.state) : null;
          let proof = cachePublicAnalysis ? proofCache.get(proofKey) : null;
          const reusedProof = !!proof;
          if (reusedProof) { proofHits++; boundedProofHits += +(proof.reason === 'bounded'); }
          else if (nextActions.length) {
            proof = (continuationPruning ? deadEnd.analyzeContinuation : deadEnd.analyze)(game, moved.state, nextActions, settings.proofNodes, deadline);
            if (cachePublicAnalysis) proofCache.set(proofKey, proof);
          }
          if (continuationPruning && proof && !reusedProof) {
            continuationProof.calls++; continuationProof.nodes += proof.nodes; continuationProof.bounded += +(proof.reason === 'bounded');
            continuationProof.certified += +proof.knownDead;
          }
          if (proof?.knownDead) {
            deadPrunes++; if (!node.path.length) provedDeadRoots.add(index); continue;
          }
        }
        const candidate = evaluate(moved.state, path, passiveInformation, index, false, passiveInformation ? eligible : null);
        if (moved.win) {
          best = candidate;
          return finish();
        }
        if (exposed.length) unknown++;
        const identity = stateIdentity(moved.state, path);
        queuePath(visited, next, identity, candidate);
        const preparesKnownPair = !moved.removed || moved.removed === 1 && moved.state.tray.includes(settled.pictures[index]);
        if (knownPairMacros && preparesKnownPair && path.length < tapLimit) {
          const pairedActions = physical.legal(game, moved.state).free.filter(mate => mate !== index
            && moved.state.pictures[mate] === moved.state.pictures[index]);
          for (const mate of pairedActions) {
            if (Date.now() >= deadline) { boundary = true; completedLayer = false; break; }
            const paired = physical.advance(game, moved.state, mate);
            if (paired.uncertain || paired.lost) continue;
            assert.equal(moved.removed + paired.removed, 2, 'A known pair expansion must contain two actual removals');
            macroPairs++; hasSafeRemoval = true;
            const pairedExposed = exposureFrontier ? exposureFrontier(paired.state) : [];
            assert(Array.isArray(pairedExposed));
            const pairedPath = path.concat(mate), pairedEligible = eligibleExposure(pairedExposed, pairedPath);
            const pairedInformation = pairedEligible.length > 0;
            const pairedCandidate = evaluate(paired.state, pairedPath, pairedInformation, mate, false, pairedInformation ? pairedEligible : null);
            if (paired.win) { best = pairedCandidate; return finish(); }
            if (pairedExposed.length) unknown++;
            const pairedIdentity = stateIdentity(paired.state, pairedPath);
            queuePath(visited, next, pairedIdentity, pairedCandidate);
          }
        }
        if (keyRecoveryMacros && game.rules?.keys?.includes(index) && path.length < tapLimit) {
          const recovered = keyRecoveryPath(game, settled, index, tapLimit - node.path.length, deadline);
          if (recovered) {
            macroKeys++; hasSafeRemoval = true;
            const recoveredExposed = exposureFrontier ? exposureFrontier(recovered.state) : [];
            assert(Array.isArray(recoveredExposed));
            const recoveredPath = node.path.concat(recovered.path);
            const recoveredEligible = eligibleExposure(recoveredExposed, recoveredPath), recoveredInformation = recoveredEligible.length > 0;
            const recoveredCandidate = evaluate(recovered.state, recoveredPath, recoveredInformation,
              recovered.path.at(-1), false, recoveredInformation ? recoveredEligible : null);
            if (recoveredCandidate.won) { best = recoveredCandidate; return finish(); }
            if (recoveredExposed.length) unknown++;
            queuePath(visited, next, stateIdentity(recovered.state, recoveredPath), recoveredCandidate);
          }
        }
      }
    }
    const ranked = [...next.values()].sort((left, right) => compare(right.rank, left.rank));
    if (ranked.length > settings.beam) boundary = true;
    beam = diverseBeam ? selectBeam(ranked, settings.beam) : ranked.slice(0, settings.beam);
    if (nodes >= settings.nodes || Date.now() >= deadline) { boundary = true; break; }
    if (informationDominance && !informationWidth && shortInformation === true && !clocked && initialKnown < initialLeft
      && state.tray.length <= 1 && depth >= 1 && completedLayer && best?.information && best.path.length === 1
      && best.rank[0] === 2 && best.rank[1] === 0 && (!(goalRecoveryActive && riskFirstRecovery) || best.rank[2] === 0)) {
      dominanceStop = { completedLayers: depth + 1, unknownPictures: initialLeft - initialKnown, pathLength: 1 };
      boundary = true; break;
    }
    if (!finishKnown && !clocked && best?.progress >= settings.progress && best.state.tray.length === 0 && best.goal !== 'boundedProgress') break;
    if (depth === tapLimit - 1 && beam.length) boundary = true;
  }
  return finish();

  function finish() {
    const validActions = actions.filter(action => !unproductiveReopen(game, state, action.index, initialAllowed, progressiveReopens));
    const fallback = (validActions.length ? validActions[0] : actions[0]).index;
    let selected = best || { path: [fallback], goal: 'unresolvedFallback', won: false, safeClockExit: false,
      clockRoom: 0, progress: 0, information: state.pictures[fallback] === null };
    const exhausted = !selected.won && !beam.length && !boundary && !unknown && !unsupported;
    const exclusionProof = exhausted && excludedRoots.length && nodes < settings.nodes && Date.now() < deadline
      ? searchKnown(game, state, actions.filter(action => excludedRoots.includes(action.index)),
        { ...settings, nodes: Math.min(settings.proofNodes, settings.nodes - nodes) }) : null;
    nodes += exclusionProof?.nodes || 0;
    unknown += exclusionProof?.unknownTransitions || 0;
    unsupported += exclusionProof?.unsupportedTransitions || 0;
    deadPrunes += exclusionProof?.prunedDeadSuccessors || 0;
    if (exclusionProof?.continuationProof) for (const key of Object.keys(continuationProof)) continuationProof[key] += exclusionProof.continuationProof[key];
    boundary ||= exclusionProof?.boundary || false;
    if (exclusionProof && !exclusionProof.knownDead) {
      selected = { ...exclusionProof, won: exclusionProof.knownWin, progress: exclusionProof.knownProgress };
    }
    const knownDead = exhausted && (!excludedRoots.length || exclusionProof?.knownDead === true);
    if (knownDead) {
      const loss = actions.find(action => physical.advance(game, state, action.index).lost);
      const progress = actions.find(action => { const moved = physical.advance(game, state, action.index); return !moved.uncertain && moved.removed > 0; });
      selected = { ...selected, path: [loss?.index ?? progress?.index ?? selected.path[0]], goal: 'knownDeadEnd',
        won: false, safeClockExit: false, clockRoom: 0, progress: 0, information: false };
    }
    assert(roots.has(selected.path[0]));
    return { index: selected.path[0], path: selected.path, goal: selected.goal, knownWin: selected.won,
      knownDead, deadCertificate: knownDead ? { exhaustedKnownGraph: true, reachableUnknown: false,
        safeRemovalsExplored: hasSafeRemoval, unsupported: false, prunedOnlyCertifiedLosses: true } : null,
      prunedDeadSuccessors: deadPrunes, provedDeadRoots: [...provedDeadRoots],
      safeClockExit: selected.safeClockExit, clockRoom: selected.clockRoom, knownProgress: selected.progress,
      matchedTiles: selected.matchedTiles || 0,
      heuristicExcludedRoots: excludedRoots, exclusionProof,
      information: selected.information, nodes, boundary: boundary || excludedRoots.length > 0 && !knownDead && !selected.won,
      unknownTransitions: unknown, unsupportedTransitions: unsupported,
      initialKnown, initialLeft,
      finishKnown, tapLimit,
      ...(continuationPruning ? { continuationProof } : {}),
      ...(cachePublicAnalysis ? { analysisCache: { metricsHits, proofHits, boundedProofHits, metricsEntries: metricsCache.size,
        proofEntries: proofCache.size, ...routePlanner.stats() } } : {}),
      ...(knownPairMacros ? { expandedKnownPairs: macroPairs } : {}),
      ...(keyRecoveryMacros ? { expandedKeyRecoveries: macroKeys } : {}),
      ...(dominanceStop ? { dominanceStop } : {}),
      ...(shortInformation === 'recoveryAware' ? { informationPolicy: { active: shortInformationActive,
        recovery: informationRecovery ? { path: informationRecovery.path, kind: informationRecovery.kind } : null } } : {}),
      ...(obstacleFrontier || goalRecovery ? { goalAudit: { obstacleFrontier, goalRecovery, goalRecoveryActive,
        ...(alternativeRecoveryRoutes ? { alternativeRecoveryRoutes } : {}),
        ...(riskFirstRecovery ? { riskFirstRecovery } : {}),
        goalRecoveryMin, recoveryRankWidths: [...recoveryRankWidths].sort() } } : {}),
      note: 'Bounded known-only witness search. Unknown reveals stop the hypothetical route; their actual faces '
        + 'are never sampled from the real board. Optional public-geometry exposure values newly readable fields without querying them; already known physical continuations remain searchable, and actual observations occur after every tap. Clock distance is an ordering heuristic, not a proven bound. '
        + 'A knownDead certificate requires a fully exhausted known graph with no new information or '
        + 'unsupported transition, pruning only separately certified losses. Excluded heuristic roots require a separate '
        + 'bounded search sharing the remaining node budget before a death certificate; it chooses an actual losing/progressing tap rather than calling a '
        + 'computation cap a failure. A returned win/exit has a constructive physical witness; other absence is not a proof of loss, uniqueness '
        + 'or optimality. Automatic Joker transitions outside the public transition model remain unresolved.' };
  }
}

const guarded = diverseWitnessSearch(guardedSearch(searchKnown));
function search(game, state, actions, options = PARAMETERS) {
  const decisionMs = options.decisionMs;
  assert(decisionMs === undefined || Number.isFinite(decisionMs) && decisionMs > 0 && decisionMs <= 2000);
  const settings = decisionMs === undefined ? options : { ...options, deadline: Date.now() + decisionMs };
  const allowed = physical.legal(game, state);
  const publicActions = actions.map(action => ({ index: action.index,
    inspect: !!state.down[action.index] && state.openPeek !== action.index
      && (state.pictures[action.index] === null || unproductiveReopen(game, state, action.index, allowed, options.progressiveReopens)) }));
  return guarded(game, state, publicActions, settings);
}

module.exports = { PARAMETERS, REFERENCE_PARAMETERS, keyOf, clockDistance, roomOf, recoveryOf, search };
