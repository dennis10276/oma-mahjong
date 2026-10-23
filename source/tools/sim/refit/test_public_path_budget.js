'use strict';
const assert = require('assert/strict');
const { admitPath } = require('./public_path_budget.js');
const layouts = require('../../../www/layouts.js');
const { search } = require('./public_witness_search.js');
const { legal } = require('./known_tray_plan.js');
const { analyzeRecovery } = require('./public_recovery_graph.js');
const { createSession } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const shortest = new Map();
  assert(admitPath(shortest, 'root', 0)); assert(!admitPath(shortest, 'root', 1));
  assert(admitPath(shortest, 'shared', 4)); assert(!admitPath(shortest, 'shared', 4));
  assert(!admitPath(shortest, 'shared', 5)); assert(admitPath(shortest, 'shared', 3));
  assert(!admitPath(shortest, 'shared', 4)); assert.equal(shortest.get('shared'), 3);
  const graph = { root: [['macro', 2], ['single', 1]], macro: [['shared', 2]],
    single: [['middle', 1]], middle: [['shared', 1]], shared: [['win', 2]], win: [] };
  const visit = depthAware => {
    const seen = new Map([['root', 0]]); let beam = [{ identity: 'root', taps: 0 }], bounded = false;
    while (beam.length) {
      const next = [];
      for (const node of beam) for (const [identity, cost] of graph[node.identity]) {
        const taps = node.taps + cost;
        if (taps > 5) { bounded = true; continue; }
        if (identity === 'win') return { won: true, taps, bounded };
        const accepted = depthAware ? admitPath(seen, identity, taps) : !seen.has(identity);
        if (accepted) { if (!depthAware) seen.set(identity, taps); next.push({ identity, taps }); }
      }
      beam = next;
    }
    return { won: false, bounded };
  };
  assert.deepEqual(visit(false), { won: false, bounded: true });
  assert.deepEqual(visit(true), { won: true, taps: 5, bounded: true });
  const tiles = [{ x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, { x: 0, y: 0, z: 1 },
    { x: 1, y: 0, z: 1 }, { x: 0.5, y: 0, z: 0 }, { x: 16, y: 0, z: 0 }];
  const actual = { tiles, nb: layouts.neighbors(tiles), faces: [1, 1, 2, 2, 3, 3], down: [1, 1, 1, 1, 0, 0], rules: null, clock: null };
  const settings = { seed: 1, choiceLimit: 64, tapMs: 1000 }, session = createSession(actual, settings);
  session.tap(5); session.tap(0);
  const state = { ...session.view().state, pictures: actual.faces.slice() }, snapshot = JSON.stringify(state);
  const game = { tiles, nb: actual.nb, rules: null, clock: null };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const actions = legal(game, state).free.map(index => ({ index }));
  const exact = analyzeRecovery(game, state, { nodes: 10000 });
  assert(exact.complete && exact.knownWinningRoute && exact.minimumKnownTaps === 4);
  const options = { taps: 4, nodes: 128, beam: 8, pruneDead: false, knownPairMacros: true, goalRecovery: true, goalRecoveryMin: 1 };
  const planned = search(game, state, actions, options);
  assert(planned.knownWin && planned.path.length === 4, 'A longer macro prefix must not consume the budget of an identical state later reached by fewer real taps');
  assert(planned.nodes <= options.nodes); assert.equal(JSON.stringify(state), snapshot);
  for (const index of planned.path) session.tap(index);
  assert(session.view().win);
  const complete = [5, 0, ...planned.path];
  assert.equal(verifyAttempt(encodeGame(actual), complete, settings, session.audit()), complete.length);
  const capped = search(game, state, actions, { ...options, taps: 3 });
  assert(!capped.knownWin && !capped.knownDead && capped.boundary);
  const clockTiles = [...tiles, { x: 20, y: 0, z: 0 }, { x: 24, y: 0, z: 0 }];
  const clockActual = { tiles: clockTiles, nb: layouts.neighbors(clockTiles), faces: [1, 1, 2, 2, 3, 3, 3, 3],
    down: [1, 1, 1, 1, 0, 0, 1, 1], clock: { i: 4, n: 6 },
    rules: { iceNb: layouts.iceNeighbors(clockTiles), ice: {}, locks: new Set([4]), keys: [0, 1] } };
  const clockSession = createSession(clockActual, settings); clockSession.tap(5); clockSession.tap(0);
  const clockState = { ...clockSession.view().state, pictures: [1, 1, 2, 2, 3, 3, null, null] };
  const clockGame = { tiles: clockTiles, nb: clockActual.nb, clock: clockActual.clock, rules: clockActual.rules };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(clockGame, field, { get() { throw Error('Private ' + field); } });
  const clockPlan = search(clockGame, clockState, legal(clockGame, clockState).free.map(index => ({ index })), options);
  assert(clockPlan.safeClockExit && !clockPlan.knownWin && clockPlan.path.length === 4);
  assert(!clockPlan.path.some(index => index >= 6), 'The guaranteed clock witness must not sample the extra unknown pictures');
  for (const index of clockPlan.path) clockSession.tap(index);
  assert.equal(clockSession.view().state.alive[4], 0); assert.deepEqual(clockSession.view().state.tray, []);
  const clockPrefix = [5, 0, ...clockPlan.path];
  assert.equal(verifyAttempt(encodeGame(clockActual), clockPrefix, settings, clockSession.audit()), clockPrefix.length);
  console.log('PASS shorter physical-tap transpositions recover a four-tap production clear missed by mixed macro layers, agree with an independent exhaustive graph, preserve state, and leave the three-tap cap unresolved');
}

if (require.main === module) test();
module.exports = test;
