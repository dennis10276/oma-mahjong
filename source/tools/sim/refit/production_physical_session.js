'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), Module = require('module'), assert = require('assert/strict');
const Hard = require('./physics/hard.js');
const Layouts = require('./physics/layouts.js');
const { encodeGame, decodeGame } = require('./personal_game_io.js');
const { uniformPrior } = require('./personal_public_picture_prior.js');
const filename = require.resolve('./physics/hard.js');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
let compiled = null;

function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, 'Production physical-session anchor is absent or ambiguous');
  return source.replace(before, after);
}

function compile() {
  const original = fs.readFileSync(filename, 'utf8'), originalSha256 = hash(original);
  if (compiled) { assert.equal(compiled.originalSha256, originalSha256); return compiled; }
  let source = original.replace(/\r\n/g, '\n');
  source = replaceOnce(source, '  function play(g, p = P, seed = 1, trace = null) {',
    '  function* play(g, p = P, seed = 1, trace = null) {');
  source = replaceOnce(source,
    `        k = p.physicalChoice({ ...(publicPicturePrior ? { observationVersion: 1 } : {}), F: policyF.map((feature, index) => feature.concat(goalF[index])), kindContext, immediate: valueParts,
          ...(knownPlan ? { knownPlan } : {}) }, r());`,
    `        r();
        if (opts.some(option => option.length !== 1)) throw new Error('Physical session cannot expose macro actions');
        const legalTiles = [...opts.map(option => option[0]), ...flipT].sort((left, right) => left - right);
        if (new Set(legalTiles).size !== legalTiles.length) throw new Error('Ambiguous physical tap identity');
        const requested = yield { type: 'productionPhysicalFrame-v1', state: physicalFrame(), legalTiles };
        if (!Number.isInteger(requested) || !legalTiles.includes(requested)) throw new Error('Unavailable physical tap');
        k = opts.findIndex(option => option[0] === requested);
        if (k < 0) k = opts.length + flipT.indexOf(requested);`);
  source = replaceOnce(source, '    function end(win, why) {',
    `    function physicalFrame() {
      return { alive: Array.from(alive), down: Array.from(down, (value, index) => alive[index] ? +value : 0),
        tray: tray.slice(), moves, openPeek, relieved,
        arriving: tray.filter(face => arrivingUntil[face & 255] > tapTime), physicalTaps: physicalCount, observationTime: tapTime };
    }
    function end(win, why) {
      g.productionPhysicalFrame = physicalFrame();`);
  const loaded = new Module(filename, module); loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename)); loaded._compile(source, filename);
  compiled = { play: loaded.exports.play, originalSha256, prototypeSha256: hash(source) };
  return compiled;
}

function parameters(size, options = {}) {
  assert(Object.keys(options).every(key => ['seed', 'choiceLimit', 'tapMs', 'tapTimes', 'settleBefore'].includes(key)));
  const limit = options.choiceLimit ?? Math.max(4096, size * 32), tapMs = options.tapMs ?? 1000;
  assert(Number.isInteger(options.seed ?? 1) && Number.isInteger(limit) && limit > 0);
  assert(Number.isFinite(tapMs) && tapMs >= 0);
  if (options.tapTimes) assert(options.tapTimes.every((value, index, values) => Number.isFinite(value) && value >= 0 && (!index || value >= values[index - 1])));
  if (options.settleBefore) assert(options.settleBefore.every(value => typeof value === 'boolean'));
  return { ...Hard.P, physicalFlips: true, physicalSingleStep: false, allMoves: true, flips: true,
    forceMatches: false, peek: 0, end: 0, plan: 0, keyPlan: 0, physicalPlan: 0, physicalKeyPlan: 0,
    physicalSafety: false, physicalFollowThrough: false, physicalPairFollowThrough: false, search: 0,
    kindModel: { weights: {} }, publicPicturePrior: Array.from(uniformPrior()), physicalChoiceLimit: limit, tapMs };
}

function sessionWithSource(input, options, source) {
  const game = { ...decodeGame(encodeGame(input)), physicalLog: [],
    ...(options.tapTimes ? { tapTimes: options.tapTimes.slice() } : {}),
    ...(options.settleBefore ? { settleBefore: options.settleBefore.slice() } : {}) };
  const trace = [], policy = { ...parameters(game.tiles.length, options),
    physicalChoice: () => { throw Error('Physical session must yield before asking a policy'); } };
  const iterator = source.play(game, policy, options.seed ?? 1, trace);
  let current = iterator.next();
  const view = () => {
    if (!current.done) {
      const state = current.value.state, initial = state.alive.map(() => 1);
      const expected = state.alive.flatMap((alive, index) => alive && (game.rules && !state.relieved
        ? Layouts.takeable(index, state.alive, game.nb, game.rules, initial)
        : Layouts.isFree(index, state.alive, game.nb)) ? [index] : []);
      assert.deepEqual(current.value.legalTiles, expected, 'A physical session must expose every legal tap without picture-dependent filtering or ordering');
    }
    return structuredClone(current.done ? { type: 'productionPhysicalEnd-v1', state: game.productionPhysicalFrame,
      legalTiles: [], win: current.value.win, why: current.value.why,
      computationCensored: current.value.why === 'contextChoiceLimit' } : current.value);
  };
  const tap = index => {
    assert(!current.done, 'A terminal attempt cannot be resumed or restarted');
    assert(Number.isInteger(index) && current.value.legalTiles.includes(index), 'Choose a currently legal physical tile');
    current = iterator.next(index); return view();
  };
  const audit = () => structuredClone({ result: current.done ? current.value : null, physicalLog: game.physicalLog, trace,
    engine: { originalSha256: source.originalSha256, prototypeSha256: source.prototypeSha256 },
    note: 'Trusted-environment audit only; never supply this to a policy. The environment view omits deck, pictures, action-kind hints, scores and symbolic known masks, but its structural fields still need a validated observed-value projection before policy use. Production physics is source-anchored in memory, not reimplemented. This is an environment bridge, not a screenshot observer, autonomous reference, complete information-fidelity proof or human forecast.' });
  return { view, tap, audit };
}

function createSession(input, options = {}) {
  return sessionWithSource(input, options, compile());
}

function createSessionFactory() {
  const source = compile(), factory = (input, options = {}) => sessionWithSource(input, options, source);
  factory.verifySource = () => {
    assert.equal(hash(fs.readFileSync(filename, 'utf8')), source.originalSha256, 'Pinned production source changed during the batch');
    return { originalSha256: source.originalSha256, prototypeSha256: source.prototypeSha256 };
  };
  return factory;
}

module.exports = { createSession, createSessionFactory, parameters };
