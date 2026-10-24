'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { decodeGame } = require('./personal_game_io.js');
const { playHumanCampaign } = require('./human_reference_campaign.js');
const { loadRecordedClears, loadDevelopmentClears } = require('./human_reference_catalog.js');

function passes(dennis, bot) {
  assert(Number.isInteger(dennis) && dennis > 0);
  return Number.isInteger(bot) && bot > 0 && (dennis === 1 ? bot === 1 : bot < dennis);
}

function publicContextFor(entry) {
  if (entry.boardSource === 'levelLab') return { boardMode: 'lab' };
  return ['recordedOpening', 'versionTable', 'currentClassicDefinitionAspect1.5', 'currentFixedDefinition'].includes(entry.boardSource)
    ? { boardMode: 'standard' } : {};
}

function screen(entries, planning = {}, emit = row => console.log(JSON.stringify(row))) {
  const rows = [];
  for (const entry of entries) {
    assert.equal(entry.name, 'Dennisisdebeste');
    assert(Number.isInteger(entry.wonOn) && entry.wonOn > 0);
    const attemptLimit = Math.max(1, entry.wonOn - 1);
    const publicContext = publicContextFor(entry);
    const result = playHumanCampaign(decodeGame(entry.game), { planning, publicContext, maximumAttempts: attemptLimit });
    const row = { level: entry.lv, dennis: entry.wonOn, bot: result.wonOn, pass: passes(entry.wonOn, result.wonOn),
      boardSource: entry.boardSource ?? entry.source ?? 'providedDevelopmentBoard', historicalBoardExact: entry.historicalBoardExact ?? null,
      attemptLimit,
      slowestMs: Math.round(result.slowestMs * 10) / 10, status: result.status, verifiedTaps: result.verifiedTaps,
      decisionCount: result.decisionCount, meanDecisionMs: Math.round(result.meanDecisionMs * 10) / 10,
      dominanceStops: result.dominanceStops,
      ...(result.clockRetry ? { clockRetry: result.clockRetry } : {}),
      attempts: result.attempts.map(attempt => ({ why: attempt.why, taps: attempt.taps, left: attempt.left,
        ...(attempt.learnedRisk !== undefined ? { learnedRisk: attempt.learnedRisk } : {}) })) };
    rows.push(row); emit(row);
  }
  return rows;
}

function selectEntries(catalog, selected = null) {
  assert(Array.isArray(catalog));
  assert(selected === null || Array.isArray(selected) && selected.every(level => Number.isInteger(level) && level > 0)
    && new Set(selected).size === selected.length);
  const entries = catalog.filter(entry => entry.name === 'Dennisisdebeste' && (!selected || selected.includes(entry.lv)));
  assert(entries.length > 0);
  assert.equal(new Set(entries.map(entry => entry.lv)).size, entries.length, 'Duplicate Dennis development levels');
  assert(!selected || selected.every(level => entries.some(entry => entry.lv === level)), 'A requested Dennis level is missing from the catalog');
  assert(entries.every(entry => entry.game && Number.isInteger(entry.wonOn) && entry.wonOn > 0),
    'Keep unavailable boards/labels unresolved; do not silently exclude them from the catalog gate');
  return entries;
}

async function main(filename, levels, settings, reportFile) {
  const selected = levels ? levels.split(',').map(Number) : null;
  const input = filename === '--development' ? await loadDevelopmentClears({ selectedLevels: selected })
    : filename === '--live' ? await loadRecordedClears({ selectedLevels: selected }) : JSON.parse(fs.readFileSync(filename));
  const catalog = input.rows ?? input.entries ?? input.baseline?.input.entries;
  const entries = selectEntries(catalog, selected);
  const sourceRoot = path.resolve(__dirname, '../../..');
  const files = Object.keys(require.cache).filter(filename => filename.startsWith(sourceRoot + path.sep)).sort();
  const fingerprint = () => crypto.createHash('sha256').update(files.map(filename => path.relative(sourceRoot, filename).replace(/\\/g, '/') + '\0'
    + crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex')).join('\n')).digest('hex');
  const sourceHash = fingerprint(), planning = settings ? JSON.parse(settings) : {};
  const inputHash = crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
  console.log(JSON.stringify({ startedAt: new Date().toISOString(), cases: entries.length, sourceHash, inputHash, planning }));
  const rows = screen(entries, planning);
  const unchanged = fingerprint() === sourceHash;
  const summary = { cases: rows.length, passed: rows.filter(row => row.pass).length, sourceHash, inputHash, sourceUnchanged: unchanged,
    slowestMs: Math.max(...rows.map(row => row.slowestMs)), completeGate: false,
    meanDecisionMs: Math.round(rows.reduce((sum, row) => sum + row.meanDecisionMs * row.decisionCount, 0)
      / Math.max(1, rows.reduce((sum, row) => sum + row.decisionCount, 0)) * 10) / 10,
    dominanceStops: rows.reduce((sum, row) => sum + row.dominanceStops, 0),
    ...(planning.clockRetryLearning ? { clockRetry: {
      decisionsAudited: rows.reduce((sum, row) => sum + row.clockRetry.decisionsAudited, 0),
      decisionsUsingAlternative: rows.reduce((sum, row) => sum + row.clockRetry.decisionsUsingAlternative, 0) } } : {}),
    developmentGate: filename === '--development' && !selected && unchanged && rows.every(row => row.pass && row.slowestMs < 2000),
    ...(input.excluded ? { excluded: input.excluded } : {}),
    byBoardSource: Object.fromEntries([...new Set(rows.map(row => row.boardSource))].map(source => [source,
      { cases: rows.filter(row => row.boardSource === source).length, passed: rows.filter(row => row.boardSource === source && row.pass).length }])),
    note: 'Development results, not unseen20 validation. Human try labels enter comparison only, never the controller. Board provenance remains explicit; current definitions need not be identical to historical deals.' };
  if (reportFile) {
    const table = ['# Human-information reference development run', '', 'Planning: `' + JSON.stringify(planning) + '`',
      'Source: `' + sourceHash + '`; unchanged: ' + unchanged + '.', 'Input: `' + inputHash + '`.', '',
      '| Level | Dennis tries | Bot tries | Pass | Board source | Mean ms | Slowest ms |', '|---:|---:|---:|:---:|---|---:|---:|',
      ...rows.map(row => `| ${row.level} | ${row.dennis} | ${row.bot ?? '>' + row.attemptLimit} | ${row.pass ? 'yes' : 'no'} | ${row.boardSource} | ${row.meanDecisionMs} | ${row.slowestMs} |`),
      '', `Passed ${summary.passed}/${summary.cases}; mean ${summary.meanDecisionMs}ms; slowest ${summary.slowestMs}ms; dominance stops ${summary.dominanceStops}.`,
      ...(summary.clockRetry ? [`Clock retry audit: ${summary.clockRetry.decisionsAudited} decisions with an alternative-search audit; ${summary.clockRetry.decisionsUsingAlternative} decisions using an adopted alternative (including retained steps).`] : []),
      'Historical board identity is not claimed for current-definition substitutes. The unseen20-level gate has not been run.', ''];
    fs.writeFileSync(path.resolve(reportFile), table.join('\n'), { flag: 'wx' });
  }
  console.log(JSON.stringify(summary));
}

if (require.main === module) main(...process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { screen, passes, selectEntries, publicContextFor };
