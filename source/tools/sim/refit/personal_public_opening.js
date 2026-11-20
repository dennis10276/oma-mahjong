'use strict';
const Hard = require('../../../www/hard.js');
const Layouts = require('../../../www/layouts.js');
const { decodeGame } = require('./personal_game_io.js');
const SCHEMA = 'public-opening-geometry-pair-equivalents-v1';

function openingFeatures(encodedGame) {
  const game = decodeGame(encodedGame), { tiles, nb, faces, down, rules, clock } = game;
  const alive = new Uint8Array(tiles.length).fill(1), cover = Hard.coverOf(tiles, nb);
  const takeable = [], geometricallyFree = [];
  for (let index = 0; index < tiles.length; index++) {
    if (Layouts.isFree(index, alive, nb)) geometricallyFree.push(index);
    if (rules ? Layouts.takeable(index, alive, nb, rules, alive) : Layouts.isFree(index, alive, nb)) takeable.push(index);
  }
  const faceUpTakeable = new Set(takeable.filter(index => !down[index])), visibleByFace = new Map();
  for (let index = 0; index < tiles.length; index++) {
    if (down[index] || cover[index].length) continue;
    const picture = faces[index];
    if (!visibleByFace.has(picture)) visibleByFace.set(picture, []);
    visibleByFace.get(picture).push(index);
  }
  const depth = target => {
    const seen = new Set([target]), pending = [target];
    let aboveCount = 0;
    while (pending.length) for (const above of nb.above[pending.pop()]) {
      if (seen.has(above)) continue;
      seen.add(above); pending.push(above); aboveCount++;
    }
    const sideDepth = direction => {
      let count = 0, current = target;
      for (;;) {
        const next = nb[direction][current][0];
        if (next === undefined) return count;
        count++; current = next;
        if (count > 12) return count;
      }
    };
    let estimate = aboveCount + Math.min(sideDepth('left'), sideDepth('right'));
    estimate += rules?.ice?.[target] || 0;
    if (rules?.locks?.has(target)) estimate += (rules.keys || []).length * (1 + aboveCount);
    return estimate;
  };
  let visibleMateCount = 0, takeableMateTileCount = 0;
  const mateDepths = [];
  for (const index of faceUpTakeable) {
    const mates = (visibleByFace.get(faces[index]) || []).filter(other => other !== index);
    if (!mates.length) continue;
    visibleMateCount++;
    mateDepths.push(Math.min(...mates.map(depth)));
    if (mates.some(other => faceUpTakeable.has(other))) takeableMateTileCount++;
  }
  return { schema: SCHEMA, features: {
    n: tiles.length,
    blockedFreeCount: geometricallyFree.length - takeable.length,
    takeableWithVisMateFrac: faceUpTakeable.size ? visibleMateCount / faceUpTakeable.size : 0,
    takeableWithTakeableMate: takeableMateTileCount / 2,
    meanMateDepth: mateDepths.length ? mateDepths.reduce((sum, value) => sum + value, 0) / mateDepths.length : 6,
    clockSlackRatio: clock ? (clock.n - depth(clock.i) - 1) / clock.n : 1,
  }, diagnostics: { takeableMateTileCount, visibleMateSamples: mateDepths.length,
    note: 'Mate support is identical visible-picture support, not a full legal pair or Joker solver. '
      + 'takeableWithTakeableMate is half the supported-tile count, including fractional equivalents; not disjoint pairs. '
      + 'Depth/slack are public geometry heuristics, not guaranteed route costs. meanMateDepth6 means no samples when visibleMateSamples0.' } };
}

function openingPairCount(encodedGame) {
  const game = decodeGame(encodedGame), alive = new Uint8Array(game.tiles.length).fill(1), counts = new Map();
  for (let index = 0; index < game.tiles.length; index++) {
    if (game.down[index] || !Layouts.isFree(index, alive, game.nb)) continue;
    const picture = game.faces[index];
    counts.set(picture, (counts.get(picture) || 0) + 1);
  }
  return [...counts.values()].reduce((sum, count) => sum + Math.floor(count / 2), 0);
}

module.exports = { SCHEMA, openingFeatures, openingPairCount };
