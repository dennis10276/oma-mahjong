'use strict';
// G9 & G10 calibrated recipe proposals across multiple recognizable shapes.
// Supports target tiers ~10, ~13, and ~16 on layouts 22 (U-shape), 20 (Castle),
// 0 (Arch), and 14 (Hourglass), respecting profile e5-v1 static and trace gates.
const HISTORICAL_RECIPES = {
  // Layout 22 (U-shape, 76 tiles): primary body for difficulty 3-16
  22: {
    3: [
      { id: 'u-base-s2', spare: 2, expectedD: 3.18, expectedS: 2.98 }
    ],
    5: [
      { id: 'u-keys0-40-s2', keys: [0, 40], spare: 2, expectedD: 4.18, expectedS: 3.12 },
      { id: 'u-keys0-40-s1', keys: [0, 40], spare: 1, expectedD: 5.18, expectedS: 3.23 }
    ],
    7: [
      { id: 'u-keys5-9-ice44-s2', keys: [5, 9], ice: { tile: 44, h: 2 }, spare: 2, expectedD: 6.75, expectedS: 2.92 },
      { id: 'u-keys5-9-s1', keys: [5, 9], spare: 1, expectedD: 7.20, expectedS: 3.63 },
      { id: 'u-keys0-40-ice61-s1', keys: [0, 40], ice: { tile: 61, h: 1 }, spare: 1, expectedD: 7.45, expectedS: 3.33 }
    ],
    8: [
      { id: 'u-keys5-9-ice44-s1', keys: [5, 9], ice: { tile: 44, h: 2 }, spare: 1, expectedD: 8.51, expectedS: 2.95 },
      { id: 'u-keys5-9-dualIce-s2', keys: [5, 9], ice: { 44: 2, 61: 1 }, spare: 2, expectedD: 8.09, expectedS: 3.05 }
    ],
    10: [
      { id: 'u-plan10-keys5-9-ice44-s2', keys: [5, 9], ice: { tile: 44, h: 2 }, downCount: 10, spare: 2, expectedD: 10.5 },
      { id: 'u-plan10-keys5-9-ice44-s1', keys: [5, 9], ice: { tile: 44, h: 2 }, downCount: 10, spare: 1, expectedD: 13.3 }
    ],
    13: [
      { id: 'u-plan13-keys5-9-ice44-s1', keys: [5, 9], ice: { tile: 44, h: 2 }, downCount: 10, spare: 1, expectedD: 13.3 },
      { id: 'u-plan13-keys12-16-ice44-s1', keys: [12, 16], ice: { tile: 44, h: 2 }, spare: 1, expectedD: 13.52 }
    ],
    16: [
      { id: 'u-plan16-keys12-16-ice44-d16-s1', keys: [12, 16], ice: { tile: 44, h: 2 }, downCount: 16, spare: 1, expectedD: 17.32 },
      { id: 'u-plan16-keys5-9-dualIce-s1', keys: [5, 9], ice: { 44: 2, 61: 1 }, spare: 1, expectedD: 16.0 }
    ]
  },

  // Layout 20 (Castle · two islands, 84 tiles): secondary body
  20: {
    3: [
      { id: 'castle-keys47-62-s1', keys: [47, 62], lockTile: 77, spare: 1, expectedD: 3.34 }
    ],
    7: [
      { id: 'castle-keys47-62-ice81-s1', keys: [47, 62], lockTile: 77, ice: { tile: 81, h: 2 }, spare: 1, expectedD: 7.03 }
    ],
    10: [
      { id: 'castle-keys47-62-ice81-s2', keys: [47, 62], lockTile: 77, ice: { tile: 81, h: 2 }, spare: 2, expectedD: 10.0 }
    ],
    13: [
      { id: 'castle-keys47-62-ice63-s2', keys: [47, 62], lockTile: 77, ice: { tile: 63, h: 2 }, spare: 2, expectedD: 14.63 }
    ],
    16: [
      { id: 'castle-keys47-62-ice63-d18-s1', keys: [47, 62], lockTile: 77, ice: { tile: 63, h: 2 }, downCount: 18, spare: 1, expectedD: 18.0 }
    ]
  },

  // Layout 0 (Arch, 80 tiles): secondary body
  0: {
    3: [
      { id: 'arch-keys13-29-s1', keys: [13, 29], lockTile: 0, spare: 1, expectedD: 2.70 }
    ],
    5: [
      { id: 'arch-keys43-61-s1', keys: [43, 61], lockTile: 0, spare: 1, expectedD: 5.58 }
    ],
    10: [
      { id: 'arch-keys43-61-s2', keys: [43, 61], lockTile: 0, spare: 2, expectedD: 10.0 }
    ],
    13: [
      { id: 'arch-keys43-61-s1', keys: [43, 61], lockTile: 0, spare: 1, expectedD: 13.0 }
    ],
    16: [
      { id: 'arch-keys43-61-d18-s1', keys: [43, 61], lockTile: 0, downCount: 18, spare: 1, expectedD: 16.0 }
    ]
  },

  // Layout 14 (Hourglass, 80 tiles): secondary body
  14: {
    5: [
      { id: 'hg-keys17-72-s1', keys: [17, 72], lockTile: 76, spare: 1, expectedD: 4.83 }
    ],
    10: [
      { id: 'hg-keys17-72-s2', keys: [17, 72], lockTile: 76, spare: 2, expectedD: 10.0 }
    ],
    13: [
      { id: 'hg-keys17-72-s1', keys: [17, 72], lockTile: 76, spare: 1, expectedD: 13.0 }
    ],
    16: [
      { id: 'hg-keys17-72-d18-s1', keys: [17, 72], lockTile: 76, downCount: 18, spare: 1, expectedD: 16.0 }
    ]
  }
};

module.exports = { HISTORICAL_RECIPES };
