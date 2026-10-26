'use strict';
const assert = require('assert/strict');
const { legal, advance } = require('./known_tray_plan.js');
const { aliveSignature } = require('./public_alive_signature.js');
const { createExposureFrontier } = require('./public_exposure_frontier.js');

function createReusableExploration(options = {}) {
  const maximumJobs = options.maximumJobs ?? 128, maximumStates = options.maximumStates ?? 8192;
  const maximumTotalStates = options.maximumTotalStates ?? 65536;
  assert([maximumJobs, maximumStates, maximumTotalStates].every(value => Number.isInteger(value) && value > 0));
  assert(maximumStates <= maximumTotalStates);
  const jobs = new Map();
  let storedStates = 0;
  const counters = { calls: 0, createdJobs: 0, reusedJobs: 0, resumedUnfinished: 0, workUnits: 0,
    expandedStates: 0, evictedJobs: 0, returnedRoutes: 0, rejectedRoutes: 0, maximumSliceMs: 0 };
  const remove = key => {
    const job = jobs.get(key); job.iterator.return(); storedStates -= job.visited.size;
    jobs.delete(key); counters.evictedJobs++;
  };
  const search = (game, state, roots, settings = {}) => {
    const began = Date.now(), deadline = settings.deadline ?? began + 250;
    const units = settings.nodes ?? 2000, taps = settings.taps ?? 128, peekTrayLimit = settings.peekTrayLimit ?? 1;
    assert(Number.isFinite(deadline)); assert(Number.isInteger(units) && units > 0);
    assert(Number.isInteger(taps) && taps > 0 && taps <= 512);
    assert(Number.isInteger(peekTrayLimit) && peekTrayLimit >= 0 && peekTrayLimit <= 2);
    assert.equal(typeof settings.version, 'string'); assert(settings.version.length > 0);
    assert(!settings.preferActualPeek, 'Reusable exploration currently preserves the exposure-first information policy');
    assert(Object.keys(game).every(key => ['tiles', 'nb', 'rules', 'clock', 'publicFrontier', 'publicExposure',
      'publicRoleExposure', 'publicInformationExposure'].includes(key)));
    assert(Array.isArray(roots) && roots.every(action => Number.isInteger(action.index)));
    const allowedRoots = new Set(roots.map(action => action.index));
    assert.equal(allowedRoots.size, roots.length);
    const stateFields = position => ['alive', 'pictures', 'down', 'tray', 'moves', 'openPeek', 'relieved', 'arriving']
      .map(field => position[field] ?? null);
    const rules = game.rules ? [game.rules.ice, Array.from(game.rules.locks ?? []), game.rules.keys] : null;
    const key = JSON.stringify([settings.version, stateFields(state), roots.map(action => action.index), taps, peekTrayLimit,
      game.tiles.map(tile => [tile.x, tile.y, tile.z]), game.nb, rules, game.clock]);
    counters.calls++;
    const empty = (reason, nodes = 0, job = null, resumed = false) => {
      counters.maximumSliceMs = Math.max(counters.maximumSliceMs, Date.now() - began);
      return { path: null, nodes, boundary: true, reason, imaginedPicturesAdded: 0,
        reusable: { resumed, cumulativeWork: job?.work ?? 0, expandedStates: job?.visited.size ?? 0 } };
    };
    if (Date.now() >= deadline) return empty('deadline');
    let job = jobs.get(key);
    const resumed = !!job;
    if (job) {
      counters.reusedJobs++; counters.resumedUnfinished += +(!job.exhausted && !job.found);
      jobs.delete(key); jobs.set(key, job);
    } else {
      while (jobs.size >= maximumJobs) remove(jobs.keys().next().value);
      job = { initial: structuredClone(state), visited: new Map(), work: 0, found: null, exhausted: false,
        unknownBoundary: false, depthBoundary: false, capped: false };
      const initial = job.initial, pictureExposure = createExposureFrontier(game.tiles, initial, 'all');
      const exposure = game.publicInformationExposure ?? (game.publicRoleExposure
        ? position => [...new Set([...pictureExposure(position), ...game.publicRoleExposure(position)])] : pictureExposure);
      const progress = position => initial.alive.reduce((total, alive, index) => total + +(alive && !position.alive[index]), 0);
      const identity = position => aliveSignature(position.alive) + '|' + JSON.stringify([position.tray,
        position.openPeek, !!position.relieved, position.arriving ?? [],
        game.clock && position.alive[game.clock.i] ? position.moves : 0]);
      function* visit(position, path) {
        yield null;
        if (!position.alive.some(Boolean) && !position.tray.length) return { path, kind: 'completeKnownWin', knownWin: true };
        if (path.length && position.tray.length <= 2 && exposure(position).length) return { path, kind: 'newPublicExposure', knownWin: false };
        if (path.length >= taps) { job.depthBoundary = true; return null; }
        const signature = identity(position), previous = job.visited.get(signature);
        if (previous !== undefined && previous <= path.length) return null;
        if (previous === undefined && job.visited.size >= maximumStates) { job.capped = true; return null; }
        if (previous === undefined) { storedStates++; counters.expandedStates++; }
        job.visited.set(signature, path.length);
        const candidates = [];
        for (const index of legal(game, position).free) {
          yield null;
          if (!path.length && !allowedRoots.has(index)) continue;
          const moved = advance(game, position, index);
          if (moved.uncertain) {
            job.unknownBoundary = true;
            const clockSafe = !game.clock || !position.alive[game.clock.i] || game.clock.n - position.moves > 2;
            if (moved.reason === 'unseenPicture' && position.down[index] === 1 && position.tray.length <= peekTrayLimit && clockSafe) {
              return { path: path.concat(index), kind: 'actualPeekRequired', knownWin: false };
            }
            continue;
          }
          if (!moved.lost) candidates.push({ index, moved });
        }
        candidates.sort((left, right) => left.moved.state.tray.length - right.moved.state.tray.length
          || right.moved.removed - left.moved.removed);
        for (const candidate of candidates) {
          const result = yield* visit(candidate.moved.state, path.concat(candidate.index));
          if (result) return result;
        }
        return null;
      }
      job.iterator = visit(initial, []);
      job.validate = (found, currentGame, current, currentDeadline) => {
        let position = current;
        const prefixLength = found.kind === 'actualPeekRequired' ? found.path.length - 1 : found.path.length;
        for (const index of found.path.slice(0, prefixLength)) {
          if (Date.now() >= currentDeadline) return null;
          const allowed = legal(currentGame, position);
          if (!allowed.free.includes(index) || allowed.uncertain?.includes(index)) return null;
          const moved = advance(currentGame, position, index);
          if (moved.uncertain || moved.lost) return null;
          position = moved.state;
        }
        let newlyExposed = [], boundaryIndex = null;
        if (found.kind === 'completeKnownWin') {
          if (position.alive.some(Boolean) || position.tray.length) return null;
        } else if (found.kind === 'newPublicExposure') {
          const currentPictureExposure = createExposureFrontier(currentGame.tiles, current, 'all');
          newlyExposed = Array.from(currentGame.publicInformationExposure ? currentGame.publicInformationExposure(position)
            : new Set([...currentPictureExposure(position), ...(currentGame.publicRoleExposure?.(position) ?? [])]));
          if (position.tray.length > 2 || !newlyExposed.length) return null;
        } else {
          boundaryIndex = found.path.at(-1);
          const allowed = legal(currentGame, position);
          if (!allowed.free.includes(boundaryIndex) || allowed.uncertain?.includes(boundaryIndex)
            || position.pictures[boundaryIndex] !== null || position.down[boundaryIndex] !== 1
            || position.tray.length > peekTrayLimit || currentGame.clock && position.alive[currentGame.clock.i]
              && currentGame.clock.n - position.moves <= 2) return null;
        }
        if (Date.now() >= currentDeadline) return null;
        return { ...found, path: found.path.slice(), newlyExposed, boundaryIndex, knownPrefixTaps: prefixLength,
          knownProgress: progress(position) };
      };
      jobs.set(key, job); counters.createdJobs++;
    }
    let nodes = 0;
    while (!job.exhausted && !job.found && nodes < units && Date.now() < deadline) {
      const result = job.iterator.next(); nodes++; job.work++; counters.workUnits++;
      if (result.done) { job.exhausted = true; job.found = result.value; }
      if (job.capped) { job.iterator.return(); job.exhausted = true; }
      while (storedStates > maximumTotalStates && jobs.size > 1) {
        const victim = Array.from(jobs.keys()).find(candidate => candidate !== key); remove(victim);
      }
    }
    if (job.found) {
      const validated = job.validate(job.found, game, state, deadline);
      if (validated) {
        counters.returnedRoutes++;
        counters.maximumSliceMs = Math.max(counters.maximumSliceMs, Date.now() - began);
        return { ...validated, nodes, boundary: !validated.knownWin, reason: 'constructive_public_information_route',
          imaginedPicturesAdded: 0, reusable: { resumed, cumulativeWork: job.work, expandedStates: job.visited.size } };
      }
      if (Date.now() >= deadline) return empty('deadline', nodes, job, resumed);
      counters.rejectedRoutes++; remove(key);
      return empty('stale_route_rejected', nodes, job, resumed);
    }
    return empty(Date.now() >= deadline ? 'deadline' : job.capped ? 'state_cap' : job.exhausted
      ? 'unresolved_frontier_exhausted' : 'node_limit', nodes, job, resumed);
  };
  return { search, stats: () => ({ ...counters, jobs: jobs.size, storedStates }) };
}

module.exports = { createReusableExploration };
