'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const { decodeGame } = require('./personal_game_io.js');
const { playHumanCampaign } = require('./human_reference_campaign.js');

function passes(dennis, bot) {
  assert(Number.isInteger(dennis) && dennis > 0);
  return Number.isInteger(bot) && bot > 0 && (dennis === 1 ? bot === 1 : bot < dennis);
}

function screen(entries, planning = {}, emit = row => console.log(JSON.stringify(row))) {
  const rows = [];
  for (const entry of entries) {
    assert.equal(entry.name, 'Dennisisdebeste');
    assert(Number.isInteger(entry.wonOn) && entry.wonOn > 0);
    const result = playHumanCampaign(decodeGame(entry.game), { planning });
    const row = { level: entry.lv, dennis: entry.wonOn, bot: result.wonOn, pass: passes(entry.wonOn, result.wonOn),
      slowestMs: Math.round(result.slowestMs * 10) / 10, status: result.status, verifiedTaps: result.verifiedTaps,
      attempts: result.attempts.map(attempt => ({ why: attempt.why, taps: attempt.taps, left: attempt.left })) };
    rows.push(row); emit(row);
  }
  return rows;
}

function main(filename, levels, settings) {
  const input = JSON.parse(fs.readFileSync(filename)), catalog = input.entries ?? input.baseline?.input.entries;
  assert(Array.isArray(catalog));
  const selected = levels ? levels.split(',').map(Number) : null;
  const entries = catalog.filter(entry => entry.name === 'Dennisisdebeste' && (!selected || selected.includes(entry.lv)));
  assert(entries.length > 0);
  const rows = screen(entries, settings ? JSON.parse(settings) : {});
  console.log(JSON.stringify({ cases: rows.length, passed: rows.filter(row => row.pass).length,
    slowestMs: Math.max(...rows.map(row => row.slowestMs)), completeGate: false,
    note: 'Selected development cases, not the complete recorded-clear gate or unseen20 validation. Human try labels enter comparison only, never the controller.' }));
}

if (require.main === module) main(...process.argv.slice(2));
module.exports = { screen, passes };
