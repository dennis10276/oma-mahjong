'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { PIDS, boardOf } = require('./mimic_games.js');
const { campaignsOf } = require('./attempt_campaigns.js');
const { normalizeAttempts } = require('./attempt_count_labels.js');
const { boardId } = require('./personal_model.js');
const { progressionTargets } = require('./progression_targets.js');
const { designed } = require('./boards.js');
const { encodeGame } = require('./personal_game_io.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const parentRelative = 'analysis/archive/personal-bots/experiments/personal-outcome-styles-scored-2026-10-18T15-48-20-154Z';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const parentFile = parentRelative + '/analysis/archive/personal-bots/physical-outcome-styles-count-data.json';
  const manifest = JSON.parse(fs.readFileSync(path.join(root, parentRelative, 'manifest.json')));
  const parentBytes = fs.readFileSync(path.join(root, parentFile));
  assert.equal(hash(parentBytes), manifest.files['analysis/archive/personal-bots/physical-outcome-styles-count-data.json']);
  const parent = JSON.parse(parentBytes), existing = new Set(parent.rows.map(row => row.name + '|' + row.start));
  const plays = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/realdata/plays.json')));
  const scores = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/realdata/scores.json')));
  const recent = [], future = [], targets = {};
  for (const [name, pid] of Object.entries(PIDS)) {
    const parentCompletedThrough = Math.max(...parent.rows.filter(row => row.name === name).map(row => row.end));
    const events = Object.values(plays[pid] || {}).filter(event => event.m !== 'd' && !event.tk);
    const replays = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/replays/' + pid + '.json'))), recorded = new Map();
    for (const [aid, chunks] of Object.entries(replays)) for (const chunk of Object.values(chunks)) if (chunk?.data) {
      const init = JSON.parse(chunk.data).init;
      if (init && !init.partial && !init.track && init.state) recorded.set(aid, boardOf(init));
    }
    for (const campaign of campaignsOf(events)) {
      if (!campaign.events.length || campaign.start <= parentCompletedThrough || existing.has(name + '|' + campaign.start)) continue;
      const first = campaign.events[0], last = campaign.events.at(-1);
      const highestEarlierClear = Math.max(0, ...events.filter(event => event.k === 'end' && event.r === 'win' && event.t < campaign.start).map(event => event.lv));
      const firstClear = campaign.lv > highestEarlierClear;
      if (!firstClear) continue;
      const game = recorded.get(campaign.opening?.aid) || recorded.get(first.aid) || designed(first.v, first.lv);
      assert(game, 'No verified board for the new recent campaign: ' + name + '/' + campaign.lv + '/' + campaign.start);
      const aids = campaign.campaignAids;
      const boardIds = campaign.events.map(event => recorded.get(event.aid) || designed(event.v, event.lv)).filter(Boolean).map(boardId);
      recent.push({ name, lv: first.lv, version: first.v, start: campaign.start, end: last.t,
        ...normalizeAttempts(campaign.firstCounter, last.r === 'win' ? last.at || 1 : null, campaign.confirmedOpening),
        observedAttempts: Math.max(...campaign.events.map(event => event.at || 1)) - campaign.firstCounter + 1,
        firstClear, excludedAids: aids, boardChangedWithinCampaign: new Set(boardIds).size > 1,
        openingRecorded: !!campaign.opening?.aid, assisted: campaign.events.some(event => event.ez || event.h || event.sh || event.rb),
        source: recorded.has(campaign.opening?.aid) || recorded.has(first.aid) ? 'recorded' : 'table', board: boardId(game), game: encodeGame(game) });
    }
    const target = progressionTargets(events, scores[pid], 24);
    targets[name] = target;
    for (const lv of target.levels) {
      if (events.some(event => event.k === 'start' && event.lv === lv)) continue;
      const game = designed(target.version, lv);
      assert(game, 'A future level needs its verified fixed board');
      future.push({ name, lv, version: target.version, priorCounter: 0, firstAttempt: 1, firstClear: true,
        eligibleAtPlanningOnly: true, board: boardId(game), game: encodeGame(game) });
    }
  }
  const files = [...new Set(['analysis/archive/realdata/plays.json', 'analysis/archive/realdata/scores.json',
    'analysis/archive/realdata/snapshot.json', parentRelative + '/manifest.json', parentFile,
    'analysis/archive/personal-bots/personal-prefix-versions.json', 'analysis/archive/personal-bots/personal-fresh-own-models.json',
    ...Object.values(PIDS).map(pid => 'analysis/archive/replays/' + pid + '.json'),
    ...Object.keys(require.cache).filter(file => file.startsWith(root + path.sep)).map(file => path.relative(root, file).replace(/\\/g, '/')),
    ...fs.readdirSync(path.join(__dirname, 'tables')).filter(name => /^(levels|hard|early)-/.test(name)).map(name => 'tools/sim/refit/tables/' + name)])].sort();
  const inputHashes = Object.fromEntries(files.map(file => [file, hash(fs.readFileSync(path.join(root, file)))]));
  const output = { made: new Date().toISOString(), evidence: 'fresh-personal-request-schedule-not-forecasts', targetMet: false,
    targets, recent: recent.sort((left, right) => left.start - right.start), future, inputHashes,
    requests: recent.map(row => ({ name: row.name, start: row.start, excludedAids: row.excludedAids })),
    note: 'All newly available first-clear campaigns beyond the unchanged276-board parent are retained, including pending and hard cases. '
      + 'Future board tasks contain no numeric forecasts or winning labels. Planning eligibility is not a genuine pre-start freeze; '
      + 'live openings and actual freeze time must be checked again later. Historical as-of fits exclude entire target campaigns '
      + 'and later-created chunks, but client queue timestamps alone are not server-availability proof.' };
  fs.writeFileSync(path.join(archive, 'personal-fresh-count-requests.json'), JSON.stringify(output));
  console.log(JSON.stringify({ recent: recent.length, future: future.length,
    players: Object.fromEntries(Object.keys(PIDS).map(name => [name, { recent: recent.filter(row => row.name === name).map(row => row.lv),
      future: future.filter(row => row.name === name).map(row => row.lv) }])) }, null, 2));
}

if (require.main === module) main();
