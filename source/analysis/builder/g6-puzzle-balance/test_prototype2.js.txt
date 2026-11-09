'use strict';
const B = require('../../../tools/builder/builder.js');
const E = require('../../../tools/builder/engine.js');
const L = require('../../../www/layouts.js');
const D = require('../../../tools/builder/loop/detour.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const { tileVisibility } = require('../../../tools/sim/refit/human_board_visibility.js');

const W = D.work();

function testFamily1() {
  console.log('Testing Family 1: stagedTrayCommitment...');
  const lay = B.LAYOUTS[33]; // ushape, 72 tiles
  console.log('Layout 33:', lay.shape, lay.tiles.length, 'tiles');
}

testFamily1();
