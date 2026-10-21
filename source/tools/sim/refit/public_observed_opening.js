'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { prototype } = require('./personal_pixel_opening_prototype.js');
const { normalizedPrior, uniformPrior } = require('./personal_public_picture_prior.js');
const { condition } = require('./public_pixel_belief.js');
let compiled = null;

function captureOpening(publicGame, rows, initialPrior = Array.from(uniformPrior())) {
  assert(Array.isArray(rows) && rows.length && rows.length === publicGame.tiles.length);
  const normalized = normalizedPrior(initialPrior), total = initialPrior.reduce((sum, value) => sum + value, 0);
  const prior = Math.abs(total - 1) < 1e-12 ? initialPrior.slice() : Array.from(normalized), pictures = [], beliefs = [];
  rows.forEach((row, index) => {
    assert.equal(row.index, index);
    assert.equal(row.alive, true, 'Observed-value prototype currently accepts initial all-alive openings only');
    beliefs.push(condition(Array.from(prior), row.observation));
    pictures.push(row.observation.known);
  });
  const tiles = publicGame.tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z }));
  const down = Array.from(publicGame.down);
  assert.equal(down.length, tiles.length); assert(down.every(value => value === 0 || value === 1));
  const rules = publicGame.rules ? { ice: { ...publicGame.rules.ice }, iceNb: publicGame.rules.iceNb?.map(row => Array.from(row)),
    keys: Array.from(publicGame.rules.keys || []), locks: new Set(publicGame.rules.locks || []) } : null;
  const clock = publicGame.clock ? { i: publicGame.clock.i, n: publicGame.clock.n } : null;
  const game = { tiles, nb: Layouts.neighbors(tiles), down, rules, clock,
    faces: pictures.map(picture => picture === null ? 0 : picture),
    publicPixelKnown: pictures.map(picture => +(picture !== null)), captureValue: true, valueLog: true, policyLog: [] };
  const source = compiled || (compiled = prototype()), engine = source.engine;
  let snapshot, actions;
  const result = engine.play(game, { ...engine.P, physicalFlips: true, allMoves: true, flips: true, forceMatches: false,
    peek: 0, end: 0, plan: 0, keyPlan: 0, physicalPlan: 0, physicalKeyPlan: 0, physicalSafety: false, search: 0,
    kindModel: { weights: {} }, publicPicturePrior: Array.from(prior),
    physicalTrayPlanning: (geometry, state, available) => {
      snapshot = state; actions = available;
      return { features: available.map(() => []), nodes: 0, boundaries: 0 };
    } }, 1);
  assert.equal(result.why, 'valueCapture');
  assert.deepEqual(snapshot.pictures, pictures);
  return { type: 'publicObservedOpening-v2', observationVersion: 2, pictures, beliefs, snapshot, actions,
    decision: { ...game.capturedValue, observationVersion: 2 },
    engine: { originalSha256: source.originalSha256, prototypeSha256: source.prototypeSha256 } };
}

module.exports = { captureOpening };
