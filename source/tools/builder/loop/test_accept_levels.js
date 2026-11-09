'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const A = require('./accept_levels.js'), L = require('./library.js'), GP = require('./gate_profile.js'), Y = require('./yardstick.js'), Policy = require('./policy.js');
function fixture(n = 1, options = {}) {
  const profile = GP.loadProfile(), calls = [], entries = [];
  for (let j = 0; j < n; j++) {
    const design = { tiles: Array.from({ length: 80 }, (_, i) => [j * 1000 + i * 4, 0, 0]), faces: Array.from({ length: 80 }, (_, i) => Math.floor(i / 2)), down: [], obst: {}, clock: { i: 0, n: 3 }, solution: Array.from({ length: 80 }, (_, i) => i) };
    entries.push(L.makeEntry({ design, k: 1, shipSpares: [2, 3], curve: { points: [] }, story: 'story-' + (j % 4), gateProfile: profile,
      S: { S: 4, trusted: true }, fingerprints: { family: 'family', planner: 'planner' } }));
  }
  const plan = { range: [250, 249 + n], levels: entries.map((e, i) => ({ level: 250 + i, key: e.key, spare: 2, target: Policy.familyTarget(250 + i) })) };
  const ledger = Y.createLedger(false), bias = options.bias ?? 0;
  const ys = { fingerprint: 'family', pins: { planner: { fingerprint: 'planner' }, blocks: { ACCEPT: { blockCampaigns: 40 } } }, ledger,
    accept(d, target) {
      const key = Y.puzzleKey(d), start = ledger.nextBlock(key), id = ledger.reserve(key, start, start + 8, { purpose: 'accept' });
      calls.push({ kind: 'accept', target, clockN: d.clock.n, start }); ledger.finish(key, id, { decision: 'accept' });
      return { decision: 'accept', D: target + bias, se: 0.1, n: 160, fingerprint: 'family', reserved: [start, start + 8] };
    },
    rate(d, o) {
      calls.push({ kind: 'rate', start: o.startBlock, campaigns: o.campaigns, clock: !!d.clock });
      const target = Policy.familyTarget(250 + Math.round(d.tiles[0][0] / 1000));
      return { D: target + (options.independentBias ?? bias) - (d.clock ? 0 : 2), se: 0.1, n: o.campaigns, valid: true, fingerprint: 'family' };
    } };
  const staticGates = () => ({ pass: true, shipSpares: [2, 3], warnings: [], gates: {
    ...Object.fromEntries(['A1','A2','A3','A4','A5','A6','A7','A9'].map(g => [g, { pass: true }])),
    A4: { pass: true, detail: { okSpares: [2, 3] } }, A8: { pass: true, flag: 'spare>=2 only' } } });
  const deps = { ys, staticGates,
    traceGates: (d, o) => { calls.push({ kind: 'traces', clockN: d.clock.n, o }); return { pass: true, ...Object.fromEntries(['B1','B2','B3','B4','B5','B6'].map(g => [g, { pass: true }])), B7: { maxTarget: null } }; },
    c1: () => ({ pass: true }),
    c2c3: (d, o) => { calls.push({ kind: 'planner', clockN: d.clock.n, spare: o.plannerSpare }); return { C2: { pass: true, valid: true, asIs: options.S ?? 4, fingerprint: 'planner' }, C3: { report: true } }; },
  };
  return { plan, entries, calls, deps, ys, profile };
}
test('acceptance checks the chosen spare, reserves independent seeds, and ablates on those same fresh seeds', () => {
  const f = fixture(), frozen = structuredClone(f.entries), r = A.acceptLevels(f.plan, f.entries, {}, f.deps);
  assert.equal(r.summary.readyForReview, true); assert.equal(r.results[0].status, 'accepted');
  assert.deepEqual(f.calls.find(c => c.kind === 'planner'), { kind: 'planner', clockN: 3, spare: 2 });
  assert.equal(f.calls.find(c => c.kind === 'traces').o.thresholds.B2.min, 0.2);
  assert.deepEqual(r.results[0].independentBlocks, [8, 12]);
  assert.deepEqual(f.calls.filter(c => c.kind === 'rate').map(c => [c.start, c.campaigns, c.clock]), [[8,160,true],[8,160,false]]);
  assert.deepEqual(f.entries, frozen);
});
test('five individually acceptable levels can fail both window checks; holes never count as on-target', () => {
  const f = fixture(5, { bias: 0.8 }), r = A.acceptLevels(f.plan, f.entries, {}, f.deps);
  assert.equal(r.summary.counts.accepted, 5); assert.equal(r.summary.windows[0].pass, false);
  assert.equal(r.summary.readyForReview, false);
  const h = fixture(5); h.plan.levels[2] = { level: 252, hole: true };
  const holes = A.acceptLevels(h.plan, h.entries, {}, h.deps);
  assert.equal(holes.summary.counts.hole, 1); assert.equal(holes.summary.windows[0].complete, false);
});
test('a fresh-seed miss refuses the level and does not run ablations', () => {
  const f = fixture(1, { independentBias: 1.1 }), r = A.acceptLevels(f.plan, f.entries, {}, f.deps);
  assert.equal(r.results[0].status, 'refused'); assert.deepEqual(r.results[0].reasons, ['independentDifficulty']);
  assert.equal(f.calls.filter(c => c.kind === 'rate').length, 1);
});
test('profile mismatch, unknown traces, and missing special proofs never become acceptance', () => {
  const f = fixture(); f.entries[0].gateProfile = GP.loadProfile('strict-v1');
  assert.match(A.acceptLevels(f.plan, f.entries, {}, f.deps).results[0].reasons[0], /gateProfileMismatch/);
  assert.equal(f.calls.length, 0);
  const u = fixture(), trace = u.deps.traceGates;
  u.deps.traceGates = (...args) => ({ ...trace(...args), B2: { pass: null } });
  assert.deepEqual(A.acceptLevels(u.plan, u.entries, {}, u.deps).results[0].reasons, ['traceProofIncomplete']);
  const s = fixture(); s.deps.c4 = () => ({ pass: true, fingerprint: 'family', specials: [] });
  assert.deepEqual(A.acceptLevels(s.plan, s.entries, {}, s.deps).results[0].reasons, ['specialProofIncomplete']);
});
test('skilled fallback is explicit per level; there is no averaging or allowance below 2', () => {
  const f = fixture(1, { S: 2.2 });
  assert.equal(A.acceptLevels(f.plan, f.entries, {}, f.deps).results[0].status, 'refused');
  const allowed = A.acceptLevels(f.plan, f.entries, { skilledMin: 2 }, f.deps);
  assert.equal(allowed.results[0].status, 'accepted'); assert.deepEqual(allowed.summary.fallbackLevels, [250]);
  assert.throws(() => A.acceptLevels(f.plan, f.entries, { skilledMin: 1.99 }, f.deps), /Every level/);
});
test('checkpoint resumes completed work without a seed retry and rejects altered inputs', () => {
  const f = fixture(), checkpoint = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'oma-accept-')), 'accept.json');
  const r = A.acceptLevels(f.plan, f.entries, { checkpoint }, f.deps), n = f.calls.length;
  assert.equal(A.acceptLevels(f.plan, f.entries, { checkpoint }, f.deps).results[0].status, 'accepted');
  assert.equal(f.calls.length, n);
  const changed = structuredClone(f.entries); changed[0].card = 'changed';
  assert.throws(() => A.acceptLevels(f.plan, changed, { checkpoint }, f.deps), /different plan/);
  r.results[0] = { level: 250, status: 'interrupted', reasons: ['interrupted'] }; fs.writeFileSync(checkpoint, JSON.stringify(r));
  const resumed = A.acceptLevels(f.plan, f.entries, { checkpoint }, f.deps);
  assert.equal(resumed.summary.readyForReview, false); assert.equal(f.calls.length, n);
});

test('a finishing-proof source change refuses old acceptance checkpoints before any seed retry',t=>{
 const f=fixture(),checkpoint=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'oma-proof-binding-')),'accept.json');
 A.acceptLevels(f.plan,f.entries,{checkpoint},f.deps);const calls=f.calls.length,read=fs.readFileSync;
 t.mock.method(fs,'readFileSync',(file,...args)=>{
  const value=read(file,...args);
  if(typeof file==='string'&&path.basename(file)==='finish.js')return Buffer.isBuffer(value)?Buffer.concat([value,Buffer.from('\n// changed finishing proof\n')]):value+'\n// changed finishing proof\n';
  return value;
 });
 assert.throws(()=>A.acceptLevels(f.plan,f.entries,{checkpoint},f.deps),/different plan, library, code/);assert.equal(f.calls.length,calls);
});
test('preflight rejects altered puzzles and targets before any bot work', () => {
  const f = fixture(); f.plan.levels[0].target = 9;
  assert.throws(() => A.acceptLevels(f.plan, f.entries, {}, f.deps), /approved curve/);
  f.plan.levels[0].target = 10; f.entries[0].design.faces[0] = 99;
  assert.throws(() => A.acceptLevels(f.plan, f.entries, {}, f.deps), /altered/);
  assert.equal(f.calls.length, 0);
});
test('a later batch needs accepted boundary evidence and checks windows across the boundary', () => {
  const f = fixture(5), slots = f.plan.levels.slice(4), T = Policy.familyTarget;
  const current = [{ level: 254, key: slots[0].key, spare: 2, status: 'accepted', D: T(254) + 0.8, independentD: T(254) + 0.8, target: T(254), S: 4 }];
  assert.deepEqual(A.summarize(slots, current, f.entries).missingContext, [250,251,252,253]);
  const history = f.plan.levels.slice(0,4).map(s => ({ ...s, status: 'accepted', D: T(s.level) + 0.8, independentD: T(s.level) + 0.8, S: 4 }));
  const r = A.summarize(slots, current, f.entries, history);
  assert.equal(r.windows[0].from, 250); assert.equal(r.windows[0].to, 254);
  assert.equal(r.windows[0].pass, false); assert.equal(r.readyForReview, false);
});
