'use strict';
// node --test source/tools/builder/loop/test_traces.js
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const E = require('../engine.js'), T = require('./traces.js'), A = require('../task11_analyze.js');

const ROWS = fs.readFileSync(path.join(__dirname, '../../../analysis/builder/data/qualified-200-225.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const ROW = ROWS[1]; // 70bde28d4c0922c5, 76 tiles
const design = T.atSpare(ROW, 1).design, g = E.game(design), N = design.tiles.length;

// ---------- a fake capture in the bot's physical trace format, made by stepping the engine ----------
const physical = s => ({ alive: Array.from(s.alive), tray: s.tray.map(i => g.faces[i]), moves: s.moves });
const decision = (s, index) => ({ state: physical(s), index, remembered: {}, observed: { pictures: g.faces.map((f, i) => s.alive[i] && !g.down[i] ? f : null), roles: [] } });
const tryStep = (s, m) => { try { return E.step(g, s, m); } catch { return null; } };
function solutionStep(s, k) { // returns [move, next, stepsUsed]; maps a witness pair the way task11_analyze.witness does
  const p = design.solution, i = p[k], next = tryStep(s, i);
  if (next) return [i, next, 1];
  const pair = E.legal(g, s).find(a => typeof a === 'object' && a.pair.includes(i) && a.pair.includes(p[k + 1]));
  return [pair, tryStep(s, pair), 2];
}
function prefixState(steps) { let s = E.start(g), k = 0; while (k < steps) { const [, next, used] = solutionStep(s, k); s = next; k += used; } return s; }
function finish(attempt, decisions, actions, s, win, why) {
  const left = s.alive.reduce((a, b) => a + b, 0), clockAlive = g.clock && s.alive[g.clock.i];
  return { attempt, win, why, censored: false, phase: win ? null : clockAlive ? 'clock' : left <= 10 ? 'late' : 'mid', left, taps: actions.length, actions, decisions,
    terminal: { state: physical(s), observed: { pictures: [], roles: [] } } };
}
function winTry(attempt) {
  let s = E.start(g), k = 0; const decisions = [], actions = [];
  while (!E.won(g, s)) {
    const [move, next, used] = solutionStep(s, k), index = typeof move === 'number' ? move : move.pair[0];
    decisions.push(decision(s, index)); actions.push(index); s = next; k += used;
  }
  return finish(attempt, decisions, actions, s, true, 'win');
}
// Follow the witness for `steps` steps, take the losing tile `bad`, then the lowest legal tile not in `avoid` until the engine ends the try.
function loseTry(attempt, steps, bad, avoid = []) {
  let s = E.start(g), k = 0; const decisions = [], actions = [];
  while (k < steps) { const [move, next, used] = solutionStep(s, k), index = typeof move === 'number' ? move : move.pair[0]; decisions.push(decision(s, index)); actions.push(index); s = next; k += used; }
  const errorState = s; let m = bad;
  for (;;) {
    if (m == null) return finish(attempt, decisions, actions, s, false, 'stuck');
    decisions.push(decision(s, m)); actions.push(m);
    const next = tryStep(s, m);
    if (!next) {
      if (!s.clockTaken && g.clock && s.moves >= g.clock.n) return { ...finish(attempt, decisions, actions, s, false, 'clock'), errorState };
      const alive = s.alive.slice(); alive[m] = 0;
      return { ...finish(attempt, decisions, actions, { ...s, alive, tray: s.tray.concat(m), moves: s.moves + 1 }, false, 'tray'), errorState };
    }
    s = next; m = E.legal(g, s).filter(a => typeof a === 'number' && !avoid.includes(a)).sort((a, b) => a - b)[0];
  }
}
const campaign = attempts => ({ wonOn: attempts.at(-1).win ? attempts.at(-1).attempt : null, attempts });
// A fake capture: one call per CURVE sub-block; hands out the given campaigns in order.
function fakeCapture(campaigns, calls = []) {
  let next = 0;
  return (d, { runs, seed, botVersion }) => {
    calls.push({ runs, seed, botVersion });
    const part = campaigns.slice(next, next + runs); next += runs;
    return { profile: 'family', ms: 0, result: { valid: true, expectedTries: 2.5, results: part.map(c => campaign(c.map(x => { const { errorState, ...a } = x; return a; }))) } };
  };
}

// Two witness steps before the clock whose state has a losing single-tile option.
const traps = E.traps(g, null, T.BUDGET).filter(f => f.losing.some(l => typeof l.move === 'number'));
const late = traps[traps.length - 1], early = traps.find(f => f.step < late.step && f.losing.some(l => typeof l.move === 'number'));
const trapMove = late.losing.find(l => typeof l.move === 'number').move;
const offMove = early.losing.find(l => typeof l.move === 'number' && l.move !== trapMove).move;
const forks = [{ step: late.step, moves: late.moves, tempting: [{ move: trapMove, kind: 'test' }] }];

test('sameish matches takes, pairs, static_gates tile lists and a take inside a listed pair', () => {
  assert.equal(T.sameish(3, 3), true); assert.equal(T.sameish(3, 4), false);
  assert.equal(T.sameish({ pair: [1, 2] }, { pair: [2, 1] }), true); assert.equal(T.sameish(2, { pair: [1, 2] }), true);
  assert.equal(T.sameish({ pair: [5, 6] }, 6), true); assert.equal(T.sameish(null, 6), false);
  assert.equal(T.sameish(7, [3, 7]), true); assert.equal(T.sameish(7, { tiles: [7] }), true); assert.equal(T.sameish(8, [3, 7]), false);
});

test('normalizeForks keeps losing moves and priced detours, drops free moves; forks map to witness states by moves', () => {
  const rows = [{ step: 2, moves: 2, tempting: [{ move: [4, 5], kind: 'pair', cost: 0, result: 'win' }, { move: [6, 7], kind: 'pair', cost: 1, result: 'win' }, { move: [8], kind: 'match', cost: null, result: 'lose' }] },
    { step: 3, moves: 3, tempting: [{ move: [9], kind: 'match', cost: 0, result: 'win' }] }, { step: 1, moves: 1, tempting: [{ move: 11, kind: 'pair' }] }];
  const f = T.normalizeForks(rows);
  assert.equal(f.length, 2); assert.deepEqual(f[0].tempting.map(t => t.tiles), [[6, 7], [8]]); assert.deepEqual(f[1].tempting[0], { tiles: [11], kind: 'pair', cost: null, result: 'lose' });
  const idx = T.forkIndex(g, T.normalizeForks(forks));
  assert.equal(idx.keys.size, 1); assert.equal(idx.unmapped, 0); assert.equal(idx.tempting[0].tiles[0], trapMove);
});

test('the ruler: the fast key-memory bot, also for a slow or Codex pin (zero drift); any other pin is refused', () => {
  const fast = '63be677ee17677754b17e9c835e8a0f757d1d5ec62738950bf2a2f5e4357413a';
  assert.equal(T.ruler({ fingerprint: fast }).botVersion, T.FAST); assert.equal(T.ruler({ fingerprint: fast }).fingerprint, fast);
  const slow = T.ruler({ fingerprint: '5372bd4e5d29acce926c537400b8a069dd0d04c3f4d2032024c9f34a1d99863d' });
  assert.equal(slow.botVersion, T.FAST); assert.equal(slow.pinned, true); assert.match(slow.zeroDriftOf, /^5372bd4e/);
  assert.equal(T.ruler({ fingerprint: 'd362e85fba3d61523c54bc53a92745458e4467fb4a59624aad1312e9d9003ae3' }).botVersion, T.FAST);
  assert.throws(() => T.ruler({ fingerprint: '4cf0b4c7057c2242f27fe529bb1885e4ad06cdf94588b79411cc06c522509e39' }), /neither/);
  assert.equal(T.ruler({ fingerprint: fast }, 'family-key-memory-v1').pinned, false);
});

test('campaigns come from the CURVE sub-blocks in meter order (4711, 12630, 18427, 26346)', () => {
  assert.deepEqual(T.curveSubBlocks().map(b => b.seed), [4711, 12630, 18427, 26346]);
  assert.deepEqual(T.curveSubBlocks({ pins: { subBlockStride: 7919, blocks: { CURVE: { calls: [{ runs: 20, seeds: 2, seed: 4711 }] } } } }).map(b => [b.seed, b.runs]), [[4711, 20], [12630, 20]]);
  const calls = [], many = Array.from({ length: 25 }, () => [winTry(1)]);
  const r = T.traceGates(ROW, { spare: 1, forks, campaigns: 25, capture: fakeCapture(many, calls) });
  assert.deepEqual(calls.map(c => [c.runs, c.seed]), [[20, 4711], [5, 12630]]);
  assert.equal(r.campaigns, 25); assert.equal(r.D, 1); assert.equal(r.counts.losses, 0); assert.equal(r.B2.pass, null); assert.equal(r.B1.value, 0);
});

test('B1-B7 on a fake capture: one trap campaign, one off-trap campaign', () => {
  const a1 = loseTry(1, late.step, trapMove), a2 = loseTry(2, late.step, trapMove), b1 = loseTry(1, early.step, offMove, [trapMove]);
  const caps = [[a1, a2, winTry(3)], [b1, winTry(2)]];
  const r = T.traceGates(ROW, { spare: 1, forks, campaigns: 2, capture: fakeCapture(caps) });
  assert.equal(r.campaigns, 2); assert.equal(r.counts.losses, 3); assert.equal(r.counts.provedFirstErrors, 3); assert.equal(r.counts.engineMismatches, 0);
  // B1: campaign 1's first try takes the tempting move before the clock; campaign 2's does not.
  assert.equal(r.B1.bites, 1); assert.equal(r.B1.firstTries, 2); assert.equal(r.biteShare, 0.5); assert.equal(r.B1.pass, true);
  // B2: two of three first errors are at the fork state on the listed tempting move.
  assert.equal(r.B2.atTrap, 2); assert.equal(r.B2.atForkState, 2); assert.equal(r.B2.onTemptingMove, 2); assert.equal(r.lossesAtTrapShare, 0.667); assert.equal(r.B2.pass, true);
  // B3/B4 from the injected error positions and the engine-ended tries.
  const losses = [a1, a2, b1], share = losses.map(x => (x.errorState.moves + 1) / N), delay = losses.map(x => x.terminal.state.moves - x.errorState.moves - 1);
  assert.equal(r.firstErrorMedianShare, Math.round(A.median(share) * 1000) / 1000); assert.equal(r.delayMedian, A.median(delay));
  // B5/B6: every fake loss ends before the clock with most tiles left.
  assert.equal(r.lateSqueezeShare, 0); assert.equal(r.B5.pass, true); assert.equal(r.postClockShare, 0); assert.equal(r.B6.pass, true);
  // B7: no tries 6-20 here; the second try of campaign 1 repeats its first error.
  assert.equal(r.B7.value, null); assert.equal(r.B7.lossesTries6to20, 0);
  assert.ok(r.examples.length === 3 && r.examples.filter(e => e.atForkState).length === 2 && r.examples.every(e => typeof e.text === 'string'));
  assert.equal(r.examples.find(e => e.campaign === 0 && e.attempt === 2).repeated, true);
});

test('B7 counts repeated losing moves in tries 6-20; second act B6 rule', () => {
  const tries = Array.from({ length: 7 }, (_, k) => loseTry(k + 1, late.step, trapMove)).concat([winTry(8)]);
  const r = T.traceGates(ROW, { spare: 1, forks, campaigns: 1, capture: fakeCapture([tries]), secondAct: true });
  assert.equal(r.B7.lossesTries6to20, 2); assert.equal(r.B7.repeats, 2); assert.equal(r.repeatShare, 1); assert.equal(r.B7.inflated, true); assert.equal(r.B7.maxTarget, 10);
  assert.equal(r.B6.pass, false, 'a second-act board needs at least 10% post-clock losses');
});

test('unknown is never read as a loss: a starved engine budget leaves the share gates undecided', () => {
  const caps = [[loseTry(1, late.step, trapMove), winTry(2)]];
  const r = T.traceGates(ROW, { spare: 1, forks, campaigns: 1, capture: fakeCapture(caps), budget: { nodes: 1, ms: 1, cap: 1, depthNodes: 1 } });
  assert.equal(r.counts.losses, 1); assert.ok(r.counts.provedFirstErrors <= 1);
  if (r.counts.provedFirstErrors === 0) { assert.equal(r.B2.pass, null); assert.equal(r.B3.pass, null); assert.equal(r.B4.pass, null); }
});

test('an invalid spare is refused, not measured', () => {
  assert.deepEqual(T.traceGates(ROW, { spare: -1, capture: () => assert.fail('no capture') }), { spare: -1, fail: 'invalidSpare' });
});

test('real smoke run: pinned fast key-memory bot, 4 campaigns, same moves as the slow bot', () => {
  const t = Date.now(), r = T.traceGates(ROW, { spare: 2, campaigns: 4 });
  assert.equal(r.campaigns, 4); assert.equal(r.ruler.botVersion, T.FAST); assert.equal(r.ruler.pinned, true);
  assert.equal(r.ruler.fingerprint, '63be677ee17677754b17e9c835e8a0f757d1d5ec62738950bf2a2f5e4357413a');
  assert.equal(r.counts.engineMismatches, 0); assert.equal(r.counts.recoveries, 0);
  for (const k of ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7']) assert.ok(k in r && 'pass' in r[k] && 'value' in r[k]);
  for (const v of [r.biteShare, r.lossesAtTrapShare, r.firstErrorMedianShare, r.lateSqueezeShare, r.postClockShare]) assert.ok(v == null || (v >= 0 && v <= 1));
  // zero drift with capture: true (G3 proved it with capture 'tail'): the slow bot plays the same campaigns tap for tap,
  // with identical captured states, observations and memories
  const design2 = T.atSpare(ROW, 2).design, fast = T.captureFamily(design2, { runs: 4, seed: 4711 }), slow = T.captureFamily(design2, { runs: 4, seed: 4711, botVersion: T.SLOW });
  const full = x => JSON.stringify(x.result.results.map(c => ({ wonOn: c.wonOn, attempts: c.attempts })));
  assert.equal(full(fast), full(slow));
  assert.deepEqual(fast.result.results.map(c => c.wonOn), r.wonOn);
  assert.ok(Date.now() - t < 30000);
});
