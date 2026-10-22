'use strict';
const assert = require('assert/strict');
const { trayRecoveryBurden } = require('./public_goal_frontier.js');

function test() {
  const blocked = trayRecoveryBurden({ knownCost: 6, unknownWaiting: 0 }, { immediate: 0 }, 2);
  const unknown = trayRecoveryBurden({ knownCost: 0, unknownWaiting: 1 }, { immediate: 0 }, 1);
  assert(blocked.burden > unknown.burden, 'Knowing a buried mate does not make a crowded tray safer than an open exploration slot');
  assert.deepEqual(trayRecoveryBurden({ knownCost: 0, unknownWaiting: 0 }, { immediate: 3 }, 3), { carried: 0, burden: 0 });
  assert.deepEqual(trayRecoveryBurden({ knownCost: 0, unknownWaiting: 0 }, { immediate: 0 }, 0), { carried: 0, burden: 0 });
  assert(trayRecoveryBurden({ knownCost: 0, unknownWaiting: 3 }, { immediate: 0 }, 3).burden > unknown.burden);
  console.log('PASS balanced tray ordering combines actual access cost, unknown mates and carried pressure without treating any heuristic as a safety or death proof');
}

if (require.main === module) test();
module.exports = test;
