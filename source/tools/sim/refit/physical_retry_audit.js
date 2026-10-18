'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { recordings } = require('./personal_prefix_data.js');
const { campaignsOf } = require('./attempt_campaigns.js');
const { PIDS } = require('./mimic_games.js');
const { boardId } = require('./personal_model.js');
const root = path.resolve(__dirname, '../../..');

function stateOf(recorded, position) {
  const frame = recorded.actions[position - 1];
  return { alive: frame?.alive || recorded.g.faces.map(() => 1), tray: frame?.tray || [], openPeek: frame?.openPeek ?? -1 };
}

function identity(state) {
  return state.alive.join('') + '|' + state.tray.slice().sort((left, right) => left - right).join(',') + '|p' + state.openPeek;
}

function commonPrefix(left, right) {
  let count = 0;
  while (count < Math.min(left.length, right.length) && left[count] === right[count]) count++;
  return count;
}

function compareRetries(previous, next) {
  const actions = game => game.actions.map(action => action.kind + ':' + action.index);
  const takes = game => game.actions.filter(action => action.kind === 'take').map(action => action.index);
  const previousTakes = takes(previous), nextTakes = takes(next);
  const last = previous.actions.at(-1), before = identity(stateOf(previous, previous.actions.length - 1));
  const revisits = next.actions.flatMap((action, position) => identity(stateOf(next, position)) === before ? [action] : []);
  const final = previous.actions.at(-1), clock = previous.g.clock;
  return { sameFirstTake: previousTakes.length && nextTakes.length ? previousTakes[0] === nextTakes[0] : null,
    sharedOpeningActions: commonPrefix(actions(previous), actions(next)),
    sharedOpeningTakes: commonPrefix(previousTakes, nextTakes),
    priorChoices: previous.actions.length, nextChoices: next.actions.length,
    priorTerminalStateRevisited: revisits.length > 0,
    priorTerminalActionRepeated: revisits.some(action => action.index === last.index && action.kind === last.kind),
    priorOutcome: previous.ending, priorStop: previous.stopReason,
    priorFailure: previous.ending === 'stuck' ? clock && final.alive[clock.i] && final.moves >= clock.n ? 'clock'
      : final.tray.length >= 4 ? 'tray' : 'other' : 'restart',
    priorClockCleared: clock ? !final.alive[clock.i] : null,
    priorKeysRemaining: (previous.g.rules?.keys || []).filter(index => final.alive[index]).length,
    previousPrefixAvailableBeforeNextOpening: previous.availableAt < next.t };
}

function summarize(rows) {
  const revisited = rows.filter(row => row.priorTerminalStateRevisited), takes = rows.filter(row => row.sameFirstTake !== null);
  return { pairs: rows.length, sameFirstTake: takes.filter(row => row.sameFirstTake).length,
    firstTakePairs: takes.length, shareFourOpeningTakes: rows.filter(row => row.sharedOpeningTakes >= 4).length,
    meanSharedOpeningTakes: rows.length ? rows.reduce((sum, row) => sum + row.sharedOpeningTakes, 0) / rows.length : null,
    terminalStateRevisited: revisited.length, terminalActionRepeated: revisited.filter(row => row.priorTerminalActionRepeated).length,
    priorFailures: Object.fromEntries(['clock', 'tray', 'other', 'restart'].map(kind => [kind, rows.filter(row => row.priorFailure === kind).length])) };
}

function main() {
  const files = ['www/hard.js', 'www/layouts.js', 'tools/sim/refit/physical_retry_audit.js', 'tools/sim/refit/personal_prefix_data.js',
    'tools/sim/refit/attempt_campaigns.js', 'tools/sim/refit/personal_model.js', 'analysis/archive/realdata/plays.json',
    ...Object.values(PIDS).map(pid => 'analysis/archive/replays/' + pid + '.json')];
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of files) digest.update(file).update(fs.readFileSync(path.join(root, file)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf(), recorded = recordings();
  const plays = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/realdata/plays.json')));
  const players = {};
  for (const [name, games] of Object.entries(recorded)) {
    const byAid = new Map(games.map(game => [game.aid, game])), rows = [];
    const regular = Object.values(plays[PIDS[name]] || {}).filter(event => event.k === 'end' && event.r === 'win' && event.m !== 'd' && !event.tk);
    for (const campaign of campaignsOf(plays[PIDS[name]])) {
      const seen = new Set(), starts = campaign.starts.filter(start => {
        if (start.res || seen.has(start.aid)) return false;
        seen.add(start.aid);
        return true;
      });
      for (let position = 1; position < starts.length; position++) {
        const previous = byAid.get(starts[position - 1].aid), next = byAid.get(starts[position].aid);
        if (!previous?.actions.length || !next?.actions.length || next.at !== previous.at + 1
          || !(previous.stopReason === 'restart' || previous.stopReason === 'end' && previous.ending === 'stuck')) continue;
        if (boardId(previous.g) !== boardId(next.g)) continue;
        const highestEarlierClear = Math.max(0, ...regular.filter(event => event.t < campaign.start).map(event => event.lv));
        rows.push({ name, lv: campaign.lv, start: campaign.start, previousAid: previous.aid, nextAid: next.aid,
          nextOpening: next.t, availableAt: Math.max(previous.availableAt, next.availableAt),
          previousAttempt: previous.at, nextAttempt: next.at,
          firstClear: campaign.lv > highestEarlierClear, ...compareRetries(previous, next) });
      }
    }
    players[name] = { all: summarize(rows), firstClear: summarize(rows.filter(row => row.firstClear)),
      firstRetry: summarize(rows.filter(row => row.firstClear && row.previousAttempt === 1)), rows };
  }
  if (fingerprintOf() !== fingerprint) throw new Error('Retry diagnostic inputs changed');
  const report = { made: new Date().toISOString(), evidence: 'recorded-retry-mechanism-diagnostic', fingerprint, fingerprintFiles: files, players,
    note: 'Adjacent recorded natural retries on identical boards, with missing/assisted prefixes excluded and resumes deduplicated. Restart is not invented as a natural loss. Repeating a terminal action is measured only when the same physical state recurs; the terminal action is not necessarily the causal mistake. First-clear and replay habits remain separate. This is not winning-attempt accuracy and no forecast or training model is changed.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/physical-retry-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(Object.fromEntries(Object.entries(players).map(([name, player]) => [name,
    { all: player.all, firstClear: player.firstClear, firstRetry: player.firstRetry }])), null, 2));
}

if (require.main === module) main();
module.exports = { stateOf, identity, commonPrefix, compareRetries, summarize };
