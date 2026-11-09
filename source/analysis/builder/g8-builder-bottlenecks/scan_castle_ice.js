'use strict';
// scan_castle_ice.js
// Scans clean ice prerequisites on Castle (Layout 20) with keys [47, 62] and lock 77
const VC = require('../../../tools/builder/visible_choice.js');
const K = require('../../../tools/builder/knobs.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const T = require('../../../tools/builder/loop/traces.js');
const Y = require('../../../tools/builder/loop/yardstick.js');

const profile = GP.loadProfile('e5-v1');
const ys = Y.createYardstick();

const base = VC.build({
  layout: 20, shape: 'castle · two islands', story: 'deepClock', stage: 'top',
  frame: { spare: 2 }, targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
  seed: 2, mode: 'visibleChoice'
});

const clockTile = base.design.clock.i;
const keys = [47, 62];
const lockTile = 77;
const n = base.design.tiles.length;

const validIce = [];
for (let t = 0; t < n; t++) {
  if (t === clockTile || keys.includes(t) || t === lockTile) continue;
  for (const h of [1, 2]) {
    const res = K.clockKeyIce(base.design, keys, { tile: t, h }, 1, { lockTile });
    if (!res.fail && res.proof) {
      const p = res.design.faces.findIndex((f, idx) => idx !== t && f === res.design.faces[t]);
      const partnerIsClock = (p === clockTile);
      const partnerIsKey = keys.includes(p);
      const partnerIsLock = (p === lockTile);
      if (!partnerIsClock && !partnerIsKey && !partnerIsLock) {
        validIce.push({ tile: t, h, k: res.proof.minimum, partner: p });
      }
    }
  }
}

console.log(`Found ${validIce.length} clean ice candidates on Castle with keys [47, 62] and lock 77:`);
validIce.sort((a, b) => b.k - a.k);
for (const v of validIce) {
  console.log(`tile: ${v.tile}, h: ${v.h}, k: ${v.k}, partner: ${v.partner}`);
}
