'use strict';
const fs = require('fs'), path = require('path');
const { PIDS } = require('./mimic_games.js');
const { exits } = require('./failure_audit.js');
const L = require('../../../www/layouts.js');
const root = path.resolve(__dirname, '../../..');

function matchErrors(chunks) {
  const rows = Object.values(chunks).filter(row => row?.data).sort((left, right) => left.seq - right.seq);
  const parts = rows.map(row => JSON.parse(row.data)), init = parts.find(part => part.init)?.init;
  if (!init || init.partial || init.track || init.ez || !init.state || init.state.f.some(face => face >= 100)) return null;
  const events = parts.flatMap(part => part.events || []), ending = events.find(event => event[1] === 'end');
  if (!ending || !['win', 'stuck'].includes(ending[2]?.r) || events.some(event => ['hint', 'shuffle', 'rescue', 'nudge', 'truncated'].includes(event[1]))) return null;
  const state = structuredClone(init.state), tiles = init.tiles.map(([x, y, z]) => ({ x, y, z })), nb = L.neighbors(tiles);
  const inspected = state.d.map((down, index) => !down || index === state.p ? 1 : 0);
  let opportunities = 0, fatal = 0, manual = false;
  for (const [, kind, data] of events) {
    if (kind === 'auto') break;
    if (kind === 'tap') manual = Array.isArray(data) && !data[1] && !data[2];
    if (kind === 'state' && data) {
      if (data.f) return null;
      if (manual && data.a?.some(([index, value]) => !value && state.a[index]) && state.tr.length === 3
        && !(state.ck && state.a[state.ck.i]) && exits(tiles, nb, state, inspected).visibleMatches.length) {
        opportunities++;
        fatal += +(data.tr?.length >= 4);
      }
      for (const field of ['a', 'd']) if (data[field]) for (const [index, value] of data[field]) state[field][index] = value;
      for (const field of ['tr', 'p', 'm', 'ob', 'ck']) if (Object.hasOwn(data, field)) state[field] = data[field];
      if (state.p >= 0) inspected[state.p] = 1;
    }
    if (kind === 'end') break;
  }
  return { t: rows[0].t, availableAt: Math.max(...rows.map(row => row.t || 0)), opportunities, fatal };
}

function recordings() {
  const plays = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/realdata/plays.json'), 'utf8'));
  return Object.fromEntries(Object.entries(PIDS).map(([name, pid]) => {
    const regular = new Set(Object.values(plays[pid] || {}).filter(event => event.k === 'end' && event.m !== 'd' && !event.tk).map(event => event.aid));
    const replay = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/replays/' + pid + '.json'), 'utf8'));
    return [name, Object.entries(replay).filter(([aid]) => regular.has(aid)).map(([, chunks]) => matchErrors(chunks)).filter(Boolean)];
  }));
}

function matchErrorAt(recorded, name, cutoff) {
  const totals = Object.fromEntries(Object.entries(recorded).map(([person, games]) => {
    const before = games.filter(game => game.availableAt < cutoff).sort((left, right) => left.availableAt - right.availableAt);
    let opportunities = 0, fatal = 0;
    before.forEach((game, index) => {
      const weight = 0.5 ** ((before.length - 1 - index) / 20);
      opportunities += weight * game.opportunities;
      fatal += weight * game.fatal;
    });
    return [person, { games: before.length, opportunities, fatal, availableThrough: before.at(-1)?.availableAt ?? null }];
  }));
  const family = Object.entries(totals).filter(([person, count]) => person !== name && count.opportunities > 0);
  const prior = family.length ? family.reduce((sum, [, count]) => sum + count.fatal / count.opportunities, 0) / family.length : 0;
  const own = totals[name];
  if (!own) throw new Error('Unknown visible-match persona: ' + name);
  return { probability: (own.fatal + 12 * prior) / (own.opportunities + 12), own, prior, cutoff,
    familyAvailableThrough: Math.max(0, ...family.map(([, count]) => count.availableThrough || 0)) };
}

function diagnostic(recorded) {
  const players = {};
  for (const [name, games] of Object.entries(recorded)) {
    const ordered = games.slice().sort((left, right) => left.t - right.t);
    if (!ordered.length) continue;
    const cutoff = ordered[Math.floor(ordered.length * 0.75)].t, fitted = matchErrorAt(recorded, name, cutoff);
    const testing = ordered.filter(game => game.t >= cutoff);
    const opportunities = testing.reduce((sum, game) => sum + game.opportunities, 0), fatal = testing.reduce((sum, game) => sum + game.fatal, 0);
    players[name] = { fitted, testingGames: testing.length, opportunities, fatal, observedProbability: opportunities ? fatal / opportunities : null };
  }
  return { made: new Date().toISOString(), players,
    note: 'Historical mechanism diagnostic, not count accuracy. Physical human choices before auto-finish, at three waiting tiles with an immediately visible takeable tray match, after the clock is cleared or absent. Fits use earlier complete unassisted regular recordings, twenty-game decay and twelve-choice leave-person-out family shrinkage. Auto-finished wins contribute their earlier human choices, never automatic actions. A fatal choice despite a visible match is observed; its psychological cause is not inferred. Applying this rate to recalled matches is a separate actor hypothesis.' };
}

if (require.main === module) {
  const report = diagnostic(recordings());
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-match-error.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
module.exports = { matchErrors, recordings, matchErrorAt, diagnostic };
