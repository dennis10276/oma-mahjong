'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { advance, legal } = require('./known_tray_plan.js');
const { searchHypothesisContinuation } = require('./public_hypothesis_rollout.js');

function roleAt(game, state, index) {
  if (state.relieved || !game.rules) return 'none';
  const removed = game.rules.iceNb[index].filter(neighbor => !state.alive[neighbor]).length;
  const ice = Math.max(0, (game.rules.ice[index] || 0) - removed);
  if (ice) return ice > 1 ? 'ice2' : 'ice';
  const activeKeys = game.rules.keys.some(key => state.alive[key]);
  if (activeKeys && game.rules.locks.has(index)) return 'lock';
  if (activeKeys && game.rules.keys.includes(index)) return 'key';
  return 'none';
}

function sameFrame(actual, expected) {
  return ['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps']
    .every(field => JSON.stringify(actual[field]) === JSON.stringify(expected[field]));
}

function createHypothesisPhysics(input, { random = Math.random, now = Date.now, maximumAssignments = 12 } = {}) {
  assert(Object.keys(input).every(key => ['tiles', 'rememberedPictures', 'rememberedDown', 'initialRoles',
    'episodes', 'blockedFacts', 'boardMode', 'clock'].includes(key)));
  assert.equal(typeof random, 'function'); assert.equal(typeof now, 'function');
  assert(Number.isInteger(maximumAssignments) && maximumAssignments > 0 && maximumAssignments <= 64);
  const physicalFields = ['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps'];
  const physicalCopy = state => {
    assert(Object.keys(state).every(key => physicalFields.includes(key)));
    return Object.fromEntries(physicalFields.map(key => [key,
      ['alive', 'tray', 'arriving'].includes(key) ? Array.from(state[key]) : state[key]]));
  };
  const problem = { tiles: input.tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z })),
    rememberedPictures: Array.from(input.rememberedPictures), rememberedDown: Array.from(input.rememberedDown),
    initialRoles: Array.from(input.initialRoles), boardMode: input.boardMode,
    clock: input.clock ? { i: input.clock.i, n: input.clock.n } : null,
    blockedFacts: input.blockedFacts.map(fact => {
      assert(Object.keys(fact).every(key => ['index', 'attempt', 'physicalTaps', 'alive', 'source'].includes(key)));
      return { index: fact.index, attempt: fact.attempt, physicalTaps: fact.physicalTaps, alive: Array.from(fact.alive) };
    }),
    episodes: input.episodes.map(episode => {
      assert(Object.keys(episode).every(key => ['actions', 'frames', 'status'].includes(key)));
      return { actions: Array.from(episode.actions), status: episode.status, frames: episode.frames.map(frame => {
        assert(Object.keys(frame).every(key => ['state', 'roles'].includes(key)));
        return { state: physicalCopy(frame.state), roles: Array.from(frame.roles) };
      }) };
    }) };
  const size = problem.tiles.length;
  assert(['standard', 'lab'].includes(problem.boardMode));
  assert(size > 0 && size % 2 === 0);
  for (const field of ['rememberedPictures', 'rememberedDown', 'initialRoles']) assert.equal(problem[field].length, size);
  assert(problem.rememberedDown.every(value => value === null || value === 0 || value === 1));
  const roleNames = ['none', 'ice', 'ice2', 'lock', 'key'];
  assert(problem.initialRoles.every(role => role === null || roleNames.includes(role)));
  assert(problem.episodes.length && problem.episodes.every(episode => episode.frames.length === episode.actions.length + 1));
  const neighbors = Layouts.neighbors(problem.tiles), iceNb = Layouts.iceNeighbors(problem.tiles);
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 4096 };
  const domains = problem.initialRoles.map(role => role === null ? roleNames.slice() : [role]);
  const observations = [];
  for (const episode of problem.episodes) for (const frame of episode.frames) {
    assert.equal(frame.roles.length, size);
    if (frame.state.relieved) continue;
    frame.roles.forEach((role, index) => {
      if (role === null || !frame.state.alive[index]) return;
      assert(roleNames.includes(role)); observations.push({ index, role, state: frame.state });
      const removed = iceNb[index].filter(neighbor => !frame.state.alive[neighbor]).length;
      domains[index] = domains[index].filter(candidate => {
        if (role === 'key' || role === 'lock') return candidate === role;
        if (role.startsWith('ice')) return candidate.startsWith('ice') && (candidate === 'ice2' ? 2 : 1) - removed === (role === 'ice2' ? 2 : 1);
        return !candidate.startsWith('ice') || (candidate === 'ice2' ? 2 : 1) <= removed;
      });
    });
  }
  for (const fact of problem.blockedFacts) {
    const removed = iceNb[fact.index].filter(neighbor => !fact.alive[neighbor]).length;
    domains[fact.index] = domains[fact.index].filter(role => role === 'lock'
      || role.startsWith('ice') && (role === 'ice2' ? 2 : 1) > removed);
  }
  assert(domains.every(domain => domain.length), 'Actual public evidence contradicts the declared obstacle model');
  const draw = limit => {
    const value = random(); assert(Number.isFinite(value) && value >= 0 && value < 1);
    return Math.floor(value * limit);
  };
  const stats = { assignments: 0, rejectedAssignments: 0, historyReplays: 0, verifiedHypotheticalClears: 0, deadlineStops: 0,
    thinRolloutClears: 0, wideRolloutClears: 0, unresolvedRollouts: 0, certifiedRolloutLosses: 0 };
  let cachedOrdinal = null, cachedPictures = null, cached = null;
  const replayPrefix = (game, episode, deadline, validateFrames) => {
    if (now() >= deadline) return null;
    const session = factory(game, settings);
    if (validateFrames && !sameFrame(session.view().state, episode.frames[0].state)) return null;
    for (const [offset, index] of episode.actions.entries()) {
      if (now() >= deadline) return null;
      const view = session.view();
      if (view.type === 'productionPhysicalEnd-v1' || !view.legalTiles.includes(index)) return null;
      const after = session.tap(index);
      if (validateFrames && !sameFrame(after.state, episode.frames[offset + 1].state)) return null;
    }
    if (episode.status === 'physicalLoss' && (session.view().type !== 'productionPhysicalEnd-v1' || session.view().win)) return null;
    if (episode.status === 'cleared' && !session.view().win) return null;
    return session;
  };
  const completeWorld = (hypothesis, deadline) => {
    assert.equal(hypothesis.kind, 'pairedPictureHypothesis'); assert.equal(hypothesis.observedFact, false);
    assert.equal(hypothesis.pictures.length, size);
    const odd = new Set();
    hypothesis.pictures.forEach(picture => {
      assert(Number.isInteger(picture) && (picture >= 0 && picture < 36 || picture === 101));
      if (odd.has(picture)) odd.delete(picture); else odd.add(picture);
    });
    assert.equal(odd.size, 0, 'A picture hypothesis must obey the paired opening contract');
    assert(hypothesis.pictures.filter(picture => picture === 101).length <= 2);
    problem.rememberedPictures.forEach((picture, index) => { if (picture !== null) assert.equal(hypothesis.pictures[index], picture); });
    for (let attempt = 0; attempt < maximumAssignments && now() < deadline; attempt++) {
      stats.assignments++;
      const down = problem.rememberedDown.map((value, index) => value !== null ? value
        : !domains[index].includes('none') && problem.boardMode === 'standard' ? 0 : +(draw(100) < 35));
      const choices = domains.map((domain, index) => problem.boardMode === 'standard' && down[index]
        ? domain.filter(role => role === 'none') : domain.slice());
      if (choices.some(domain => !domain.length)) { stats.rejectedAssignments++; continue; }
      const fixedKeys = choices.flatMap((domain, index) => domain.length === 1 && domain[0] === 'key' ? [index] : []);
      if (fixedKeys.length > 2) { stats.rejectedAssignments++; continue; }
      const candidateKeys = choices.flatMap((domain, index) => domain.includes('key') && !fixedKeys.includes(index) ? [index] : []);
      const forcedLock = choices.some(domain => domain.length === 1 && domain[0] === 'lock');
      const keyCount = fixedKeys.length || forcedLock || candidateKeys.length >= 2 && draw(4) === 0 ? 2 : 0;
      if (fixedKeys.length + candidateKeys.length < keyCount) { stats.rejectedAssignments++; continue; }
      const keys = fixedKeys.slice();
      while (keys.length < keyCount) keys.push(candidateKeys.splice(draw(candidateKeys.length), 1)[0]);
      const ice = {}, locks = new Set();
      let invalid = false;
      for (const [index, domain] of choices.entries()) {
        if (keys.includes(index)) continue;
        const options = domain.filter(role => role !== 'key' && (keyCount > 0 || role !== 'lock'));
        if (!options.length) { invalid = true; break; }
        const role = options.includes('none') && draw(5) > 0 ? 'none' : options[draw(options.length)];
        if (role === 'lock') locks.add(index);
        if (role.startsWith('ice')) ice[index] = role === 'ice2' ? 2 : 1;
      }
      if (invalid) { stats.rejectedAssignments++; continue; }
      const game = { tiles: problem.tiles, nb: neighbors, faces: hypothesis.pictures.slice(), down,
        rules: { iceNb, ice, locks, keys }, clock: problem.clock };
      if (observations.some(row => roleAt(game, row.state, row.index) !== row.role)
        || problem.blockedFacts.some(fact => Layouts.takeable(fact.index, fact.alive, neighbors, game.rules, fact.alive.map(() => 1))
          || !fact.alive.some((alive, index) => alive && Layouts.takeable(index, fact.alive, neighbors, game.rules, fact.alive.map(() => 1))))) {
        stats.rejectedAssignments++; continue;
      }
      let last = null;
      for (const episode of problem.episodes) {
        stats.historyReplays++; last = replayPrefix(game, episode, deadline, true);
        if (!last) break;
      }
      if (!last) { stats.rejectedAssignments++; continue; }
      const actual = problem.episodes.at(-1).frames.at(-1).state;
      if (last.view().type === 'productionPhysicalEnd-v1') { stats.rejectedAssignments++; continue; }
      return { game, state: { ...structuredClone(actual), pictures: hypothesis.pictures.slice(),
        down: down.map((value, index) => actual.alive[index] ? value : 0) } };
    }
    if (now() >= deadline) stats.deadlineStops++;
    return null;
  };
  const prepare = request => {
    assert(Object.keys(request).every(key => ['hypothesis', 'worldOrdinal', 'deadline'].includes(key)));
    const { hypothesis, worldOrdinal, deadline } = request;
    assert(Number.isInteger(worldOrdinal) && worldOrdinal > 0);
    assert(Number.isFinite(deadline));
    assert.equal(hypothesis.kind, 'pairedPictureHypothesis'); assert.equal(hypothesis.observedFact, false);
    if (now() >= deadline) { stats.deadlineStops++; return false; }
    const signature = JSON.stringify(hypothesis.pictures);
    if (cachedOrdinal !== worldOrdinal) {
      cachedOrdinal = worldOrdinal; cachedPictures = signature; cached = completeWorld(hypothesis, deadline);
    } else assert.equal(signature, cachedPictures, 'Every root in a balanced batch must use the same picture filling');
    return cached !== null;
  };
  return {
    prepare,
    evaluate({ hypothesis, index, deadline, nodeLimit, worldOrdinal }) {
      const result = (status, nodes) => ({ kind: 'hypothesisEvaluation', status, nodes });
      assert(Number.isInteger(index) && index >= 0 && index < size);
      assert(Number.isInteger(nodeLimit) && nodeLimit > 0);
      assert(Number.isInteger(worldOrdinal) && worldOrdinal > 0);
      assert(Number.isFinite(deadline));
      if (now() >= deadline) { stats.deadlineStops++; return result('unresolved', 0); }
      if (!prepare({ hypothesis, worldOrdinal, deadline })) return result('unresolved', 0);
      const { game, state } = cached, available = legal(game, state).free;
      if (!available.includes(index)) return result('unresolved', 0);
      const moved = advance(game, state, index);
      if (moved.uncertain) return result('unresolved', 1);
      if (moved.lost) return result('lost', 1);
      let path = [index], nodes = 1, status = moved.win ? 'cleared' : 'unresolved', winningBeam = null;
      if (!moved.win && nodeLimit > 1 && now() < deadline) {
        const actions = legal(game, moved.state).free.map(target => ({ index: target }));
        if (actions.length) {
          const planned = searchHypothesisContinuation({ tiles: game.tiles, nb: game.nb, rules: game.rules, clock: game.clock },
            moved.state, actions, { nodeLimit: nodeLimit - 1, deadline });
          nodes += planned.nodes;
          status = planned.status;
          if (status === 'cleared') {
            path = path.concat(planned.path);
            winningBeam = planned.stages.at(-1).beam;
          } else if (status === 'lost') stats.certifiedRolloutLosses++;
          else stats.unresolvedRollouts++;
        }
      }
      if (status === 'cleared') {
        const session = replayPrefix(game, problem.episodes.at(-1), deadline, true);
        if (!session) return result('unresolved', nodes);
        for (const target of path) {
          if (now() >= deadline) { stats.deadlineStops++; return result('unresolved', nodes); }
          assert(session.view().legalTiles.includes(target), 'A hypothetical winning witness contains a production-illegal tap');
          session.tap(target);
        }
        assert.equal(session.view().win, true, 'A hypothetical winning witness failed independent production replay');
        stats.verifiedHypotheticalClears++;
        if (winningBeam !== null) stats[winningBeam === 1 ? 'thinRolloutClears' : 'wideRolloutClears']++;
      }
      return result(status, nodes);
    },
    stats() { return { ...stats }; },
    verifySource: factory.verifySource,
  };
}

module.exports = { createHypothesisPhysics, roleAt, sameFrame };
