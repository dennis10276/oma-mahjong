'use strict';

const fs = require('node:fs');
const H = require('./hand');
const E = require('../engine');
const D = require('../loop/detour');
const { fullTrayFailure } = require('../builder');
const { targetFor, meets } = require('../chained_finish_profiles');
const { closeTwins } = require('./separate');
const { expert } = require('./feel');
const { tuneFeel } = require('./feel_retune');
const { findThawTrap } = require('./thaw_trap');
const { findOpeningSweep, findOpeningChoices, findFinishPair } = require('./choice_checks');
const { supportedAt } = require('./detower');
const { measure } = require('../footprint');

function recipe(variant) {
  const keysFirst = variant === 'keys' || variant === 'competing';
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
  if (!keysFirst) row(2, 1, [2, 8]);
  row(2, 5, [2]);
  row(2, 7, keysFirst ? [4, 8] : [8]);
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
  const nearKey = variant === 'competing' ? at(2, 11, 2) : at(10, 6, 0);
  const farKey = keysFirst ? at(0, 6, 0) : at(0, 4, 0);
  const flank = at(7, 7, 1);
  const flankMate = keysFirst ? at(4, 7, 2) : at(2, 1, 2);
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
    // The centre roof interrupts the side-first sweep. Pair it with the flank
    // to open the middle without spending the two slots reserved for the thaw.
    const [cap, edge, corner] = [at(8, 9, 2), at(9, 9, 1), at(9, 11, 1)];
    route = [...opening, flank, flankMate, lock, leftMelt, leftIce, nearKey, farKey, cap, edge, corner, clock];
    pairs.leftIce.push(cap);
    Object.assign(pairs, { melt: [melter, lock], rim: [edge], cap: [corner], clock: [clock] });
  } else {
    route = [...opening, nearKey, farKey, flank, flankMate, lock, leftMelt, leftIce, clock];
    Object.assign(pairs, { clock: [melter, clock], lock: [lock] });
  }
  const spec = {
    clock,
    route,
    ice: { [leftIce]: 2, [rightIce]: 2 },
    locks: keysFirst ? [clock] : [lock, clock],
    keys: [nearKey, farKey],
    down: .23,
    pairs,
  };
  if (variant === 'reserve') {
    const upperRoof = at(8, 1, 2), upperFace = at(9, 1, 1), upperRefund = at(10, 2, 0);
    const lowerRoof = at(8, 9, 2), lowerFace = at(9, 9, 1), lowerRefund = at(10, 8, 0);
    const openUpper = at(3, 3, 1), openLower = at(3, 9, 1);
    // The clock leaves two pictures waiting. The visible pair is tempting,
    // but each of its tiles is needed to lift a different roof's buried twin.
    pairs.lock.push(upperRefund);
    pairs.leftIce.push(lowerRefund);
    Object.assign(pairs, { reserve: [openUpper, openLower, upperFace, lowerFace], upperRoof: [upperRoof], lowerRoof: [lowerRoof] });
    spec.tail = [upperRoof, [openUpper, upperFace], upperRefund, lowerRoof, [openLower, lowerFace], lowerRefund];
    spec.peek = true;
    spec.downTiles = [upperFace, lowerFace];
  }
  return { tiles, spec, earlyKey: variant === 'keys' ? [...opening, nearKey] : null };
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

const pressureParks = feel => +(feel.parkAt[1] + feel.parkAt[2]).toFixed(1);
const finishFeel = (design, playouts, seed) => expert(design, { playouts, seed, wrong: false });
// Require enough time for the error to look promising without the prolonged
// dead finish seen on the shipped repeat-pressure exemplar.
const finiteFinish = proof => proof?.runwayExact && proof.runway <= 18;
const clockNeed = (design, upTo) => D.clockNeed(D.clockGames(design), E.start(E.game(design)), {
  upTo, nodes: 90000, w: D.work(350000, 4000),
});

function build({ variant = 'clock', seed = 1, tries = 200 } = {}) {
  if (!['clock', 'keys', 'reserve', 'competing'].includes(variant)) {
    throw new Error('Expected clock, keys, reserve or competing');
  }
  if (!Number.isSafeInteger(seed) || seed < 1 || !Number.isSafeInteger(tries) || tries < 1
      || !Number.isSafeInteger(seed + tries)) throw new Error('Expected a positive seed and try count');

  const { tiles, spec, earlyKey } = recipe(variant);
  const { tilePx } = measure(tiles, { minimum: 60 });
  if (tilePx < 60 || !tiles.every((tile, i) => supportedAt(tiles, tile, i))) return { fail: 'layout' };
  const finish = targetFor('existing');
  const reserve = variant === 'reserve';
  for (let deal = seed; deal < seed + tries; deal++) {
    const pressure = reserve ? 2 + (deal % 5) * .25 : 1.2 + (deal % 4) * .2;
    let { design, fail } = H.fill({ ...spec, pressure }, tiles, deal);
    if (!design) return { fail };
    if (!closeTwins(design).meets) continue;

    design.clock.n = spec.route.length + 1;
    const timing = clockNeed(design, spec.route.length);
    if (!timing.exact || timing.k == null || timing.k < 10) continue;
    design.clock.n = timing.k + 1;
    if (!E.replay(design, design.solution).ok) continue;

    let proof = findThawTrap(design);
    if (!proof || findOpeningSweep(design) || fullTrayFailure(design)) continue;
    if (earlyKey && !strandsWithEarlyKey(design, earlyKey)) continue;
    let finishPair = reserve ? findFinishPair(design) : null;
    if (reserve && !finiteFinish(finishPair)) continue;
    let feel = finishFeel(design, 16, 9);
    let independent = finishFeel(design, 64, 844);
    if (reserve && (!meets(finish, feel) || !meets(finish, independent))) {
      const tune = tuneFeel(design, {
        seed: deal, ms: 4000, maxProposals: 1400, keepRoute: true, tolerance: 0,
        freeze: [...spec.route, ...spec.tail.flat()],
        target: { ...finish, parks: 3.2 },
        validate(candidate) {
          const timingAgain = clockNeed(candidate, timing.k);
          const ok = timingAgain.exact && timingAgain.k === timing.k
            && findThawTrap(candidate) && !findOpeningSweep(candidate) && !fullTrayFailure(candidate)
            && finiteFinish(findFinishPair(candidate)) && meets(finish, finishFeel(candidate, 64, 844));
          return { ok, why: 'reserveProof' };
        },
      });
      if (!tune.met) continue;
      design = tune.design;
      proof = findThawTrap(design);
      finishPair = findFinishPair(design);
      feel = finishFeel(design, 16, 9);
      independent = finishFeel(design, 64, 844);
    }
    if (!meets(finish, feel) || !meets(finish, independent)) continue;
    const openingChoices = variant === 'competing' ? findOpeningChoices(design) : [];
    if (variant === 'competing' && new Set(openingChoices.map(choice => choice.goal)).size < 2) continue;
    return {
      variant, seed: deal, minimum: timing.k, proof, secondWrongTurn: earlyKey, finishPair, openingChoices,
      finishPressure: pressureParks(feel), independentFinishPressure: pressureParks(independent), design,
    };
  }
  return { fail: 'no deal passed the checks', tries };
}

if (require.main === module) {
  const [variant, seed, output, tries] = process.argv.slice(2);
  if (!output) throw new Error('Usage: node earned_tray.js <clock|keys|reserve|competing> <seed> <output.json> [tries]');
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
