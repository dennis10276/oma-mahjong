'use strict';
// test_separated_pair.js: Tests placing a tempting tile x whose partner y is separated,
// while x unblocks an apparent relief pair (r1, r2).

const E = require('../../../tools/builder/engine.js');
const B = require('../../../tools/builder/builder.js');
const L = require('../../../www/layouts.js');
const D = require('../../../tools/builder/loop/detour.js');
const Pk = require('../../../tools/builder/loop/publicfork.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const VC = require('../../../tools/builder/visible_choice.js');

function testSeparation(layoutIndex, shape, seed = 1) {
  console.log(`\n=== Testing Layout ${layoutIndex} (${shape}) ===`);
  const base = VC.build({
    layout: layoutIndex,
    shape,
    story: 'deepClock',
    stage: 'edge',
    frame: { spare: 2 },
    targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
    seed,
    mode: 'visibleChoice'
  });

  if (base.fail) {
    console.log('Build failed:', base.fail);
    return;
  }

  const d = base.design;
  const g = E.game(d);
  console.log(`Base design: ${d.tiles.length} tiles, clock k=${base.card.clock.fewestMoves}, spare=${base.card.clock.spare}`);
  console.log('Traps from card:', base.card.traps);

  // Let's inspect each trap [x, y] in card.traps
  for (const [x, y] of base.card.traps) {
    console.log(`Trap [${x}, ${y}]: face=${d.faces[x]}, pos in solution: x=${d.solution.indexOf(x)}, y=${d.solution.indexOf(y)}`);
  }
}

for (const [idx, shape] of [[22, 'ushape'], [8, 'cross'], [0, 'arch'], [25, 'frame']]) {
  testSeparation(idx, shape, 1);
}
