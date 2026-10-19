'use strict';
const assert = require('assert/strict');
const { unopenedLevels } = require('./personal_attention_future_data.js');
const target = { first: 106, levels: [105, 106, 107, 108, 109] };
const events = [{ k: 'start', lv: 53 }, { k: 'start', lv: 106 }, { k: 'start', lv: 107, m: 'd' }, { k: 'start', lv: 108, tk: 'track' }];
assert.deepEqual(unopenedLevels(target, events), [107, 108, 109]);
assert.deepEqual(unopenedLevels(target, Object.fromEntries(events.map((event, index) => [index, event]))), [107, 108, 109]);
assert.deepEqual(unopenedLevels(target, [...events, { k: 'start', lv: 109, at: 20 }]), [107, 108]);
console.log('PASS new own-policy forecast preparation excludes opened levels and low replays without confusing daily/track starts or displayed retry counters');
