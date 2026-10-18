'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '../../..');

function handoffOf(recorded, actionCount) {
  if (!Number.isInteger(actionCount) || actionCount < 0 || actionCount > recorded.actions.length) throw new Error('Invalid handoff action count');
  const last = recorded.actions[actionCount - 1];
  const take = recorded.take.slice(0, last?.followEnd || 0).filter(index => index >= 0);
  return { ...recorded.g, start: take, peekedAtStart: [...new Set(recorded.actions.slice(0, actionCount).map(action => action.index))],
    openPeekAtStart: last?.openPeek ?? -1, physicalLog: [] };
}

function matchesState(game, result, expected) {
  return result.moves === (expected?.moves || 0) && result.openPeek === (expected?.openPeek ?? -1)
    && JSON.stringify(result.tray) === JSON.stringify(expected?.tray || [])
    && game.faces.every((face, index) => (result.at[index] < 0) === !!(expected?.alive[index] ?? 1));
}

function main() {
  const runs = +(process.argv[2] || 16), pinned = path.resolve(process.argv[3]
    || path.join(root, 'analysis/archive/personal-bots/experiments/personal-first-2026-10-17T10-33-50-257Z'));
  if (!Number.isInteger(runs) || runs < 2) throw new Error('At least two handoff diagnostic runs required');
  const dataRaw = fs.readFileSync(path.join(pinned, 'analysis/archive/personal-bots/physical-personal-count-data.json'));
  const data = JSON.parse(dataRaw), fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of data.fingerprintFiles) digest.update(fs.readFileSync(path.join(pinned, file)));
    return digest.digest('hex');
  };
  if (fingerprintOf() !== data.fingerprint) throw new Error('Pinned personal measurement changed');
  const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
  const Hard = require(path.join(pinned, 'www/hard.js'));
  const { recordings } = require(path.join(pinned, 'tools/sim/refit/personal_prefix_data.js'));
  const { selectModels, actorOf } = require(path.join(pinned, 'tools/sim/refit/physical_count_data.js'));
  const bank = JSON.parse(fs.readFileSync(path.join(pinned, 'analysis/archive/personal-bots/physical-policy-bank.json')));
  const requests = JSON.parse(fs.readFileSync(path.join(pinned, 'analysis/archive/personal-bots/physical-count-requests.json'))).requests;
  const rows = [], missing = [], unsupported = [];
  for (const [name, games] of Object.entries(recordings())) for (const recorded of games) {
    if (!['Dennisisdebeste', 'Mrs. Doubtfire'].includes(name) || !recorded.initialNewLevel || recorded.g.faces.some(face => face >= 100)) continue;
    const request = requests.find(row => row.name === name && row.excludedAids.includes(recorded.aid));
    if (!request) { missing.push({ name, lv: recorded.lv, aid: recorded.aid }); continue; }
    const models = selectModels(bank, request);
    const clockAction = recorded.g.clock ? recorded.actions.findIndex(action => !action.alive[recorded.g.clock.i]) : -1;
    const stages = { initial: 0 };
    if (clockAction >= 0) stages.afterClock = clockAction + 1;
    for (const moves of [20, 40, 60]) {
      const action = recorded.actions.findIndex(frame => frame.moves >= moves);
      if (action >= 0) stages['move' + moves] = action + 1;
    }
    for (const [stage, actionCount] of Object.entries(stages)) {
      const game = handoffOf(recorded, actionCount), expected = recorded.actions[actionCount - 1];
      const validation = Hard.play({ ...game, follow: [] }, actorOf(models.ownAll), 1);
      if (!matchesState(game, validation, expected)) {
        unsupported.push({ name, lv: recorded.lv, stage, actionCount, expectedMoves: expected?.moves || 0,
          actualMoves: validation.moves, why: validation.why });
        continue;
      }
      const profiles = { ownAll: actorOf(models.ownAll), ownAllPlan8: { ...actorOf(models.ownAll), physicalPlan: 8 },
        ownNovelPlan8: { ...actorOf(models.ownNovel), physicalPlan: 8 }, ownAllFinish100: { ...actorOf(models.ownAll), physicalPlan: 8, physicalSafety: 1 } };
      const simulations = Object.fromEntries(Object.entries(profiles).map(([profile, actor]) => [profile,
        Array.from({ length: runs }, (_, sample) => {
          const result = Hard.play({ ...game, physicalLog: [] }, actor, 20261028 * 7919 + sample * 104729);
          return { why: result.why, moves: result.moves, left: result.left };
        })]));
      rows.push({ name, lv: recorded.lv, aid: recorded.aid, stage, actionCount, observedMoves: expected?.moves || 0,
        observedTray: expected?.tray || [], observedLeft: expected ? expected.alive.filter(Boolean).length : game.faces.length, simulations });
    }
  }
  if (fingerprintOf() !== data.fingerprint || sourceHash !== crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex')) throw new Error('Handoff audit inputs changed');
  const players = Object.fromEntries(['Dennisisdebeste', 'Mrs. Doubtfire'].map(name => [name,
    Object.fromEntries([...new Set(rows.map(row => row.stage))].map(stage => {
      const own = rows.filter(row => row.name === name && row.stage === stage);
      return [stage, { prefixes: own.length, profiles: Object.fromEntries(Object.keys(own[0]?.simulations || {}).map(profile => {
        const values = own.flatMap(row => row.simulations[profile]);
        return [profile, { runs: values.length, wins: values.filter(value => value.why === 'win').length,
          clocks: values.filter(value => value.why === 'clock').length,
          trays: values.filter(value => value.why === 'tray').length,
          meanLeft: values.reduce((sum, value) => sum + value.left, 0) / values.length }];
      })) }];
    }))]));
  const report = { made: new Date().toISOString(), evidence: 'human-state-handoff-diagnostic-only', pinned, runs, sourceHash,
    measurementFingerprint: data.fingerprint, players, rows, missing, unsupported,
    note: 'Human prefix state is deliberately supplied only to localize actor failure; this is NOT a forecast, training data, new-level accuracy or evidence of the 80% goal. Every actor is frozen before campaign opening and receives only the observed past at handoff. Ordinary-picture boards only; unsupported atomic-clock initialization is explicit. Natural prefixes stop before help or missing chunks. All autonomous initial runs remain separate from the handoff runs.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/physical-handoff-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(players, null, 2));
  console.log('Missing models:', missing.length, 'unsupported handoffs:', unsupported.length);
}

if (require.main === module) main();
module.exports = { handoffOf, matchesState };
