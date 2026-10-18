'use strict';
const crypto = require('crypto');

const NAMES = ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda'];
const CONFIG = Object.freeze({ halfLife: 20, pull: 1, slope: 0.5, boardPull: 1, care: 2, memory: [0.75, 0.5, 0.75] });
const clamp = (value, limit = 0.05) => Math.min(1 - limit, Math.max(limit, value));
const sigmoid = value => 1 / (1 + Math.exp(-value));
const logit = value => Math.log(clamp(value) / (1 - clamp(value)));

function boardId(game) {
  const rules = game.rules;
  const ice = rules ? Object.entries(rules.ice || {}).sort(([left], [right]) => +left - +right) : [];
  const locks = rules && rules.locks ? Array.from(rules.locks).sort((left, right) => left - right) : [];
  const keys = rules ? Array.from(rules.keys || []).sort((left, right) => left - right) : [];
  return crypto.createHash('sha256').update(JSON.stringify([
    game.tiles.map(tile => [tile.x, tile.y, tile.z]), Array.from(game.faces), Array.from(game.down),
    ice, locks, keys, game.clock ? [game.clock.i, game.clock.n] : null,
  ])).digest('hex');
}

function conditional(chain, attempt) {
  for (let index = Math.min(attempt, chain.cond.length) - 1; index >= 0; index--) {
    if (Number.isFinite(chain.cond[index])) return chain.cond[index];
  }
  return chain.within[0];
}

function cumulative(probabilities) {
  let loss = 1;
  return probabilities.map(probability => {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new Error('Invalid probability');
    loss *= 1 - probability;
    return 1 - loss;
  });
}

function fit(past, useBoards = true) {
  const boardIndices = new Map();
  if (useBoards) for (const row of past) if (!boardIndices.has(row.board)) boardIndices.set(row.board, 9 + boardIndices.size);
  const size = 9 + boardIndices.size;
  const prior = Array(size).fill(0);
  prior[8] = CONFIG.slope;
  const weights = prior.slice();
  const counters = {};
  const rows = [...past].sort((left, right) => right.t - left.t).map(row => {
    const age = counters[row.name] || 0;
    counters[row.name] = age + 1;
    const person = NAMES.indexOf(row.name);
    if (person < 0) throw new Error('Unknown player: ' + row.name);
    const features = [[person, 1], [8, logit(row.raw)]];
    if (row.at > 1) features.push([4 + person, 1]);
    if (useBoards) features.push([boardIndices.get(row.board), 1]);
    return { features, outcome: +row.won, weight: 0.5 ** (age / CONFIG.halfLife) };
  });
  const columns = Array.from({ length: size }, () => []);
  const scores = rows.map(row => row.features.reduce((sum, [index, value]) => sum + weights[index] * value, 0));
  rows.forEach((row, rowIndex) => row.features.forEach(([index, value]) => columns[index].push([rowIndex, value])));
  for (let iteration = 0; iteration < 100; iteration++) {
    let largest = 0;
    for (let index = 0; index < size; index++) {
      const pull = index < 9 ? CONFIG.pull : CONFIG.boardPull;
      let gradient = -pull * (weights[index] - prior[index]);
      let information = pull;
      for (const [rowIndex, value] of columns[index]) {
        const row = rows[rowIndex], probability = sigmoid(scores[rowIndex]);
        gradient += row.weight * value * (row.outcome - probability);
        information += row.weight * value * value * probability * (1 - probability);
      }
      const delta = Math.max(-2, Math.min(2, gradient / information));
      weights[index] += delta;
      for (const [rowIndex, value] of columns[index]) scores[rowIndex] += delta * value;
      largest = Math.max(largest, Math.abs(delta));
    }
    if (largest < 1e-7) break;
  }
  return { weights, boardIndices };
}

function predict(model, row) {
  const person = NAMES.indexOf(row.name);
  if (person < 0) throw new Error('Unknown player: ' + row.name);
  const boardIndex = model.boardIndices.get(row.board);
  return sigmoid(model.weights[person] + (row.at > 1 ? model.weights[4 + person] : 0)
    + model.weights[8] * logit(row.raw) + (boardIndex === undefined ? 0 : model.weights[boardIndex]));
}

function recentRate(past, row) {
  const same = past.filter(previous => previous.name === row.name && (previous.at > 1) === (row.at > 1)).sort((left, right) => right.t - left.t);
  let wins = 1, total = 2;
  same.forEach((previous, age) => {
    const weight = 0.5 ** (age / CONFIG.halfLife);
    wins += weight * +previous.won;
    total += weight;
  });
  return wins / total;
}

const loss = (probability, outcome) => -Math.log(outcome ? clamp(probability, 1e-9) : 1 - clamp(probability, 1e-9));
module.exports = { NAMES, CONFIG, boardId, conditional, cumulative, fit, predict, recentRate, loss };
