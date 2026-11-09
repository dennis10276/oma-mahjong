'use strict';
// node --test source/tools/builder/loop/test_run_pipeline.js   (fakes for every step; one small dry-run smoke test)
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');
const P = require('./run_pipeline.js'), Lb = require('./library.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'oma-pipe-test-'));
const STORIES = ['keysFarSide', 'frozenGuards', 'deepClock', 'chainReaction', 'lockBeside'];
const briefs = STORIES.map((story, i) => ({ id: story + '-' + i, story, layout: i, shape: 'arch', frame: { spare: 1 } }));

// A fake board per (brief, seed); `same` maps a brief id to another so two briefs can make one board.
function fakeBuild({ same = {}, fail = () => false } = {}) {
  return brief => {
    if (fail(brief)) return { fail: 'unproven' };
    const id = same[brief.id] || brief.id, h = [...(id + brief.seed)].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
    const tiles = Array.from({ length: 80 }, (_, i) => [i % 10 * 2, Math.floor(i / 10) * 2, 0]);
    return { design: { tiles, faces: tiles.map((_, i) => (Math.floor(i / 2) + h) % 36), down: [], obst: { ice: {}, keys: [], locks: [] }, clock: { i: h % 80, n: 9 }, solution: [] }, card: { shape: 'arch' } };
  };
}
const fakeYs = ({ S = () => 4 } = {}) => {
  const calls = [];
  return { calls, fingerprint: 'fam-fp', referenceFingerprint: 'ref-fp', pins: { family: { botVersion: 'family-key-memory-v1-fast' }, planner: { fingerprint: 'ref-fp' } },
    planner: (d, o) => { calls.push(['planner', o.spare]); return { S: S(d), valid: true, fingerprint: 'ref-fp', styles: null }; } };
};
const staticOk = (o = {}) => () => ({ pass: true, k: 7, archetype: 'free-pair relief', card: 'Card.', warnings: [], shipSpares: [1, 2, 3],
  gates: { ...Object.fromEntries(['A1', 'A2', 'A3', 'A5', 'A6', 'A7', 'A9'].map(g => [g, { pass: true }])), A4: { pass: true, detail: { okSpares: o.okSpares || [1, 2, 3] } }, A8: { pass: true, flag: null } } });
function deps(over = {}) {
  const lib = Lb.createLibrary({ dir: over.dir || tmp() });
  const ys = over.ys || fakeYs();
  return {
    briefs, library: lib, ys, log: () => {},
    build: over.build || fakeBuild(),
    staticGates: over.staticGates || staticOk(),
    screenBoard: over.screenBoard || ((d, y, o) => { (y.calls || []).push(['screen', o.lo, o.hi]); return { keep: true, reasons: [], points: { 1: { D: 8, n: 20, valid: true }, 3: { D: 6, n: 20, valid: true } } }; }),
    measureCurve: over.measureCurve || (() => ({ block: 'CURVE', bot: 'family', fingerprint: 'fam-fp', steps: [], verdicts: {}, shippable: [1, 2, 3], diallable: true,
      points: [0, 1, 2, 3].map(s => ({ spare: s, D: 10 - 1.5 * s, se: 0.8, n: 80, valid: true })) })),
    traceGates: over.traceGates || ((d, o) => ({ spare: o.spare, pass: true, lossesAtTrapShare: 0.55, B7: { maxTarget: null }, thresholds: {}, budget: {} })),
    c1: over.c1 || ((d, o) => ({ pass: true, keyMemory: 6, reference: 6.4, tolerance: 2 })),
    c2c3: over.c2c3 || (() => ({ C2: { pass: true, asIs: 4, faceUp: 4.2 }, C3: { pass: true } })),
  };
}

test('candidates: frozenGuards and chainReaction are left out; seeds advance per pass over the briefs', () => {
  const list = P.candidateBriefs(briefs);
  assert.deepEqual(list.map(b => b.story), ['keysFarSide', 'deepClock', 'lockBeside']);
  assert.deepEqual([0, 1, 2, 3, 7].map(i => { const c = P.candidateAt(list, i, 1).brief; return [c.story, c.seed]; }),
    [['keysFarSide', 1], ['deepClock', 1], ['lockBeside', 1], ['keysFarSide', 2], ['deepClock', 3]]);
});

test('a clean run fills the library, logs yield and CPU per step, and a rerun resumes (skips everything)', () => {
  const dir = tmp(), d = deps({ dir });
  const s = P.runPipeline({ n: 6, targets: [6, 8] }, d);
  assert.equal(s.outcomes.library, 6);
  assert.equal(s.steps.build.in, 6); assert.equal(s.steps.library.pass, 6);
  assert(s.steps.planner.cpuS >= 0 && s.steps.static.cpuPerIn != null);
  const e = Lb.createLibrary({ dir }).entries();
  assert.equal(e.length, 6);
  assert.equal(e[0].design.clock.n, 7, 'frozen at k');
  assert.deepEqual(e[0].shipSpares, [1, 2, 3]);
  assert.equal(e[0].S.trusted, true); assert.equal(e[0].fingerprints.family, 'fam-fp');
  assert.match(e[0].card, /^Card\. The family bot's first error was at the trap in 55%/);
  assert.deepEqual([e[0].archetype.label, e[0].archetype.name], ['A1', 'free-pair relief']);
  assert.deepEqual(e[0].gates.traces[1].thresholds, {}, 'the thresholds actually returned by the trace are retained');
  assert.equal(e[0].gateProfile.id, 'e5-v1');
  assert.equal(e[0].fingerprints.gateProfile, e[0].gateProfile.fingerprint);
  assert.equal(typeof e[0].puzzleKey, 'string');
  assert.deepEqual(d.ys.calls.filter(c => c[0] === 'screen')[0], ['screen', 6, 8]);
  assert.deepEqual(d.ys.calls.filter(c => c[0] === 'planner').map(c => c[1]), Array.from({length:6}, () => [1,2,3]).flat());
  const runs = Lb.readJsonl(path.join(dir, 'pipeline-runs.jsonl'));
  assert.equal(runs.length, 1); assert.equal(runs[0].next, 6);
  const d2 = deps({ dir }), s2 = P.runPipeline({ n: 6, writeRunLog: false }, d2);
  assert.equal(s2.outcomes.skip, 6);
  assert.equal(d2.ys.calls.length, 0, 'no bot work on a resumed board');
  assert.equal(Lb.createLibrary({ dir }).entries().length, 6);
});

test('each gate rejects with its name; load-dependent static failures are not written', () => {
  const d1 = deps({ screenBoard: () => ({ keep: false, reasons: ['tooEasy'], points: { 1: { D: 2, n: 10, valid: true, stoppedAt: 10 } } }) });
  const s1 = P.runPipeline({ n: 2, writeRunLog: false }, d1);
  assert.deepEqual(d1.library.rejects().map(r => [r.gate, r.reason]), [['screen', 'tooEasy'], ['screen', 'tooEasy']]);
  assert.equal(s1.steps.planner.in, 0, 'the planner never runs on a screened-out board');
  const d3 = deps({ staticGates: () => ({ pass: false, k: 6, gates: { A4: { pass: false } }, warnings: ['wallClock: the hang guard was hit; verdicts may depend on PC load'] }) });
  const s3 = P.runPipeline({ n: 2, writeRunLog: false }, d3);
  assert.equal(s3.outcomes.unresolved, 2); assert.equal(d3.library.rejects().length, 0);
  const d4 = deps({ staticGates: () => ({ pass: false, k: 6, gates: { A1: { pass: true }, A4: { pass: false, detail: { why: ['x'] } }, A6: { pass: false } }, warnings: ['A4: node budget ran out before the clock'] }) });
  const s4 = P.runPipeline({ n: 1, writeRunLog: false }, d4);
  assert.deepEqual(d4.library.rejects().map(r => [r.gate, r.reason]), [['static', 'A4,A6']]);
  assert.deepEqual(s4.steps.static.byGate, { A4: 1, A6: 1 });
  assert.match(s4.text, /static failures by gate: A4 1, A6 1/);
  const d6 = deps({ ys: fakeYs({ S: () => 2.1 }) });
  P.runPipeline({ n: 1, writeRunLog: false }, d6);
  assert.match(d6.library.rejects()[0].reason, /S 2.1 outside 2.5-6/);
});

test('pipeline has per-board skilled limits and an explicit minimum-2 fallback, without hidden margins', () => {
  for (const S of [2.49, 6.01]) {
    const d = deps({ ys: fakeYs({ S: () => S }) });
    const r = P.runPipeline({ n: 1, writeRunLog: false }, d);
    assert.equal(r.steps.planner.fail, 1); assert.equal(d.library.entries().length, 0);
  }
  for (const S of [2.5, 6]) {
    const d = deps({ ys: fakeYs({ S: () => S }) });
    assert.equal(P.runPipeline({ n: 1, writeRunLog: false }, d).steps.library.pass, 1);
  }
  const fallback = deps({ ys: fakeYs({ S: () => 2 }) });
  assert.equal(P.runPipeline({ n: 1, skilledFloor: 2, writeRunLog: false }, fallback).steps.library.pass, 1);
  assert.equal(fallback.library.entries()[0].S.fallback, true);
  assert.throws(() => P.runPipeline({ skilledFloor: 1.99 }, deps()), /Every level requires/);
  assert.throws(() => P.runPipeline({ plannerMargin: 0.3 }, deps()), /Every level requires/);
});

test('a normal skilled rejection does not hide the same candidate from a fallback run', () => {
  const d = deps({ ys: fakeYs({ S: () => 2.2 }) });
  assert.equal(P.runPipeline({ n: 1, writeRunLog: false }, d).steps.planner.fail, 1);
  const r = P.runPipeline({ n: 1, skilledFloor: 2, writeRunLog: false }, d);
  assert.equal(r.steps.library.pass, 1);
  assert.equal(d.library.entries()[0].S.fallback, true);
  assert.match(r.pipeline, /fallback-2$/);
});

test('strict rejects do not suppress calibrated candidates; profile thresholds and raw failures are retained', () => {
  const base = staticOk(), d = deps({ staticGates: () => {
    const r = base(); r.pass = false; r.gates.A5.pass = false; r.gates.A7.pass = false; return r;
  }, traceGates: (design, o) => ({ spare: o.spare, pass: true, thresholds: o.thresholds, B7: { maxTarget: null } }) });
  assert.equal(P.runPipeline({ n: 1, gateProfile: 'strict-v1', writeRunLog: false }, d).steps.static.fail, 1);
  assert.equal(P.runPipeline({ n: 1, gateProfile: 'e5-v1', writeRunLog: false }, d).steps.library.pass, 1);
  const e = d.library.entries()[0];
  assert.equal(e.gates.static.gates.A7.wouldPass, false);
  assert.equal(e.gates.traces[2].thresholds.B2.min, 0.2);
  assert.equal(e.gateProfile.fingerprint, e.fingerprints.gateProfile);
});

test('a changed target band gets a new rejection identity rather than reusing an old screen failure', () => {
  const d = deps({ screenBoard: (design, ys, o) => ({ keep: o.lo < 10, reasons: ['outsideBand'] }) });
  const first = P.runPipeline({ n: 1, writeRunLog: false }, d);
  assert.equal(first.steps.screen.fail, 1);
  const second = P.runPipeline({ n: 1, targets: [6,8], writeRunLog: false }, d);
  assert.notEqual(second.pipeline, first.pipeline); assert.equal(second.steps.library.pass, 1);
});

test('ship spares: curve AND A4; traces and C1 drop spares; C2 only marks S untrusted; none left rejects', () => {
  const d = deps({
    staticGates: staticOk({ okSpares: [1, 2] }),
    traceGates: (x, o) => ({ spare: o.spare, pass: o.spare === 1 ? null : true, B1: { pass: null }, lossesAtTrapShare: 0.5 }),
    c1: (x, o) => ({ pass: o.spare !== 2, keyMemory: 6, reference: 9, tolerance: 2 }),
    c2c3: () => ({ C2: { pass: false, asIs: 3, faceUp: 6 } }),
  });
  P.runPipeline({ n: 1, writeRunLog: false }, d);
  const e = d.library.entries()[0];
  assert.deepEqual(e.shipSpares, [1]);
  assert.equal(e.S.trusted, false); assert.equal(e.S.faceUp, 6);
  assert.match(e.gates.spareNotes[3], /A4/); assert.match(e.gates.spareNotes[1], /undecided/); assert.match(e.gates.spareNotes[2], /C1 fail/);
  assert.deepEqual(Lb.pairsOf([e]).map(p => [p.spare, p.Strusted]), [[1, false]]);
  const d2 = deps({ traceGates: (x, o) => ({ spare: o.spare, pass: false, B5: { pass: false } }) });
  P.runPipeline({ n: 1, writeRunLog: false }, d2);
  assert.deepEqual(d2.library.rejects().map(r => r.gate), ['traces']);
  assert.match(d2.library.rejects()[0].reason, /B5/);
  const d3 = deps({ measureCurve: () => ({ points: [{ spare: 1, D: 20 }], shippable: [], verdicts: { 1: { spare: 1, reasons: ['censored'] } } }) });
  P.runPipeline({ n: 1, writeRunLog: false }, d3);
  assert.match(d3.library.rejects()[0].reason, /s1: censored/);
  const d4 = deps({ staticGates: staticOk({ okSpares: [3] }), measureCurve: () => ({ points: [], shippable: [1, 2], verdicts: {} }) });
  P.runPipeline({ n: 1, writeRunLog: false }, d4);
  assert.match(d4.library.rejects()[0].reason, /curve \[1,2\], A4 \[3\]/);
  const d5 = deps({ c1: () => ({ pass: false, keyMemory: 5, reference: 12, tolerance: 2 }) });
  P.runPipeline({ n: 1, writeRunLog: false }, d5);
  assert.deepEqual(d5.library.rejects().map(r => r.gate), ['C1']);
});

test('a crash is logged, not written; build failures and duplicates are counted; the time budget stops between boards', () => {
  let n = 0;
  const ok = staticOk();
  const d = deps({ staticGates: (x, o) => { if (++n === 2) throw Error('boom'); return ok(x, o); } });
  const s = P.runPipeline({ n: 3, writeRunLog: false }, d);
  assert.equal(s.outcomes.error, 1); assert.match(s.errors[0].error, /boom/);
  assert.equal(d.library.entries().length + d.library.rejects().length, 2);
  const d2 = deps({ build: fakeBuild({ same: { 'deepClock-2': 'keysFarSide-0' }, fail: b => b.story === 'lockBeside' }) });
  const s2 = P.runPipeline({ n: 3, writeRunLog: false }, d2);
  assert.deepEqual(s2.outcomes, { library: 1, skip: 1, buildFail: 1 });
  let t = 0;
  const d3 = deps(); d3.now = () => (t += 7 * 60000);
  const s3 = P.runPipeline({ n: 10, maxMinutes: 18, writeRunLog: false }, d3);
  assert(s3.done < 10 && /time budget/.test(s3.stopped)); assert.match(s3.text, /Next start: --start/);
});

test('smoke: dry run with the real builder, screen, curve and counterfactuals on a fake meter (1 candidate)', () => {
  const dir = tmp(), B = require('../builder.js');
  const d = P.fakeDeps();
  Object.assign(d, { build: b => B.build(b), briefs: require('../briefs-v1.json'), library: Lb.createLibrary({ dir }), log: () => {} });
  const s = P.runPipeline({ n: 1, start: 2, dryRun: true, writeRunLog: false, targets: [1, 20] }, d);
  assert.equal(s.done, 1);
  assert.equal(s.errors.length, 0, JSON.stringify(s.errors));
  assert.equal(s.steps.build.pass, 1);
});

test('missing C2 and unknown planner validity are not trusted / rejected', () => {
  const d = deps({ c2c3: () => ({}) });
  P.runPipeline({ n: 1, writeRunLog: false }, d);
  const e = d.library.entries()[0];
  assert.equal(e.S.trusted, false);
  assert.deepEqual(Lb.pairsOf([e]).map(p => p.Strusted), [false, false, false].slice(0, e.shipSpares.length));
  const d2 = deps({ c2c3: () => { throw Error('boom'); } });
  try { P.runPipeline({ n: 1, writeRunLog: false }, d2); } catch (x) { /* a throwing step is reported, never trusted */ }
  assert.ok(d2.library.entries().every(x => x.S.trusted === false));
  const ys = fakeYs(); const orig = ys.planner;
  ys.planner = (...a) => { const r = orig(...a); delete r.valid; return r; };
  const d3 = deps({ ys });
  P.runPipeline({ n: 1, writeRunLog: false }, d3);
  assert.equal(d3.library.entries().length, 0);
  assert.equal(d3.library.rejects()[0].gate, 'planner');
});

test('each clock setting uses its own skilled rating; a low spare-2 score cannot hide a viable tighter setting', () => {
  const d = deps();
  d.ys.planner = (design, {spare}) => ({ S: {1:3,2:1.8,3:1.5}[spare], valid: true, fingerprint: 'ref-fp' });
  P.runPipeline({n:1, writeRunLog:false}, d);
  const e = d.library.entries()[0];
  assert.deepEqual(e.shipSpares, [1]);
  const pairs = Lb.pairsOf([e]); assert.equal(pairs[0].S, 3); assert.equal(pairs[0].spare, 1);
});

test('construction mode is explicit, recorded and isolated from the baseline identity', () => {
  const baseline=P.runPipeline({n:1,writeRunLog:false},deps());
  const visible=P.runPipeline({n:1,mode:'visibleChoice',writeRunLog:false},deps());
  const dependency=P.runPipeline({n:1,mode:'dependencyChoice',writeRunLog:false},deps());
  assert.notEqual(visible.pipeline,baseline.pipeline);assert.equal(visible.options.mode,'visibleChoice');
  assert.notEqual(dependency.pipeline,baseline.pipeline);assert.notEqual(dependency.pipeline,visible.pipeline);
  assert.equal(dependency.options.mode,'dependencyChoice');
  assert(P.codeFingerprints()['visible_choice.js']);
  assert(P.codeFingerprints()['dependency_choice.js']);assert(P.codeFingerprints()['reserve_cuts.js']);
  assert.throws(()=>P.runPipeline({mode:'typo'},deps()),/Unknown builder mode/);
});

test('static shape checks receive the constructed shape before the input brief shape',()=>{
 let shape;
 const fresh=()=>{const d=deps({staticGates:(board,o)=>{shape=o.shape;return staticOk()(board,o);}});d.briefs=briefs.map(b=>({...b,shape:'block'}));return d;};
 P.runPipeline({n:1,writeRunLog:false},fresh());assert.equal(shape,'arch');
 P.runPipeline({n:1,writeRunLog:false,staticOptions:{shape:'clover'}},fresh());assert.equal(shape,'clover');
});

test('a qualifying spare-2 score never lends skilled credit to an easier spare', () => {
  const d = deps();
  d.ys.planner = (design, {spare}) => ({ S: {1:6.2,2:2.6,3:1.9}[spare], valid: true, fingerprint: 'ref-fp' });
  P.runPipeline({n:1, writeRunLog:false}, d);
  const e = d.library.entries()[0]; assert.deepEqual(e.shipSpares, [2]);
  assert.equal(e.S.bySpare[2].S, 2.6); assert.equal(e.S.bySpare[3], undefined);
});

test('face-up sanity and trust are measured per eligible clock setting', () => {
  const d = deps({c2c3: (design, o) => ({C2:{pass:o.plannerSpare!==3, faceUp:o.plannerSpare===3?10:4}, C3:{report:true}})});
  P.runPipeline({n:1, writeRunLog:false}, d);
  const e = d.library.entries()[0], pairs = Lb.pairsOf([e]);
  assert.equal(pairs.find(p=>p.spare===2).Strusted, true);
  assert.equal(pairs.find(p=>p.spare===3).Strusted, false);
  assert.equal(e.S.bySpare[3].faceUp, 10);
});
