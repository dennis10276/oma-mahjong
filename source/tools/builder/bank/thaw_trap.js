'use strict';

const E = require('../engine');
const { visibility } = require('../loop/obvious');

const matchInTray = (game, state, tile) => state.tray.find(i => game.faces[i] === game.faces[tile]);

function winningRefunds(game, ice) {
  const { design } = game;
  if (!E.replay(design, design.solution).ok) return [];
  const targets = new Set(ice);
  const refunds = [];
  let state = E.start(game);
  for (let i = 0; i < design.solution.length && !state.clockTaken; i++) {
    const tile = design.solution[i];
    const refund = matchInTray(game, state, tile);
    if (targets.has(tile) && state.tray.length === 3 && refund !== undefined
        && !game.iceNb[tile].includes(refund)) {
      refunds.push({ ice: tile, refund });
    }
    const clockPair = game.after && refund === undefined && state.moves + 1 === game.clock.n
      && design.solution[i + 1] === game.clock.i;
    let next = clockPair ? null : E.step(game, state, tile);
    if (!next) next = E.step(game, state, { pair: [tile, design.solution[++i]] });
    if (!next) return [];
    state = next;
  }
  return refunds;
}

// A local dig may lift a cover to reach a melter. Count only work on that
// target, so unrelated clean-up cannot pad the length of the losing route.
function localDig(game, relaxed, ice) {
  const melters = game.iceNb[ice].filter(i => !game.nb.above[i].includes(ice));
  const work = new Set(melters.flatMap(i => [i, ...game.nb.above[i]]));
  const start = E.start(game);
  const queue = [{ state: start, path: [] }];
  const seen = new Set();
  let priced = 0;
  for (const { state, path } of queue) {
    const legal = E.legal(game, state).filter(Number.isInteger);
    if (legal.includes(ice)) {
      if (path.length < 3 || state.tray.length !== 3 || legal.some(i => !game.down[i] && matchInTray(game, state, i) !== undefined)) continue;
      if (priced++ >= 16) return null;
      if (E.winnable(relaxed, state, { nodes: 100000, ms: 1000 }).result === 'lose') return path;
      continue;
    }
    if (path.length === 5 || state.moves >= game.clock.n) continue;
    for (const i of legal) {
      if (game.down[i] || i === game.clock.i || !work.has(i)) continue;
      const next = E.step(game, state, i);
      if (!next) continue;
      // For pair matching, only the picture of each tile waiting matters.
      const key = next.alive.join('') + '/' + next.tray.map(i => game.faces[i]).sort().join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ state: next, path: [...path, i] });
    }
  }
  return null;
}

function findThawTrap(design) {
  if (!design.clock || Object.keys(design.obst?.ice ?? {}).length < 2) return null;
  const game = E.game(design);
  const vis = visibility(game, E.start(game));
  const ice = Object.keys(design.obst.ice).map(Number).filter(i => vis[i].role);
  if (ice.length < 2) return null;
  const relaxed = E.game({ ...design, clock: { ...design.clock, n: design.tiles.length + 1 } });
  for (const proof of winningRefunds(game, ice)) {
    const wrongThaw = localDig(game, relaxed, proof.ice);
    if (wrongThaw) return { ...proof, wrongThaw };
  }
  return null;
}

module.exports = { findThawTrap };
