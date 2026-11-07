'use strict';
const E = require('./engine.js'), M = require('../factory/meter.js');
function state(g, physical) {
  const alive = Uint8Array.from(physical.alive), tray = physical.tray.map(face => g.faces.findIndex((f, i) => f === (face & 255) && !alive[i]));
  if (tray.includes(-1)) throw Error('A waiting picture has no removed tile representative');
  return { alive, tray, moves: physical.moves, clockTaken: !g.clock || !alive[g.clock.i] };
}
function stateKey(g, s) { return Array.from(s.alive).join('') + '/' + s.tray.map(i => g.faces[i]).sort((a, b) => a - b).join(',') + '/' + (s.clockTaken ? '-' : s.moves); }
const same = (a, b) => typeof a === typeof b && (typeof a === 'number' ? a === b : a.pair.slice().sort((a, b) => a - b).join() === b.pair.slice().sort((a, b) => a - b).join());
function event(g, before, after, index, terminalWhy) {
  const removed = before.alive.flatMap((v, i) => v && !after.alive[i] ? [i] : []);
  if (!removed.length) return { kind: terminalWhy === 'clock' ? 'clock-blocked' : 'peek', move: terminalWhy === 'clock' ? index : null, removed };
  if (removed.length === 1 && removed[0] === index) return { kind: 'take', move: index, removed };
  if (removed.length === 2 && removed.includes(index) && g.faces[removed[0]] === g.faces[removed[1]]) return { kind: 'peek-pair', move: { pair: [index, removed.find(i => i !== index)] }, removed };
  return { kind: 'unsupported-physical-transition', move: null, removed };
}
function classifySummary(options) {
  const win = options.filter(x => x.result === 'win').length, lose = options.filter(x => x.result === 'lose').length, unknown = options.filter(x => x.result === 'unknown').length;
  return { legal: options.length, win, lose, unknown, requestedDecision: options.length >= 2 && lose > 0, realFork: win > 0 && lose > 0,
    stateResult: win ? 'win' : !unknown && options.length ? 'lose' : 'unknown' };
}
function reason(g, s, move, kind) {
  if (kind === 'peek') return 'peek';
  if (kind === 'clock-blocked') return 'clock too late';
  const i = typeof move === 'number' ? move : move?.pair?.[0];
  if (i == null) return 'unsupported transition';
  const pair = typeof move !== 'number', match = s.tray.some(t => g.faces[t] === g.faces[i]);
  if (!pair && !match && s.tray.length >= 3) return '4th tile';
  if (!s.clockTaken && g.clock && s.moves >= g.clock.n - 1 && !(pair ? move.pair.includes(g.clock.i) : i === g.clock.i)) return 'clock too late';
  if (pair) return 'peek pair';
  if (!s.clockTaken && E.kindOf(g, s, move) === 'pair') return 'free pair taken early';
  if (!s.clockTaken) {
    // g.toClock is a search-order hint, not the full dependency set: it marks keys
    // but can omit their covers. A cover on a winning route is not an off-route dig.
    const end = g.design.solution.indexOf(g.clock.i), prefix = new Set(g.design.solution.slice(0, end + 1));
    return prefix.has(i) ? 'clock-route order' : 'off stored clock route';
  }
  return 'partner or ending choice';
}
function compareTransition(g, s, ev, after) {
  if (ev.kind === 'peek') return s.moves === after.moves && s.alive.every((v, i) => v === after.alive[i]) && s.tray.map(i => g.faces[i]).sort((a, b) => a - b).join() === after.tray.slice().sort((a, b) => a - b).join();
  if (ev.move == null) return false;
  try {
    const next = E.step(g, s, ev.move);
    if (!next) return after.tray.length >= 4 || ev.kind === 'clock-blocked';
    return next.moves === after.moves && next.alive.every((v, i) => v === after.alive[i]) &&
      next.tray.map(i => g.faces[i]).sort((a, b) => a - b).join() === after.tray.slice().sort((a, b) => a - b).join();
  } catch { return false; }
}
module.exports = { state, stateKey, event, same, classifySummary, reason, compareTransition };
