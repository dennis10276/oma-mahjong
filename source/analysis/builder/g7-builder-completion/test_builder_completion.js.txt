'use strict';
// test_builder_completion.js: Unit tests for builder_completion module.
// Verifies:
// 1. Deterministic construction.
// 2. Strict witness replay.
// 3. Exact matching game & strict clock minima.
// 4. Multi-geometry support across approved layouts (ushape, arch, castle).
// 5. Normal skilled band compliance S in [2.5, 6.0] with pinned planner.
// 6. Gate A6 and static gates compliance.

const test = require('node:test');
const assert = require('node:assert/strict');
const BC = require('./builder_completion.js');
const E = require('../../../tools/builder/engine.js');
const { createYardstick } = require('../../../tools/builder/loop/yardstick.js');

test('builder_completion: deterministic build produces identical design for same seed', () => {
  const brief = { layout: 22, shape: 'ushape', target: 10, spare: 2, seed: 42 };
  const b1 = BC.build(brief);
  const b2 = BC.build(brief);

  assert.ok(b1.design, `Build 1 failed: ${b1.fail}`);
  assert.ok(b2.design, `Build 2 failed: ${b2.fail}`);
  assert.deepEqual(b1.design.tiles, b2.design.tiles);
  assert.deepEqual(b1.design.faces, b2.design.faces);
  assert.deepEqual(b1.design.solution, b2.design.solution);
  assert.equal(b1.proof.minimum, b2.proof.minimum);
});

test('builder_completion: strict witness replays cleanly from start to finish', () => {
  const res = BC.build({ layout: 22, shape: 'ushape', target: 10, spare: 2, seed: 1 });
  assert.ok(res.design, `Build failed: ${res.fail}`);

  const rep = E.replay(res.design, res.design.solution, { strict: true });
  assert.equal(rep.ok, true, `Strict witness replay failed: ${rep.why} at step ${rep.at}`);
});

test('builder_completion: game and strict clock shortest minima are equal and proven', () => {
  const res = BC.build({ layout: 22, shape: 'ushape', target: 10, spare: 2, seed: 1 });
  assert.ok(res.design);

  const limits = { nodes: 200000, ms: Infinity, finishNodes: 100000, finishMs: Infinity };
  const gameK = E.clockShortest(E.game(res.design), limits);
  const strictK = E.clockShortest(E.game(res.design, { strict: true }), limits);

  assert.ok(gameK && !gameK.unsure, 'Game clock shortest unproven');
  assert.ok(strictK && !strictK.unsure, 'Strict clock shortest unproven');
  assert.equal(gameK.k, strictK.k, `Game k (${gameK.k}) !== strict k (${strictK.k})`);
  assert.equal(gameK.k, res.proof.minimum, `Measured k (${gameK.k}) !== reported proof k (${res.proof.minimum})`);
});

test('builder_completion: supports multiple distinct geometries with skilled S in [2.5, 6.0]', () => {
  const ys = createYardstick();
  const testCases = [
    { layout: 22, shape: 'ushape', seed: 1 },
    { layout: 0, shape: 'arch', seed: 1 },
    { layout: 20, shape: 'castle · two islands', seed: 2 }
  ];

  for (const tc of testCases) {
    const res = BC.build({ layout: tc.layout, shape: tc.shape, target: 10, spare: 2, seed: tc.seed });
    assert.ok(res.design, `Build on layout ${tc.layout} (${tc.shape}) failed: ${res.fail}`);

    const pl = ys.planner(res.design, { spare: 2 });
    assert.equal(pl.valid, true, `Planner measurement invalid on layout ${tc.layout}`);
    assert.ok(pl.S >= 2.5 && pl.S <= 6.0, `Layout ${tc.layout} S (${pl.S}) outside [2.5, 6.0] normal band`);
    assert.equal(res.proof.staticPass, true, `Static gates failed on layout ${tc.layout}`);
  }
});

test('builder_completion: reports honest failure on invalid inputs', () => {
  assert.equal(BC.build({ spare: 4 }).fail, 'invalidSpare');
  assert.equal(BC.build({ layout: 999 }).fail, 'unknownLayout');
});
