'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const Hard = require('../../../www/hard.js');
const { recordings } = require('./personal_prefix_data.js');
const { campaignsOf } = require('./attempt_campaigns.js');
const { PIDS } = require('./mimic_games.js');
const { boardId } = require('./personal_model.js');
const root = path.resolve(__dirname, '../../..');

function inheritedChoices(prefix, actions, seen, down) {
  const summary = { decisions: prefix.decisions.length, previouslyObservedDownChoices: 0, flipsModelCallsUnknown: 0, takesModelCallsBlind: 0 };
  for (const [position, decision] of prefix.decisions.entries()) {
    const index = actions[position].index, selected = decision.F[decision.k];
    if (!selected || !seen[index] || !down[index]) continue;
    summary.previouslyObservedDownChoices++;
    if (selected[19] && !selected[65]) summary.flipsModelCallsUnknown++;
    if (!selected[19] && selected[16]) summary.takesModelCallsBlind++;
  }
  return summary;
}

function main() {
  const file = path.join(root, 'analysis/archive/personal-bots/policy-sequence-prefix-data.json');
  const raw = fs.readFileSync(file), data = JSON.parse(raw), digest = crypto.createHash('sha256');
  for (const source of data.fingerprintFiles) digest.update(source).update(fs.readFileSync(path.join(root, source)));
  if (digest.digest('hex') !== data.fingerprint) throw new Error('Retry knowledge audit requires current prefix sources');
  const plays = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/realdata/plays.json'))), players = {};
  for (const [name, games] of Object.entries(recordings())) {
    const campaigns = new Map(campaignsOf(plays[PIDS[name]]).flatMap(campaign => campaign.campaignAids.map(aid => [aid, campaign.start])));
    const prefixes = new Map(data.players[name].map(prefix => [prefix.aid, prefix])), history = [];
    const summary = { candidatePrefixes: data.players[name].length, prefixes: 0, unmappedPrefixes: 0, earlierAvailableSameCampaignPrefixes: 0, decisions: 0,
      previouslyObservedDownChoices: 0, flipsModelCallsUnknown: 0, takesModelCallsBlind: 0 };
    for (const game of games) {
      const prefix = prefixes.get(game.aid), campaign = campaigns.get(game.aid);
      if (!prefix) continue;
      if (campaign === undefined) { summary.unmappedPrefixes++; continue; }
      const board = boardId(game.g), prior = history.filter(row => row.campaign === campaign && row.board === board && row.availableAt < game.t);
      const seen = game.g.faces.map((face, index) => +prior.some(row => row.seen[index]));
      const actions = game.actions.slice(0, prefix.manualChoices);
      if (actions.length !== prefix.decisions.length) throw new Error('Retry knowledge audit action alignment differs');
      const current = inheritedChoices(prefix, actions, seen, game.g.down);
      summary.prefixes++;
      summary.earlierAvailableSameCampaignPrefixes += +(prior.length > 0);
      for (const [key, value] of Object.entries(current)) summary[key] += value;
      const state = { ...game.g, follow: game.take.slice(0, actions.at(-1).followEnd), log: [], logMatches: true,
        tapTimes: actions.map(action => action.time), settleBefore: actions.map(action => action.settled) };
      const result = Hard.play(state, { ...Hard.P, physicalFlips: true, peek: 0, end: 0, plan: 0, forceMatches: false }, 1);
      history.push({ campaign, board, availableAt: prefix.availableAt, seen: Array.from(result.seen) });
    }
    players[name] = summary;
  }
  const report = { made: new Date().toISOString(), evidence: 'descriptive-available-retry-knowledge-not-forecast-accuracy',
    prefixFingerprint: data.fingerprint, prefixDataSha256: crypto.createHash('sha256').update(raw).digest('hex'),
    sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'), players,
    note: 'Only pictures actually observed in earlier uploaded natural prefixes of the same campaign and exact board. This identifies missing candidate memory, not proof that the human remembered every picture. No cross-campaign replay memory, future upload, hidden initial face or target winning count is used.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-retry-knowledge-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(players, null, 2));
}

if (require.main === module) main();
module.exports = { inheritedChoices };
