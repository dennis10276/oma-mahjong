'use strict';
const assert = require('assert/strict');
const physical = require('./known_tray_plan.js');
const deadEnd = require('./public_dead_end.js');
const { guardedSearch } = require('./public_witness_reopen_guard.js');
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
  pairProgress: true, finishKnown: true, trayRecovery: true, trayRecoveryMin: 2 });

function unproductiveReopen(state, index) {
  const picture = state.pictures[index];
  return !!state.down[index] && state.openPeek !== index && picture !== null
    && !state.tray.includes(picture)
    && !(state.openPeek >= 0 && state.pictures[state.openPeek] === picture);
}

function keyOf(game, state, knowledge = false) {
  const active = !!(game.clock && state.alive[game.clock.i]);
  return state.alive.join('') + '|' + state.tray.slice().sort((left, right) => left - right).join(',')
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
  const match = allowed.free.some(index => state.pictures[index] !== null && state.tray.includes(state.pictures[index]));
  return { room: 4 - state.tray.length, safe: state.tray.length <= 2 || state.tray.length === 3 && match,
    pressure: +(state.tray.length >= 3 && !match), allowed };
}

function compare(left, right) {
  for (let part = 0; part < left.length; part++) if (left[part] !== right[part]) return left[part] - right[part];
  return 0;
}

function recoveryOf(game, state) {
  const free = new Set(physical.legal(game, state).free);
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
  assert(Number.isInteger(settings.taps) && settings.taps > 0 && settings.taps <= 96);
  assert(Number.isInteger(settings.nodes) && settings.nodes > 0 && Number.isInteger(settings.beam) && settings.beam > 0);
  assert(Number.isInteger(settings.progress) && settings.progress > 0);
  assert(typeof settings.pruneDead === 'boolean' && Number.isInteger(settings.proofNodes) && settings.proofNodes > 0);
  assert(typeof settings.pairProgress === 'boolean');
  assert(typeof settings.finishKnown === 'boolean' && typeof settings.trayRecovery === 'boolean');
  assert(Number.isInteger(settings.trayRecoveryMin) && settings.trayRecoveryMin >= 0 && settings.trayRecoveryMin <= 3);
  assert(settings.trayRecoveryClockMin === null || Number.isInteger(settings.trayRecoveryClockMin)
    && settings.trayRecoveryClockMin >= 0 && settings.trayRecoveryClockMin <= 3);
  physical.featuresOf(game, state, [], { taps: 1, nodes: 1, progress: 1 });
  assert(Array.isArray(actions) && actions.length > 0);
  const roots = new Set(actions.map(action => action.index)), initialFree = physical.legal(game, state).free;
  assert([...roots].every(index => initialFree.includes(index)));
  const initialLeft = state.alive.reduce((sum, value) => sum + value, 0), clocked = !!(game.clock && state.alive[game.clock.i]);
  const cone = clocked ? clockCone(game, state) : null;
  const initialKnown = state.pictures.filter((picture, index) => state.alive[index] && picture !== null).length;
  const finishKnown = settings.finishKnown && initialKnown === initialLeft;
  const tapLimit = finishKnown ? Math.min(96, Math.max(settings.taps,
    initialLeft + state.down.filter((value, index) => value && state.alive[index]).length)) : settings.taps;
  let best = null, beam = [{ state, path: [] }], nodes = 0, boundary = false, unknown = 0, unsupported = 0, hasSafeRemoval = false, deadPrunes = 0;
  const provedDeadRoots = new Set();
  const visited = new Set([keyOf(game, state)]);

  const evaluate = (position, path, information = false, targetIndex = -1) => {
    const room = roomOf(game, position), left = position.alive.reduce((sum, value) => sum + value, 0);
    const won = left === 0 && position.tray.length === 0, exit = clocked && !position.alive[game.clock.i];
    const progress = initialLeft - left;
    const matchedTiles = initialLeft + state.tray.length - left - position.tray.length;
    const recovery = recoveryOf(game, position);
    const inCone = cone && targetIndex >= 0 ? cone.has(targetIndex) : false;

    // Safety check: is this information path safe for the tray?
    const safeInfo = information && (room.safe || position.tray.length <= 2);

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
      rank = [tier, inCone ? 1 : 0, -room.pressure, room.room, progress, -path.length, -recovery.stranded, recovery.immediate];
    } else if (clocked) {
      rank = [tier, inCone ? 1 : 0, -room.pressure, -clockDistance(game, position), safeInfo ? -path.length : progress, room.room, safeInfo ? progress : -path.length];
      const recoveryMin = settings.trayRecoveryClockMin !== null ? settings.trayRecoveryClockMin : settings.trayRecoveryMin;
      if (settings.trayRecovery && (!clocked || !position.alive[game.clock.i])) rank.splice(2, 0, position.tray.length >= recoveryMin ? -recovery.stranded : 0,
        position.tray.length >= recoveryMin ? recovery.immediate : 0);
    } else {
      rank = settings.pairProgress
        ? [tier, -room.pressure, matchedTiles, room.room, progress, -path.length]
        : [tier, -room.pressure, progress, room.room, -path.length, 0];
      if (settings.trayRecovery) rank.splice(2, 0, position.tray.length >= settings.trayRecoveryMin ? -recovery.stranded : 0,
        position.tray.length >= settings.trayRecoveryMin ? recovery.immediate : 0);
    }

    const candidate = { state: position, path, rank, goal, won, safeClockExit: exit && room.safe, clockRoom: exit ? room.room : 0, progress, matchedTiles, information };
    if (path.length && (progress > 0 || information || won || exit) && (!best || compare(rank, best.rank) > 0)) best = candidate;
    return candidate;
  };

  const hasOther = actions.some(action => !unproductiveReopen(state, action.index));
  const excludedRoots = hasOther ? actions.filter(action => unproductiveReopen(state, action.index)).map(action => action.index) : [];

  for (let depth = 0; depth < tapLimit && beam.length; depth++) {
    const next = [];
    for (const node of beam) {
      if (nodes >= settings.nodes) { boundary = true; break; }
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
        const moved = physical.advance(game, settled, index), path = node.path.concat(index);
        if (moved.uncertain) {
          if (moved.reason !== 'unseenPicture') { unsupported++; continue; }
          unknown++;
          const sequence = settled.down[index] ? path : node.path;
          if (sequence.length) evaluate(settled, sequence, true, index);
          continue;
        }
        if (moved.lost) continue;
        hasSafeRemoval ||= moved.removed > 0;
        if (settings.pruneDead && moved.removed > 0 && !moved.win && (moved.state.tray.length >= 3
          || game.clock && moved.state.alive[game.clock.i] && game.clock.n - moved.state.moves <= 2)) {
          const nextActions = physical.legal(game, moved.state).free.map(index => ({ index }));
          if (nextActions.length && deadEnd.analyze(game, moved.state, nextActions, settings.proofNodes).knownDead) {
            deadPrunes++; if (!node.path.length) provedDeadRoots.add(index); continue;
          }
        }
        const candidate = evaluate(moved.state, path, false, index);
        if (moved.win) {
          best = candidate;
          return finish();
        }
        const identity = keyOf(game, moved.state);
        if (!visited.has(identity)) { visited.add(identity); next.push(candidate); }
      }
    }
    next.sort((left, right) => compare(right.rank, left.rank));
    if (next.length > settings.beam) boundary = true;
    beam = next.slice(0, settings.beam);
    if (nodes >= settings.nodes) break;
    if (!finishKnown && !clocked && best?.progress >= settings.progress && best.state.tray.length === 0 && best.goal !== 'boundedProgress') break;
    if (depth === tapLimit - 1 && beam.length) boundary = true;
  }
  return finish();

  function finish() {
    const validActions = actions.filter(action => !unproductiveReopen(state, action.index));
    const fallback = (validActions.length ? validActions[0] : actions[0]).index;
    let selected = best || { path: [fallback], goal: 'unresolvedFallback', won: false, safeClockExit: false,
      clockRoom: 0, progress: 0, information: state.pictures[fallback] === null };
    const exhausted = !selected.won && !beam.length && !boundary && !unknown && !unsupported;
    const exclusionProof = exhausted && excludedRoots.length && nodes < settings.nodes
      ? searchKnown(game, state, actions.filter(action => excludedRoots.includes(action.index)),
        { ...settings, nodes: Math.min(settings.proofNodes, settings.nodes - nodes) }) : null;
    nodes += exclusionProof?.nodes || 0;
    unknown += exclusionProof?.unknownTransitions || 0;
    unsupported += exclusionProof?.unsupportedTransitions || 0;
    deadPrunes += exclusionProof?.prunedDeadSuccessors || 0;
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
      note: 'Bounded known-only witness search. Unknown reveals stop the hypothetical route; their actual faces '
        + 'are never sampled from the real board. Clock distance is an ordering heuristic, not a proven bound. '
        + 'A knownDead certificate requires a fully exhausted known graph with no new information or '
        + 'unsupported transition, pruning only separately certified losses. Excluded heuristic roots require a separate '
        + 'bounded search sharing the remaining node budget before a death certificate; it chooses an actual losing/progressing tap rather than calling a '
        + 'computation cap a failure. A returned win/exit has a constructive physical witness; other absence is not a proof of loss, uniqueness '
        + 'or optimality. Automatic Joker transitions outside the public transition model remain unresolved.' };
  }
}

const guarded = guardedSearch(searchKnown);
function search(game, state, actions, options = PARAMETERS) {
  const publicActions = actions.map(action => ({ index: action.index,
    inspect: !!state.down[action.index] && state.openPeek !== action.index
      && (state.pictures[action.index] === null || unproductiveReopen(state, action.index)) }));
  return guarded(game, state, publicActions, options);
}

module.exports = { PARAMETERS, REFERENCE_PARAMETERS, keyOf, clockDistance, roomOf, recoveryOf, search };
