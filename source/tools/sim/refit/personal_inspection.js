'use strict';
const fs = require('fs'), path = require('path');
const { PIDS } = require('./mimic_games.js');
const { auditRecording } = require('./match_notice_audit.js');
const root = path.resolve(__dirname, '../../..');

function recordings() {
  return Object.fromEntries(Object.entries(PIDS).map(([name, pid]) => {
    const replay = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/replays/' + pid + '.json'), 'utf8'));
    return [name, Object.values(replay).map(auditRecording).filter(Boolean).sort((left, right) => left.availableAt - right.availableAt)];
  }));
}

function inspectionAt(recorded, name, cutoff, halfLife = 20, pull = 12) {
  const totals = Object.fromEntries(Object.entries(recorded).map(([person, games]) => {
    const past = games.filter(game => game.availableAt < cutoff).sort((left, right) => left.availableAt - right.availableAt);
    let novel = 0, matched = 0;
    for (const [index, game] of past.entries()) {
      const weight = 0.5 ** ((past.length - 1 - index) / halfLife), counts = game.counts.noClock;
      novel += weight * counts.novelFlipTaps;
      matched += weight * counts.novelMatchTaps;
    }
    return [person, { games: past.length, novel, matched, availableThrough: past.at(-1)?.availableAt ?? null }];
  }));
  const family = Object.entries(totals).filter(([person, count]) => person !== name && count.novel + count.matched > 0)
    .map(([, count]) => count.novel / (count.novel + count.matched));
  const prior = family.length ? family.reduce((sum, probability) => sum + probability, 0) / family.length : 0;
  const mine = totals[name];
  if (!mine) throw new Error('Unknown inspection persona: ' + name);
  return { probability: (mine.novel + pull * prior) / (mine.novel + mine.matched + pull), prior,
    own: mine, familyAvailableThrough: Math.max(0, ...Object.entries(totals).filter(([person]) => person !== name)
      .map(([, count]) => count.availableThrough || 0)), cutoff, halfLife, pull };
}

function diagnostic(recorded) {
  const players = {};
  for (const [name, games] of Object.entries(recorded)) {
    const ordered = games.slice().sort((left, right) => left.t - right.t);
    const cut = ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * 0.75))]?.t;
    if (!cut) continue;
    const fitted = inspectionAt(recorded, name, cut);
    let novel = 0, matched = 0;
    for (const game of ordered.filter(game => game.t >= cut)) {
      novel += game.counts.noClock.novelFlipTaps;
      matched += game.counts.noClock.novelMatchTaps;
    }
    const probability = Math.min(1 - 1e-6, Math.max(1e-6, fitted.probability));
    players[name] = { fitted, testingGames: ordered.filter(game => game.t >= cut).length, novel, matched,
      observedProbability: novel + matched ? novel / (novel + matched) : null,
      binaryLogLoss: novel + matched ? -(novel * Math.log(probability) + matched * Math.log(1 - probability)) / (novel + matched) : null };
  }
  return { made: new Date().toISOString(), players,
    note: 'Historical conditional inspection diagnostic only. Counts new free inspections versus visible tray matches when novel inspection was possible and the clock was absent or cleared. Reopens and competing other actions are not treated as forgetting. Each target uses strictly earlier available chunks and a leave-person-out family prior, not later recordings.' };
}

if (require.main === module) {
  const report = diagnostic(recordings());
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-inspection-policy.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
module.exports = { recordings, inspectionAt, diagnostic };
