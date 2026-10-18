'use strict';
const assert = require('assert/strict');
const { comparePrefixes } = require('./personal_memory_audit.js');
const before = Array(76).fill(0), after = Array(76).fill(0);
before[19] = 1; after[19] = 1; after[65] = 1;
const game = feature => ({ aid: 'retry', t: 10, availableAt: 11, reconstructed: { moves: 2 },
  decisions: [{ F: [feature], k: 0, kindContext: [1] }] });
const original = game(before), recalled = { ...game(after), inheritedPictures: 1, memorySources: [{ aid: 'prior', availableAt: 9 }] };
assert.deepEqual(comparePrefixes([original], [recalled]), { prefixes: 1, decisions: 1, prefixesWithMemory: 1,
  changedDecisions: 1, reopeningsRecognized: 1, rememberedInspectionsNowTakes: 0, blindFeaturesResolved: 0, fatalLabelsResolved: 0, pairKindsRestored: 0 });
assert.throws(() => comparePrefixes([original], [{ ...recalled, memorySources: [{ aid: 'future', availableAt: 10 }] }]));
assert.throws(() => comparePrefixes([original], [{ ...recalled, reconstructed: { moves: 3 } }]));
console.log('PASS memory reconstruction audit preserves physical outcomes and rejects future sources');
