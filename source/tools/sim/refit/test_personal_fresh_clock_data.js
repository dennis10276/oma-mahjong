'use strict';
const assert = require('assert/strict');
const { semantic } = require('./personal_fresh_clock_data.js');
const game = { aid: 'attempt', lv: 150, at: 3, t: 10, availableAt: 20, observedAt: 30,
  decisions: [{ F: [[0], [1]], immediate: [[0], [1]], kindContext: [0], k: 0, tray: [], moves: 0 }] };
const annotated = { ...game, observedAt: 40, decisions: game.decisions.map(decision => ({ ...decision, knownPlan: [[1], [0]] })) };
assert.deepEqual(semantic(game), semantic(annotated));
assert.notDeepEqual(semantic(game), semantic({ ...annotated, decisions: [{ ...annotated.decisions[0], k: 1 }] }));
assert.notDeepEqual(semantic(game), semantic({ ...annotated, availableAt: 21 }));
console.log('PASS clock annotations preserve semantic actions and availability without changing version identities');
