'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createRetryRiskMemory } = require('./public_retry_risk_memory.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 2, 3, 4, 1, 2, 3, 4],
    down: tiles.map(() => 0), rules: null, clock: null };
  const factory = createSessionFactory(), memory = createRetryRiskMemory();
  const publicState = state => {
    const result = { alive: state.alive, tray: state.tray, moves: state.moves, openPeek: state.openPeek,
      relieved: state.relieved, arriving: state.arriving, physicalTaps: state.physicalTaps };
    for (const field of ['pictures', 'down', 'faces', 'deck', 'seed']) Object.defineProperty(result, field, { get() { throw Error('Private ' + field); } });
    return result;
  };
  const run = (actions, status, choiceLimit = 32) => {
    const settings = { seed: 1, tapMs: 1000, choiceLimit }, session = factory(game, settings);
    memory.beginAttempt();
    const before = [];
    for (const index of actions) {
      const prior = publicState(session.view().state);
      before.push(prior);
      const after = publicState(session.tap(index).state);
      memory.observeTransition(prior, index, after);
    }
    assert.equal(verifyAttempt(encodeGame(game), actions, settings, session.audit()), actions.length);
    return { learned: memory.finish(status), before, actual: session.view() };
  };
  const failed = run([0, 1, 2, 3], 'physicalLoss');
  assert.equal(failed.actual.why, 'tray');
  assert.deepEqual(failed.learned, { index: 2, penalty: 1 });
  assert.equal(memory.cost(failed.before[2], 2), 1);
  assert.equal(memory.cost(failed.before[2], 6), 0);
  assert.equal(memory.cost({ ...failed.before[2], moves: 50 }, 2), 1);
  assert.equal(memory.cost({ ...failed.before[2], openPeek: 6 }, 2), 0);
  const snapshot = memory.entries();
  assert.equal(run([0, 1, 2], 'unresolvedBudget', 3).actual.computationCensored, true);
  assert.deepEqual(memory.entries(), snapshot, 'A cap is not a failed attempt to learn from');
  assert.equal(run([0, 4, 1, 5, 2, 6, 3, 7], 'cleared').actual.win, true);
  assert.deepEqual(memory.entries(), snapshot, 'A clear must not teach a losing-action penalty');
  run([0, 1, 2, 6, 4, 5, 3, 7], 'cleared');
  assert.deepEqual(memory.entries(), snapshot, 'A recovered third carrier is not an unrecovered loss');
  run([0, 1, 2, 3], 'physicalLoss');
  assert.equal(memory.cost(failed.before[2], 2), 2);
  assert.equal(memory.finish('physicalLoss'), null, 'A completed attempt cannot be counted twice');
  const independent = createRetryRiskMemory();
  assert.equal(independent.cost(failed.before[2], 2), 0, 'Risk memory cannot leak to a new level controller');
  const generalized=createRetryRiskMemory(null,{generalizePictures:true});
  const pictureSettings={seed:1,tapMs:1000,choiceLimit:32},pictureSession=factory(game,pictureSettings);
  generalized.beginAttempt();
  for(const index of [0,1,2,3]){
    const before=publicState(pictureSession.view().state);
    generalized.observeTransition(before,index,publicState(pictureSession.tap(index).state));
  }
  assert.equal(verifyAttempt(encodeGame(game),[0,1,2,3],pictureSettings,pictureSession.audit()),4);
  generalized.finish('physicalLoss');
  const different={...failed.before[2],openPeek:6};
  assert.equal(generalized.cost(different,2),0);
  assert.equal(generalized.pictureCost(different,3,false),1,'A failed third picture is a soft preference in other actual public positions');
  assert.equal(generalized.pictureCost(different,3,true),0,'An available remembered partner removes the picture preference');
  assert.equal(generalized.pictureCost({...different,tray:[1]},3,false),0);
  assert.equal(generalized.pictureCost(different,null,false),0,'Never score an unknown picture using future knowledge');
  assert.equal(generalized.pictureCost({...different,tray:[1,3]},3,false),0,'Never penalize an immediate tray match');
  assert.equal(independent.pictureCost(different,3,false),0,'No cross-controller picture preferences');
  assert(generalized.entries().some(row=>row.kind==='failedThirdPicturePreference'&&row.picture===3&&row.provedLoss===false));
  const learnedPictures=generalized.entries();
  generalized.beginAttempt();generalized.finish('unresolvedBudget');assert.deepEqual(generalized.entries(),learnedPictures);
  const clockGame = { ...game, clock: { i: 3, n: 8 } }, clockSettings = { seed: 1, tapMs: 1000, choiceLimit: 32 };
  const clockSession = factory(clockGame, clockSettings), clocked = createRetryRiskMemory(clockGame.clock);
  clocked.beginAttempt();
  for (const index of [0, 1, 2, 3]) {
    const before = publicState(clockSession.view().state);
    clocked.observeTransition(before, index, publicState(clockSession.tap(index).state));
  }
  assert.equal(clockSession.view().why, 'tray');
  assert.equal(verifyAttempt(encodeGame(clockGame), [0, 1, 2, 3], clockSettings, clockSession.audit()), 4);
  clocked.finish('physicalLoss');
  assert.equal(clocked.cost(failed.before[2], 2), 1);
  assert.equal(clocked.cost({ ...failed.before[2], moves: 3 }, 2), 0);
  const widerTiles = Array.from({ length: 10 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const widerGame = { tiles: widerTiles, nb: Layouts.neighbors(widerTiles), faces: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5],
    down: widerTiles.map(() => 0), rules: null, clock: null };
  const recoveredMemory = createRetryRiskMemory(null,{generalizePictures:true}), widerSession = factory(widerGame, clockSettings);
  const widerActions = [0, 1, 2, 7, 3, 4], snapshots = [];
  for (const index of widerActions) {
    const before = publicState(widerSession.view().state); snapshots.push(before);
    recoveredMemory.observeTransition(before, index, publicState(widerSession.tap(index).state));
  }
  assert.equal(widerSession.view().why, 'tray');
  assert.deepEqual(recoveredMemory.finish('physicalLoss'), { index: 3, penalty: 1 });
  assert.equal(recoveredMemory.cost(snapshots[2], 2), 0, 'An earlier third carrier that was actually recovered must not be penalized');
  assert.equal(recoveredMemory.pictureCost(snapshots[2],3,false),0);
  assert.equal(recoveredMemory.pictureCost(snapshots[2],4,false),1);
  assert.equal(verifyAttempt(encodeGame(widerGame), widerActions, clockSettings, widerSession.audit()), widerActions.length);
  assert.throws(() => independent.observeTransition(failed.before[2], 2, failed.before[2]));
  factory.verifySource();
  console.log('PASS retry risk memory learns only actual unrecovered third-carrier commitments from replayed losses, distinguishes active-clock resources, keeps caps/clears untrained and never reads hidden fields or shares evidence between levels');
}

if (require.main === module) test();
module.exports = test;
