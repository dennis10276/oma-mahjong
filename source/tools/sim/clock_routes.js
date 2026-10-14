/* Offline clock-only tuning: never changes a board, deal, obstacle or clock position. */
'use strict';
const L = require('../../www/layouts');
const SLOTS = L.SLOTS;
  const clockSpare = level => level < 90 ? [3, 4] : level < 110 ? [2, 3] : [1, 2];
  // Replay a complete witness, checking every tap including ice, locks, tray capacity and deadline.
  function validSolution(g, path) {
    if (!path || path.length !== g.tiles.length) return false;
    const initial = new Uint8Array(g.tiles.length).fill(1), alive = initial.slice(), tray = [];
    let clockTaken = !g.clock;
    for (let move = 0; move < path.length; move++) {
      const i = path[move];
      if (!Number.isInteger(i) || !alive[i] || !(g.rules ? L.takeable(i, alive, g.nb, g.rules, initial) : L.isFree(i, alive, g.nb))) return false;
      if (!clockTaken && move >= g.clock.n) return false;
      alive[i] = 0;
      if (g.clock && i === g.clock.i) clockTaken = true;
      const q = tray.indexOf(g.faces[i]); if (q >= 0) tray.splice(q, 1); else tray.push(g.faces[i]);
      if (tray.length >= SLOTS) return false;
    }
    return clockTaken && tray.length === 0;
  }
  // Bounded breadth-first search: prioritize the blockers of the clock, but keep alternative
  // legal tray states. Accept a prefix only if an exact solver can finish the whole board.
  function clockRoute(g, ci, options = {}) {
    const n = g.tiles.length, initial = new Uint8Array(n).fill(1);
    const remainingRules = alive => {
      if (!g.rules) return null;
      const ice = {};
      for (const k in g.rules.ice) {
        const gone = g.rules.iceNb[k].filter(i => !alive[i]).length;
        if (g.rules.ice[k] > gone) ice[k] = g.rules.ice[k] - gone;
      }
      return { ...g.rules, ice };
    };
    const blockers = alive => {
      const up = new Set(), todo = [ci];
      while (todo.length) for (const j of g.nb.above[todo.pop()]) if (alive[j] && !up.has(j)) { up.add(j); todo.push(j); }
      const side = name => { const set = new Set(up), todo = [ci], seen = new Set();
        while (todo.length) { const k = todo.pop(); if (seen.has(k)) continue; seen.add(k); for (const j of g.nb[name][k]) if (alive[j]) { set.add(j); todo.push(j); } }
        return set.size;
      };
      return Math.min(side('left'), side('right')) + 1;
    };
    let frontier = [{ alive: initial.slice(), tray: [], path: [] }], nodes = 0;
    const seen = new Set();
    for (let depth = 0; depth < (options.depth || Math.min(64, n)) && frontier.length && nodes < (options.nodes || 80000); depth++) {
      const next = [];
      for (const state of frontier) {
        for (let i = 0; i < n; i++) {
          if (!(g.rules ? L.takeable(i, state.alive, g.nb, g.rules, initial) : L.isFree(i, state.alive, g.nb))) continue;
          const q = state.tray.findIndex(j => g.faces[j] === g.faces[i]);
          if (q < 0 && state.tray.length >= SLOTS - 1) continue;
          const alive = state.alive.slice(); alive[i] = 0;
          const tray = q < 0 ? state.tray.concat(i) : state.tray.filter((_, k) => k !== q), path = state.path.concat(i);
          const key = alive.join('') + '|' + tray.map(j => g.faces[j]).sort((a,b) => a-b).join(',');
          if (seen.has(key)) continue; seen.add(key); nodes++;
          if (i === ci) {
            const rest = L.solve(g.tiles, g.nb, g.faces, alive, tray, 100000, remainingRules(alive));
            if (rest) return path.concat(rest);
          } else next.push({ alive, tray, path, score: blockers(alive) + tray.length * 0.15 });
        }
      }
      next.sort((a,b) => a.score-b.score);
      frontier = next.slice(0, options.width || 96);
    }
    return null;
  }

module.exports = {clockSpare, validSolution, clockRoute};
