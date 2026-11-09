'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./builder.js');
const PB = require('./puzzle_balance.js');
const E = require('./engine.js');
const SG = require('./loop/static_gates.js');
const GP = require('./loop/gate_profile.js');
const { tileVisibility } = require('../sim/refit/human_board_visibility.js');

const profile = GP.loadProfile('e5-v1');

test('puzzleBalance is opt-in and does not alter default builder behavior', () => {
  const def = B.build({ layout: 33, story: 'keysFarSide' });
  assert.notEqual(def.card?.story, 'puzzleBalance-stagedTrayCommitment');
});

test('puzzleBalance rejects invalid family, layout, or targets', () => {
  assert.equal(PB.build({ family: 'unknownFamily' }).fail, 'invalidFamily');
  assert.equal(PB.build({ family: 'stagedTrayCommitment', layout: 999 }).fail, 'invalidLayout');
  assert.equal(PB.build({ family: 'stagedTrayCommitment', layout: 33, targets: { commitment: 99 } }).fail, 'invalidCommitment');
  assert.equal(PB.build({ family: 'promptChokeDistance', layout: 33, targets: { chokeDelay: 99 } }).fail, 'invalidChokeDelay');
  assert.equal(PB.build({ family: 'distributedStages', layout: 33, targets: { stages: 99 } }).fail, 'invalidStages');
});

test('puzzleBalance guarantees tile size >= 52 px and tiles >= 72', () => {
  const b = PB.build({ family: 'stagedTrayCommitment', layout: 33, targets: { commitment: 0 } });
  assert.ok(b.design, b.fail);
  assert.ok(b.design.tiles.length >= 72);
  assert.ok(b.card.px >= 52);
});

test('puzzleBalance guarantees clock tile is visible at move 0 and minimum is exact', () => {
  const b = PB.build({ family: 'stagedTrayCommitment', layout: 33, targets: { commitment: 1 }, seed: 42 });
  assert.ok(b.design, b.fail);
  const d = b.design;
  const objects = d.tiles.map(([x, y, z]) => ({ x, y, z }));
  const vis = tileVisibility(objects, {
    alive: new Uint8Array(d.tiles.length).fill(1),
    down: new Uint8Array(d.tiles.length),
    openPeek: -1
  }, d.clock).tiles;
  assert.ok(vis[d.clock.i].picture, 'clock tile must have visible picture at start');

  const cs = E.clockShortest(E.game(d, { strict: true }), { nodes: 100000 });
  assert.equal(cs.k, b.card.clock.fewestMoves);
  assert.equal(d.clock.n, cs.k + 2);
});

test('puzzleBalance guarantees strict witness replay and no design mutation', () => {
  const b = PB.build({ family: 'stagedTrayCommitment', layout: 33, targets: { commitment: 2 }, seed: 7 });
  assert.ok(b.design, b.fail);
  const frozen = JSON.stringify(b.design);
  const rep = E.replay(b.design, b.design.solution, { strict: true });
  assert.equal(rep.ok, true, 'strict replay must succeed');
  assert.equal(JSON.stringify(b.design), frozen, 'design must not be mutated');
});

test('puzzleBalance builds deterministically across seeds', () => {
  const b1 = PB.build({ family: 'stagedTrayCommitment', layout: 33, targets: { commitment: 1 }, seed: 1234 });
  const b2 = PB.build({ family: 'stagedTrayCommitment', layout: 33, targets: { commitment: 1 }, seed: 1234 });
  assert.deepEqual(b1.design, b2.design);

  const bDiff = PB.build({ family: 'stagedTrayCommitment', layout: 33, targets: { commitment: 1 }, seed: 5678 });
  assert.notDeepEqual(b1.design.faces, bDiff.design.faces);
  assert.deepEqual(b1.design.tiles, bDiff.design.tiles);
});

test('puzzleBalance builds all 3 families and passes required static gates', () => {
  for (const c of [0, 1, 2]) {
    const b = PB.build({ family: 'stagedTrayCommitment', layout: 33, targets: { commitment: c }, seed: 1 });
    assert.ok(b.design, b.fail);
    const sg = SG.staticGates(b.design, { stopEarly: false });
    const applied = GP.applyStatic(sg, profile);
    assert.equal(applied.pass, true, `commitment ${c} must pass static gates`);
    assert.equal(applied.gates.A6.pass, true, `commitment ${c} must pass A6`);
  }

  for (const cd of [1, 3, 5, 8]) {
    const b = PB.build({ family: 'promptChokeDistance', layout: 33, targets: { chokeDelay: cd }, seed: 1 });
    assert.ok(b.design, b.fail);
    const sg = SG.staticGates(b.design, { stopEarly: false });
    const applied = GP.applyStatic(sg, profile);
    assert.equal(applied.pass, true, `chokeDelay ${cd} must pass static gates`);
  }

  for (const st of [1, 2, 3]) {
    const b = PB.build({ family: 'distributedStages', layout: 33, targets: { stages: st }, seed: 1 });
    assert.ok(b.design, b.fail);
    const sg = SG.staticGates(b.design, { stopEarly: false });
    const applied = GP.applyStatic(sg, profile);
    assert.equal(applied.pass, true, `stages ${st} must pass static gates`);
  }
});
