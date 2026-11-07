'use strict';
// node --test source/tools/builder/loop/test_library.js
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');
const Lb = require('./library.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'oma-lib-test-'));
function design(seed = 1, n = 8) {
  const tiles = Array.from({ length: 72 + (seed % 3) * 8 }, (_, i) => [i % 12 * 2, Math.floor(i / 12) * 2, 0]);
  return { tiles, faces: tiles.map((_, i) => (Math.floor(i / 2) + seed) % 36), down: [5, 3], gold: null, obst: { ice: {}, keys: [], locks: [] }, clock: { i: 10, n }, solution: [1, 2, 3] };
}
const curve = (D = { 0: 12, 1: 9, 2: 7, 3: 6 }, ship = [1, 2, 3]) => ({ block: 'CURVE', bot: 'family', fingerprint: 'fam', shippable: ship, diallable: true,
  points: Object.entries(D).map(([s, d]) => ({ spare: +s, D: d, se: 0.8, n: 80, valid: true, perCampaign: [1, 2] })), steps: [], verdicts: {} });
const entry = (seed, o = {}) => Lb.makeEntry({ design: design(seed), k: 7, story: o.story || 'keysFarSide', layout: 3, briefId: 'b' + seed, seed,
  curve: curve(o.D, o.ship), shipSpares: o.shipSpares, S: o.S ?? { S: 4, valid: true, trusted: true }, fingerprints: { family: o.family || 'fam' },
  gates: o.gates || { traces: { 2: { B7: { maxTarget: 10 } }, 3: { B7: { maxTarget: null } } } } });

test('contentKey ignores the clock budget and the witness, sees everything else', () => {
  const a = design(1, 8), b = design(1, 11);
  b.solution = [3, 2, 1];
  assert.equal(Lb.contentKey(a), Lb.contentKey(b));
  const c = design(1); c.faces[0] = 35; assert.notEqual(Lb.contentKey(a), Lb.contentKey(c));
  const d = design(1); d.down = [3, 5]; assert.equal(Lb.contentKey(a), Lb.contentKey(d), 'face-down order is not content');
  const e = design(1); e.clock.i = 11; assert.notEqual(Lb.contentKey(a), Lb.contentKey(e));
  const f = design(1); f.obst.ice = { 4: 1 }; assert.notEqual(Lb.contentKey(a), Lb.contentKey(f));
  assert.equal(Lb.contentKey({ design: a }), Lb.contentKey(a), 'a wrapped design is unwrapped');
});

test('makeEntry freezes the design at spare 0 and tags it', () => {
  const e = entry(2);
  assert.equal(e.schema, Lb.ENTRY_SCHEMA);
  assert.equal(e.design.clock.n, 7); assert.equal(e.k, 7);
  assert.equal(e.key, Lb.contentKey(design(2)));
  assert.deepEqual(e.shipSpares, [1, 2, 3]);
  assert.equal(e.tags.bigBoard, false); assert.equal(e.tags.openingClock, false);
  assert.throws(() => Lb.makeEntry({ design: design(1) }), /k/);
  const big = Lb.makeEntry({ design: { ...design(1), tiles: Array.from({ length: 92 }, (_, i) => [i, 0, 0]) }, k: 5, curve: curve() });
  assert.equal(big.tags.bigBoard, true); assert.equal(big.tags.openingClock, true);
});

test('append-only library: add, dedupe, reject, has, resume from disk', () => {
  const dir = tmp(), lib = Lb.createLibrary({ dir });
  assert.equal(lib.has(entry(1).key), null);
  assert.deepEqual(lib.add(entry(1)), { added: true, key: entry(1).key });
  assert.equal(lib.add(entry(1)).reason, 'duplicate');
  const r = lib.reject({ design: design(2), gate: 'static', reason: 'A4', briefId: 'b2' });
  assert.equal(r.added, true);
  assert.equal(lib.reject({ design: design(2), gate: 'curve', reason: 'x' }).reason, 'duplicate');
  assert.equal(lib.reject({ design: design(1), gate: 'curve', reason: 'x' }).reason, 'inLibrary');
  assert.throws(() => lib.reject({ design: design(3) }), /gate/);
  const before = fs.readFileSync(lib.files.library, 'utf8');
  lib.add(entry(4));
  assert(fs.readFileSync(lib.files.library, 'utf8').startsWith(before), 'earlier lines untouched');
  const again = Lb.createLibrary({ dir });
  assert.equal(again.has(entry(1).key), 'library');
  assert.equal(again.has(Lb.contentKey(design(2))), 'reject');
  assert.equal(again.entries().length, 2);
  assert.equal(again.rejects()[0].design, undefined, 'reject rows do not store the design by default');
  assert.deepEqual(again.rejectStats(), { total: 1, byGate: { static: 1 } });
  // a tampered entry is refused
  const bad = entry(5); bad.design.faces[0] = 30;
  assert.throws(() => again.add(bad), /key/);
});

test('a half-written last line is skipped and the next append starts a fresh line', () => {
  const dir = tmp(), lib = Lb.createLibrary({ dir });
  lib.add(entry(1));
  fs.appendFileSync(lib.files.library, '{"schema":"library-entry-v1","key":"trunc');
  const l2 = Lb.createLibrary({ dir });
  assert.equal(l2.entries().length, 1); assert.equal(l2.damaged.length, 1);
  l2.add(entry(2));
  const l3 = Lb.createLibrary({ dir });
  assert.equal(l3.entries().length, 2); assert.equal(l3.damaged.length, 1);
});

test('query and pairsOf', () => {
  const dir = tmp(), lib = Lb.createLibrary({ dir });
  lib.add(entry(1, { story: 'deepClock', D: { 0: 14, 1: 10, 2: 8, 3: 7 } }));
  lib.add(entry(2, { story: 'lockBeside', S: { S: 2, valid: true, trusted: false } }));
  lib.add(entry(3, { family: 'other', shipSpares: [] }));
  assert.equal(lib.query({ story: 'deepClock' }).length, 1);
  assert.equal(lib.query({ D: [9.5, 10.5] }).length, 1);
  assert.equal(lib.query({ D: [9.5, 10.5], spare: 2 }).length, 0);
  assert.equal(lib.query({ trustedS: true }).length, 2);
  assert.equal(lib.query({ shippable: true }).length, 2);
  assert.equal(lib.query({ fingerprint: 'fam' }).length, 2);
  const { pairs, skipped } = Lb.pairsOf(lib.entries(), { family: 'fam', withSkipped: true, measured: { [entry(1).key + ':2']: { D: 8.4, se: 0.4 } } });
  assert.equal(skipped.otherRuler, 1);
  assert.equal(pairs.length, 6);
  const p12 = pairs.find(p => p.key === entry(1).key && p.spare === 2);
  assert.equal(p12.D, 8.4); assert.equal(p12.Dsource, 'ACCEPT'); assert.equal(p12.maxTarget, 10);
  assert.equal(pairs.find(p => p.key === entry(1).key && p.spare === 1).Dsource, 'CURVE');
  const p2 = pairs.find(p => p.key === entry(2).key);
  assert.equal(p2.Strusted, false); assert.equal(p2.story, 'lockBeside');
});

test('smoke: a real build gives the same content key twice (deterministic builder)', () => {
  const B = require('../builder.js'), briefs = require('../briefs-v1.json');
  const b = { ...briefs[0], seed: 1 };
  const a = B.build(b), c = B.build(b);
  assert(a.design, 'build ok'); assert.equal(Lb.contentKey(a.design), Lb.contentKey(c.design));
});

test('a reject made under an older pipeline version can be tested again', () => {
  const lib = Lb.createLibrary({ dir: tmp() }), k = Lb.contentKey(design(5));
  assert.equal(lib.reject({ design: design(5), gate: 'static', reason: 'x', pipeline: 'v1' }).added, true);
  assert.equal(lib.has(k, { pipeline: 'v1' }), 'reject');
  assert.equal(lib.has(k, { pipeline: 'v2' }), null);
  assert.equal(lib.reject({ design: design(5), gate: 'static', reason: 'y', pipeline: 'v1' }).reason, 'duplicate');
  assert.equal(lib.reject({ design: design(5), gate: 'curve', reason: 'z', pipeline: 'v2' }).added, true);
  assert.equal(lib.has(k, { pipeline: 'v2' }), 'reject');
});
