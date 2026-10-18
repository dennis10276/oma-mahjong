'use strict';
const fs = require('fs'), path = require('path');
const L = require('../../../www/layouts.js');
const { PIDS } = require('./mimic_games.js');

function takeable(index, nb, state) {
  const ob = state.ob;
  return state.a[index] && L.isFree(index, state.a, nb)
    && !(ob && ob.left && ob.left[index] > 0)
    && !(ob && !ob.unlocked && (ob.locks || []).includes(index));
}

function visibleMatches(tiles, nb, state) {
  const trayFaces = state.tr.map(index => state.f[index]);
  return tiles.map((tile, index) => index).filter(index => takeable(index, nb, state)
    && (!state.d[index] || state.p === index) && trayFaces.includes(state.f[index]));
}

const empty = () => ({ opportunities: 0, matchTaps: 0, otherTaps: 0, flipsInstead: 0, reopenFlipsInstead: 0,
  novelOpportunities: 0, novelMatchTaps: 0, novelFlipTaps: 0, keysInstead: 0, clockInstead: 0, pairsInstead: 0 });

function auditRecording(chunks) {
  const rows = Object.values(chunks).filter(row => row?.data).sort((left, right) => left.seq - right.seq);
  let init = null;
  const events = [];
  for (const row of rows) {
    const data = JSON.parse(row.data);
    if (data.init) init = data.init;
    events.push(...data.events);
  }
  if (!init || init.partial || init.track || !init.state || init.state.f.some(face => face >= 100)) return null;
  const state = structuredClone(init.state), tiles = init.tiles.map(([x, y, z]) => ({ x, y, z })), nb = L.neighbors(tiles);
  const seenDown = state.d.map((value, index) => !value || state.p === index ? 1 : 0);
  const counts = { noClock: empty(), earlyClock: empty(), planningClock: empty() };
  for (const [milliseconds, kind, data] of events) {
    if (['hint', 'shuffle', 'rescue', 'nudge', 'auto', 'truncated'].includes(kind)) break;
    if (kind === 'tap' && Array.isArray(data) && !data[1] && !data[2]) {
      const clicked = data[0];
      if (!Number.isInteger(clicked) || clicked < 0 || clicked >= tiles.length || !state.a[clicked]) continue;
      const matches = visibleMatches(tiles, nb, state);
      if (!matches.length) continue;
      const activeClock = !!(state.ck && state.a[state.ck.i]), budget = activeClock ? state.ck.n - state.m : 0;
      const group = counts[activeClock ? budget <= 10 ? 'planningClock' : 'earlyClock' : 'noClock'];
      const novelAvailable = tiles.some((tile, index) => state.d[index] && !seenDown[index] && takeable(index, nb, state));
      group.opportunities++;
      group.novelOpportunities += +novelAvailable;
      if (matches.includes(clicked)) {
        group.matchTaps++;
        group.novelMatchTaps += +novelAvailable;
      }
      else {
        group.otherTaps++;
        const flip = state.d[clicked] && state.p !== clicked;
        group.flipsInstead += +flip;
        group.reopenFlipsInstead += +(flip && seenDown[clicked]);
        group.novelFlipTaps += +(flip && !seenDown[clicked]);
        group.keysInstead += +(!!state.ob && !state.ob.unlocked && (state.ob.keys || []).includes(clicked));
        group.clockInstead += +(activeClock && clicked === state.ck.i);
        group.pairsInstead += +(!flip && state.p >= 0 && state.p !== clicked && state.a[state.p] && state.f[state.p] === state.f[clicked]);
      }
    }
    if (kind === 'state' && data) {
      if (data.f) break;
      for (const field of ['a', 'd']) if (data[field]) for (const [index, value] of data[field]) state[field][index] = value;
      for (const field of ['tr', 'p', 'm', 'ob', 'ck']) if (Object.hasOwn(data, field)) state[field] = data[field];
      if (state.p >= 0) seenDown[state.p] = 1;
    }
  }
  return { lv: +init.key.slice(1), at: init.at, t: rows[0].t, availableAt: Math.max(...rows.map(row => row.t || 0)), counts };
}

function main() {
  const root = path.resolve(__dirname, '../../..'), players = {};
  for (const [name, pid] of Object.entries(PIDS)) {
    const replays = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/replays/' + pid + '.json'), 'utf8'));
    const games = Object.values(replays).map(auditRecording).filter(Boolean), totals = { noClock: empty(), earlyClock: empty(), planningClock: empty() };
    for (const game of games) for (const [context, count] of Object.entries(game.counts)) for (const [statistic, value] of Object.entries(count)) totals[context][statistic] += value;
    players[name] = { games: games.length, totals, recentGames: games.sort((left, right) => left.availableAt - right.availableAt).slice(-20) };
    console.log(name, JSON.stringify(totals));
  }
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/visible-match-audit.json'), JSON.stringify({ made: new Date().toISOString(), players,
    note: 'Accepted human taps while an immediately visible tray match was takeable. Other taps do not prove forgetting: deliberate key, pair or clock planning can also explain them. Picture knowledge is limited to face-up or currently open tiles.' }, null, 2));
}

if (require.main === module) main();
module.exports = { visibleMatches, auditRecording };
