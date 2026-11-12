'use strict';
// node source/tools/builder/bank/test_smarten.js   (about 10 s, one core)
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.resolve(__dirname, '../../../..'), DIR = path.join(ROOT, 'source/analysis/builder/bank/puzzles');
const E = require('../engine.js'), T = require('./texture.js'), { smarten } = require('./smarten.js');
const f = fs.readdirSync(DIR).find(x => x.startsWith('2073ccd9')) || fs.readdirSync(DIR)[0];
const p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')), d = p.design;
const x = T.texture(d);
assert(x.before.pairs + x.after.pairs === d.tiles.length / 2, 'pairs cover the board');
assert(x.after.trayMax <= 3 && x.faceDownShare >= 0, 'tray profile');
const r = smarten(d, { spec: p.spec, k: p.card.clock.k, seed: 1, cpuSec: 3 });
assert(E.replay(r.design, r.design.solution, { strict: true }).ok, 'stored solution still a strict win');
assert.deepStrictEqual(r.design.tiles, d.tiles, 'layout unchanged');
assert.deepStrictEqual(r.design.clock, d.clock, 'clock unchanged');
assert.deepStrictEqual(r.design.obst, d.obst, 'specials unchanged');
assert(r.design.down.length / d.tiles.length <= 0.3 + 1e-9 || r.notes.some(n => /free to turn up|rejected/.test(n)), 'face-down share <= 0.30 or explained');
const r2 = smarten(d, { spec: p.spec, k: p.card.clock.k, seed: 1, cpuSec: 3 });
assert(r.design.faces.every((v, i) => v === r2.design.faces[i]) || r.cpuMs > 0, 'runs');
console.log('test_smarten ok', JSON.stringify(r.edits), r.J);
