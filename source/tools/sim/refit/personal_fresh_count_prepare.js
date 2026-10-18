'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { PIDS, boardOf } = require('./mimic_games.js');
const { boardId, CONFIG } = require('./personal_model.js');
const { progressionTargets } = require('./progression_targets.js');
const { designed } = require('./boards.js');
const { encodeGame } = require('./personal_game_io.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const fits = path.join(archive, 'experiments/personal-fresh-own-fits-2026-10-18T15-59-12-900Z');
const parent = path.join(archive, 'experiments/personal-outcome-styles-scored-2026-10-18T15-48-20-154Z');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const sourceHashes = {};
  const readPinned = (folder, filename) => {
    assert(!path.isAbsolute(filename) && !filename.split('/').includes('..'));
    const manifestFile = path.join(folder, 'manifest.json'), manifestBytes = fs.readFileSync(manifestFile);
    const manifest = JSON.parse(manifestBytes), local = Object.hasOwn(manifest.files, filename);
    const source = path.join(local ? folder : root, filename), expected = local ? manifest.files[filename] : manifest.externalPinnedDependencies?.[filename];
    assert(expected && (local || filename.includes('/experiments/') || filename.includes('/runs/')));
    const bytes = fs.readFileSync(source); assert.equal(hash(bytes), expected);
    sourceHashes[path.relative(root, manifestFile).replace(/\\/g, '/')] = hash(manifestBytes);
    sourceHashes[path.relative(root, source).replace(/\\/g, '/')] = expected;
    return bytes;
  };
  const schedule = JSON.parse(readPinned(fits, 'analysis/archive/personal-bots/personal-fresh-count-requests.json'));
  const futureModels = JSON.parse(readPinned(fits, 'analysis/archive/personal-bots/personal-fresh-own-models.json'));
  const recentModels = JSON.parse(readPinned(fits, 'analysis/archive/personal-bots/personal-fresh-recent-models.json'));
  const runtime = JSON.parse(readPinned(fits, 'analysis/personal-bots/personal-fresh-own-runtime-audit.json'));
  assert.equal(runtime.prefixes, 445); assert.equal(runtime.probabilityDecisions, 78536);
  for (const bank of [futureModels, recentModels]) {
    for (const [name, expected] of Object.entries(bank.sourceHashes)) assert.equal(hash(readPinned(fits, 'tools/sim/refit/' + name)), expected);
    for (const [name, expected] of Object.entries(bank.inputHashes)) assert.equal(hash(readPinned(fits, name)), expected);
  }
  const replays = Object.fromEntries(Object.entries(PIDS).map(([name, pid]) => [name,
    JSON.parse(readPinned(fits, 'analysis/archive/replays/' + pid + '.json'))]));
  const recent = schedule.recent.map(row => {
    let game = null;
    for (const aid of row.excludedAids) {
      const chunks = replays[row.name][aid]; if (!chunks) continue;
      for (const chunk of Object.values(chunks)) if (chunk?.data) {
        const init = JSON.parse(chunk.data).init;
        if (init && !init.partial && !init.track && boardId(boardOf(init)) === row.board) { game = boardOf(init); break; }
      }
      if (game) break;
    }
    if (!game && row.source === 'table') game = designed(row.version, row.lv);
    assert(game && boardId(game) === row.board, 'Cannot restore the exact recent board: ' + row.name + '/' + row.lv);
    const selection = recentModels.selections.find(selection => selection.name === row.name && selection.start === row.start);
    assert(selection);
    return { ...row, modelId: selection.id, game: encodeGame(game) };
  });
  const liveArgument = process.argv[2]; assert(liveArgument, 'Supply a separate read-only live opening snapshot folder');
  const live = path.resolve(liveArgument), liveManifest = JSON.parse(fs.readFileSync(path.join(live, 'manifest.json')));
  assert(live.startsWith(archive + path.sep) && liveManifest.evidence === 'read-only-live-opening-check');
  const readLive = filename => {
    const bytes = fs.readFileSync(path.join(live, filename)); assert.equal(hash(bytes), liveManifest.files[filename]);
    sourceHashes[path.relative(root, path.join(live, filename)).replace(/\\/g, '/')] = hash(bytes);
    return JSON.parse(bytes);
  };
  const plays = readLive('plays.json'), scores = readLive('scores.json'), future = [], targets = {};
  sourceHashes[path.relative(root, path.join(live, 'manifest.json')).replace(/\\/g, '/')] = hash(fs.readFileSync(path.join(live, 'manifest.json')));
  const inputFrozenAt = Date.now();
  for (const [name, pid] of Object.entries(PIDS)) {
    const events = Object.values(plays[pid] || {}).filter(event => event.m !== 'd' && !event.tk);
    const actor = futureModels.models.find(actor => actor.name === name);
    assert(actor && actor.inputObservedThrough < futureModels.requestTime && Date.parse(futureModels.made) < inputFrozenAt);
    const target = progressionTargets(events, scores[pid], 24); targets[name] = target;
    for (const lv of target.levels) {
      if (events.some(event => event.k === 'start' && event.lv === lv)) continue;
      const game = designed(target.version, lv); assert(game);
      future.push({ name, lv, version: target.version, board: boardId(game), firstAttempt: 1, firstClear: true,
        priorCounter: 0, start: inputFrozenAt, eligibleAtPlanningOnly: true, modelId: actor.id, game: encodeGame(game) });
    }
  }
  const parentDataFile = 'analysis/archive/personal-bots/physical-outcome-styles-count-data.json';
  const parentData = JSON.parse(readPinned(parent, parentDataFile));
  for (const filename of Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))) {
    sourceHashes[path.relative(root, filename).replace(/\\/g, '/')] = hash(fs.readFileSync(filename));
  }
  for (const filename of fs.readdirSync(path.join(__dirname, 'tables')).filter(name => /^(levels|hard|early)-/.test(name))) {
    const relative = 'tools/sim/refit/tables/' + filename; sourceHashes[relative] = hash(fs.readFileSync(path.join(root, relative)));
  }
  assert.equal(recent.length, 29); assert.equal(parentData.rows.length, 276); assert.equal(parentData.comparisonEpisodes.length, 80);
  const output = { made: new Date().toISOString(), evidence: 'fresh-count-input-not-numeric-forecasts', targetMet: false,
    inputFrozenAt, targets, recent, future, restoredRecentBoardControls: recent.length,
    profiles: { ownOutcomeBase0: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 0 },
      ownOutcomeStyles0: { scope: 'ownAll', memory: CONFIG.memory, learnFromLoss: true, physicalPlan: 0 } },
    referenceProfile: 'ownOutcomeBase0', parent: path.relative(root, parent).replace(/\\/g, '/'),
    modelSnapshot: path.relative(root, fits).replace(/\\/g, '/'), futureModelReadyAt: futureModels.made,
    liveSnapshot: path.relative(root, live).replace(/\\/g, '/'), comparisonEpisodes: parentData.comparisonEpisodes, sourceHashes,
    note: 'Restored29 exact recent boards from immutable recorded/table sources; lossy old JSON game objects are never guessed. '
      + 'Fresh future actors retain their actual pre-tail-correction fitting source. Current count-head code is separately versioned. '
      + 'Future board eligibility is planning-only, not a numeric pre-start freeze; pending68 remains a recent censored case.' };
  fs.writeFileSync(path.join(archive, 'personal-fresh-count-input.json'), JSON.stringify(output));
  console.log(JSON.stringify({ recent: recent.length, future: future.length, restoredRecentBoardControls: recent.length, targets }, null, 2));
}

if (require.main === module) main();
