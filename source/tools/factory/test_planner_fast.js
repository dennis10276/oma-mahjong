'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const refBot = require('../sim/refit/human_bot.js');
const fastBot = require('../sim/refit/human_bot_planner_fast.js');
const { createFactoryController: createRefController } = require('../sim/refit/human_factory_controller.js');
const { createFastPlannerController } = require('../sim/refit/human_planner_controller_fast.js');
const { campaignFast } = require('../sim/refit/human_style_environment.js');
const { normalizeBoard } = require('../sim/refit/public_board_input.js');
const { decodeGame } = require('../sim/refit/personal_game_io.js');
const { visibilityGeometry, observeBoardFast } = require('../sim/refit/human_board_visibility.js');
const Layouts = require('../sim/refit/physics/layouts.js');
const release = require('../sim/refit/human_release.js');
const task11Keys = require('../builder/task11_keys.js');
const M = require('./meter.js');

const ROOT = path.resolve(__dirname, '../..');
const qualRows = fs.readFileSync(path.join(ROOT, 'analysis/builder/data/qualified-200-225.jsonl'), 'utf8')
  .trim().split(/\r?\n/).map(JSON.parse);
const knobsHidden = JSON.parse(fs.readFileSync(path.join(ROOT, 'analysis/builder/knobs-v1/boards.json'), 'utf8'))
  .find(b => !b.fail && b.design && (b.design.obst?.keys?.length || 0) > 0 && task11Keys.features(b.design).keysShownAtStart === 0);

const syntheticJokerIceLockBoard = {
  tiles: [
    [0, 0, 0], [2, 0, 0], [4, 0, 0], [6, 0, 0],
    [0, 2, 0], [2, 2, 0], [4, 2, 0], [6, 2, 0],
    [1, 1, 1], [5, 1, 1],
  ],
  faces: [1, 101, 2, 2, 3, 3, 4, 4, 1, 101],
  down: [0, 4, 5],
  obst: { ice: { 2: 1, 6: 2 }, locks: [3], keys: [4, 5] },
  clock: { i: 3, n: 9 },
};

function assertPlannerParity(board, label, runs = 4) {
  const opts = { setting: 'planner', runs, seeds: 2, seed: 4711, capture: 'tail' };
  const ref = refBot.measureHuman(board, { ...opts, fast: false });
  const fast = fastBot.measureHuman(board, opts);

  assert.equal(fast.expectedTries, ref.expectedTries, `${label}: expectedTries`);
  assert.equal(fast.firstTryRate, ref.firstTryRate, `${label}: firstTryRate`);
  assert.equal(fast.averageTries, ref.averageTries, `${label}: averageTries`);
  assert.deepEqual(fast.plannerStyles, ref.plannerStyles, `${label}: plannerStyles`);
  assert.equal(fast.version, ref.version, `${label}: version`);
  assert.equal(fast.calibrationStatus, ref.calibrationStatus, `${label}: calibrationStatus`);
  assert.equal(fast.valid, ref.valid, `${label}: valid`);
  assert.deepEqual(fast.lossPhase, ref.lossPhase, `${label}: lossPhase`);
  assert.equal(fast.results.length, ref.results.length, `${label}: results.length`);

  for (let r = 0; r < ref.results.length; r++) {
    assert.equal(fast.results[r].wonOn, ref.results[r].wonOn, `${label} run ${r}: wonOn`);
    assert.equal(fast.results[r].attempts.length, ref.results[r].attempts.length, `${label} run ${r}: attempts.length`);
    for (let a = 0; a < ref.results[r].attempts.length; a++) {
      assert.deepEqual(fast.results[r].attempts[a].actions, ref.results[r].attempts[a].actions, `${label} run ${r} attempt ${a}: actions`);
      assert.deepEqual(fast.results[r].attempts[a].decisions, ref.results[r].attempts[a].decisions, `${label} run ${r} attempt ${a}: decisions`);
    }
  }
}

test('Fast planner matches slow reference move-for-move on qualified, hidden-key, face-up (C2), and joker/ice2/lock boards', () => {
  assertPlannerParity(qualRows[0].design, 'qualified-0', 3);
  assertPlannerParity(knobsHidden.design, 'knobs-hidden-key', 3);
  assertPlannerParity({ ...qualRows[0].design, down: [] }, 'face-up-gate-C2', 3);
  assertPlannerParity(syntheticJokerIceLockBoard, 'synthetic-joker-ice2-lock', 4);
});

test('Step-by-step controller parity: decide scores, memory, attention, and retry evidence match identically', () => {
  const encoded = normalizeBoard(knobsHidden.design);
  const game = decodeGame(encoded);
  const geom = visibilityGeometry(game.tiles), nb = geom.neighbors;
  const n = game.tiles.length, alive0 = new Uint8Array(n).fill(1);
  const plannerProfile = {
    ...release.profiles.Dennis,
    spotPenalty: 200, lookDepth: 2, lookPenalty: 150, lookFrom: 1, pairFirst: 100,
    freePeekBonus: 70, clockNeedFull: 1, routePlan: 300, routeBeam: 300,
    routeNeed: 1, routeNeedTray: 2, routeNeedSlack: 99,
  };

  const cRef = createRefController(game.tiles, plannerProfile, 12345);
  const cFast = createFastPlannerController(game.tiles, plannerProfile, 12345);

  for (let attempt = 1; attempt <= 3; attempt++) {
    cRef.beginAttempt();
    cFast.beginAttempt();
    assert.deepEqual(cFast.planningAttention(), cRef.planningAttention());

    const alive = new Uint8Array(n).fill(1);
    const stateDown = Array.from(game.down || new Uint8Array(n), v => +v);
    const peeked = new Uint8Array(n);
    const tray = [];
    let moves = 0, left = n, openPeek = -1, taps = 0, relieved = false;
    const legalMask = new Uint8Array(n);

    while (left > 0 && taps < 40) {
      if (game.clock && alive[game.clock.i] && moves >= game.clock.n) break;
      legalMask.fill(0);
      let lc = 0;
      for (let i = 0; i < n; i++) {
        const ok = game.rules && !relieved
          ? Layouts.takeable(i, alive, nb, game.rules, alive0)
          : Layouts.isFree(i, alive, nb);
        if (alive[i] && ok) { legalMask[i] = 1; lc++; }
      }
      if (!lc) break;

      const obs = observeBoardFast(geom, game, alive, stateDown, openPeek, moves, relieved, legalMask);
      const st = { alive, tray, moves, openPeek, relieved, arriving: [], physicalTaps: taps };
      cRef.observe(st, obs);
      cFast.observe(st, obs);

      assert.deepEqual(cFast.remembered(), cRef.remembered());
      const dRef = cRef.decide();
      const dFast = cFast.decide();
      assert.equal(dFast.index, dRef.index, `attempt ${attempt} tap ${taps} index`);
      assert.equal(dFast.score, dRef.score, `attempt ${attempt} tap ${taps} score`);

      const idx = dFast.index;
      if (stateDown[idx] && openPeek !== idx && !(peeked[idx] && tray.includes(game.faces[idx]))) {
        peeked[idx] = 1;
        if (!tray.includes(game.faces[idx])) { openPeek = idx; taps++; continue; }
      }
      alive[idx] = 0; stateDown[idx] = 0;
      if (openPeek === idx) openPeek = -1;
      left--; moves++; taps++;
      const q = tray.indexOf(game.faces[idx]);
      if (q >= 0) tray.splice(q, 1); else tray.push(game.faces[idx]);
      if (tray.length >= 4) break;
    }

    const termObs = observeBoardFast(geom, game, alive, stateDown, openPeek, moves, relieved, null);
    const termSt = { alive: Array.from(alive), tray: tray.slice(), moves, openPeek, relieved, arriving: [], physicalTaps: taps };
    cRef.observe(termSt, termObs);
    cFast.observe(termSt, termObs);
    cRef.endAttempt('beforeClock', tray.slice());
    cFast.endAttempt('beforeClock', tray.slice());

    assert.deepEqual(cFast.keyIdentityEvidence(), cRef.keyIdentityEvidence());
    assert.deepEqual(cFast.keyPictureRelationEvidence(), cRef.keyPictureRelationEvidence());
    assert.deepEqual(cFast.lockedCarryEvidence(), cRef.lockedCarryEvidence());
    assert.deepEqual(cFast.retryAccessEvidence(), cRef.retryAccessEvidence());
  }
});

test('100% audit passes on planner-fast-v1 and loud-fails on any injected state mutation', () => {
  const res = fastBot.measureHuman(qualRows[0].design, { setting: 'planner', runs: 2, seeds: 1, seed: 4711, auditRate: 1 });
  assert.equal(res.valid, true);
  assert.ok(res.verifiedTaps > 0);

  const encoded = normalizeBoard(qualRows[0].design);
  const plannerProfile = {
    ...release.profiles.Dennis,
    spotPenalty: 200, lookDepth: 2, lookPenalty: 150, lookFrom: 1, pairFirst: 100,
    freePeekBonus: 70, clockNeedFull: 1, routePlan: 300, routeBeam: 300,
    routeNeed: 1, routeNeedTray: 2, routeNeedSlack: 99,
  };
  assert.throws(
    () => campaignFast(encoded, plannerProfile, 4711, {
      maxAttempts: 3,
      controllerFactory: createFastPlannerController,
      auditRate: 1,
      _auditMutator(snap) { snap.win = !snap.win; },
    }),
    /Fast-mode audit failed/
  );
});

test('meter.js registers planner-fast-v1 and strictly isolates planner caches from family and pre-Task-05 caches', () => {
  assert.ok(M.BOT_VERSIONS['planner-fast-v1'], 'planner-fast-v1 registered in BOT_VERSIONS');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-cache-iso-'));
  try {
    const board = qualRows[0].design;
    const input = M.boardOf(board);
    const plannerSettings = { setting: 'planner', runs: 4, seeds: 2, seed: 4711 };
    const familySettings = { setting: 'family', runs: 4, seeds: 2, seed: 4711 };

    // 1. Post-Task-05 G2 reference planner cache ('4cf0b4c7...') IS reused by planner-fast-v1 when setting === 'planner'
    const g2Fp = '4cf0b4c7057c2242f27fe529bb1885e4ad06cdf94588b79411cc06c522509e39';
    const g2PlannerFile = path.join(tmpDir, M.digest({ fingerprint: g2Fp, input, settings: plannerSettings }) + '.json');
    const fakeSavedPlanner = { expectedTries: 3.25, firstTryRate: 0.4, plannerStyles: { route: 3.25, plain: 4.1 }, valid: true, results: [] };
    M.atomicJson(g2PlannerFile, fakeSavedPlanner);

    const fastPlannerMeter = M.createMeter({ cacheDir: tmpDir, botVersion: 'planner-fast-v1' });
    const hit1 = fastPlannerMeter.measure(board, plannerSettings);
    assert.deepEqual(hit1, fakeSavedPlanner);
    assert.equal(fastPlannerMeter.stats.hits, 1);
    assert.equal(fastPlannerMeter.stats.plannerReused, 1);

    // 2. Pre-Task-05 ('cae3bc38...') cache MUST NOT be reused for planner!
    const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-cache-pre05-'));
    try {
      const preTask05Fp = 'cae3bc38f7b01e627e288330d5ba0cf210383e39e864ab35976e29faff64f83d';
      const oldPlannerFile = path.join(tmpDir2, M.digest({ fingerprint: preTask05Fp, input, settings: plannerSettings }) + '.json');
      M.atomicJson(oldPlannerFile, { expectedTries: 99, valid: true, results: [] });

      const m2 = M.createMeter({ cacheDir: tmpDir2, botVersion: 'planner-fast-v1' });
      const fresh = m2.measure(board, { setting: 'planner', runs: 2, seeds: 1, seed: 4711 });
      assert.notEqual(fresh.expectedTries, 99);
      assert.equal(m2.stats.calls, 1);
    } finally {
      fs.rmSync(tmpDir2, { recursive: true, force: true });
    }

    // 3. Family caches MUST NEVER be mixed with planner caches in either direction!
    const tmpDir3 = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-cache-nofam-'));
    try {
      const kmFastFp = '63be677ee17677754b17e9c835e8a0f757d1d5ec62738950bf2a2f5e4357413a';
      M.atomicJson(
        path.join(tmpDir3, M.digest({ fingerprint: kmFastFp, input, settings: plannerSettings }) + '.json'),
        { expectedTries: 88, valid: true, results: [] }
      );
      M.atomicJson(
        path.join(tmpDir3, M.digest({ fingerprint: fastPlannerMeter.fingerprint, input, settings: familySettings }) + '.json'),
        { expectedTries: 77, valid: true, results: [] }
      );

      const mPlanner = M.createMeter({ cacheDir: tmpDir3, botVersion: 'planner-fast-v1' });
      const rP = mPlanner.measure(board, { setting: 'planner', runs: 2, seeds: 1, seed: 4711 });
      assert.notEqual(rP.expectedTries, 88);
      assert.equal(mPlanner.stats.calls, 1);

      const mFamily = M.createMeter({ cacheDir: tmpDir3, botVersion: 'family-key-memory-v1-fast' });
      const rF = mFamily.measure(board, { setting: 'family', runs: 2, seeds: 1, seed: 4711 });
      assert.notEqual(rF.expectedTries, 77);
      assert.equal(mFamily.stats.calls, 1);
    } finally {
      fs.rmSync(tmpDir3, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
