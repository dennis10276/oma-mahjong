'use strict';
// node --test source/tools/builder/loop/test_static_gates.js   (fast: tiny hand-made boards; one real smoke test)
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const E = require('../engine.js');
const D = require('./detour.js'), P = require('./publicfork.js'), O = require('./obvious.js'), SG = require('./static_gates.js');

// a tiny flat board: n tiles in one row, 4 units apart (every tile free), clock on tile 0
function tiny({ faces = [0, 0, 1, 1, 2, 2, 3, 3], n = 3, down = [] } = {}) {
  return { tiles: faces.map((_, i) => [i * 4, 0, 0]), faces: faces.slice(), down, obst: {}, clock: { i: 0, n }, solution: faces.map((_, i) => i) };
}

test('work tracker: a spent budget gives unknown with budget, never lose', () => {
  const d = tiny(), g = E.game(d), w = D.work(0);
  const r = w.win(g, E.start(g), 1000);
  assert.equal(r.result, 'unknown'); assert.equal(r.budget, true); assert.equal(w.hit, true);
  const c = w.classify(g, E.start(g), 1000);
  assert.ok(c.every(x => x.result !== 'lose' || x.move === undefined), 'nothing is a loss without proof');
  const l = w.longest(g, E.start(g), 7, 100);
  assert.equal(l.budget, true); assert.equal(l.exact, false);
});

test('temptingMoves: free face-up pairs and tray matches off the clock way, nothing on it', () => {
  const d = tiny(), g = E.game(d), s = E.start(g);
  const t = D.temptingMoves(g, s);
  assert.deepEqual(t.map(x => x.take), [[2, 3], [4, 5], [6, 7]]);        // (0,1) holds the clock
  assert.ok(t.every(x => x.kind === 'pair' && !x.peek));
  const s1 = E.step(g, s, 4);                                              // picture 2 waits in the tray
  const t1 = D.temptingMoves(g, s1);
  assert.deepEqual(t1.filter(x => x.kind === 'match').map(x => x.take), [[5]]);
  assert.ok(!t1.some(x => x.kind === 'pair' && x.take.includes(5)), 'a waiting picture is a match, not a pair');
});

test('clockNeed and priceMove: a free pair before the clock costs 2 clock moves', () => {
  const d = tiny(), C = D.clockGames(d), s = E.start(C.free), w = D.work(1e6);
  assert.equal(D.clockNeed(C, s, { upTo: 10, w }).k, 1);
  const p = D.priceMove(C, s, { kind: 'pair', take: [2, 3] }, { base: 1, nShipMax: 4, w });
  assert.equal(p.cost, 2); assert.equal(p.result, 'win'); assert.equal(p.exact, true);
  const lost = D.priceMove(C, s, { kind: 'pair', take: [2, 3] }, { base: 1, nShipMax: 2, w });   // n <= 2: proven lost
  assert.equal(lost.result, 'lose'); assert.equal(lost.cost, null);
});

test('permuteHidden / redeals: pictures move only among the chosen tiles, counts kept, identity first, deterministic', () => {
  const d = tiny({ faces: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4] }), tiles = [1, 3, 5, 7, 9];
  const a = P.redeals(d, tiles, 4, 7), b = P.redeals(d, tiles, 4, 7);
  assert.equal(a[0], d); assert.equal(a.length, 4);
  assert.deepEqual(a.map(x => x.faces), b.map(x => x.faces));
  const keys = new Set(a.map(x => tiles.map(i => x.faces[i]).join(',')));
  assert.equal(keys.size, a.length, 'distinct deals');
  for (const x of a) {
    for (let i = 0; i < 10; i++) if (!tiles.includes(i)) assert.equal(x.faces[i], d.faces[i]);
    assert.deepEqual(x.faces.slice().sort(), d.faces.slice().sort());
  }
  assert.equal(P.redeals(d, [3], 4, 1).length, 1, 'one tile: only the identity');
});

test('sameTake: a single that starts a tempting pair is the same move; a peek pair only matches itself', () => {
  assert.equal(P.sameTake(2, { take: [2, 3] }), true);
  assert.equal(P.sameTake(4, { take: [2, 3] }), false);
  assert.equal(P.sameTake({ pair: [2, 3] }, { take: [2, 3], act: { pair: [2, 3] } }), true);
  assert.equal(P.sameTake({ pair: [2, 3] }, { take: [2, 3] }), false);
});

test('fairFork: an instant lose with the clock as the obvious winning alternative is fair; too late on the board is not', () => {
  const d = tiny({ n: 1 }), C = D.clockGames(d), s = E.start(C.free), t = { kind: 'pair', take: [2, 3] };
  const p = D.priceMove(C, s, t, { base: 1, nShipMax: 1, w: D.work(1e6) });
  assert.equal(p.result, 'lose');
  const f = P.fairFork(C, s, t, { nShipMax: 1, unseen: [], w: D.work(1e6) });
  assert.equal(f.fair, true, JSON.stringify(f)); assert.equal(f.checks.forcedDepth, 0);
  assert.ok(O.isObvious(C.at(1), s, 0).reasons.includes('clock'));
  const late = P.fairFork(C, s, t, { nShipMax: 1, unseen: [], w: D.work(1e6), minLeft: 1.01 });
  assert.equal(late.fair, false); assert.equal(late.unfair, true); assert.match(late.why[0], /tiles left/);
  const blind = P.fairFork(C, s, t, { nShipMax: 1, unseen: [], w: D.work(0) });
  assert.equal(blind.unfair, false, 'budget is a warning, never unfair');
});

test('cardOf / archetypeOf: one plain sentence and a label', () => {
  const card = SG.cardOf({ k: 7, priced: [{ kind: 'pair', cost: 2, moves: 2 }], loseForks: [{ kind: 'match', fair: true, moves: 4 }], A8: null });
  assert.equal(card, 'The clock needs 7 moves; taking the free pair in sight at move 3 before the clock costs 2 spare moves, and the tray match at move 5 loses the board.');
  assert.match(SG.cardOf({ k: 5, priced: [], loseForks: [], A8: 'spare>=2 only' }), /spare 2 or more\)\.$/);
  const d = tiny(), g = E.game(d);
  assert.equal(SG.archetypeOf(d, g, [{}], []), 'free-pair relief');
  assert.equal(SG.archetypeOf(d, g, [], []), 'clock race');
  assert.equal(SG.archetypeOf({ ...d, obst: { ice: { 0: 1 } } }, g, [], []), 'thaw order');
});

test('staticGates on a tiny board: no crash, A1 rejects < 72 tiles, a tiny budget never turns into a loss', () => {
  const r = SG.staticGates(tiny({ n: 4 }), { budget: 1, previous: [] });
  assert.equal(r.pass, false);
  assert.equal(r.gates.A1.pass, false); assert.ok(r.gates.A1.detail.why.some(x => /< 72/.test(x)));
  assert.equal(r.k, 1); assert.equal(r.gates.A8.flag, 'spare>=2 only');
  assert.notEqual(r.gates.A6.pass, false, 'budget is not a lose-fork');
  assert.ok(!r.gates.A7.detail.results.includes('lose'), 'budget is not a lost deal');
  assert.ok(Array.isArray(r.forks) && typeof r.card === 'string');
});

test('smoke (real boards): a builder build is judged the same twice; qualified 202 has a peek-pair shortcut', () => {
  const B = require('../builder.js'), brief = require('../briefs-v1.json').find(b => b.id === 'keysFarSide-hourglass-14');
  const r = B.build({ ...brief, seed: 1 });
  assert.ok(!r.fail);
  const o = { story: brief.story, shape: B.LAYOUTS[brief.layout].shape, previous: [] };
  const a = SG.staticGates(r.design, o), b = SG.staticGates(r.design, o);
  const verdicts = x => JSON.stringify([x.pass, x.k, x.shipSpares, x.nodes, x.card, Object.values(x.gates).map(g => g.pass)]);
  assert.equal(verdicts(a), verdicts(b), 'node budgets: the same verdicts and node counts');
  assert.ok(a.ms < 10000, `one board in ${a.ms} ms`);
  for (const g of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']) assert.equal(a.gates[g].pass, true, g + ' ' + JSON.stringify(a.gates[g].detail));
  assert.equal(a.archetype, 'keys before the clock');
  const q = fs.readFileSync(path.join(__dirname, '../../../analysis/builder/data/qualified-200-225.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l)).find(x => x.level === 202);
  const r202 = SG.staticGates(q.design, { previous: [], stopEarly: false });
  assert.equal(r202.gates.A3.pass, false);
  assert.ok(r202.gates.A3.detail.why.some(x => /peek-pair shortcut/.test(x)));
});

test('A3 rejects a clock.n that is not k + 1..3 (reviewer defect)', () => {
  const S = require('./static_gates.js');
  const fs = require('fs'), path = require('path');
  const row = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'analysis', 'builder', 'data', 'qualified-200-225.jsonl'), 'utf8').split('\n').find(Boolean));
  const d = row.design || row;
  const r0 = S.staticGates(d, { stopEarly: true });
  const d2 = JSON.parse(JSON.stringify(d)); d2.clock.n = r0.k + 7;
  const r = S.staticGates(d2, {});
  assert.notEqual(r.gates.A3.pass, true); assert.equal(r.pass, false);
});
