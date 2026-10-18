'use strict';
const fs = require('fs'), path = require('path');
const Hard = require('../../../www/hard.js');
const { NAMES } = require('./personal_model.js');
const { gamesOf } = require('./mimic_games.js');
const { kindsAt } = require('./kinds.js');
const { DEFAULT_KINDS } = require('./personal_policy_prior.js');
const out = { features: Hard.POLICY_FEAT, kindContextFeatures: Hard.KIND_CONTEXT, goalFeatures: Hard.GOAL_FEAT,
  base: [...Hard.weightsOf({ ...Hard.persona('strong'), temp: 2 }), ...new Array(Hard.POLICY_FEAT.length - Hard.FEAT.length).fill(0)], players: {}, kindBaselines: {} };
for (const name of NAMES) {
  out.players[name] = gamesOf(name).map(game => {
    const state = { ...game.g, follow: game.take, log: [], policyLog: [] };
    Hard.play(state, Hard.P, 1);
    for (const decision of state.policyLog) if (decision.F.some(feature => feature.length !== out.features.length || feature.some(value => !Number.isFinite(value)))) throw new Error('Invalid personal policy features');
    for (const decision of state.policyLog) if (decision.goals.length !== decision.F.length || decision.goals.some(feature => feature.length !== out.goalFeatures.length || feature.some(value => !Number.isFinite(value)))) throw new Error('Invalid visible goal features');
    return { t: game.t, availableAt: game.availableAt, lv: game.lv, at: game.at, won: game.won, aid: game.aid, decisions: state.policyLog };
  });
  console.log(name + ': ' + out.players[name].reduce((sum, game) => sum + game.decisions.length, 0) + ' decisions with position and known-picture features');
}
for (const name of NAMES) {
  const games = out.players[name], cut = games[Math.max(1, Math.floor(games.length * 0.75))].t;
  out.kindBaselines[name] = { cut, tables: Object.fromEntries(NAMES.map(person => [person, { ...DEFAULT_KINDS, ...kindsAt(person, cut) }])) };
}
fs.writeFileSync(path.resolve(__dirname, '../../../analysis/archive/personal-bots/policy-data.json'), JSON.stringify(out));
