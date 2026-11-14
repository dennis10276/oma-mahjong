'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const { exportTable, loadTable } = require('./export_levels.js');
const SRC = path.resolve(__dirname, '../../..');
const text = fs.readFileSync(path.join(SRC, 'www/levels-hard.js'), 'utf8');
const dir = path.join(SRC, 'build/traps/examples2');
const chains = fs.readdirSync(dir).filter(f => /^chain-.*\.json$/.test(f)).sort().map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).design);
assert.ok(chains.length >= 6, 'the lab-5 chain boards are there');
const clone = o => JSON.parse(JSON.stringify(o));
const set = (start, ds) => Object.fromEntries(ds.map((d, i) => [start + i, clone(d)]));
const old = loadTable(text);

// 1. six boards at 250-255: the strict tile-size rule refuses the three that are under 54 px, --minpx lets the dry run through
let r = exportTable(text, set(250, chains.slice(0, 6))).report;
assert.strictEqual(r.ok, false); assert.ok(r.errors.some(e => /tile size/.test(e)));
r = exportTable(text, set(250, chains.slice(0, 6)), { minPx: 50 }).report;
assert.strictEqual(r.ok, true, JSON.stringify(r.errors));
assert.strictEqual(r.levels.length, 6); assert.ok(r.levels.every(l => l.decodesExact && l.solutionWins));
assert.strictEqual(r.checks.untouchedLevels, 194); assert.strictEqual(r.checks.careTrackUsesTable, false);
const nw = loadTable(r.text);
assert.strictEqual(nw.levels.length, old.levels.length); assert.strictEqual(nw.ratingModels.length, old.levels.length);
const J = x => JSON.stringify(x);   // (tables come from a vm context: compare as text)
assert.strictEqual(J(nw.levels.slice(0, 180)), J(old.levels.slice(0, 180))); assert.strictEqual(J(nw.levels.slice(186)), J(old.levels.slice(186)));
assert.notStrictEqual(J(nw.levels[180]), J(old.levels[180]));
assert.ok(r.text.includes('\r\n') === text.includes('\r\n'), 'line ends kept');
assert.strictEqual(r.checks.cycle.firstPastEndBase, 150);

// 2. appending: level 270 extends the table and the cycle
r = exportTable(text, set(268, chains.slice(0, 3)), { minPx: 50 }).report;
assert.strictEqual(r.ok, true, JSON.stringify(r.errors));
assert.strictEqual(loadTable(r.text).levels.length, old.levels.length + 1); assert.strictEqual(r.checks.cycle.last, 270); assert.strictEqual(r.checks.cycle.span, 121);

// 3. refusals
const bad = (ds, o, re) => { const x = exportTable(text, ds, o).report; assert.strictEqual(x.ok, false); assert.ok(x.errors.some(e => re.test(e)), x.errors.join('|')); };
bad(set(272, chains.slice(0, 1)), { minPx: 50 }, /gap/);
bad(set(249, chains.slice(0, 1)), { minPx: 50 }, /below 250/);
bad({ 250: chains[1], 252: chains[2] }, { minPx: 50 }, /gap/);
{ const d = clone(chains[1]); d.solution = d.solution.slice().reverse(); bad({ 251: d }, {}, /does not win/); }
{ const d = clone(chains[1]); d.solution.pop(); bad({ 251: d }, {}, /solution must list/); }
{ const d = clone(chains[1]); d.faces[0] = (d.faces[0] + 1) % 36; bad({ 251: d }, {}, /odd number/); }
{ const d = clone(chains[1]); d.obst.keys = []; bad({ 251: d }, {}, /locks without keys/); }
{ const d = clone(chains[1]); d.tiles[0][0] = 64; bad({ 251: d }, {}, /outside 0\.\.63/); }
{ const d = clone(chains[1]); d.clock.n = 0; bad({ 251: d }, {}, /clock invalid/); }
console.log('test_export_levels: all passed');
