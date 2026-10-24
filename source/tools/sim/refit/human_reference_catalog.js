'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { campaignsOf } = require('./attempt_campaigns.js');
const { normalizeAttempts } = require('./attempt_count_labels.js');
const { boardOf, PIDS } = require('./mimic_games.js');
const { encodeGame } = require('./personal_game_io.js');
const { designed, classic } = require('./boards.js');
const root = path.resolve(__dirname, '../../..');

function firstClearCampaigns(raw) {
  const first = new Map();
  for (const campaign of campaignsOf(raw, { minimumVersion: 0, minimumLevel: 1 })) if (campaign.events.at(-1)?.r === 'win' && !first.has(campaign.lv)) first.set(campaign.lv, campaign);
  const recorded = [...new Set(Object.values(raw).filter(event => event.k === 'end' && event.r === 'win'
    && event.m !== 'd' && !event.tk && event.lv > 0).map(event => event.lv))].sort((left, right) => left - right);
  return recorded.map(level => ({ level, campaign: first.get(level) ?? null }));
}

function initialBoard(chunks) {
  if (!chunks || typeof chunks !== 'object') return null;
  const first = Object.values(chunks).find(chunk => chunk?.seq === 0 && chunk.data);
  if (!first) return null;
  const init = JSON.parse(first.data).init;
  if (!init || init.partial || init.track || !init.state || !/^L\d+$/.test(init.key)) return null;
  const state = init.state;
  if (!state.a?.every(alive => alive === 1) || state.tr?.length !== 0 || state.m !== 0 || state.p >= 0) return null;
  return { level: +init.key.slice(1), at: init.at, game: encodeGame(boardOf(init)) };
}

function reconstructLevel(version, level) {
  const original = designed(version, level);
  if (original) return { game: encodeGame(original), boardSource: 'versionTable', historicalBoardExact: true };
  const fixed = designed('1.55', level);
  if (fixed) return { game: encodeGame(fixed), boardSource: 'currentFixedDefinition', historicalBoardExact: false };
  return { game: encodeGame(classic(level, 1.5)), boardSource: 'currentClassicDefinitionAspect1.5', historicalBoardExact: false };
}

async function loadRecordedClears({ get, raw, cached, buildBoard = reconstructLevel, selectedLevels = null } = {}) {
  assert(selectedLevels === null || Array.isArray(selectedLevels) && selectedLevels.every(level => Number.isInteger(level) && level > 0));
  const database = fs.readFileSync(path.join(root, 'www/js/rules.js'), 'utf8').match(/const DB_URL\s*=\s*['"]([^'"]+)['"]/)[1];
  const fetchJson = get ?? (async resource => {
    let failure;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(database + resource + '.json', { signal: AbortSignal.timeout(15000) });
        assert(response.ok, 'Read-only Dennis catalog GET failed: ' + response.status);
        return await response.json();
      } catch (error) { failure = error; }
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
    }
    throw failure;
  });
  const events = raw ?? await fetchJson('/plays/' + PIDS.Dennisisdebeste);
  const replays = cached ?? JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/replays', PIDS.Dennisisdebeste + '.json')));
  const rows = [];
  for (const { level, campaign } of firstClearCampaigns(events)) {
    if (!campaign) { rows.push({ level, status: 'unsupportedOlderEventFormat' }); continue; }
    const end = campaign.events.at(-1), opening = campaign.opening;
    const labels = normalizeAttempts(campaign.firstCounter, end.at || 1, campaign.confirmedOpening);
    const metadata = { name: 'Dennisisdebeste', lv: level, start: campaign.start, version: (opening || campaign.events[0]).v, ...labels,
      assisted: campaign.events.some(event => event.ez || event.h || event.sh || event.rb) };
    if (selectedLevels && !selectedLevels.includes(level)) { rows.push({ ...metadata, status: 'notRequested' }); continue; }
    if (!campaign.confirmedOpening) { rows.push({ ...metadata, status: 'unconfirmedOpening' }); continue; }
    const chunks = opening?.aid ? replays[opening.aid] ?? await fetchJson('/replays/' + PIDS.Dennisisdebeste + '/' + encodeURIComponent(opening.aid)) : null;
    const initial = initialBoard(chunks);
    if (!initial || initial.level !== level || initial.at !== opening.at) {
      const rebuilt = buildBoard(metadata.version, level);
      rows.push({ ...metadata, status: rebuilt ? 'available' : 'missingExactOpeningBoard', ...rebuilt }); continue;
    }
    rows.push({ ...metadata, status: 'available', game: initial.game, openingAid: opening.aid,
      boardSource: 'recordedOpening', historicalBoardExact: true });
  }
  return { observedAt: new Date().toISOString(), rows,
    note: 'Every recorded natural-level first clear is accounted for. Dennis authorized comparison with his try counts without old recordings on2026-10-22. Prefer recorded openings, then original-version level tables, then current level definitions. Current classic boards use declared aspect1.5 and are not asserted identical to historical boards. Board provenance/exactness remains explicit; no claim that a different board reproduces the historical trial. Missing starts remain unresolved. Replay episode counters start at1. Raw decks stay trusted-environment-only. Read-only GETs; no large snapshots or traces written.' };
}

function labDevelopmentClears(input = JSON.parse(fs.readFileSync(path.join(root, 'analysis/lab-clears.json')))) {
  assert(Array.isArray(input.rows));
  const levels = new Set();
  const rows = input.rows.filter(entry => {
    assert.equal(entry.name, 'Dennisisdebeste');
    assert.equal(entry.lv, 10000 + entry.lab.id);
    assert.equal(entry.boardSource, 'levelLab');
    assert.equal(entry.historicalBoardExact, true);
    assert(Number.isInteger(entry.wonOn) && entry.wonOn > 0);
    assert(!levels.has(entry.lv), 'Duplicate lab board');
    levels.add(entry.lv);
    if (entry.lv === 10031) {
      assert.equal(entry.stackedRoles, true);
      return false;
    }
    assert.equal(entry.stackedRoles, false, 'Only lab10031 has an authorized exclusion');
    return true;
  });
  assert.equal(rows.length, 15, 'Keep every authorized lab board in the development gate');
  assert(levels.has(10031), 'Retain the excluded mixed-role board in the source data');
  return structuredClone(rows);
}

async function loadDevelopmentClears(options = {}) {
  const recorded = await loadRecordedClears(options);
  const selected = options.selectedLevels;
  const lab = labDevelopmentClears().map(entry => selected && !selected.includes(entry.lv)
    ? { ...entry, game: undefined, status: 'notRequested' } : { ...entry, status: 'available' });
  return { ...recorded, rows: [...recorded.rows, ...lab],
    excluded: [{ level: 10031, reason: 'User-excluded lab board with overlapping roles' }] };
}

async function main() {
  const catalog = await loadRecordedClears();
  console.log(JSON.stringify({ observedAt: catalog.observedAt, total: catalog.rows.length,
    available: catalog.rows.filter(row => row.status === 'available').length,
    boardSources: Object.fromEntries([...new Set(catalog.rows.map(row => row.boardSource))].map(source => [source, catalog.rows.filter(row => row.boardSource === source).length])),
    unresolved: catalog.rows.filter(row => row.status !== 'available').map(({ game, ...row }) => row),
    newest: Math.max(...catalog.rows.map(row => row.lv ?? row.level)) }));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { firstClearCampaigns, initialBoard, reconstructLevel, loadRecordedClears, labDevelopmentClears, loadDevelopmentClears };
