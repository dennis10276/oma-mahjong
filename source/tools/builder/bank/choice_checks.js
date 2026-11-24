'use strict';

const E = require('../engine');
const O = require('../loop/obvious');
const D = require('../loop/detour');

const openingLength = 5;
const minimumRunway = 5;
const runwaySurvey = 30;
const finishWindow = 14;
const prove = (game, state) => E.winnable(game, state, { nodes: 60000, ms: 450 });
const singles = (game, state) => E.legal(game, state).filter(Number.isInteger);
const legalTake = (legal, take) => Number.isInteger(take) ? legal.includes(take)
  : Array.isArray(take?.pair) && take.pair.length === 2 && legal.some(move => move.pair?.every(i => take.pair.includes(i)));
const frozen = (game, state, tile) => game.iceH[tile] > 0
  && game.iceNb[tile].filter(i => !state.alive[i]).length < game.iceH[tile];

// Look at the physical effect of a take, including a fourth take that the
// tray cannot hold. Key covers count when lifting them reveals the badge.
function openingTargets(game, state, tile, previous) {
  if (game.down[tile]) return [];
  const clock = game.clock.i;
  const goals = [];
  if (tile === clock || game.nb.above[clock].includes(tile)) goals.push({ kind: 'clock', tile: clock });
  const visible = O.visibility(game, state);
  if (game.isKey[tile] && visible[tile].role) goals.push({ kind: 'key', tile });
  // The badge disappears on thaw. Only count a thaw on the last visible action.
  if (previous && visible[tile].role && frozen(game, previous, tile) && O.visibility(game, previous)[tile].role) {
    goals.push({ kind: 'ice', tile });
  }
  for (const ice of game.iceRev[tile]) {
    if (state.alive[ice] && visible[ice].role && frozen(game, state, ice)) {
      goals.push({ kind: 'ice', tile: ice });
    }
  }
  const coveredKeys = game.below[tile].filter(i => state.alive[i] && game.isKey[i]);
  if (coveredKeys.length) {
    const after = { ...state, alive: state.alive.slice() };
    after.alive[tile] = 0;
    const exposed = O.visibility(game, after);
    for (const key of coveredKeys) {
      if (exposed[key].role && (!visible[key].role || game.nb.above[key].every(i => !after.alive[i]))) {
        goals.push({ kind: 'key', tile: key });
      }
    }
  }
  return goals;
}

function auditOpeningTrace(design, actions) {
  const game = E.game(design);
  if (!game.clock) return { result: 'no-clock' };
  let state = E.start(game);
  let previous;
  const fullTray = [];
  for (const take of actions) {
    if (state.moves >= game.clock.n) return { result: 'timeout', moves: state.moves, fullTray };
    const legal = E.legal(game, state);
    if (!legalTake(legal, take)) return { result: 'illegal', moves: state.moves, fullTray };
    if (state.tray.length === E.SLOTS - 1) {
      const waiting = new Set(state.tray.map(i => game.faces[i]));
      const faceUpMatches = legal.filter(i => Number.isInteger(i) && !game.down[i] && waiting.has(game.faces[i]));
      fullTray.push({ at: state.moves, take, faceUpMatches });
    }
    const next = E.step(game, state, take);
    if (!next) {
      return {
        result: 'overflow', moves: state.moves, fullTray,
        overflow: { take, from: prove(game, state).result, goals: openingTargets(game, state, take, previous) },
      };
    }
    previous = state;
    state = next;
    if (state.clockTaken) {
      return { result: 'clock', moves: state.moves, fullTray, clockContinuation: prove(game, state).result };
    }
  }
  return { result: state.moves >= game.clock.n ? 'timeout' : 'open', moves: state.moves, fullTray };
}

function auditRefundFork(design, prefix, intended, decoy) {
  const game = E.game(design);
  if (!game.clock || intended === decoy || game.faces[intended] !== game.faces[decoy]) return null;
  let state = E.start(game);
  let previous;
  for (const take of prefix) {
    if (!legalTake(E.legal(game, state), take)) return null;
    previous = state;
    state = E.step(game, state, take);
    if (!state || state.clockTaken) return null;
  }
  if (state.tray.length !== E.SLOTS - 1) return null;
  const free = singles(game, state);
  if (!free.includes(intended) || !free.includes(decoy)) return null;
  const visible = O.visibility(game, state);
  if (![intended, decoy].every(i => visible[i].picture)) return null;
  const waiting = state.tray.find(i => game.faces[i] === game.faces[intended]);
  if (waiting === undefined) return null;

  const intendedTargets = openingTargets(game, state, intended, previous);
  const decoyTargets = openingTargets(game, state, decoy, previous);
  const distinct = (targets, other) => targets.find(goal => other.every(alt => alt.tile !== goal.tile));
  const intendedGoal = distinct(intendedTargets, decoyTargets);
  const decoyGoal = distinct(decoyTargets, intendedTargets);
  if (!intendedGoal || !decoyGoal) return null;

  const right = E.step(game, state, intended);
  const wrong = E.step(game, state, decoy);
  const proof = D.work(450000, 4000);
  if (!right || !wrong || proof.win(game, right, 120000).result !== 'win'
      || proof.win(game, wrong, 120000).result !== 'lose') return null;
  const runway = E.longest(game, wrong, minimumRunway, 12000).depth;
  if (runway < minimumRunway) return null;
  const time = D.clockNeed(D.clockGames(design), wrong, {
    upTo: game.clock.n + 8, nodes: 75000, w: proof,
  });
  if (!time.exact || time.k === null || time.k <= game.clock.n) return null;
  return { at: state.moves, waiting, intended, decoy, intendedGoal, decoyGoal, decoyClock: time.k, runway };
}

// A visible pair that a second park makes takeable, even though the old
// waiting picture can no longer be cleared on a winning route.
function openedPair(game, state, free, visible) {
  const after = singles(game, state);
  const waiting = new Set(state.tray.map(i => game.faces[i]));
  for (const a of after) {
    if (free.includes(a) || !visible[a].picture || waiting.has(game.faces[a])) continue;
    const b = after.find(i => i !== a && visible[i].picture && game.faces[i] === game.faces[a]);
    if (b !== undefined) return [a, b];
  }
  return null;
}

function auditTrayRelease(design, prefix, route) {
  if (route.length !== 3 || !route.every(Number.isInteger)) return null;
  const game = E.game(design);
  if (!game.clock) return null;
  let state = E.start(game);
  for (const take of prefix) {
    if (!legalTake(E.legal(game, state), take)) return null;
    state = E.step(game, state, take);
    if (!state) return null;
  }
  if (!state.clockTaken || state.tray.length !== 1) return null;
  const [waiting] = state.tray;
  const mate = route[2];
  const matching = game.faceTiles.get(game.faces[waiting]).filter(i => state.alive[i]);
  const visible = O.visibility(game, state);
  if (matching.length !== 1 || matching[0] !== mate || !visible[mate].picture) return null;

  const free = singles(game, state);
  if (free.includes(route[1]) || free.includes(mate)
      || free.some(i => singles(game, E.step(game, state, i)).includes(mate))) return null;
  let release = state;
  for (const [index, tile] of route.entries()) {
    if (!O.visibility(game, release)[tile]?.picture || !singles(game, release).includes(tile)) return null;
    release = E.step(game, release, tile);
    if (!release || release.tray.length !== [2, 3, 2][index]) return null;
  }
  if (release.tray.includes(waiting) || prove(game, release).result !== 'win') return null;

  const decoys = [];
  for (const take of free) {
    if (route.includes(take) || !visible[take].picture) continue;
    const wrong = E.step(game, state, take);
    if (wrong.tray.length !== 2) continue;
    const pair = openedPair(game, wrong, free, visible);
    if (!pair || prove(game, wrong).result !== 'lose') continue;
    const afterPair = E.step(game, E.step(game, wrong, pair[0]), pair[1]);
    const runway = pair.length + E.longest(game, afterPair, minimumRunway - pair.length, 12000).depth;
    if (runway >= minimumRunway) decoys.push({ take, pair, runway });
  }
  return { at: state.moves, waiting, route, decoys };
}

function forcesReleaseAfterClock(design, { waiting, route }) {
  const game = E.game(design);
  const obst = design.obst;
  if (!game.clock || obst?.keys2?.length || obst?.locks2?.length) return false;
  const { i: clock } = game.clock;
  if (!game.nb.above[clock].includes(waiting)) return false;
  const proof = D.work(150000);
  return route.every(tile => {
    // One cover is already required. The extra lock in this solver copy asks
    // whether the clock can be won with this release tile also taken early.
    if (game.faces[tile] === game.faces[clock]) return false;
    const test = E.game({ ...design, obst: { ...obst, keys2: [waiting, tile], locks2: [clock] } });
    return proof.win(test, E.start(test), 45000).result === 'lose';
  });
}

// Follow only causal, visible takes. A sequence of unrelated nearby tiles or
// a sequence that already loses is not a winning shortcut.
function findOpeningSweep(design) {
  const game = E.game(design);
  if (!game.clock) return null;
  const { nb } = game;
  const unblocks = (i, j) => nb.above[j].includes(i)
    || nb.left[j].includes(i) || nb.right[j].includes(i);

  function follow(state, previousFree, free, path) {
    if (state.clockTaken) return null;
    if (path.length === openingLength) return prove(game, state).result === 'win' ? path : null;
    for (const tile of free) {
      if (tile === game.clock.i || game.down[tile]) continue;
      if (path.length && (previousFree.includes(tile) || !unblocks(path.at(-1), tile))) continue;
      const next = E.step(game, state, tile);
      if (!next) continue;
      const found = follow(next, free, singles(game, next), [...path, tile]);
      if (found) return found;
    }
    return null;
  }

  const start = E.start(game);
  return follow(start, [], singles(game, start), []);
}

function findOpeningChoices(design) {
  const game = E.game(design);
  if (!game.clock) return [];
  const start = E.start(game);
  if (prove(game, start).result !== 'win') return [];

  const roles = O.visibleRoles(game, start);
  // Keep the clock's physical approach separate from the gold key approach.
  const clockSide = O.cone(game, start, roles.map(role => role === 'key' ? 'none' : role), 3);
  const limits = { nodes: 18000, ms: 140 };
  const choices = [];
  let relaxed;
  for (const tile of singles(game, start)) {
    if (game.down[tile]) continue;
    const key = game.isKey[tile] && roles[tile] === 'key';
    const clock = clockSide.has(tile);
    if (!key && !clock) continue;
    const position = E.step(game, start, tile);
    if (!position || E.winnable(game, position, limits).result !== 'lose') continue;
    const runway = E.longest(game, position, 8, 5000).depth;
    if (runway < minimumRunway) continue;
    relaxed ??= E.game({ ...design, clock: { ...design.clock, n: game.n + 1 } });
    choices.push({ tile, goal: key ? 'key' : 'clock', runway, relaxed: E.winnable(relaxed, position, limits).result });
  }
  return choices;
}

function losingPair(game, state) {
  if (state.tray.length >= E.SLOTS - 1) return null;
  const waiting = new Set(state.tray.map(tile => game.faces[tile]));
  const visible = singles(game, state).filter(tile => !game.down[tile] && !waiting.has(game.faces[tile]));
  for (const [i, tile] of visible.entries()) {
    for (const twin of visible.slice(i + 1)) {
      if (game.faces[tile] !== game.faces[twin]) continue;
      const first = E.step(game, state, tile);
      // An unlocked tile generally stays available as the pile shrinks.
      // Keep this check because taking the pair must be a real option.
      if (!first || !E.legal(game, first).includes(twin)) continue;
      const after = E.step(game, first, twin);
      if (!after || prove(game, after).result !== 'lose') continue;
      const { depth: runway, exact } = E.longest(game, after, runwaySurvey, 250000);
      if (runway >= minimumRunway) {
        return { pair: [tile, twin], at: state.moves, runway, runwayExact: exact && runway < runwaySurvey };
      }
    }
  }
  return null;
}

// The winning route establishes that the position at the clock is still
// solvable. This probe checks the finish choices near that arrival.
function findFinishPair(design) {
  const game = E.game(design);
  if (!game.clock) return null;
  let state = E.start(game);
  const witness = prove(game, state);
  if (witness.result !== 'win') return null;
  let clockAt = null;
  for (const action of witness.path) {
    state = E.step(game, state, action);
    if (!state.clockTaken) continue;
    clockAt ??= state.moves;
    if (state.moves > clockAt + finishWindow) break;
    const proof = losingPair(game, state);
    if (proof) return proof;
  }
  return null;
}

module.exports = {
  auditOpeningTrace, auditRefundFork, auditTrayRelease, forcesReleaseAfterClock,
  findOpeningSweep, findOpeningChoices, findFinishPair,
};
