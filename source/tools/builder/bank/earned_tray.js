'use strict';

const fs = require('node:fs');
const H = require('./hand');
const E = require('../engine');
const D = require('../loop/detour');
const O = require('../loop/obvious');
const { fullTrayFailure } = require('../builder');
const { targetFor, meets } = require('../chained_finish_profiles');
const { closeTwins, swapStage } = require('./separate');
const { expert } = require('./feel');
const { tuneFeel } = require('./feel_retune');
const { findThawTrap } = require('./thaw_trap');
const {
  auditRefundFork, auditTrayRelease, forcesReleaseAfterClock, auditPairContext,
  findOpeningSweep, findOpeningChoices, findFinishPair,
} = require('./choice_checks');
const { supportedAt } = require('./detower');
const { measure } = require('../footprint');
const variants = ['clock', 'keys', 'reserve', 'competing', 'refund', 'release', 'release-roofs', 'release-keys', 'pair-context'];

function recipe(variant) {
  const keyRelease = variant === 'release-keys';
  const keysFirst = variant === 'keys' || variant === 'competing' || keyRelease;
  const refund = variant === 'refund';
  const pairContext = variant === 'pair-context';
  const roofs = variant === 'release-roofs';
  const hasRelease = variant === 'release' || roofs || keyRelease;
  const tiles = [];
  function row(z, y, xs) {
    for (const x of xs) tiles.push([x, y, z]);
  }
  for (let y = 0; y <= 12; y += 2) row(0, y, refund && y === 12 ? [2, 4, 6, 8, 10] : [0, 2, 4, 6, 8, 10]);
  row(1, 1, [1, 3, 7, 9]);
  row(1, 3, [3, 7, 9]);
  row(1, 5, [1, 3, 5, 7, 9]);
  row(1, 7, [1, 3, 5, 7, 9]);
  row(1, 9, [1, 3, 7, 9]);
  row(1, 11, refund ? [3, 7, 9] : [1, 3, 7, 9]);
  if (!keysFirst) row(2, 1, [2, 8]);
  row(2, 5, refund ? [2, 4, 6] : [2]);
  row(2, 7, keysFirst ? [4, 8] : [8]);
  row(2, 9, [8]);
  if (keysFirst) row(2, 11, [2]);
  if (keyRelease) tiles.push([5, 1, 1], [5, 3, 1], [2, 1, 2], [8, 1, 2]);
  else if (hasRelease) tiles.push([5, 9, 1], [5, 11, 1]);
  if (roofs) tiles.push([2, 9, 2], [8, 11, 2]);

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
  const nearKey = variant === 'competing' || keyRelease ? at(2, 11, 2) : at(10, 6, 0);
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
  let context;
  if (variant === 'reserve' || refund || pairContext) {
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
    if (pairContext) {
      const handoff = at(1, 1, 1);
      const sideRefund = at(10, 0, 0);
      const pair = [openUpper, openLower];
      pairs.lock[1] = handoff;
      pairs.leftIce[1] = at(10, 10, 0);
      // The covered twins need both roofs out. Each refund stays behind the
      // other roof's twin, so one open lane alone cannot return a slot.
      pairs.upperRoof.push(lowerRefund);
      pairs.lowerRoof.push(upperRefund);
      spec.tail = [handoff, ...pair, upperRoof, lowerRoof, [upperFace, lowerFace], lowerRefund, upperRefund];
      const prefix = [...route, handoff];
      const fixed = [...Object.values(pairs).flat(), sideRefund];
      const offers = releaseOffers(tiles, spec, prefix, fixed, [], false, (i, drawn) => {
        const [x, y] = tiles[i], [sx, sy] = tiles[sideRefund];
        return drawn[i].picture && Math.max(Math.abs(x - sx), Math.abs(y - sy)) > 2;
      });
      context = { prefix, pair, sideRefund, offers, roofs: [upperRoof, lowerRoof], hidden: [upperFace, lowerFace] };
    }
  }
  let release;
  if (keyRelease) {
    const leftShelf = [at(2, 1, 2), at(1, 1, 1), at(3, 1, 1)];
    const belowMate = [at(4, 2, 0), at(4, 0, 0), at(2, 0, 0), at(2, 2, 0)];
    // The thawed tile matches the cap before the keys. The clock then
    // refunds the flank and leaves the last corner waiting on its own.
    pairs.roof = [roof, flankMate];
    pairs.flank = [flank, clock];
    pairs.rim.push(leftMelt);
    delete pairs.clock;
    const lateCap = pairs.leftIce[1];
    route.splice(route.indexOf(lateCap), 1);
    route.splice(route.indexOf(nearKey), 0, lateCap);
    pairs.cap.push(leftShelf[2]);
    spec.tail = leftShelf;
    release = { prefix: route, route: leftShelf, belowMate, roofs };
  } else if (hasRelease) {
    const handoff = at(8, 1, 2);
    const lowerShelf = [at(8, 9, 2), at(9, 9, 1), at(7, 9, 1)];
    const belowMate = [at(6, 8, 0), at(8, 8, 0), at(6, 10, 0), at(8, 10, 0)];
    pairs.lock.push(handoff);
    pairs.leftIce.push(lowerShelf[2]);
    spec.tail = [handoff, ...lowerShelf];
    const prefix = [...route, handoff];
    release = { prefix, route: lowerShelf, belowMate, roofs };
  }
  if (release) {
    spec.peek = true;
    release.offers = releaseOffers(tiles, spec, release.prefix, release.route, release.belowMate, release.roofs);
  }
  const fork = refund ? { prefix: opening.slice(0, -1), intended: rightIce, decoy: at(1, 9, 1) } : null;
  return { tiles, spec, earlyKey: variant === 'keys' ? [...opening, nearKey] : null, fork, release, context };
}

// Select real pairs that a wrong park can open. Tile ids stand in for unfilled
// pictures so this pass depends on the pile and its fixed route, not the deal.
function releaseOffers(tiles, spec, prefix, route, belowMate, roofs, eligiblePark = () => true) {
  const faces = tiles.map((_, i) => i);
  for (const [first, mate] of Object.values(spec.pairs)) {
    if (mate !== undefined) faces[mate] = faces[first];
  }
  const obst = { ice: spec.ice, keys: spec.keys, locks: spec.locks };
  const game = E.game({ tiles, faces, obst, clock: { i: spec.clock, n: prefix.length } });
  let state = E.start(game);
  for (const tile of prefix) state = E.step(game, state, tile);
  const free = E.legal(game, state).filter(Number.isInteger);
  const drawn = O.visibility(game, state);
  const used = new Set([...prefix, ...route, ...belowMate]);
  const available = free.filter(i => !used.has(i));
  const farEnough = (a, b) => Math.max(Math.abs(tiles[a][0] - tiles[b][0]), Math.abs(tiles[a][1] - tiles[b][1])) > 2;
  const parks = available.filter(i => (!roofs || tiles[i][2] === 2) && eligiblePark(i, drawn));
  return parks.flatMap(park => {
    const opened = E.legal(game, E.step(game, state, park)).filter(i =>
      Number.isInteger(i) && !used.has(i) && !free.includes(i) && drawn[i].picture);
    return opened.flatMap(tile => available.filter(i => i !== park && drawn[i].picture && farEnough(tile, i))
      .map(mate => ({ park, pair: [tile, mate] })));
  });
}

function arrangePairContext(spec, context, seed) {
  const bait = context.offers[seed % context.offers.length];
  if (!bait) return null;
  const pairs = { ...spec.pairs, sideCover: [bait.park, context.sideRefund], sidePair: bait.pair };
  return { ...spec, pairs, pressure: 1.4 + (seed % 6) * .3 };
}

function arrangeRelease(spec, { route, belowMate, offers }, seed) {
  const first = offers[(seed % offers.length) * 7 % offers.length];
  if (!first) return null;
  const used = new Set([first.park, ...first.pair]);
  const others = offers.filter(({ park, pair }) => ![park, ...pair].some(i => used.has(i)));
  if (!others.length) return null;
  const second = others[(seed % others.length) * 11 % others.length];
  const offset = seed % belowMate.length;
  const [underFirst, underSecond, underBait, underOther] = [...belowMate.slice(offset), ...belowMate.slice(0, offset)];
  // Keep the blockers' and baits' twins beneath the carried picture's mate.
  // A wrong park can make a different match, but cannot earn its own slot back.
  const pairs = {
    ...spec.pairs, visiblePair: first.pair, otherPair: second.pair,
    cover1: [route[0], underFirst], cover2: [route[1], underSecond],
    falsePark: [first.park, underBait], otherPark: [second.park, underOther],
  };
  return { ...spec, pairs, pressure: 1.6 + (seed % 6) * .21 };
}

function separateRelease(design, spec, seed) {
  const spacing = closeTwins(design);
  if (spacing.meets) return design;
  const freeze = [...spec.route, ...Object.values(spec.pairs).flat()];
  const fixed = new Set(freeze.map(i => design.faces[i]));
  const protectedPair = ([i]) => fixed.has(design.faces[i]);
  if (spacing.closeVisible.some(protectedPair) || spacing.closeFour.some(protectedPair)
      || spacing.close.filter(protectedPair).length / spacing.pairs > .05) return null;
  // These piles allow one close pair. Stop there, with a fixed search budget
  // so a scheduled pause cannot change the seeded deal.
  const swap = swapStage(design, {
    seed, freeze, targetCost: 1, iterationsPerRound: 500, wallMs: Infinity,
    validate: candidate => E.replay(candidate, candidate.solution).ok,
  });
  return swap.validated && swap.after.meets ? swap.design : null;
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

function addRefundFork(design, { prefix, intended, decoy }, minimum) {
  const face = design.faces[intended], alternative = design.faces[decoy];
  const clockEnd = design.solution.indexOf(design.clock.i);
  if (face === alternative || design.solution.slice(0, clockEnd + 1).some(i => design.faces[i] === alternative)) return null;
  if ([face, alternative].some(picture => design.faces.filter(f => f === picture).length !== 2)) return null;
  const faces = design.faces.map(picture => picture === alternative ? face : picture);
  for (const n of new Set([design.clock.n, minimum])) {
    const candidate = { ...design, faces, clock: { ...design.clock, n } };
    if (!E.replay(candidate, candidate.solution).ok || !closeTwins(candidate).meets) continue;
    const fork = auditRefundFork(candidate, prefix, intended, decoy);
    if (!fork || fork.intendedGoal.kind !== 'ice' || fork.decoyGoal.kind !== 'ice' || fork.decoyClock - n > 6) continue;
    const timing = clockNeed(candidate, minimum);
    if (!timing.exact || timing.k !== minimum) continue;
    return { design: candidate, proof: { prefix, ...fork } };
  }
  return null;
}

function build({ variant = 'clock', seed = 1, tries = 200 } = {}) {
  if (!variants.includes(variant)) throw new Error(`Expected variant ${variants.join(', ')}`);
  if (!Number.isSafeInteger(seed) || seed < 1 || !Number.isSafeInteger(tries) || tries < 1
      || !Number.isSafeInteger(seed + tries)) throw new Error('Expected a positive seed and try count');

  const { tiles, spec, earlyKey, fork, release, context } = recipe(variant);
  const { tilePx } = measure(tiles, { minimum: 60 });
  if (tilePx < 60 || !tiles.every((tile, i) => supportedAt(tiles, tile, i))) return { fail: 'layout' };
  const finish = targetFor('existing');
  const reserve = variant === 'reserve' || !!fork;
  const keyRelease = variant === 'release-keys';
  // One spare move lets the player park a cover from the left shelf early.
  const spare = keyRelease ? 0 : 1;
  for (let deal = seed; deal < seed + tries; deal++) {
    const pressure = reserve ? 2 + (deal % 5) * .25 : 1.2 + (deal % 4) * .2;
    const dealSpec = context ? arrangePairContext(spec, context, deal)
      : release ? arrangeRelease(spec, release, deal) : { ...spec, pressure };
    if (!dealSpec) continue;
    let { design, fail } = H.fill(dealSpec, tiles, deal);
    if (!design) {
      if (release || context) continue;
      return { fail };
    }
    if (release || context) {
      design = separateRelease(design, dealSpec, deal);
      if (!design) continue;
    } else if (!closeTwins(design).meets) continue;

    design.clock.n = spec.route.length + spare;
    const timing = clockNeed(design, spec.route.length);
    if (!timing.exact || timing.k == null || timing.k < 10
        || ((release || context) && timing.k !== spec.route.length)) continue;
    design.clock.n = timing.k + spare;
    if (!E.replay(design, design.solution).ok) continue;

    let proof = keyRelease ? null : findThawTrap(design);
    if ((!keyRelease && !proof) || findOpeningSweep(design) || fullTrayFailure(design)) continue;
    if (earlyKey && !strandsWithEarlyKey(design, earlyKey)) continue;
    let finishPair = reserve ? findFinishPair(design) : null;
    if (reserve && !finiteFinish(finishPair)) continue;
    const finishContext = context && auditPairContext(design, context.prefix, context.pair, dealSpec.pairs.sideCover[0], context);
    if (context && !finishContext) continue;
    const finishRelease = release && auditTrayRelease(design, release.prefix, release.route);
    if (release) {
      const decoys = finishRelease?.decoys.filter(move => !release.roofs || tiles[move.take][2] === 2);
      const pairs = new Set(decoys?.map(move => move.pair.slice().sort().join(',')));
      if (pairs.size < 2 || !forcesReleaseAfterClock(design, finishRelease)) continue;
    }
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
    let refundFork;
    if (fork) {
      const forked = addRefundFork(design, fork, timing.k);
      if (!forked) continue;
      design = forked.design;
      refundFork = forked.proof;
      proof = findThawTrap(design);
      finishPair = findFinishPair(design);
      if (!proof || !finiteFinish(finishPair) || findOpeningSweep(design) || fullTrayFailure(design)) continue;
      feel = finishFeel(design, 16, 9);
      independent = finishFeel(design, 64, 844);
    }
    if (!meets(finish, feel) || !meets(finish, independent)) continue;
    const competing = variant === 'competing' || keyRelease;
    const openingChoices = competing ? findOpeningChoices(design) : [];
    if (competing && new Set(openingChoices.map(choice => choice.goal)).size < 2) continue;
    return {
      variant, seed: deal, minimum: timing.k, proof, secondWrongTurn: earlyKey, finishPair, openingChoices,
      ...(refundFork ? { refundFork } : {}),
      ...(finishRelease ? { finishRelease } : {}),
      ...(finishContext ? { finishContext } : {}),
      finishPressure: pressureParks(feel), independentFinishPressure: pressureParks(independent), design,
    };
  }
  return { fail: 'no deal passed the checks', tries };
}

if (require.main === module) {
  const [variant, seed, output, tries] = process.argv.slice(2);
  if (!output) throw new Error(`Usage: node earned_tray.js <${variants.join('|')}> <seed> <output.json> [tries]`);
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
