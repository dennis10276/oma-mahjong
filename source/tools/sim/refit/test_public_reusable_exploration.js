'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createReusableExploration } = require('./public_reusable_exploration.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { encodeGame } = require('./personal_game_io.js');
const { verifyAttempt, createHumanController } = require('./human_reference_campaign.js');
const { advance } = require('./known_tray_plan.js');

function test() {
  const tiles = [0, 8, 16, 24].map(position => ({ x: position, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2], down: [0, 0, 0, 0], rules: null, clock: null };
  const publicGame = { tiles, nb: actual.nb, rules: null, clock: null };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(publicGame, field, { get() { throw Error('Private ' + field); } });
  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 64, tapMs: 1000 };
  const session = factory(actual, settings), state = { ...session.view().state, pictures: actual.faces.slice() };
  const roots = tiles.map((tile, index) => ({ index }));
  const engine = createReusableExploration();
  let found = null;
  for (let call = 0; call < 100 && !found; call++) {
    const report = engine.search(publicGame, state, roots, { version: 'public-v1', nodes: 1 });
    assert(report.nodes <= 1); assert.equal(report.imaginedPicturesAdded, 0);
    const fresh = createReusableExploration().search(publicGame, state, roots, { version: 'public-v1', nodes: 1 });
    assert.equal(fresh.path, null, 'A restarted one-unit search never reaches a route');
    if (report.path) found = report;
  }
  assert(found?.knownWin); assert(found.reusable.cumulativeWork > 1);
  assert(engine.stats().resumedUnfinished > 1);
  let replayedTaps = 0;
  const replay = (game, route) => {
    const physical = factory(game, settings);
    for (const index of route) { assert(physical.view().legalTiles.includes(index)); physical.tap(index); }
    replayedTaps += verifyAttempt(encodeGame(game), route, settings, physical.audit()); return physical.view();
  };
  assert(replay(actual, found.path).win);
  const child = advance(publicGame, state, 0).state, childRoots = [1, 2, 3].map(index => ({ index }));
  const interleaved = createReusableExploration();
  let opening = null, continuation = null;
  for (let call = 0; call < 100 && (!opening || !continuation); call++) {
    if (!opening) { const report = interleaved.search(publicGame, state, roots, { version: 'same-model', nodes: 1 }); if (report.path) opening = report; }
    if (!continuation) { const report = interleaved.search(publicGame, child, childRoots, { version: 'same-model', nodes: 1 }); if (report.path) continuation = report; }
  }
  assert(opening?.knownWin && continuation?.knownWin); assert.equal(interleaved.stats().createdJobs, 2);
  assert(interleaved.stats().resumedUnfinished > 2); assert(replay(actual, [0, ...continuation.path]).win);
  const changed = engine.search(publicGame, state, roots, { version: 'public-v2-role-change', nodes: 1 });
  assert.equal(changed.reusable.resumed, false);
  const limitedRoots = engine.search(publicGame, state, [{ index: 2 }], { version: 'public-v1', nodes: 1 });
  assert.equal(limitedRoots.reusable.resumed, false);
  const changedKnowledge = engine.search(publicGame, { ...state, pictures: [null, 1, 2, 2] }, roots, { version: 'public-v1', nodes: 1 });
  assert.equal(changedKnowledge.reusable.resumed, false);
  const expired = engine.search(publicGame, state, roots, { version: 'public-v1', deadline: Date.now() - 1 });
  assert.equal(expired.nodes, 0); assert.equal(expired.reason, 'deadline');
  const capped = createReusableExploration({ maximumStates: 1 });
  const cappedReport = capped.search(publicGame, state, roots, { version: 'bounded', nodes: 1000 });
  assert.equal(cappedReport.reason, 'state_cap'); assert(cappedReport.boundary); assert.equal(cappedReport.path, null);
  assert.equal(capped.stats().storedStates, 1); assert(!cappedReport.knownDead);
  const evicting = createReusableExploration({ maximumJobs: 1 });
  evicting.search(publicGame, state, roots, { version: 'first', nodes: 1 });
  evicting.search(publicGame, state, roots, { version: 'second', nodes: 1 });
  assert.equal(evicting.stats().jobs, 1); assert.equal(evicting.stats().evictedJobs, 1);
  const memoryBounded = createReusableExploration({ maximumJobs: 2, maximumStates: 1, maximumTotalStates: 1 });
  memoryBounded.search(publicGame, state, roots, { version: 'older', nodes: 2 });
  memoryBounded.search(publicGame, state, roots, { version: 'newer', nodes: 2 });
  assert(memoryBounded.stats().storedStates <= 1 && memoryBounded.stats().evictedJobs > 0);
  let blocked = false;
  const changingGame = { ...publicGame, publicFrontier: position => ({ free: position.alive.flatMap((alive, index) => alive
    && !(blocked && index === 0) ? [index] : []), uncertain: [] }) };
  const guarded = createReusableExploration();
  assert(guarded.search(changingGame, state, roots, { version: 'defensive', nodes: 1000 }).knownWin);
  blocked = true;
  const stale = guarded.search(changingGame, state, roots, { version: 'defensive', nodes: 1000 });
  assert.equal(stale.path, null); assert.equal(stale.reason, 'stale_route_rejected'); assert(!stale.knownDead);
  const originalNow = Date.now;
  try {
    let clock = 100; Date.now = () => clock;
    const clocked = createReusableExploration();
    assert(clocked.search(publicGame, state, roots, { version: 'deadline', nodes: 1000, deadline: 200 }).knownWin);
    clock = 300;
    assert(clocked.search(publicGame, state, roots, { version: 'deadline', nodes: 1000, deadline: 400 }).knownWin,
      'A resumed job uses its current validation deadline, not the creation deadline');
  } finally { Date.now = originalNow; }
  let canonical = null;
  for (const hidden of [...Array(36).keys(), 101]) {
    const concealed = { ...actual, faces: [hidden, hidden, 7, 7], down: [1, 1, 1, 1] };
    const physical = factory(concealed, settings), initial = physical.view().state;
    const packet = observeBoard(tiles, initial, null, { picture: index => concealed.faces[index], role: () => 'none' });
    const observed = { ...initial, pictures: packet.pictures, down: packet.down };
    if (canonical === null) canonical = structuredClone(observed); else assert.deepEqual(observed, canonical);
    const model = createReusableExploration();
    const peek = model.search(publicGame, observed, roots, { version: 'public-backs', nodes: 1000 });
    assert.equal(peek.kind, 'actualPeekRequired'); assert.equal(peek.knownPrefixTaps, 0);
    assert(!peek.knownWin && !peek.knownDead); assert.deepEqual(observed, canonical);
    const revealed = replay(concealed, peek.path); assert(!revealed.win); assert.equal(revealed.state.openPeek, peek.boundaryIndex);
  }
  const coveredTiles = [{ x: 0, y: 0, z: 0 }, { x: .28, y: .28 / 1.24, z: 1 }, { x: 1, y: 0, z: 1 },
    { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, { x: 16, y: 0, z: 0 },
    { x: 12.28, y: .28 / 1.24, z: 1 }, { x: 20, y: 0, z: 0 }];
  let canonicalCovered = null;
  for (const hidden of [0, 1, 7, 17, 28, 35]) for (const orientation of [0, 1]) {
    const covered = { tiles: coveredTiles, nb: Layouts.neighbors(coveredTiles), faces: [hidden, 7, 9, 7, hidden, 9, 2, 2],
      down: coveredTiles.map((tile, index) => index === 0 ? orientation : 0), rules: null, clock: null };
    const physical = factory(covered, settings), initial = physical.view().state;
    const packet = observeBoard(coveredTiles, initial, null, { picture: index => covered.faces[index], role: () => 'none' });
    const observed = { ...initial, pictures: packet.pictures, down: packet.down };
    if (canonicalCovered === null) canonicalCovered = structuredClone(observed); else assert.deepEqual(observed, canonicalCovered);
    const model = { tiles: coveredTiles, nb: covered.nb, rules: null, clock: null };
    const exposing = createReusableExploration();
    const information = exposing.search(model, observed, [{ index: 1 }], { version: 'covered-public', nodes: 100 });
    assert.equal(information.kind, 'newPublicExposure'); assert.deepEqual(information.newlyExposed, [0]);
    assert(!information.knownWin); assert.equal(information.boundaryIndex, null);
    assert.equal(information.knownPrefixTaps, information.path.length); assert.deepEqual(observed, canonicalCovered);
    const revealed = replay(covered, information.path);
    const after = observeBoard(coveredTiles, revealed.state, null, { picture: index => covered.faces[index], role: () => 'none' });
    assert.equal(after.down[0], orientation);
    const staleExposure = exposing.search({ ...model, publicInformationExposure: () => [] }, observed,
      [{ index: 1 }], { version: 'covered-public', nodes: 100 });
    assert.equal(staleExposure.path, null); assert.equal(staleExposure.reason, 'stale_route_rejected');
  }
  const controller = createHumanController(tiles, { retryInformationWitness: true, deadEndInformation: true,
    reusablePublicPlanning: true, retryInformationNodes: 1 });
  const losing = { ...actual, faces: [1, 2, 3, 4] };
  for (let attempt = 0; attempt < 3; attempt++) {
    const physical = factory(losing, settings);
    const observe = () => {
      const frame = physical.view(), position = frame.state, takeable = new Set(frame.legalTiles ?? []);
      controller.observe(Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps']
        .map(field => [field, position[field]])), observeBoard(tiles, position, null,
      { picture: index => losing.faces[index], role: () => 'none', takeable: index => takeable.has(index) }));
    };
    controller.beginAttempt(); observe();
    for (const index of [0, 1, 2, 3]) { controller.decide(); controller.acknowledge(index, true); physical.tap(index); observe(); }
    assert.equal(physical.view().why, 'tray'); controller.completeAttempt('physicalLoss');
    replayedTaps += verifyAttempt(encodeGame(losing), [0, 1, 2, 3], settings, physical.audit());
  }
  const lifetime = controller.retryInformationStats().reusable;
  assert(lifetime.resumedUnfinished > 0 && lifetime.reusedJobs > 0 && lifetime.expandedStates > 0,
    'The controller must retain actual search work across complete physical attempts and planner resets');
  assert.throws(() => createHumanController(tiles, { reusablePublicPlanning: true }));
  factory.verifySource();
  console.log('PASS reusable public search resumes unfinished one-unit jobs across alternating roots, isolates changed public versions/knowledge/roots, revalidates stale routes and current deadlines, bounds memory without loss proofs, and independently replays ' + replayedTaps + ' taps including37 concealed-picture and12 geometry-exposure worlds');
  console.log('Controller physical-retry reuse: ' + JSON.stringify(lifetime));
}

if (require.main === module) test();
module.exports = test;
