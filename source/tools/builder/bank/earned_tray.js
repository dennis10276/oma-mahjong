'use strict';

const fs = require('node:fs');
const H = require('./hand');
const E = require('../engine');
const D = require('../loop/detour');
const { fullTrayFailure } = require('../builder');
const { targetFor, meets } = require('../chained_finish_profiles');
const { closeTwins } = require('./separate');
const { expert } = require('./feel');
const { findThawTrap } = require('./thaw_trap');
const { supportedAt } = require('./detower');
const { measure } = require('../footprint');

function recipe(variant) {
  const keysFirst = variant === 'keys';
  const tiles = [];
  function row(z, y, xs) {
    for (const x of xs) tiles.push([x, y, z]);
  }
  for (let y = 0; y <= 12; y += 2) row(0, y, [0, 2, 4, 6, 8, 10]);
  row(1, 1, [1, 3, 7, 9]);
  row(1, 3, [3, 7, 9]);
  row(1, 5, [1, 3, 5, 7, 9]);
  row(1, 7, [1, 3, 5, 7, 9]);
  row(1, 9, [1, 3, 7, 9]);
  row(1, 11, [1, 3, 7, 9]);
  row(2, 1, keysFirst ? [8] : [2, 8]);
  row(2, 5, [2]);
  row(2, 7, [8]);
  row(2, 9, [8]);
  if (keysFirst) row(2, 11, [2]);

  function at(x, y, z) {
    const tile = tiles.findIndex(([tx, ty, tz]) => tx === x && ty === y && tz === z);
    if (tile === -1) throw new Error(`No tile at ${x},${y},${z}`);
    return tile;
  }
  const bank = at(2, 5, 2);
  const direct = at(9, 3, 1);
  const remote = at(1, 5, 1);
  const roof = at(8, 7, 2);
  const melter = at(9, 7, 1);
  const rightIce = at(9, 5, 1);
  const leftIce = at(1, 7, 1);
  const nearKey = at(10, 6, 0);
  const farKey = keysFirst ? at(0, 6, 0) : at(0, 4, 0);
  const flank = at(7, 7, 1);
  const flankMate = keysFirst ? at(2, 11, 2) : at(2, 1, 2);
  const lock = at(5, 7, 1);
  const leftMelt = at(3, 7, 1);
  const clock = keysFirst ? at(10, 10, 0) : at(0, 6, 0);

  // Both versions offer the same local thaw. A spare match must be prepared in the other wing.
  const opening = [bank, remote, direct, roof, melter, rightIce];
  const pairs = {
    refund: [bank, rightIce],
    split: [remote, direct],
    roof: [roof, leftMelt],
    keys: [nearKey, farKey],
    flank: [flank, flankMate],
    leftIce: [leftIce],
  };
  let route;
  if (keysFirst) {
    // Each ice front reveals a key. Parking the first key before clearing the flank costs the last slot.
    const [cap, edge, corner] = [at(8, 9, 2), at(9, 9, 1), at(9, 11, 1)];
    route = [...opening, flank, flankMate, lock, leftMelt, leftIce, nearKey, farKey, cap, edge, corner, clock];
    pairs.leftIce.push(cap);
    Object.assign(pairs, { melt: [melter, lock], rim: [edge], cap: [corner], clock: [clock] });
  } else {
    route = [...opening, nearKey, farKey, flank, flankMate, lock, leftMelt, leftIce, clock];
    Object.assign(pairs, { clock: [melter, clock], lock: [lock] });
  }
  return {
    tiles,
    earlyKey: keysFirst ? [...opening, nearKey] : null,
    spec: {
      clock,
      route,
      ice: { [leftIce]: 2, [rightIce]: 2 },
      locks: keysFirst ? [clock] : [lock, clock],
      keys: [nearKey, farKey],
      down: .23,
      pairs,
    },
  };
}

function strandsWithEarlyKey(design, path) {
  const game = E.game({ ...design, clock: { ...design.clock, n: design.tiles.length + 1 } });
  let state = E.start(game);
  for (const tile of path) {
    if (!E.legal(game, state).includes(tile)) return false;
    state = E.step(game, state, tile);
    if (!state) return false;
  }
  return state.tray.length === 3 && E.winnable(game, state, { nodes: 100000, ms: 1000 }).result === 'lose';
}

function build({ variant = 'clock', seed = 1, tries = 200 } = {}) {
  if (!['clock', 'keys'].includes(variant)) throw new Error('Expected clock or keys');
  if (!Number.isSafeInteger(seed) || seed < 1 || !Number.isSafeInteger(tries) || tries < 1
      || !Number.isSafeInteger(seed + tries)) throw new Error('Expected a positive seed and try count');

  const { tiles, spec, earlyKey } = recipe(variant);
  const { tilePx } = measure(tiles, { minimum: 60 });
  if (tilePx < 60 || !tiles.every((tile, i) => supportedAt(tiles, tile, i))) return { fail: 'layout' };
  const finish = targetFor('existing');
  for (let deal = seed; deal < seed + tries; deal++) {
    const { design, fail } = H.fill({ ...spec, pressure: 1.2 + (deal % 4) * .2 }, tiles, deal);
    if (!design) return { fail };
    if (!closeTwins(design).meets) continue;

    design.clock.n = spec.route.length + 1;
    const timing = D.clockNeed(D.clockGames(design), E.start(E.game(design)), {
      upTo: spec.route.length, nodes: 90000, w: D.work(350000, 4000),
    });
    if (!timing.exact || timing.k == null || timing.k < 10) continue;
    design.clock.n = timing.k + 1;
    if (!E.replay(design, design.solution).ok) continue;

    const proof = findThawTrap(design);
    if (!proof || fullTrayFailure(design)) continue;
    if (earlyKey && !strandsWithEarlyKey(design, earlyKey)) continue;
    const feel = expert(design, { playouts: 16, seed: 9, wrong: false });
    if (!meets(finish, feel)) continue;

    const finishPressure = +(feel.parkAt[1] + feel.parkAt[2]).toFixed(1);
    return { variant, seed: deal, minimum: timing.k, proof, secondWrongTurn: earlyKey, finishPressure, design };
  }
  return { fail: 'no deal passed the checks', tries };
}

if (require.main === module) {
  const [variant, seed, output, tries] = process.argv.slice(2);
  if (!output) throw new Error('Usage: node earned_tray.js <clock|keys> <seed> <output.json> [tries]');
  const result = build({ variant, seed: Number(seed), tries: tries === undefined ? undefined : Number(tries) });
  if (result.design) {
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
    console.log(output);
  } else {
    console.error(result);
    process.exitCode = 1;
  }
}

module.exports = { build };
