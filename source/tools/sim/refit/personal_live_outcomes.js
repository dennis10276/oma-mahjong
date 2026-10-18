'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { campaignsOf } = require('./attempt_campaigns.js');
const { normalizeAttempts } = require('./attempt_count_labels.js');
const { designed } = require('./boards.js');
const { tableVersion } = require('./board_versions.js');
const { boardId } = require('./personal_model.js');
const { PIDS } = require('./mimic_games.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main(argument) {
  assert(argument, 'Supply a separate read-only live opening snapshot');
  const folder = path.resolve(argument), manifestBytes = fs.readFileSync(path.join(folder, 'manifest.json')), manifest = JSON.parse(manifestBytes);
  assert(folder.startsWith(path.join(root, 'analysis/archive/personal-bots/live-openings-')));
  assert.equal(manifest.evidence, 'read-only-live-opening-check');
  const playsBytes = fs.readFileSync(path.join(folder, 'plays.json')); assert.equal(hash(playsBytes), manifest.files['plays.json']);
  const plays = JSON.parse(playsBytes), oldFile = path.join(root, 'analysis/archive/personal-bots/prospective-outcomes.json');
  const oldBytes = fs.readFileSync(oldFile), original = JSON.parse(oldBytes), episodes = [];
  for (const [name, pid] of Object.entries(PIDS)) for (const campaign of campaignsOf(plays[pid] || {})) {
    const first = campaign.opening || campaign.events[0], last = campaign.events.at(-1);
    const prior = original.find(row => row.name === name && row.start === campaign.start && row.lv === campaign.lv);
    let board = prior?.board || null, source = prior ? 'previous-exact-outcome' : 'unresolved';
    if (!board && tableVersion(first.v) === '1.55' && campaign.lv >= 53 && campaign.lv <= 269) {
      const game = designed(first.v, campaign.lv);
      if (game) { board = boardId(game); source = 'verified-fixed-table'; }
    }
    const counters = [...campaign.starts, ...campaign.events].map(event => event.at || 1);
    episodes.push({ name, lv: campaign.lv, version: first.v, start: campaign.start,
      end: last?.t || campaign.start, board, source,
      ...normalizeAttempts(campaign.firstCounter, last?.r === 'win' ? last.at || 1 : null, campaign.confirmedOpening),
      campaignAids: campaign.campaignAids, openingRecorded: !!campaign.opening?.aid,
      observedAttempts: Math.max(...counters) - campaign.firstCounter + 1,
      assisted: campaign.events.some(event => event.ez || event.h || event.sh || event.rb),
      unresolvedBoard: board === null });
  }
  const report = { made: new Date().toISOString(), observedAt: manifest.made, evidence: 'separate-live-completed-and-pending-outcomes',
    targetMet: false, liveManifestSha256: hash(manifestBytes), playsSha256: hash(playsBytes), previousOutcomeSha256: hash(oldBytes),
    episodes, unresolvedBoards: episodes.filter(row => row.unresolvedBoard).length,
    sourceHashes: Object.fromEntries(Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))
      .map(filename => [path.relative(root, filename).replace(/\\/g, '/'), hash(fs.readFileSync(filename))])),
    note: 'Separate outcome export; never replaces frozen fitting raw inputs. Exact previous boards or verified fixed-table boards only. '
      + 'Unresolved boards and pending campaigns remain explicit, not discarded successes. Actual start timestamps determine forecast eligibility. '
      + 'Replay counts are episode-relative; all original numeric forecasts and misses remain unchanged.' };
  fs.writeFileSync(path.join(folder, 'personal-outcomes.json'), JSON.stringify(report));
  console.log(JSON.stringify({ folder, episodes: episodes.length, unresolvedBoards: report.unresolvedBoards }));
}

if (require.main === module) main(process.argv[2]);
