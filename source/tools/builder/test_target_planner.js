'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const TP = require('./target_planner.js');
const KC = require('./keyed_choice.js');
const B = require('./builder.js');
const E = require('./engine.js');

test('targetChoice deterministically constructs verified target 10 board with strict witness', () => {
  const brief = { mode: 'targetChoice', target: 10 };
  const res = TP.build(brief);
  assert.ok(res.design, res.fail);
  assert.equal(res.card.plannedTarget, 10);
  assert.deepEqual(res.card.targetBand, [9.0, 11.0]);
  assert.equal(res.card.shape, 'ushape');
  assert.equal(res.proof.minimum, 17);
  assert.equal(res.design.clock.n, 18);
  assert.ok(E.replay(res.design, res.design.solution, { strict: true }).ok);
});

test('targetChoice deterministically constructs verified target 13 board with strict witness', () => {
  const brief = { mode: 'targetChoice', target: 13 };
  const res = TP.build(brief);
  assert.ok(res.design, res.fail);
  assert.equal(res.card.plannedTarget, 13);
  assert.deepEqual(res.card.targetBand, [12.0, 14.0]);
  assert.equal(res.card.shape, 'ushape');
  assert.equal(res.proof.minimum, 15);
  assert.equal(res.design.clock.n, 16);
  assert.ok(E.replay(res.design, res.design.solution, { strict: true }).ok);
});

test('targetChoice routes to qualified alternative shape when explicitly requested', () => {
  const brief = { mode: 'targetChoice', target: 10, shape: 'castle · two islands' };
  const res = TP.build(brief);
  assert.ok(res.design, res.fail);
  assert.equal(res.card.shape, 'castle · two islands');
  assert.equal(res.proof.lockTile, 77);
  assert.equal(res.proof.minimum, 16);
  assert.ok(E.replay(res.design, res.design.solution, { strict: true }).ok);
});

test('targetChoice rejects unsupported targets, incompatible shapes, and budgets without falling back', () => {
  assert.equal(TP.build({ mode: 'targetChoice', target: 42 }).fail, 'unsupportedTarget');
  assert.equal(TP.build({ mode: 'targetChoice', target: 0 }).fail, 'unsupportedTarget');
  assert.equal(TP.build({ mode: 'targetChoice', target: 'ten' }).fail, 'invalidTarget');
  assert.equal(TP.build({ mode: 'targetChoice', target: 13, shape: 'arch' }).fail, 'incompatibleShape');
  assert.equal(TP.build({ mode: 'targetChoice', target: 10, unknownProp: 1 }).fail, 'unsupportedBrief');
  assert.equal(TP.build({ mode: 'targetChoice', target: 10 }, { hardWork: 500 }).fail, 'unsupportedOption');
  assert.equal(TP.build({ mode: 'targetChoice', target: 10 }, { wallMs: 0 }).fail, 'wallClock');
});

test('public builder dispatch for targetChoice is deterministic and respects keyedChoice boundaries', () => {
  const a = B.build({ mode: 'targetChoice', target: 10 });
  const b = B.build({ mode: 'targetChoice', target: 10 });
  assert.ok(a.design, a.fail);
  assert.deepEqual(a.design, b.design);

  // Pure keyedChoice continues to reject implicit targets as verified by lead review
  assert.equal(KC.build({ layout: 22, stage: 'edge', seed: 1, target: 10 }).fail, 'unsupportedBrief');
});
