'use strict';
const assert = require('assert/strict');
const { legal, advance } = require('./known_tray_plan.js');
const { aliveSignature } = require('./public_alive_signature.js');
const { createExposureFrontier } = require('./public_exposure_frontier.js');

function explorationWitness(game, initial, roots, options = {}) {
  const deadline = options.deadline ?? Date.now() + 250, nodeLimit = options.nodes ?? 2000, maxTaps = options.taps ?? 128;
  const peekTrayLimit = options.peekTrayLimit ?? 1;
  const preferActualPeek = options.preferActualPeek ?? false;
  assert(Number.isFinite(deadline));
  assert(Number.isInteger(nodeLimit) && nodeLimit > 0);
  assert(Number.isInteger(maxTaps) && maxTaps > 0 && maxTaps <= 512);
  assert(Number.isInteger(peekTrayLimit) && peekTrayLimit >= 0 && peekTrayLimit <= 2);
  assert.equal(typeof preferActualPeek, 'boolean');
  assert(Array.isArray(roots) && roots.every(action => Number.isInteger(action.index)));
  assert(Object.keys(game).every(key => ['tiles', 'nb', 'rules', 'clock', 'publicFrontier', 'publicExposure', 'publicRoleExposure', 'publicInformationExposure'].includes(key)));
  assert(game.publicRoleExposure === undefined || typeof game.publicRoleExposure === 'function');
  assert(game.publicInformationExposure === undefined || typeof game.publicInformationExposure === 'function');
  const pictureExposure = createExposureFrontier(game.tiles, initial, 'all');
  const exposure = game.publicInformationExposure ?? (game.publicRoleExposure
    ? position => [...new Set([...pictureExposure(position), ...game.publicRoleExposure(position)])] : pictureExposure);
  const allowedRoots = new Set(roots.map(action => action.index)), visited = new Map();
  let nodes = 0, boundary = false, reason = 'no_known_information_route', exposureFallback = null;
  const progress = state => initial.alive.reduce((sum, alive, index) => sum + +(alive && !state.alive[index]), 0);
  const stopped = () => {
    if (Date.now() >= deadline) { boundary = true; reason = 'deadline'; return true; }
    if (nodes >= nodeLimit) { boundary = true; reason = 'node_limit'; return true; }
    return false;
  };
  const identity = state => aliveSignature(state.alive) + '|' + JSON.stringify([state.tray, state.openPeek,
    !!state.relieved, state.arriving ?? [], game.clock && state.alive[game.clock.i] ? state.moves : 0]);
  function visit(state, path) {
    if (stopped()) return null;
    if (path.length && state.tray.length <= 2) {
      const newlyExposed = exposure(state);
      if (newlyExposed.length) {
        const candidate = { path, knownPrefixTaps: path.length, boundaryIndex: null,
          newlyExposed: Array.from(newlyExposed), knownProgress: progress(state), knownWin: false, kind: 'newPublicExposure' };
        if (!preferActualPeek) return candidate;
        exposureFallback ??= candidate;
      }
    }
    if (!state.alive.some(Boolean) && !state.tray.length) return { path, knownPrefixTaps: path.length,
      boundaryIndex: null, newlyExposed: [], knownProgress: progress(state), knownWin: true, kind: 'completeKnownWin' };
    if (path.length >= maxTaps) { boundary = true; return null; }
    const key = identity(state), earlier = visited.get(key);
    if (earlier !== undefined && earlier <= path.length) return null;
    visited.set(key, path.length); nodes++;
    const candidates = [];
    for (const index of legal(game, state).free) {
      if (stopped()) break;
      if (!path.length && !allowedRoots.has(index)) continue;
      const moved = advance(game, state, index);
      if (moved.uncertain) {
        const clockSafe = !game.clock || !state.alive[game.clock.i] || game.clock.n - state.moves > 2;
        if (moved.reason === 'unseenPicture' && state.down[index] === 1 && state.tray.length <= peekTrayLimit && clockSafe) {
          return { path: path.concat(index), knownPrefixTaps: path.length, boundaryIndex: index,
            newlyExposed: [], knownProgress: progress(state), knownWin: false, kind: 'actualPeekRequired' };
        }
        boundary = true; continue;
      }
      if (moved.lost) continue;
      candidates.push({ index, moved });
    }
    candidates.sort((left, right) => left.moved.state.tray.length - right.moved.state.tray.length
      || right.moved.removed - left.moved.removed);
    for (const candidate of candidates) {
      if (stopped()) break;
      const found = visit(candidate.moved.state, path.concat(candidate.index));
      if (found) return found;
    }
    return null;
  }
  const preferred = visit(initial, []), found = preferred ?? exposureFallback;
  return { ...found, path: found?.path ?? null, nodes, boundary: found ? !found.knownWin : boundary,
    reason: found ? 'constructive_public_information_route' : reason, imaginedPicturesAdded: 0,
    ...(preferActualPeek ? { exposureFallbackUsed: !preferred && !!exposureFallback,
      budgetStopReason: ['deadline', 'node_limit'].includes(reason) ? reason : null } : {}) };
}

module.exports = { explorationWitness };
