'use strict';
const assert = require('assert/strict');
const { legal, advance } = require('./known_tray_plan.js');
const { aliveSignature } = require('./public_alive_signature.js');
const { createExposureFrontier } = require('./public_exposure_frontier.js');

function simplifyKnownPrefix(game, state, path, knownPrefixTaps, roots, deadline) {
  const result = path.slice(); let position = state, offset = 0, removed = 0;
  const same = (left,right) => JSON.stringify(['alive','tray','moves','openPeek','relieved','arriving']
    .map(field=>left[field]??null)) === JSON.stringify(['alive','tray','moves','openPeek','relieved','arriving']
    .map(field=>right[field]??null));
  while (offset < knownPrefixTaps && Date.now() < deadline) {
    const allowed = legal(game,position), index = result[offset];
    if (!allowed.free.includes(index) || allowed.uncertain?.includes(index)) break;
    const first = advance(game,position,index);
    if (first.uncertain || first.lost) break;
    const next = result[offset+1];
    if (first.removed === 0 && offset+1 < knownPrefixTaps && (offset !== 0 || roots.has(next))
      && allowed.free.includes(next) && !allowed.uncertain?.includes(next)) {
      const afterFirst = legal(game,first.state);
      if (afterFirst.free.includes(next) && !afterFirst.uncertain?.includes(next)) {
        const both = advance(game,first.state,next), direct = advance(game,position,next);
        if (!both.uncertain && !both.lost && !direct.uncertain && !direct.lost && same(both.state,direct.state)) {
          result.splice(offset,1); knownPrefixTaps--; removed++; continue;
        }
      }
    }
    position = first.state; offset++;
  }
  return {path:result,knownPrefixTaps,removedKnownPeeks:removed};
}

function createReusableExploration(options = {}) {
  const maximumJobs = options.maximumJobs ?? 128, maximumStates = options.maximumStates ?? 8192;
  const maximumTotalStates = options.maximumTotalStates ?? 65536;
  const maximumDependencies = options.maximumDependencies ?? 32768, maximumTotalDependencies = options.maximumTotalDependencies ?? 131072;
  assert([maximumJobs, maximumStates, maximumTotalStates, maximumDependencies, maximumTotalDependencies]
    .every(value => Number.isInteger(value) && value > 0));
  assert(maximumStates <= maximumTotalStates);
  assert(maximumDependencies <= maximumTotalDependencies);
  const jobs = new Map();
  const preferInvestedWork = options.preferInvestedWork ?? false;
  assert.equal(typeof preferInvestedWork, 'boolean');
  const evictionVictim = (protectedKey = null) => {
    const candidates = Array.from(jobs.keys()).filter(candidate => candidate !== protectedKey);
    assert(candidates.length);
    if (!preferInvestedWork) return candidates[0];
    const value = key => {
      const retained = jobs.get(key);
      return retained.found?.knownWin ? Infinity : retained.exhausted || retained.capped ? -1 : retained.work;
    };
    return candidates.reduce((selected, candidate) => value(candidate) < value(selected) ? candidate : selected);
  };
  let storedStates = 0, storedDependencies = 0;
  const counters = { calls: 0, createdJobs: 0, reusedJobs: 0, resumedUnfinished: 0, workUnits: 0,
    expandedStates: 0, evictedJobs: 0, returnedRoutes: 0, rejectedRoutes: 0, maximumSliceMs: 0,
    dependencyQueries: 0, preservedAfterValidation: 0, dependencyRestarts: 0, knowledgeResets: 0, resumedWorkUnits: 0 };
  counters.yieldedInformation = 0; counters.cachedIntermediateReturns = 0;
  const remove = key => {
    const job = jobs.get(key); job.iterator.return(); storedStates -= job.visited.size;
    storedDependencies -= job.dependencies.size;
    jobs.delete(key); counters.evictedJobs++;
  };
  const search = (game, state, roots, settings = {}) => {
    const began = Date.now(), deadline = settings.deadline ?? began + 250;
    const units = settings.nodes ?? 2000, taps = settings.taps ?? 128, peekTrayLimit = settings.peekTrayLimit ?? 1;
    assert(Number.isFinite(deadline)); assert(Number.isInteger(units) && units > 0);
    assert(Number.isInteger(taps) && taps > 0 && taps <= 512);
    assert(Number.isInteger(peekTrayLimit) && peekTrayLimit >= 0 && peekTrayLimit <= 2);
    assert.equal(typeof settings.version, 'string'); assert(settings.version.length > 0);
    const dependencyAware = settings.revalidatePublicChanges ?? false;
    const continueAfterInformation = settings.continueAfterInformation ?? false;
    const consumeInformation = settings.consumeInformation ?? true;
    const simplifyPrefixes = settings.simplifyPrefixes ?? false;
    const validationLimit = settings.validationQueries ?? maximumDependencies;
    assert.equal(typeof dependencyAware, 'boolean'); assert(Number.isInteger(validationLimit) && validationLimit > 0);
    assert.equal(typeof continueAfterInformation, 'boolean');
    assert.equal(typeof consumeInformation, 'boolean');
    assert.equal(typeof simplifyPrefixes, 'boolean');
    assert(consumeInformation || continueAfterInformation);
    assert(!settings.preferActualPeek, 'Reusable exploration currently preserves the exposure-first information policy');
    assert(Object.keys(game).every(key => ['tiles', 'nb', 'rules', 'clock', 'publicFrontier', 'publicExposure',
      'publicRoleExposure', 'publicInformationExposure'].includes(key)));
    assert(Array.isArray(roots) && roots.every(action => Number.isInteger(action.index)));
    const allowedRoots = new Set(roots.map(action => action.index));
    assert.equal(allowedRoots.size, roots.length);
    const stateFields = position => ['alive', 'pictures', 'down', 'tray', 'moves', 'openPeek', 'relieved', 'arriving']
      .map(field => position[field] ?? null);
    const physicalFields = position => ['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving']
      .map(field => position[field] ?? null);
    const rules = game.rules ? [game.rules.ice, Array.from(game.rules.locks ?? []), game.rules.keys] : null;
    const key = JSON.stringify([dependencyAware ? 'dependency-aware' : settings.version,
      dependencyAware ? physicalFields(state) : stateFields(state), roots.map(action => action.index), taps, peekTrayLimit, continueAfterInformation,
      game.tiles.map(tile => [tile.x, tile.y, tile.z]), game.nb, rules, game.clock, simplifyPrefixes]);
    const revision = JSON.stringify([settings.version, state.pictures, state.down,
      ['publicFrontier', 'publicInformationExposure', 'publicRoleExposure'].map(field => typeof game[field])]);
    let dependencyQueries = 0;
    counters.calls++;
    const empty = (reason, nodes = 0, job = null, resumed = false) => {
      counters.maximumSliceMs = Math.max(counters.maximumSliceMs, Date.now() - began);
      return { path: null, nodes, boundary: true, reason, imaginedPicturesAdded: 0,
        reusable: { resumed, cumulativeWork: job?.work ?? 0, expandedStates: job?.visited.size ?? 0,
          ...(dependencyAware ? { dependencyQueries, pendingDependencyChecks: job?.validation
            ? job.validation.records.length - job.validation.cursor : 0 } : {}) } };
    };
    if (Date.now() >= deadline) return empty('deadline');
    let job = jobs.get(key);
    let resumed = !!job;
    if (job && dependencyAware && job.revision !== revision) {
      const compatible = job.initial.pictures.every((picture, index) => !state.alive[index] || picture === null || picture === state.pictures[index])
        && job.initial.down.every((down, index) => !state.alive[index] || down === null || down === state.down[index]);
      if (!compatible || job.capped) {
        counters.knowledgeResets += +!compatible; counters.dependencyRestarts++;
        remove(key); job = null; resumed = false;
      } else {
        for (let index = 0; index < state.alive.length; index++) {
          job.initial.pictures[index] = state.pictures[index]; job.initial.down[index] = state.down[index];
        }
        job.currentGame = game; job.refreshExposure();
        if (job.validation?.revision !== revision) job.validation = { revision, records: Array.from(job.dependencies.values()), cursor: 0 };
        let changed = false;
        while (job.validation.cursor < job.validation.records.length && dependencyQueries < validationLimit && Date.now() < deadline) {
          const record = job.validation.records[job.validation.cursor++];
          dependencyQueries++; counters.dependencyQueries++;
          if (job.fingerprint(record.kind, record.position, record.index) !== record.answer) { changed = true; break; }
        }
        if (changed) {
          counters.dependencyRestarts++; remove(key); job = null; resumed = false;
        } else if (job.validation.cursor < job.validation.records.length) {
          return empty(Date.now() >= deadline ? 'deadline' : 'dependency_validation_limit', 0, job, true);
        } else {
          job.validation = null; job.revision = revision; counters.preservedAfterValidation++;
        }
      }
    }
    if (job) {
      counters.reusedJobs++; job.currentGame = game;
      jobs.delete(key); jobs.set(key, job);
    } else {
      while (jobs.size >= maximumJobs) remove(evictionVictim());
      job = { initial: structuredClone(state), visited: new Map(), work: 0, found: null, exhausted: false,
        unknownBoundary: false, depthBoundary: false, capped: false, dependencies: new Map(), currentGame: game,
        revision, validation: null, dependencyCap: false, pendingOffer: null };
      const initial = job.initial;
      job.refreshExposure = () => {
        const model = job.currentGame, pictureExposure = createExposureFrontier(model.tiles, initial, 'all');
        job.exposure = model.publicInformationExposure ?? (model.publicRoleExposure
          ? position => [...new Set([...pictureExposure(position), ...model.publicRoleExposure(position)])] : pictureExposure);
      };
      job.refreshExposure();
      job.rawQuery = (kind, position, index) => {
        if (kind === 'exposure') return Array.from(job.exposure(position));
        const allowed = legal(job.currentGame, position);
        if (kind === 'legal') return allowed;
        if (!allowed.free.includes(index)) return { blocked: true };
        return advance(job.currentGame, position, index);
      };
      const canonical = (kind, value) => kind === 'exposure' ? Array.from(value).sort((left, right) => left - right)
        : kind === 'legal' ? [value.free, value.uncertain ?? [], !!value.relieved]
          : value.blocked || value.uncertain ? [!!value.blocked, !!value.uncertain, value.reason ?? null]
            : [physicalFields(value.state), value.removed, !!value.lost, !!value.win];
      job.fingerprint = (kind, position, index) => JSON.stringify(canonical(kind, job.rawQuery(kind, position, index)));
      const query = (kind, position, index = null) => {
        const value = job.rawQuery(kind, position, index);
        if (dependencyAware) {
          const identity = kind + '|' + index + '|' + JSON.stringify(physicalFields(position));
          if (!job.dependencies.has(identity)) {
            if (job.dependencies.size >= maximumDependencies) { job.capped = true; job.dependencyCap = true; }
            else { job.dependencies.set(identity, { kind, position, index, answer: JSON.stringify(canonical(kind, value)) }); storedDependencies++; }
          }
        }
        return value;
      };
      const progress = position => initial.alive.reduce((total, alive, index) => total + +(alive && !position.alive[index]), 0);
      const identity = position => aliveSignature(position.alive) + '|' + JSON.stringify([position.tray,
        position.openPeek, !!position.relieved, position.arriving ?? [],
        game.clock && position.alive[game.clock.i] ? position.moves : 0]);
      const rememberVisit = (position, path) => {
        const signature = identity(position), previous = job.visited.get(signature);
        if (previous !== undefined && previous <= path.length) return false;
        if (previous === undefined && job.visited.size >= maximumStates) { job.capped = true; return false; }
        if (previous === undefined) { storedStates++; counters.expandedStates++; }
        job.visited.set(signature, path.length); return true;
      };
      function* visit(position, path) {
        yield null;
        if (!position.alive.some(Boolean) && !position.tray.length) return { path, kind: 'completeKnownWin', knownWin: true };
        if (path.length && position.tray.length <= 2 && query('exposure', position).length) {
          const witness = { path, kind: 'newPublicExposure', knownWin: false };
          if (!continueAfterInformation) return witness;
          if (!rememberVisit(position, path)) return null;
          yield witness; return null;
        }
        if (path.length >= taps) { job.depthBoundary = true; return null; }
        if (!rememberVisit(position, path)) return null;
        const candidates = [];
        for (const index of query('legal', position).free) {
          yield null;
          if (!path.length && !allowedRoots.has(index)) continue;
          const moved = query('advance', position, index);
          if (moved.blocked) { job.unknownBoundary = true; continue; }
          if (moved.uncertain) {
            job.unknownBoundary = true;
            const clockSafe = !game.clock || !position.alive[game.clock.i] || game.clock.n - position.moves > 2;
            if (moved.reason === 'unseenPicture' && position.down[index] === 1 && position.tray.length <= peekTrayLimit && clockSafe) {
              const witness = { path: path.concat(index), kind: 'actualPeekRequired', knownWin: false };
              if (!continueAfterInformation) return witness;
              yield witness;
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
        let removedKnownPeeks = 0;
        if (simplifyPrefixes) {
          const prefix = found.kind === 'actualPeekRequired' ? found.path.length - 1 : found.path.length;
          const simplified = simplifyKnownPrefix(currentGame,current,found.path,prefix,allowedRoots,currentDeadline);
          found = {...found,path:simplified.path}; removedKnownPeeks = simplified.removedKnownPeeks;
        }
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
          ...(simplifyPrefixes ? {removedKnownPeeks} : {}),
          knownProgress: progress(position) };
      };
      jobs.set(key, job); counters.createdJobs++;
    }
    let nodes = 0;
    const unfinished = !job.exhausted && !job.found;
    while (!job.exhausted && !job.found && !job.pendingOffer && nodes < units && Date.now() < deadline) {
      const result = job.iterator.next(); nodes++; job.work++; counters.workUnits++;
      if (result.done) { job.exhausted = true; job.found = result.value; }
      else if (result.value?.kind) { job.pendingOffer = result.value; counters.yieldedInformation++; }
      if (job.capped) { job.iterator.return(); job.exhausted = true; job.found = null; job.pendingOffer = null; }
      while ((storedStates > maximumTotalStates || storedDependencies > maximumTotalDependencies) && jobs.size > 1) {
        remove(evictionVictim(key));
      }
    }
    if (resumed && unfinished && nodes) { counters.resumedUnfinished++; counters.resumedWorkUnits += nodes; }
    const candidate = job.found ?? job.pendingOffer;
    if (candidate) {
      const validated = job.validate(candidate, game, state, deadline);
      if (validated) {
        counters.returnedRoutes++;
        counters.cachedIntermediateReturns += +(resumed && !!job.found && !job.found.knownWin && nodes === 0);
        const continuing = !!job.pendingOffer;
        if (consumeInformation) job.pendingOffer = null;
        counters.maximumSliceMs = Math.max(counters.maximumSliceMs, Date.now() - began);
        return { ...validated, nodes, boundary: !validated.knownWin, reason: 'constructive_public_information_route',
          imaginedPicturesAdded: 0, reusable: { resumed, cumulativeWork: job.work, expandedStates: job.visited.size,
            ...(continueAfterInformation ? { informationContinued: continuing, iteratorOpen: !job.exhausted } : {}),
            ...(dependencyAware ? { dependencyQueries, pendingDependencyChecks: 0 } : {}) } };
      }
      if (Date.now() >= deadline) return empty('deadline', nodes, job, resumed);
      counters.rejectedRoutes++; remove(key);
      return empty('stale_route_rejected', nodes, job, resumed);
    }
    return empty(Date.now() >= deadline ? 'deadline' : job.dependencyCap ? 'dependency_cap' : job.capped ? 'state_cap' : job.exhausted
      ? 'unresolved_frontier_exhausted' : 'node_limit', nodes, job, resumed);
  };
  return { search, stats: () => ({ ...counters, jobs: jobs.size, storedStates, storedDependencies,
    jobsValidating: Array.from(jobs.values()).filter(job => job.validation).length }) };
}

module.exports = { createReusableExploration, simplifyKnownPrefix };
