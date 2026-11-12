'use strict';
const assert = require('assert'), { place, targetCurve } = require('./place.js');
assert.strictEqual(targetCurve(250), 6); assert.ok(Math.abs(targetCurve(265) - 7) < 1e-9);
assert.ok(Math.abs(targetCurve(325) - 11) < 1e-9);
let id = 0;
const mk = (D, tiles, layout, o = {}) => ({ key: 'k' + (++id), body: 'b' + id, layout, tiles, D40: D, D20: D, S: 3, band: 'normal', B7: 0.1, ...o });
const bank = [];
for (let l = 250; l < 260; l++) bank.push(mk(targetCurve(l) + 0.2, l % 10 === 0 ? 96 : 80, l % 5));
let r = place(bank, { start: 250, count: 10 });
assert.strictEqual(r.filled, 10); assert.strictEqual(r.violationsLeft, 0);
assert.strictEqual(r.rows[0].tiles, 96);
// 96 never on a non-big level; hole reported
r = place([mk(6.2, 96, 1)], { start: 251, count: 1 });
assert.strictEqual(r.filled, 0); assert.strictEqual(r.holes[0].tileClass, '72-88');
// skilled minimum 1.75, maximum 6; repeated-blunder share at most 0.3 (Dennis 2026-11-12)
assert.strictEqual(place([mk(6.1, 96, 1, { S: 1.7 })], { start: 250, count: 1 }).filled, 0);
assert.strictEqual(place([mk(6.1, 96, 1, { S: 1.8 })], { start: 250, count: 1 }).filled, 1);
assert.strictEqual(place([mk(6.1, 96, 1, { S: 6.1 })], { start: 250, count: 1 }).filled, 0);
assert.strictEqual(place([mk(6.1, 96, 1, { B7: 0.31 })], { start: 250, count: 1 }).filled, 0);
assert.strictEqual(place([mk(6.1, 96, 1, { B7: null })], { start: 250, count: 1 }).filled, 0);
// deviation > 1 rejected; taken excluded; body dup
assert.strictEqual(place([mk(7.5, 80, 1)], { start: 251, count: 1 }).filled, 0);
const t = mk(6.1, 80, 1); assert.strictEqual(place([t], { start: 251, count: 1, taken: [t.key] }).filled, 0);
const a1 = mk(6.1, 80, 1), a2 = mk(6.2, 80, 2, { body: a1.body });
assert.strictEqual(place([a1, a2], { start: 251, count: 2 }).filled, 1);
// same layout within 3 levels
const s1 = mk(6.1, 80, 7), s2 = mk(6.3, 80, 7);
assert.strictEqual(place([s1, s2], { start: 251, count: 2 }).filled, 1);
// window repair
const w = [];
for (let l = 251; l < 256; l++) w.push(mk(targetCurve(l) + 0.9, 80, l % 5));
for (let l = 251; l < 256; l++) w.push(mk(targetCurve(l) - 0.9, 80, (l + 2) % 5 + 5));
r = place(w, { start: 251, count: 5 });
assert.strictEqual(r.violationsLeft, 0); assert.strictEqual(r.filled, 5);
assert.ok(r.windows.every(x => x.ok));
console.log('test_place OK');
