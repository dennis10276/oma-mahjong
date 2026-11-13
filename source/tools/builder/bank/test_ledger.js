'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), L = require('./ledger.js');
const rated = L.loadRated();
assert.ok(rated.length >= 9, 'rated entries loaded: ' + rated.length);
const dir = path.join(__dirname, '../../../analysis/builder/bank/puzzles');
const f275 = fs.readdirSync(dir).find(x => x.startsWith('3bf50015'));
const copy = JSON.parse(fs.readFileSync(path.join(dir, f275), 'utf8'));
const r = L.check({ design: copy.design, card: copy.card }, rated);
assert.ok(!r.ok && r.reasons.length >= 2, 'copy of 275 rejected: ' + JSON.stringify(r.reasons));
// unused layout + new trap type, different cells: passes
const used = new Set(rated.map(e => e.layout));
const free = [...Array(48).keys()].find(l => !used.has(l));
const cand = { layout: free, trap: 'brandNewTrap', clock: '0,0,low', key: '2,2,high', ice: null, cells: ['900,900,0'] };
assert.deepStrictEqual(L.check(cand, rated), { ok: true, reasons: [] });
// trap type among last 2
assert.ok(!L.check({ ...cand, trap: rated[rated.length - 1].trap }, rated).ok);
// same layout and trap type ever together (outside the 12 window)
const old = [{ layout: 5, trap: 'a', clock: 'c1', key: 'k1', ice: null, cells: ['1,1,0'] }, ...Array.from({ length: 13 }, (_, i) => ({ layout: 100 + i, trap: 't' + i, clock: 'c' + i + 'x', key: 'k' + i + 'x', ice: 'i' + i, cells: ['9' + i + ',0,0'] }))];
let q = L.check({ layout: 5, trap: 'a', clock: 'z', key: 'z', ice: 'z', cells: ['1,1,0'] }, old);
assert.ok(!q.ok && q.reasons.some(x => /before/.test(x)) && !q.reasons.some(x => /last 12/.test(x)));
// fewer than 3 fields differ
q = L.check({ layout: 7, trap: 'a2', clock: 'c1', key: 'k1', ice: null, cells: ['5,5,0'] }, [old[0]]);
assert.ok(!q.ok && q.reasons.some(x => /fields differ/.test(x)));
// >75% layout overlap under a different id
const A = { layout: 1, trap: 'a', clock: 'x', key: 'y', ice: 'z', cells: ['1', '2', '3', '4'] };
const B = { layout: 2, trap: 'b', clock: 'p', key: 'q', ice: 'r' };
assert.ok(!L.check({ ...B, cells: ['1', '2', '3', '4', '9'] }, [A]).ok);
assert.ok(L.check({ ...B, cells: ['1', '8', '9', '7'] }, [A]).ok);
console.log('test_ledger OK');
