'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createReusableExploration } = require('./public_reusable_exploration.js');
const { createExposureFrontier } = require('./public_exposure_frontier.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createHumanController, verifyAttempt } = require('./human_reference_campaign.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: .28, y: .28 / 1.24, z: 1 }, { x: 1, y: 0, z: 1 },
    { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 },
    { x: 12.28, y: .28 / 1.24, z: 1 }, { x: 20, y: 0, z: 0 }];
  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 64, tapMs: 1000 };
  const config = { version: 'public-role-memory', revalidatePublicChanges: true, nodes: 1000 };
  let replayedTaps = 0;
  const replay = (game, route) => {
    const session = factory(game, settings);
    for (const index of route) { assert(session.view().legalTiles.includes(index)); session.tap(index); }
    replayedTaps += verifyAttempt(encodeGame(game), route, settings, session.audit()); return session.view();
  };
  for (const remembered of [0, 17, 35]) {
    const rememberedPictures = [remembered, 7, 9, 7, remembered, 9, 2, 2];
    const actual = { tiles, nb: Layouts.neighbors(tiles), faces: rememberedPictures.slice(),
      down: tiles.map(() => 0), rules: null, clock: null };
    const initial = factory(actual, settings).view().state;
    const state = { ...initial, pictures: rememberedPictures.slice() }, roles = tiles.map(() => 'none');
    roles[0] = null; roles[4] = null;
    const exposure = createExposureFrontier(tiles, { ...state, roles }, 'all', true);
    const model = { tiles, nb: actual.nb, rules: null, clock: null, publicInformationExposure: exposure };
    const roots = [{ index: 1 }, { index: 6 }], before = structuredClone(state);
    const legacy = createReusableExploration();
    const oldFirst = legacy.search(model, state, roots, config), oldSecond = legacy.search(model, state, roots, config);
    assert.equal(oldFirst.kind, 'newPublicExposure'); assert.deepEqual(oldFirst.path, oldSecond.path);
    assert.equal(oldSecond.nodes, 0); assert.equal(legacy.stats().cachedIntermediateReturns, 1);
    const engine = createReusableExploration();
    const continued = { ...config, continueAfterInformation: true };
    const first = engine.search(model, state, roots, continued), second = engine.search(model, state, roots, continued);
    assert.deepEqual(first.newlyExposed, [0]); assert.deepEqual(second.newlyExposed, [4]);
    assert.notDeepEqual(first.path, second.path); assert(second.nodes > 0);
    assert(first.reusable.informationContinued && first.reusable.iteratorOpen);
    assert(second.reusable.informationContinued && second.reusable.iteratorOpen);
    assert(!first.knownWin && !second.knownWin && !first.knownDead && !second.knownDead);
    assert.equal(engine.stats().cachedIntermediateReturns, 0); assert.equal(engine.stats().yieldedInformation, 2);
    const exhausted = engine.search(model, state, roots, continued);
    assert.equal(exhausted.path, null); assert(exhausted.boundary && !exhausted.knownDead);
    assert.deepEqual(state, before, 'Offering intermediate goals never updates actual picture memory');
    assert(replay(actual, first.path).state.alive[0]); assert(replay(actual, second.path).state.alive[4]);
    if (remembered === 17) {
      const originalNow = Date.now;
      try {
        let clock = 100, expire = true; Date.now = () => clock;
        const expiring = { ...model, publicInformationExposure: position => {
          const answer = exposure(position); if (answer.length && expire) { expire = false; clock = 151; } return answer;
        } };
        const pending = createReusableExploration();
        const stopped = pending.search(expiring, state, roots, { ...continued, deadline: 150 });
        assert.equal(stopped.path, null); assert.equal(stopped.reason, 'deadline');
        clock = 200;
        const recovered = pending.search(expiring, state, roots, { ...continued, deadline: 300 });
        assert.equal(recovered.nodes, 0); assert.deepEqual(recovered.newlyExposed, [0]);
        const alternative = pending.search(expiring, state, roots, { ...continued, deadline: 300 });
        assert.deepEqual(alternative.newlyExposed, [4]);
      } finally { Date.now = originalNow; }
    }
  }
  const flatTiles = [0, 8, 16, 24].map(position => ({ x: position, y: 0, z: 0 }));
  const model = { tiles: flatTiles, nb: Layouts.neighbors(flatTiles), rules: null, clock: null };
  const roots = flatTiles.map((tile, index) => ({ index }));
  let canonical = null;
  for (const hidden of [...Array(36).keys(), 101]) {
    const actual = { ...model, faces: [hidden, hidden, 7, 7], down: [1, 1, 1, 1] };
    const initial = factory(actual, settings).view().state;
    const packet = observeBoard(flatTiles, initial, null, { picture: index => actual.faces[index], role: () => 'none' });
    const state = { ...initial, pictures: packet.pictures, down: packet.down };
    if (canonical === null) canonical = structuredClone(state); else assert.deepEqual(state, canonical);
    const engine = createReusableExploration(), configured = { ...config, continueAfterInformation: true };
    const first = engine.search(model, state, roots, configured), second = engine.search(model, state, roots, configured);
    assert.equal(first.kind, 'actualPeekRequired'); assert.equal(second.kind, 'actualPeekRequired');
    assert.notEqual(first.boundaryIndex, second.boundaryIndex);
    assert(!first.knownWin && !second.knownWin); assert.equal(first.knownPrefixTaps, 0);
    assert.equal(replay(actual, first.path).state.openPeek, first.boundaryIndex);
    assert.equal(replay(actual, second.path).state.openPeek, second.boundaryIndex);
    assert.deepEqual(state, canonical);
  }
  const actual = { ...model, faces: [1, 1, 2, 2], down: [0, 0, 0, 0] };
  const state = { ...factory(actual, settings).view().state, pictures: [1, 1, 2, 2] };
  const engine = createReusableExploration(), configured = { ...config, continueAfterInformation: true };
  const win = engine.search(model, state, roots, configured), cached = engine.search(model, state, roots, configured);
  assert(win.knownWin && cached.knownWin); assert.deepEqual(win.path, cached.path); assert.equal(cached.nodes, 0);
  assert(replay(actual, win.path).win);
  assert.throws(() => createHumanController(flatTiles, { reusableContinueAfterInformation: true }));
  factory.verifySource();
  console.log('PASS intermediate exposure and peek witnesses leave search resumable and produce alternatives, expired validation retains a pending offer, complete wins stay terminal/cached, memory stays public-only and ' + replayedTaps + ' physical taps independently replay across37 concealed-picture worlds and known-memory controls');
}

if (require.main === module) test();
module.exports = test;
