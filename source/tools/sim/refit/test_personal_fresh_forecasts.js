'use strict';
const assert = require('assert/strict');
const { chooseUnopened } = require('./personal_fresh_forecasts.js');
const candidates = [150, 151, 152, 153, 154].map(lv => ({ name: 'Dennis', lv }));
const events = [{ k: 'start', lv: 151 }, { k: 'start', lv: 152, m: 'd' }, { k: 'start', lv: 153, tk: 'daily' }];
assert.deepEqual(chooseUnopened(candidates, events, 151, new Set(['Dennis|154'])).map(row => row.lv), [152, 153]);
assert.deepEqual(chooseUnopened(candidates, [{ k: 'start', lv: 152, at: 7 }], 151).map(row => row.lv), [151, 153, 154]);
console.log('PASS fresh numeric freezing excludes opened/resumed/replayed targets and never counts daily starts or duplicate coverage');
