'use strict';
// rate_probe.js: Rates a small fixed comparison using the pinned yardsticks under heavy.js
const fs = require('fs'), path = require('path');
const { createYardstick } = require('../../../tools/builder/loop/yardstick.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const Policy = require('../../../tools/builder/loop/policy.js');

function run() {
  const profile = GP.loadProfile('e5-v1');
  const ys = createYardstick();
  console.log('Yardstick loaded successfully.');
  console.log('Family bot fingerprint:', ys.loadPins().family.fingerprint);
  console.log('Planner fingerprint:', ys.loadPins().planner.fingerprint);
}

if (require.main === module) run();
