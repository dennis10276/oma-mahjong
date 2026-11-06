'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { clockSpare } = require('./knobs.js'), { summarize } = require('./knob_study.js');

test('clock spare preserves the physical puzzle and witness and refuses a witness that would change', () => {
  const d = { tiles: [[0, 0, 0], [0, 0, 1], [4, 0, 0], [8, 0, 0]], faces: [0, 1, 1, 0],
    down: [], gold: [], obst: { ice: {}, locks: [], keys: [] }, clock: { i: 0, n: 4 }, solution: [2, 1, 0, 3] };
  const saved = structuredClone(d), r = clockSpare(d, 3);
  assert.ok(!r.fail);
  assert.deepEqual(d, saved);
  assert.equal(r.proof.minimum, 2);
  const changed = structuredClone(saved); changed.clock.n = 5;
  assert.deepEqual(r.design, changed);
  assert.equal(clockSpare(d, 0).fail, 'witnessWouldChange');
  assert.equal(clockSpare(d, -1).fail, 'invalidSpare');
});

test('knob evidence requires complete valid pairs and a strict improvement on 80 percent', () => {
  const plan = { fingerprint: 'plan', bot: 'bot', profiles: ['family'], boards: Array.from({ length: 20 }, (_, i) => ({ id: String(i), story: 'story' })) };
  const records = plan.boards.flatMap((b, i) => ['tight', 'loose'].map(variant => ({ id: b.id, profile: 'family', variant, valid: true,
    expectedTries: variant === 'tight' || i >= 16 ? 8 : 7 })));
  assert.equal(summarize(plan, records).profiles.family.pass, true);
  records[1].valid = false;
  assert.equal(summarize(plan, records).profiles.family.pass, false);
  records[1].valid = true; records[1].expectedTries = 8;
  assert.equal(summarize(plan, records).profiles.family.pass, false);
  assert.equal(summarize(plan, []).profiles.family.valid, 0);
});
