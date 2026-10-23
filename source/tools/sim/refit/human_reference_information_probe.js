'use strict';
const assert = require('assert/strict');
const { loadRecordedClears } = require('./human_reference_catalog.js');
const { decodeGame } = require('./personal_game_io.js');
const { playHumanCampaign } = require('./human_reference_campaign.js');

async function main(levelText, attemptText, tapsText, settings = '{}') {
  const level = Number(levelText), attempt = Number(attemptText), physicalTaps = Number(tapsText);
  assert(Number.isInteger(level) && level > 0 && Number.isInteger(attempt) && attempt > 0);
  assert(Number.isInteger(physicalTaps) && physicalTaps >= 0);
  const catalog = await loadRecordedClears({ selectedLevels: [level] });
  const entry = catalog.rows.find(row => row.lv === level);
  assert(entry?.game);
  const planning = JSON.parse(settings);
  const result = playHumanCampaign(decodeGame(entry.game), { planning, maximumAttempts: attempt,
    captureDecisions: true, captureInformation: true });
  const choices = result.attempts[attempt - 1]?.decisions.filter(choice => choice.state.physicalTaps === physicalTaps);
  assert(choices?.length, 'Requested actual decision was not reached');
  console.log(JSON.stringify({ diagnostic: true, level, attempt, physicalTaps, planning,
    choices: choices.map(choice => ({ index: choice.index, accepted: choice.accepted, tray: choice.state.tray,
      openPeek: choice.state.openPeek, plan: choice.plan, informationAudit: choice.informationAudit })),
    note: 'Actual public observation plus known-only prefix audit. Readable fields are reported only as future visibility, never their actual future values. All accepted actions independently replay in production. Diagnostic capture is not a canonical timing benchmark.' }));
}

if (require.main === module) main(...process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
