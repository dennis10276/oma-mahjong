'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), P = require('./task11_plan.js');
test('the diagnostic sample never includes frozen keys and does not invent middle-band coverage', () => {
  const boards = Array.from({ length: 100 }, (_, i) => ({ id: String(i), family: { exp: i < 40 ? 4 : i < 45 ? 10 : 20 }, skilled: { exp: 2 },
    brief: { story: 's' + i % 3 }, design: { tiles: [[i, 0, 0]], clock: { i: 0 }, obst: { keys: [0], ice: i === 42 ? { 0: 1 } : {} } } }));
  const x = P.select(boards);
  assert.equal(x.filter(b => b.band === 'middle').length, 4);
  assert.equal(x.some(b => b.id === '42'), false);
  assert.deepEqual(P.select(boards).map(b => b.id), x.map(b => b.id));
});
