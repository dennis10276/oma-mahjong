'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { recordings, reconstruct } = require('./personal_prefix_data.js');
const { campaignsOf } = require('./attempt_campaigns.js');
const { PIDS } = require('./mimic_games.js');
const { boardId } = require('./personal_model.js');
const root = path.resolve(__dirname, '../../..');

function lateObservedSources(history, target) {
  if (target.campaign === undefined) return [];
  return history.filter(source => source.campaign === target.campaign && source.board === target.board
    && source.t < target.t && source.availableAt >= target.t && Number.isFinite(source.observedThrough)
    && source.observedThrough < target.t);
}

function main() {
  const file = path.join(root, 'analysis/archive/personal-bots/policy-memory-prefix-data.json'), raw = fs.readFileSync(file), data = JSON.parse(raw);
  const digest = crypto.createHash('sha256');
  for (const source of data.fingerprintFiles) digest.update(source).update(fs.readFileSync(path.join(root, source)));
  if (digest.digest('hex') !== data.fingerprint) throw new Error('Late-memory audit sources changed');
  const plays = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/realdata/plays.json'))), players = {};
  for (const [name, games] of Object.entries(recordings())) {
    const events = Object.values(plays[PIDS[name]] || {}), ends = new Map();
    for (const event of events) if (event.k === 'end' && event.aid && Number.isFinite(event.t)) ends.set(event.aid, Math.min(ends.get(event.aid) ?? Infinity, event.t));
    const campaigns = new Map(campaignsOf(events).flatMap(campaign => campaign.campaignAids.map(aid => [aid, campaign.start])));
    const prefixes = new Map(data.players[name].map(prefix => [prefix.aid, prefix])), history = [];
    const summary = { prefixes: 0, prefixesWithLateObservedSources: 0, lateSources: 0, additionalObservedPictures: 0,
      extraPreviouslyObservedDownChoices: 0, extraUnknownInspectionLabels: 0 };
    for (const game of games) {
      const prefix = prefixes.get(game.aid);
      if (!prefix) continue;
      const target = { campaign: campaigns.get(game.aid), board: boardId(game.g), t: game.t };
      const late = lateObservedSources(history, target), strict = history.filter(source => source.campaign === target.campaign
        && source.board === target.board && source.t < target.t && source.availableAt < target.t);
      const additional = game.g.faces.map((face, index) => +late.some(source => source.seen[index]) && !strict.some(source => source.seen[index]));
      summary.prefixes++;
      summary.prefixesWithLateObservedSources += +(late.length > 0);
      summary.lateSources += late.length;
      summary.additionalObservedPictures += additional.reduce((sum, value) => sum + value, 0);
      for (const [index, decision] of prefix.decisions.entries()) {
        const chosen = game.actions[index].index, feature = decision.F[decision.k];
        if (!additional[chosen] || !game.g.down[chosen]) continue;
        summary.extraPreviouslyObservedDownChoices++;
        summary.extraUnknownInspectionLabels += +(!!feature[19] && !feature[65]);
      }
      const rebuilt = reconstruct(game);
      history.push({ ...target, aid: game.aid, availableAt: prefix.availableAt,
        observedThrough: ends.get(game.aid), seen: Array.from(rebuilt.result.seen) });
    }
    players[name] = summary;
  }
  const report = { made: new Date().toISOString(), evidence: 'causal-observation-coverage-audit-not-forecast-accuracy',
    prefixFingerprint: data.fingerprint, prefixDataSha256: crypto.createHash('sha256').update(raw).digest('hex'),
    sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'), players,
    note: 'A confirmed earlier attempt ending proves its natural prefix was observed before the retry even when its telemetry chunk timestamp is later. This audit measures the conservative upload-before-retry restriction; any expanded training must raise feature availability to every source timestamp and retain target-source exclusions. It does not modify the running experiment or assume perfect human recall.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-late-memory-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(players, null, 2));
}

if (require.main === module) main();
module.exports = { lateObservedSources };
