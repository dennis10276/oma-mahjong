'use strict';
const B = require('../../../tools/builder/builder.js');
const E = require('../../../tools/builder/engine.js');
const L = require('../../../www/layouts.js');
const D = require('../../../tools/builder/loop/detour.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const W = D.work();

// Test prototyping construction on layout 22 (ushape, 76 tiles)
const lay = B.LAYOUTS[22];
const n = lay.tiles.length;
console.log('Layout 22:', lay.shape, n, 'tiles');

// Let's inspect neighbor structure and free tiles of layout 22
const c = B.context(lay.tiles);
const alive = new Uint8Array(n).fill(1);
const free = i => alive[i] && L.isFree(i, alive, c.nb);
const initialFree = Array.from({ length: n }, (_, i) => i).filter(free);
console.log('Initial free tiles count:', initialFree.length, 'tiles:', initialFree);
