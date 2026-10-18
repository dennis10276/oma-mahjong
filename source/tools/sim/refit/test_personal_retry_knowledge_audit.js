'use strict';
const assert = require('assert/strict');
const { inheritedChoices } = require('./personal_retry_knowledge_audit.js');
const flip = Array(68).fill(0), take = Array(68).fill(0), knownFlip = Array(68).fill(0);
flip[19] = 1;
take[16] = 1;
knownFlip[19] = 1; knownFlip[65] = 1;
const prefix = { decisions: [flip, take, knownFlip].map(feature => ({ F: [feature], k: 0 })) };
const actions = [{ index: 0 }, { index: 1 }, { index: 2 }];
assert.deepEqual(inheritedChoices(prefix, actions, [1, 1, 1], [1, 1, 1]),
  { decisions: 3, previouslyObservedDownChoices: 3, flipsModelCallsUnknown: 1, takesModelCallsBlind: 1 });
assert.deepEqual(inheritedChoices(prefix, actions, [0, 0, 0], [1, 1, 1]),
  { decisions: 3, previouslyObservedDownChoices: 0, flipsModelCallsUnknown: 0, takesModelCallsBlind: 0 });
console.log('PASS retry knowledge audit distinguishes available observed pictures from claimed human memory');
