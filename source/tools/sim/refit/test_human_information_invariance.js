'use strict';
const assert = require('assert/strict');
const { observeBoard } = require('./human_board_visibility.js');
const { createHumanController } = require('./human_reference_campaign.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 0.28, y: 0.28 / 1.24, z: 1 },
    { x: 4.28, y: 0.28 / 1.24, z: 1 }, { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }];
  for (const tile of tiles) Object.defineProperty(tile, 'face', { get() { throw Error('Geometry accessed private picture'); } });
  const clock = { i: 0, n: 8 }, visible = [2, 3, 4, 5];
  const configurations = [{}, { goalRecovery: true, goalRecoveryMin: 1, obstacleFrontier: true,
    alternativeGoalRoutes: true, alternativeRecoveryRoutes: true, riskFirstRecovery: true, safeInformationEscape: true, inspectBeforeCommit: true,
    inspectionTrayLimit: 3, exclusiveRoles: 'clock', cachePublicAnalysis: true,
    preservePairFlexibility: true, knownPairMacros: true, progressiveReopens: true, patientSingleCarry: true }];
  configurations.push({ ...configurations[1], diverseBeam: true });
  configurations.push({ ...configurations[1], diverseWitness: true, uniqueKnownCleanup: true });
  configurations.push({ ...configurations[1], passiveInformation: true });
  configurations.push({ ...configurations[1], passiveInformation: 'roles' });
  let canonical = null, controls = 0;
  for (let world = 0; world < 96; world++) {
    const state = { alive: [1, 1, 1, 1, 1, 1], down: [world % 2, Math.floor(world / 2) % 2, 0, 0, 0, 0],
      moves: 0, tray: [], openPeek: -1, relieved: false, arriving: [], physicalTaps: 0 };
    const privateFaces = [world % 36, (world * 7) % 36, 2, 2, 3, 3];
    const privateRoles = [world % 3 === 0 ? 'ice' : world % 3 === 1 ? 'lock' : 'key',
      world % 3 === 0 ? 'key' : 'none', 'none', 'none', 'none', 'none'];
    const observation = observeBoard(tiles, state, clock, {
      picture(index) { assert(visible.includes(index)); return privateFaces[index]; },
      role(index) { assert(visible.includes(index)); return privateRoles[index]; },
    });
    for (const value of Object.values(observation)) if (value && typeof value === 'object') Object.freeze(value);
    Object.freeze(observation);
    const publicState = { alive: state.alive, tray: state.tray, moves: state.moves, openPeek: state.openPeek,
      relieved: state.relieved, arriving: state.arriving, physicalTaps: state.physicalTaps };
    const output = configurations.map(configuration => {
      const controller = createHumanController(tiles, configuration);
      controller.beginAttempt(); controller.observe(publicState, observation);
      const result = { observation, decision: controller.decide(), memory: controller.known() };
      assert.deepEqual(result.memory.pictures.slice(0, 2), [null, null]);
      assert.deepEqual(result.memory.down.slice(0, 2), [null, null]);
      assert.deepEqual(result.memory.initialRoles.slice(0, 2), [null, null]);
      controls++; return result;
    });
    if (canonical === null) canonical = output;
    else assert.deepEqual(output, canonical, 'A private-world change altered the public observation, controller or memory');
  }
  console.log('PASS ' + controls + ' baseline/research concealed-world controls produce identical public observations, controller plans and retry memory while the covered clock badge stays public');
}

if (require.main === module) test();
module.exports = test;
