'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createPairFlexibility } = require('./public_pair_flexibility.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 },
    { x: 12, y: 0, z: 0 }, { x: 8, y: 0, z: 1 }, { x: 12, y: 0, z: 1 }];
  const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const pictures = [7, 7, 7, 7, 8, 8], measure = createPairFlexibility(game, pictures);
  const initial = { alive: [1, 1, 1, 1, 1, 1], tray: [], relieved: false };
  assert.equal(measure(initial), 0);
  const greedy = { ...initial, alive: [0, 0, 1, 1, 1, 1] };
  assert.equal(measure(greedy), 2, 'Taking the easy duplicate pair must expose the debt of its buried remaining pair');
  assert.equal(measure({ ...initial, alive: [1, 1, 1, 1, 0, 0] }), 0);
  assert.equal(measure({ ...greedy, tray: [7] }), 0, 'Waiting-picture recovery is handled by the separate tray metric');
  const partial = createPairFlexibility(game, [7, 7, 7, null, 8, 8]);
  assert.equal(partial(greedy), 1, 'Unseen mates cannot be counted from the actual deck');
  pictures.fill(99); assert.equal(measure(greedy), 2, 'The metric is confined to its captured observation snapshot');
  console.log('PASS pair-flexibility ordering detects newly stranded duplicate mates using observed identities only; waiting-tray recovery and unseen pictures are not double counted');
}

if (require.main === module) test();
module.exports = test;
