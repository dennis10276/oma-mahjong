'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const L = require('../../../www/layouts.js');
const { PIDS } = require('./mimic_games.js');
const root = path.resolve(__dirname, '../../..');

function exits(tiles, nb, state, inspected) {
  const takeable = index => state.a[index] && L.isFree(index, state.a, nb)
    && !(state.ob?.left?.[index] > 0) && !(!state.ob?.unlocked && state.ob?.locks?.includes(index));
  const free = tiles.map((tile, index) => index).filter(takeable);
  const visible = index => !state.d[index] || state.p === index;
  const known = index => visible(index) || inspected[index];
  const matching = predicate => free.filter(index => predicate(index) && state.tr.some(waiting => state.f[waiting] === state.f[index]));
  const pairs = predicate => free.flatMap((left, position) => free.slice(position + 1).filter(right => predicate(left) && predicate(right)
    && state.f[left] === state.f[right] && (state.tr.length < 3 || state.d[left] || state.d[right])).map(right => [left, right]));
  return { visibleMatches: matching(visible), rememberedMatches: matching(known), visiblePairs: pairs(visible),
    rememberedPairs: pairs(known), novelFlips: free.filter(index => state.d[index] && !known(index)), free: free.length };
}

function auditFailure(chunks) {
  const rows = Object.values(chunks).filter(row => row?.data).sort((left, right) => left.seq - right.seq);
  const parts = rows.map(row => JSON.parse(row.data)), init = parts.find(part => part.init)?.init;
  if (!init || init.partial || init.track || init.ez || !init.state || init.state.f.some(face => face >= 100)) return null;
  const events = parts.flatMap(part => part.events || []), ending = events.find(event => event[1] === 'end');
  if (!ending || ending[2]?.r !== 'stuck' || events.some(event => ['hint', 'shuffle', 'rescue', 'nudge', 'auto', 'truncated'].includes(event[1]))) return null;
  const tiles = init.tiles.map(([x, y, z]) => ({ x, y, z })), nb = L.neighbors(tiles), state = structuredClone(init.state);
  const inspected = state.d.map((down, index) => !down || index === state.p ? 1 : 0);
  let lastTap = null, lastTake = null;
  for (const [, kind, data] of events) {
    if (kind === 'tap') lastTap = Array.isArray(data) && !data[1] && !data[2] ? data[0] : null;
    if (kind === 'state' && data) {
      if (data.f) return null;
      if (data.a?.some(([index, value]) => !value && state.a[index])) {
        const activeClock = !!(state.ck && state.a[state.ck.i]);
        lastTake = { clicked: lastTap, tray: state.tr.length, moves: state.m, activeClock,
          clockBudget: activeClock ? state.ck.n - state.m : null,
          keysRemaining: state.ob && !state.ob.unlocked ? (state.ob.keys || []).filter(index => state.a[index]).length : 0,
          ...exits(tiles, nb, state, inspected) };
      }
      for (const field of ['a', 'd']) if (data[field]) for (const [index, value] of data[field]) state[field][index] = value;
      for (const field of ['tr', 'p', 'm', 'ob', 'ck']) if (Object.hasOwn(data, field)) state[field] = data[field];
      if (state.p >= 0) inspected[state.p] = 1;
    }
    if (kind === 'end') break;
  }
  const clockFailed = !!ending[2].ck || !!(state.ck && state.a[state.ck.i] && state.m >= state.ck.n);
  const mechanism = clockFailed ? 'clock' : state.tr.length >= 4 ? 'tray' : 'unclassified';
  const visibleExit = !!(lastTake && (lastTake.visibleMatches.length || lastTake.visiblePairs.length));
  const rememberedExit = !!(lastTake && (lastTake.rememberedMatches.length || lastTake.rememberedPairs.length));
  return { t: rows[0].t, availableAt: Math.max(...rows.map(row => row.t || 0)), lv: +init.key.slice(1), at: init.at,
    mechanism, afterClockCleared: !!(state.ck && !state.a[state.ck.i]), lastTake,
    exitClass: mechanism !== 'tray' || !lastTake ? null : visibleExit ? 'visibleSafeExit' : rememberedExit ? 'previouslySeenSafeExit'
      : lastTake.novelFlips.length ? 'uninspectedFreePictures' : 'noKnownSafeExitOrNovelFlip' };
}

function main() {
  const playsFile = path.join(root, 'analysis/archive/realdata/plays.json'), plays = JSON.parse(fs.readFileSync(playsFile, 'utf8'));
  const fingerprint = crypto.createHash('sha256').update(fs.readFileSync(__filename)).update(fs.readFileSync(playsFile));
  const players = {};
  for (const [name, pid] of Object.entries(PIDS)) {
    const filename = path.join(root, 'analysis/archive/replays/' + pid + '.json'), raw = fs.readFileSync(filename);
    fingerprint.update(raw);
    const regular = new Set(Object.values(plays[pid] || {}).filter(event => event.k === 'end' && event.m !== 'd' && !event.tk).map(event => event.aid));
    const failures = Object.entries(JSON.parse(raw)).filter(([aid]) => regular.has(aid)).map(([aid, chunks]) => {
      const audit = auditFailure(chunks);
      return audit ? { aid, ...audit } : null;
    }).filter(Boolean).sort((left, right) => left.t - right.t);
    const summarize = rows => ({ failures: rows.length, clock: rows.filter(row => row.mechanism === 'clock').length,
      tray: rows.filter(row => row.mechanism === 'tray').length, unclassified: rows.filter(row => row.mechanism === 'unclassified').length,
      trayAfterClockCleared: rows.filter(row => row.mechanism === 'tray' && row.afterClockCleared).length,
      exits: Object.fromEntries(['visibleSafeExit', 'previouslySeenSafeExit', 'uninspectedFreePictures', 'noKnownSafeExitOrNovelFlip']
        .map(kind => [kind, rows.filter(row => row.exitClass === kind).length])) });
    players[name] = { all: summarize(failures), recent: summarize(failures.slice(-15)), failures };
    console.log(name, JSON.stringify({ all: players[name].all, recent: players[name].recent }));
  }
  const report = { made: new Date().toISOString(), fingerprint: fingerprint.digest('hex'), players,
    note: 'Complete unassisted recorded regular failures only. Safe exits use currently visible or previously inspected pictures, never unseen picture locations. Previously inspected does not prove human recall. No-known-exit is a local observation, not proof that every earlier choice was forced. Mechanism comes from the recorded clock flag and final state, not the presence of a clock on the board. This diagnostic is not forecast accuracy.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/failure-audit.json'), JSON.stringify(report, null, 2));
}

if (require.main === module) main();
module.exports = { exits, auditFailure };
