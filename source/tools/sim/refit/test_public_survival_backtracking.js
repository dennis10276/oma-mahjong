'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { survivalBranchSearch } = require('./public_survival_branches.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { encodeGame } = require('./personal_game_io.js');
const { createHumanController, verifyAttempt } = require('./human_reference_campaign.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 },
    { x: 20.28, y: .28 / 1.24, z: 1 }, { x: 20, y: 0, z: 0 }, { x: 20, y: 0, z: 0 },
    { x: 20, y: 0, z: 0 }, { x: 30, y: 0, z: 0 }, { x: 40, y: 0, z: 0 }, { x: 48, y: 0, z: 0 }];
  const geometry = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  geometry.publicFrontier = position => ({ free: tiles.flatMap((tile, index) => position.alive[index]
    && Layouts.isFree(index, position.alive, geometry.nb) ? [index] : []), uncertain: [], relieved: !!position.relieved });
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(geometry, field, { get() { throw Error('Private backtracking ' + field); } });
  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 64, tapMs: 1000 };
  const primary = { index: 2, path: [2], knownDead: false, knownWin: false, safeClockExit: false, nodes: 0 };
  let replayedTaps = 0;
  const scenario = (enabled, clocked = false, unresolved = false) => {
    const model = { ...geometry, clock: clocked ? { i: 8, n: 50 } : null };
    const actual = { ...model, faces: [1, 2, 3, 4, 1, 2, 3, 4, 5, 5], down: tiles.map((tile, index) => +[3, 4, 5, 6, 8].includes(index)) };
    const policy = survivalBranchSearch(() => primary, { backtracking: enabled, nodes: 512, milliseconds: 100 });
    const pictures = tiles.map(() => null), down = tiles.map(() => null), reports = [];
    for (const attempt of [1, 2]) {
      policy.beginAttempt(); const session = factory(actual, settings), route = [];
      const observe = () => {
        const frame = session.view(), packet = observeBoard(tiles, frame.state, actual.clock,
          { picture: index => actual.faces[index], role: () => 'none' });
        packet.pictures.forEach((picture, index) => { if (picture !== null) pictures[index] = picture; });
        packet.down.forEach((orientation, index) => { if (orientation !== null) down[index] = orientation; });
        return { ...frame.state, pictures: pictures.map((picture, index) => frame.state.alive[index] ? picture : null),
          down: down.map((orientation, index) => frame.state.alive[index] ? orientation : 0) };
      };
      let state = observe();
      const tap = index => { assert(session.view().legalTiles.includes(index)); policy.acknowledge(index, true); session.tap(index); route.push(index); state = observe(); };
      for (const index of [3, 0, 1]) tap(index);
      assert.deepEqual(state.tray, [1, 2]);
      const proposal = policy.search(model, state, session.view().legalTiles.map(index => ({ index })));
      reports.push(proposal);
      if (attempt === 1 || !enabled || clocked || unresolved) assert.equal(proposal, primary);
      else {
        assert.equal(proposal.index, 3); assert.equal(proposal.goal, 'survivalBacktracking');
        assert(proposal.survivalBranches.heuristicBacktracking && !proposal.survivalBranches.necessaryIfSolvable);
        assert(!proposal.survivalBranches.discarded.includes(2), 'A failed play must not become a whole-branch exclusion');
      }
      if (unresolved) policy.finish('unresolvedBudget');
      else if (attempt === 2 && enabled && !clocked) {
        for (const index of [...proposal.path, 4, 5, 2, 6, 8, 9]) tap(index);
        assert(session.view().win); policy.finish('cleared');
      } else {
        for (const index of [2, 3]) tap(index);
        assert.equal(session.view().why, 'tray'); policy.finish('physicalLoss');
      }
      replayedTaps += verifyAttempt(encodeGame(actual), route, settings, session.audit());
    }
    return { stats: policy.stats(), outcomes: policy.outcomes(), reports };
  };
  const changed = scenario(true);
  assert.equal(changed.stats.backtrackingPlans, 1); assert.equal(changed.stats.agenda.requestsTaken, 1);
  assert.equal(changed.outcomes[0].rulesOutWholeOpening, false);
  assert.deepEqual(changed.outcomes.map(entry => entry.status), ['physicalLoss', 'cleared']);
  const legacy = scenario(false); assert.equal(legacy.stats.backtrackingPlans, undefined);
  const clocked = scenario(true, true); assert.equal(clocked.stats.agenda.requestsScheduled, 0);
  const unresolved = scenario(true, false, true); assert.equal(unresolved.stats.agenda.requestsScheduled, 0);
  assert.throws(() => createHumanController(tiles, { survivalBacktracking: true }));
  assert.throws(() => createHumanController(tiles, { survivalEarlyForks: true }));
  factory.verifySource();
  console.log('PASS one observed failed play schedules one deeper alternative on a retry, preserves the shared opening and viable old child, labels exploration separately from proof, leaves legacy/active-clock/unresolved cases unchanged and independently replays ' + replayedTaps + ' production taps');
}

if (require.main === module) test();
module.exports = test;
