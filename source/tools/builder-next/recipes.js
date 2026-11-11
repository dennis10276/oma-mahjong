'use strict';
/**
 * recipes.js - Parameterized puzzle recipe templates for builder-next.
 * Replaces old brittle hardcoded tile IDs with dynamic topological briefs.
 * Every recipe specifies structural constraints (story, stage, depth, spare, trayRoom, maxDown)
 * that VC.build resolves on the actual board topography.
 */

const RECIPES_BY_LAYOUT = {
  // Layout 27: steps (96 tiles, 7 layers) - Big board for 10th level slots (e.g. Level 250)
  27: [
    { id: 'steps-lockBeside-sp1', layout: 27, shape: 'steps', story: 'lockBeside', stage: 'edge', frameSpare: 2, spare: 1, trayRoom: 0, hiddenOnWay: 1, maxDown: 0.30, tailPairWidth: 2, traps: 2, expectedD: 10.9, expectedS: 2.15, bigBoard: true },
    { id: 'steps-lockBeside-sp2', layout: 27, shape: 'steps', story: 'lockBeside', stage: 'edge', frameSpare: 2, spare: 2, trayRoom: 0, hiddenOnWay: 1, maxDown: 0.30, tailPairWidth: 2, traps: 2, expectedD: 8.8, expectedS: 2.05, bigBoard: true },
    { id: 'steps-iceLockClock-sp1', layout: 27, shape: 'steps', story: 'iceLockClock', stage: 'edge', frameSpare: 2, spare: 1, trayRoom: 0, hiddenOnWay: 1, maxDown: 0.30, tailPairWidth: 2, traps: 2, expectedD: 11.5, expectedS: 2.10, bigBoard: true },
    { id: 'steps-lockBeside-d4-sp1', layout: 27, shape: 'steps', story: 'lockBeside', stage: 'edge', depth: 4, frameSpare: 2, spare: 1, trayRoom: 0, hiddenOnWay: 1, maxDown: 0.30, tailPairWidth: 2, traps: 2, expectedD: 13.0, expectedS: 2.20, bigBoard: true }
  ],

  // Layout 6: pyramid · tall (84 tiles, 5 layers) - Standard level
  6: [
    { id: 'pyramid-lockBeside-sp2', layout: 6, shape: 'pyramid · tall', story: 'lockBeside', stage: 'top', frameSpare: 3, depth: 4, spare: 2, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35, expectedD: 12.1, expectedS: 2.67 },
    { id: 'pyramid-lockBeside-sp1', layout: 6, shape: 'pyramid · tall', story: 'lockBeside', stage: 'top', frameSpare: 3, depth: 4, spare: 1, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35, expectedD: 13.5, expectedS: 2.75 },
    { id: 'pyramid-lockBeside-sp3', layout: 6, shape: 'pyramid · tall', story: 'lockBeside', stage: 'top', frameSpare: 3, depth: 4, spare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35, expectedD: 10.0, expectedS: 2.40 },
    { id: 'pyramid-lockBeside-tight-sp1', layout: 6, shape: 'pyramid · tall', story: 'lockBeside', stage: 'top', frameSpare: 2, depth: 4, spare: 1, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35, expectedD: 14.5, expectedS: 2.50 }
  ],

  // Layout 30: diamond (80 tiles, 5 layers) - Standard level
  30: [
    { id: 'diamond-lockBeside-d3-sp1', layout: 30, shape: 'diamond', story: 'lockBeside', stage: 'edge', depth: 3, spare: 1, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35, expectedD: 10.3, expectedS: 3.33 },
    { id: 'diamond-lockBeside-d3-sp2', layout: 30, shape: 'diamond', story: 'lockBeside', stage: 'edge', depth: 3, spare: 2, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35, expectedD: 8.5, expectedS: 3.08 },
    { id: 'diamond-lockBeside-d3-sp3', layout: 30, shape: 'diamond', story: 'lockBeside', stage: 'edge', depth: 3, spare: 3, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35, expectedD: 6.8, expectedS: 2.65 }
  ],

  // Layout 22: ushape (76 tiles, 6 layers) - Standard level
  22: [
    { id: 'ushape-lockBeside-d5-sp2', layout: 22, shape: 'ushape', story: 'lockBeside', stage: 'edge', depth: 5, spare: 2, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35, expectedD: 13.5, expectedS: 3.55 },
    { id: 'ushape-lockBeside-d5-sp3', layout: 22, shape: 'ushape', story: 'lockBeside', stage: 'edge', depth: 5, spare: 3, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35, expectedD: 10.8, expectedS: 2.73 },
    { id: 'ushape-lockBeside-d4-sp2', layout: 22, shape: 'ushape', story: 'lockBeside', stage: 'edge', depth: 4, spare: 2, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35, expectedD: 8.5, expectedS: 2.95 }
  ],

  // Layout 20: castle · two islands (84 tiles, 6 layers) - Standard level
  20: [
    { id: 'castle-lockBeside-d3-sp2', layout: 20, shape: 'castle · two islands', story: 'lockBeside', stage: 'top', depth: 3, spare: 2, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35, expectedD: 10.0, expectedS: 2.50 },
    { id: 'castle-lockBeside-d3-sp1', layout: 20, shape: 'castle · two islands', story: 'lockBeside', stage: 'top', depth: 3, spare: 1, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35, expectedD: 12.5, expectedS: 2.60 }
  ],

  // Layout 0: arch (80 tiles, 5 layers) - Standard level
  0: [
    { id: 'arch-lockBeside-d3-sp2', layout: 0, shape: 'arch', story: 'lockBeside', stage: 'edge', depth: 3, spare: 2, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35, expectedD: 10.5, expectedS: 2.50 },
    { id: 'arch-lockBeside-d3-sp1', layout: 0, shape: 'arch', story: 'lockBeside', stage: 'edge', depth: 3, spare: 1, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35, expectedD: 13.0, expectedS: 2.60 }
  ],

  // Layout 10: letterH (80 tiles, 5 layers) - Standard level
  10: [
    { id: 'letterH-lockBeside-d4-sp2', layout: 10, shape: 'letterH', story: 'lockBeside', stage: 'edge', depth: 4, spare: 2, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.34, expectedD: 9.8, expectedS: 4.85 },
    { id: 'letterH-lockBeside-d4-sp3', layout: 10, shape: 'letterH', story: 'lockBeside', stage: 'edge', depth: 4, spare: 3, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35, expectedD: 10.6, expectedS: 3.02 },
    { id: 'letterH-lockBeside-d4-sp1', layout: 10, shape: 'letterH', story: 'lockBeside', stage: 'edge', depth: 4, spare: 1, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35, expectedD: 13.2, expectedS: 3.35 },
    { id: 'letterH-lockBeside-d5-sp2', layout: 10, shape: 'letterH', story: 'lockBeside', stage: 'edge', depth: 5, spare: 2, frameSpare: 3, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.35, expectedD: 16.5, expectedS: 3.13 }
  ],

  // Layout 14: hourglass (80 tiles, 3 layers) - Standard level
  14: [
    { id: 'hourglass-lockBeside-d2-sp2', layout: 14, shape: 'hourglass', story: 'lockBeside', stage: 'edge', depth: 2, spare: 2, frameSpare: 2, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.30, expectedD: 16.5, expectedS: 2.73 },
    { id: 'hourglass-lockBeside-d2-sp1', layout: 14, shape: 'hourglass', story: 'lockBeside', stage: 'edge', depth: 2, spare: 1, frameSpare: 2, trayRoom: 0, hiddenOnWay: 1, traps: 2, maxDown: 0.30, expectedD: 18.5, expectedS: 2.80 }
  ]
};

// Generic fallback recipe for any layout
function genericRecipesForLayout(layout, shape, isBigBoard = false) {
  const depth = isBigBoard ? 3 : 3;
  return [
    { id: `gen-${layout}-lb-d${depth}-sp2`, layout, shape, story: 'lockBeside', stage: 'top', depth, spare: 2, trayRoom: 0, hiddenOnWay: 1, maxDown: 0.30, expectedD: 10.0, expectedS: 2.10, bigBoard: isBigBoard },
    { id: `gen-${layout}-lb-d${depth}-sp1`, layout, shape, story: 'lockBeside', stage: 'top', depth, spare: 1, trayRoom: 0, hiddenOnWay: 1, maxDown: 0.30, expectedD: 12.8, expectedS: 2.20, bigBoard: isBigBoard },
    { id: `gen-${layout}-ilc-d${depth}-sp2`, layout, shape, story: 'iceLockClock', stage: 'edge', depth, spare: 2, trayRoom: 0, hiddenOnWay: 1, maxDown: 0.30, expectedD: 10.5, expectedS: 2.15, bigBoard: isBigBoard },
    { id: `gen-${layout}-lb-d${depth+1}-sp1`, layout, shape, story: 'lockBeside', stage: 'top', depth: depth + 1, spare: 1, trayRoom: 0, hiddenOnWay: 1, maxDown: 0.35, expectedD: 15.5, expectedS: 2.25, bigBoard: isBigBoard }
  ];
}

module.exports = {
  RECIPES_BY_LAYOUT,
  genericRecipesForLayout
};
