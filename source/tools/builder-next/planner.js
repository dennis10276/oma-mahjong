'use strict';
/**
 * planner.js - Difficulty-driven recipe planner for builder-next.
 * Maps requested family target (e.g. 10 or 13) and skilled band to
 * structural component recipes based on empirical calibration.
 */

// Calibrated empirical recipes organized by target tier and layout
const CALIBRATED_PLANS = {
  // Layout 22 (U-shape): primary body for difficulty 3-14
  22: {
    // Target tier ~3 (D: 2.5 - 4.0)
    3: [
      { id: 'u-base-s2', spare: 2, expectedD: 3.18, expectedS: 2.98 }
    ],
    // Target tier ~5-6 (D: 4.5 - 6.5)
    5: [
      { id: 'u-keys0-40-s2', keys: [0, 40], spare: 2, expectedD: 4.18, expectedS: 3.12 },
      { id: 'u-keys0-40-s1', keys: [0, 40], spare: 1, expectedD: 5.18, expectedS: 3.23 }
    ],
    // Target tier ~7-8 (D: 6.5 - 8.5)
    7: [
      { id: 'u-keys5-9-ice44-s2', keys: [5, 9], ice: { tile: 44, h: 2 }, spare: 2, expectedD: 6.75, expectedS: 2.92 },
      { id: 'u-keys5-9-s1', keys: [5, 9], spare: 1, expectedD: 7.20, expectedS: 3.63 },
      { id: 'u-keys0-40-ice61-s1', keys: [0, 40], ice: { tile: 61, h: 1 }, spare: 1, expectedD: 7.45, expectedS: 3.33 }
    ],
    8: [
      { id: 'u-keys5-9-ice44-s1', keys: [5, 9], ice: { tile: 44, h: 2 }, spare: 1, expectedD: 8.51, expectedS: 2.95 },
      { id: 'u-keys5-9-dualIce-s2', keys: [5, 9], ice: { 44: 2, 61: 1 }, spare: 2, expectedD: 8.09, expectedS: 3.05 }
    ],
    // Target tier 10 (D: 9.0 - 11.0)
    10: [
      // Primary: balanced wing thaw (keys [5, 9] with ice on wing tile 44, spare 1)
      { id: 'u-plan10-keys5-9-ice44-s1', keys: [5, 9], ice: { tile: 44, h: 2 }, spare: 1, expectedD: 8.51, expectedS: 2.95 },
      // Secondary: dual wing thaw with spare 2
      { id: 'u-plan10-dual-wing-s2', keys: [5, 9], ice: { 44: 2, 61: 1 }, spare: 2, expectedD: 8.09, expectedS: 3.05 }
    ],
    // Target tier 12-13 (D: 11.5 - 14.0)
    13: [
      // Primary: high-difficulty candidate using deep wing peeling
      { id: 'u-plan13-keys12-16-ice44-s1', keys: [12, 16], ice: { tile: 44, h: 2 }, spare: 1, expectedD: 13.52, expectedS: 9.22 },
      // Balanced alternative: balanced wing thaw (preserves skilled S in band)
      { id: 'u-plan13-keys5-9-ice44-s1', keys: [5, 9], ice: { tile: 44, h: 2 }, spare: 1, expectedD: 8.51, expectedS: 2.95 }
    ]
  },

  // Layout 20 (Castle · two islands): secondary body
  20: {
    3: [
      { id: 'castle-keys47-62-s1', keys: [47, 62], lockTile: 77, spare: 1, expectedD: 3.34, expectedS: 2.98 }
    ],
    7: [
      { id: 'castle-keys47-62-ice81-s1', keys: [47, 62], lockTile: 77, ice: { tile: 81, h: 2 }, spare: 1, expectedD: 7.03, expectedS: 1.07 }
    ],
    10: [
      { id: 'castle-keys47-62-ice81-s1', keys: [47, 62], lockTile: 77, ice: { tile: 81, h: 2 }, spare: 1, expectedD: 7.03, expectedS: 1.07 }
    ],
    13: [
      { id: 'castle-keys47-62-ice63-s2', keys: [47, 62], lockTile: 77, ice: { tile: 63, h: 2 }, spare: 2, expectedD: 16.59, expectedS: 2.90 }
    ]
  },

  // Layout 0 (Arch): secondary body
  0: {
    3: [
      { id: 'arch-keys13-29-s1', keys: [13, 29], lockTile: 0, spare: 1, expectedD: 2.70, expectedS: 1.13 }
    ],
    5: [
      { id: 'arch-keys43-61-s1', keys: [43, 61], lockTile: 0, spare: 1, expectedD: 5.58, expectedS: 7.75 }
    ]
  },

  // Layout 14 (Hourglass): secondary body
  14: {
    5: [
      { id: 'hg-keys17-72-s1', keys: [17, 72], lockTile: 76, spare: 1, expectedD: 4.83, expectedS: 3.23 }
    ]
  }
};

/**
 * Plans an initial construction recipe for the requested target and layout.
 */
function planInitialRecipe(target = 10, layout = 22, options = {}) {
  const layoutPlans = CALIBRATED_PLANS[layout] || CALIBRATED_PLANS[22];
  
  // Find closest matching tier in the knowledge table
  const tiers = Object.keys(layoutPlans).map(Number).sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
  const bestTier = tiers[0];
  const candidates = layoutPlans[bestTier] || [];

  if (!candidates.length) {
    // Fallback: default keyed recipe
    return {
      id: `default-plan-${target}`,
      layout,
      spare: 1,
      keys: [5, 9],
      ice: target >= 9 ? { tile: 44, h: 2 } : null
    };
  }

  const selected = { ...candidates[0], layout };
  return selected;
}

module.exports = {
  CALIBRATED_PLANS,
  planInitialRecipe
};
