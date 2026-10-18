'use strict';
const assert = require('assert/strict');
const { summarize } = require('./personal_restart_audit.js');
const samples = [{ win: true, why: 'win' }, { win: false, why: 'tray' }];
const rows = [{ name: 'Dennisisdebeste', aid: 'supported', moves: 12, status: 'measured-human-state',
  simulations: { ownAll: samples, ownAllPlan8: samples } },
{ name: 'Dennisisdebeste', aid: 'unsupported', moves: 20, status: 'unsupported-wildcard-handoff' }];
const report = summarize(rows);
assert.equal(report.Dennisisdebeste.naturalRestarts, 2);
assert.equal(report.Dennisisdebeste.measured, 1);
assert.equal(report.Dennisisdebeste.unsupported.length, 1);
assert.equal(report.Dennisisdebeste.profiles.ownAll.successFraction, 0.5);
assert.equal(report.Gerda.naturalRestarts, 0);
assert.equal(report.Gerda.profiles.ownAll.successFraction, null);
console.log('PASS restart state audit keeps unsupported observations and empty players explicit, never counts them as wins');
