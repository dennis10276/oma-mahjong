'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const Hard = require('../../../www/hard.js');
const { recordings, reconstruct } = require('./personal_prefix_data.js');
const { pinnedRead, actionPinned } = require('./personal_context_runtime_audit.js');
const { PIDS } = require('./mimic_games.js');
const root = path.resolve(__dirname, '../../..');

function visibleButUnrecorded(game, alive, seen) {
  assert.equal(alive.length, game.tiles.length);
  assert.equal(seen.length, game.tiles.length);
  assert.equal(game.down.length, game.tiles.length);
  const cover = Hard.coverOf(game.tiles, game.nb);
  return Array.from(alive).flatMap((value, index) => value && !game.down[index] && !seen[index]
    && !cover[index].some(above => alive[above]) ? [index] : []);
}

function main() {
  const repair = process.argv[2] === 'repair';
  if (process.argv[2] && !repair) throw new Error('Use explicit repair comparison or the read-only omission audit');
  const beforePinned = path.join(root, 'analysis/archive/personal-bots/experiments/personal-episode-full-2026-10-18T06-19-34-227Z');
  let previousHard = null;
  if (repair) {
    const manifest = JSON.parse(fs.readFileSync(path.join(beforePinned, 'manifest.json')));
    for (const file of ['www/hard.js', 'www/layouts.js']) assert.equal(
      crypto.createHash('sha256').update(fs.readFileSync(path.join(beforePinned, file))).digest('hex'), manifest.files[file]);
    previousHard = require(path.join(beforePinned, 'www/hard.js'));
  }
  const dataFile = 'analysis/archive/personal-bots/policy-value-prefix-data.json';
  const data = pinnedRead(actionPinned, dataFile), recorded = recordings();
  const fingerprintFiles = [...new Set([...data.fingerprintFiles,
    'tools/sim/refit/personal_terminal_observation_audit.js', 'tools/sim/refit/personal_context_runtime_audit.js',
    'www/js/board.js', ...Object.values(PIDS).map(pid => 'analysis/archive/replays/' + pid + '.json'),
    ...(repair ? ['manifest.json', 'www/hard.js', 'www/layouts.js'].map(file => path.relative(root, path.join(beforePinned, file)).replace(/\\/g, '/')) : [])])];
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of fingerprintFiles) digest.update(file).update(fs.readFileSync(path.join(root, file)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf(), players = {};
  let controlPrefixes = 0, controlDecisions = 0;
  for (const [name, games] of Object.entries(data.players)) {
    const affected = [], byTerminal = {};
    for (const original of games) {
      const game = recorded[name].find(candidate => candidate.aid === original.aid);
      assert(game);
      const rebuilt = reconstruct(game, false, null, true);
      assert(rebuilt);
      assert.deepEqual(rebuilt.prefix, original);
      const final = rebuilt.state.physicalLog.at(-1), alive = final?.alive || game.g.faces.map(() => 1);
      const missing = visibleButUnrecorded(game.g, alive, rebuilt.result.seen);
      let priorMissing = missing;
      if (repair) {
        const previousState = { ...rebuilt.state, log: [], policyLog: [], physicalLog: [] };
        const previousResult = previousHard.play(previousState, { ...previousHard.P, physicalFlips: true,
          physicalSingleStep: false, peek: 0, end: 0, plan: 0, forceMatches: false }, 1);
        assert.deepEqual(rebuilt.state.physicalLog, previousState.physicalLog);
        assert.deepEqual(rebuilt.state.policyLog, previousState.policyLog);
        const { seen: previousSeen, ...previousRest } = previousResult;
        const { seen: currentSeen, ...currentRest } = rebuilt.result;
        assert.deepEqual(currentRest, previousRest);
        priorMissing = visibleButUnrecorded(game.g, alive, previousSeen);
        assert.equal(missing.length, 0);
        const added = new Set(priorMissing);
        for (let index = 0; index < currentSeen.length; index++) assert.equal(currentSeen[index],
          added.has(index) ? rebuilt.result.moves + 1 : previousSeen[index]);
        controlPrefixes++; controlDecisions += original.decisions.length;
      }
      if (!priorMissing.length) continue;
      const terminal = rebuilt.result.why + '/' + original.stopReason;
      byTerminal[terminal] = (byTerminal[terminal] || 0) + 1;
      affected.push({ aid: game.aid, level: game.lv, initialNewLevel: game.initialNewLevel, ending: game.ending,
        stopReason: original.stopReason, why: rebuilt.result.why, missing: priorMissing,
        ...(repair ? { remainingMissing: missing } : {}),
        msAfterFinalAction: game.elapsed - (game.actions.at(-1)?.time || 0) });
    }
    players[name] = { prefixes: games.length, affected: affected.length,
      missingVisiblePictures: affected.reduce((total, row) => total + row.missing.length, 0),
      initialNewAffected: affected.filter(row => row.initialNewLevel).length, byTerminal, rows: affected };
  }
  assert.equal(fingerprintOf(), fingerprint);
  if (repair) { assert.equal(controlPrefixes, 398); assert.equal(controlDecisions, 33543); }
  const report = { made: new Date().toISOString(), evidence: repair ? 'terminal-visible-memory-repair-parity' : 'terminal-visible-memory-diagnostic', targetMet: false,
    ...(repair ? { controlPrefixes, controlDecisions, repairedPictures: Object.values(players).reduce((total, row) => total + row.missingVisiblePictures, 0),
      remainingMissingPictures: 0, behaviorChanged: 'terminal exposed face-up observation only; future simulated retries may differ' } : {}),
    fingerprint, fingerprintFiles, immutablePrefixParent: path.relative(root, actionPinned).replace(/\\/g, '/'),
    immutablePrefixSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(actionPinned, dataFile))).digest('hex'),
    players, note: 'Read-only reconstruction of the unchanged 398-prefix cohort. Only currently exposed face-up tiles count; '
      + 'neither unseen face-down pictures, covered pictures, nor blocked-click xray are credited. '
      + 'The current UI exposes the board before delayed failure modals; visibility is an opportunity, not proof of human recall. '
      + 'Interrupted and assisted prefixes remain labelled, not converted into natural completed failures. '
      + (repair ? 'All original physical frames, action features and non-memory results remain exact. Only real final face-up exposure is added; '
        + 'future own simulated retries may change. Historical incoming-memory training features have not been regenerated; do not claim carry models were refitted. '
        : 'No bot behavior is changed. ') + 'No human winning-count label, forecast, or accuracy measurement is changed.' };
  const output = path.join(root, 'analysis/personal-bots/personal-terminal-' + (repair ? 'memory' : 'observation') + '-audit.json');
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(Object.fromEntries(Object.entries(players).map(([name, row]) => [name,
    { prefixes: row.prefixes, affected: row.affected, missingVisiblePictures: row.missingVisiblePictures,
      initialNewAffected: row.initialNewAffected, byTerminal: row.byTerminal }])), null, 2));
}

if (require.main === module) main();
module.exports = { visibleButUnrecorded };
