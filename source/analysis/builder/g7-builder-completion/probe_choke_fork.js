'use strict';
// Probe script to find and test delayed-choke forks (depth 3-5) on catalogue layouts
const E = require('../../../tools/builder/engine.js');
const B = require('../../../tools/builder/builder.js');
const L = require('../../../www/layouts.js');
const D = require('../../../tools/builder/loop/detour.js');
const P = require('../../../tools/builder/loop/publicfork.js');
const { tileVisibility } = require('../../../tools/sim/refit/human_board_visibility.js');

function probeLayout(layoutIndex) {
  const lay = B.LAYOUTS[layoutIndex];
  if (!lay) return { fail: 'noLayout' };
  const tiles = lay.tiles;
  const n = tiles.length;
  console.log(`Probing layout ${layoutIndex} (${lay.shape}, ${n} tiles)...`);
  
  // Find a clock placement with k in [6, 10]
  // We can start with a basic valid solution path using topological order
  const objects = tiles.map(([x, y, z]) => ({ x, y, z }));
  const nb = L.neighbors(objects);
  
  // Find tiles on top layers that can serve as clock
  const candidates = [];
  for (let i = 0; i < n; i++) {
    if (objects[i].z >= 1 && nb.above[i].length === 0) {
      candidates.push(i);
    }
  }
  console.log(`Found ${candidates.length} top-layer candidate tiles`);
  return { layoutIndex, shape: lay.shape, n, candidates: candidates.length };
}

for (const idx of [22, 8, 0, 25]) {
  probeLayout(idx);
}
