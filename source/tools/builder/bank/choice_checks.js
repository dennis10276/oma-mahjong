'use strict';

const E = require('../engine');
const O = require('../loop/obvious');

const openingLength = 5;
const minimumRunway = 5;
const runwaySurvey = 30;
const finishWindow = 14;
const prove = (game, state) => E.winnable(game, state, { nodes: 60000, ms: 450 });
const singles = (game, state) => E.legal(game, state).filter(Number.isInteger);

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

module.exports = { findOpeningSweep, findOpeningChoices, findFinishPair };
