'use strict';
const assert = require('assert/strict'), Hard = require('../../../www/hard.js'), Layouts = require('../../../www/layouts.js');
const { gate } = require('./public_dead_end_choice.js');
const { uniformPrior } = require('./personal_public_picture_prior.js');
let observations = 0;
const base = decision => { observations++; return decision.F.length - 1; };
base.probabilities = decision => decision.F.map((feature, index) => +(index === decision.F.length - 1));
base.observe = () => observations++;
const planning = (game, state, actions) => ({ features: actions.map(() => Array(17).fill(0)), nodes: 0, boundaries: 0 });
const unchanged = gate(base, planning, { enabled: false }); assert.equal(unchanged.selector, base); assert.equal(unchanged.planning, planning);
const faces = [4, 5, 6, 1, 2, 1, 4, 5, 2, 6];
const tiles = [{ x: 40, y: 0, z: 0 }, { x: 48, y: 0, z: 0 }, { x: 56, y: 0, z: 0 },
  { x: 0, y: 0, z: 3 }, { x: 8, y: 0, z: 2 }, { x: 0, y: 0, z: 2 },
  { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 1 }, { x: 8, y: 0, z: 0 }];
const wrapped = gate(base, planning);
const game = { tiles, nb: Layouts.neighbors(tiles), faces, down: faces.map((face, index) => +(index === 3 || index === 4)),
  memory: new Uint8Array(faces.length).fill(1), start: [0, 1, 2], physicalLog: [] };
const result = Hard.play(game, { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, forceMatches: false,
  peek: 0, end: 0, plan: 0, kindModel: { weights: {} }, publicPicturePrior: Array.from(uniformPrior()),
  physicalChoice: wrapped.selector, physicalTrayPlanning: wrapped.planning, physicalChoiceLimit: 32 }, 1);
assert.equal(result.why, 'tray'); assert.equal(result.moves, 4); assert(wrapped.stats().overrides > 0);
assert.equal(observations, game.physicalLog.length - 3);
console.log('PASS optional dead-end acknowledgement has exact disabled delegation, updates the actual personal choice once and ends proven dead states through real production taps');
