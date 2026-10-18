'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { recordings, reconstruct } = require('./personal_prefix_data.js');
const { retainedInput } = require('./personal_known_plan_data.js');
const { pinnedRead } = require('./personal_context_runtime_audit.js');
const { advance } = require('./known_tray_plan.js');
const { PIDS } = require('./mimic_games.js');
const root = path.resolve(__dirname, '../../..');
const snapshot = path.join(root, 'analysis/archive/personal-bots/experiments/personal-clock-strategy-actions-2026-10-18T11-30-12-648Z');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function rowOf(game, state, actions, decision) {
  const selected = actions[decision.k], moved = advance(game, state, selected.index);
  const knownPair = index => {
    if (state.pictures[index] === null) return false;
    const step = advance(game, state, index);
    return !step.uncertain && (step.removed > 1 || step.state.tray.length < state.tray.length);
  };
  const pair = actions.map(action => knownPair(action.index));
  const pairBeforeClock = actions.map((action, index) => {
    if (!pair[index]) return false;
    const step = advance(game, state, action.index);
    return !step.uncertain && !!step.state.alive[game.clock.i];
  });
  const directClock = !moved.uncertain && !moved.state.alive[game.clock.i];
  return { tray: state.tray.length, clockRemaining: game.clock.n - state.moves,
    clockPictureUnknown: state.pictures[game.clock.i] === null,
    anyExitTwo: decision.knownPlan.some(parts => parts[1] > 0),
    anyExitThreeMatch: decision.knownPlan.some(parts => parts[2] > 0),
    knownPairAvailable: pair.some(Boolean),
    pairWithExitTwoAvailable: pair.some((value, index) => value && decision.knownPlan[index][1] > 0),
    pairBeforeClockAvailable: pairBeforeClock.some(Boolean),
    pairBeforeClockWithExitTwoAvailable: pairBeforeClock.some((value, index) => value && decision.knownPlan[index][1] > 0),
    selectedKnownPair: pair[decision.k], selectedDirectClock: directClock,
    selectedPairBeforeClock: pairBeforeClock[decision.k],
    selectedExitTwo: decision.knownPlan[decision.k][1] > 0,
    selectedUncertain: !!moved.uncertain,
    selectedDig: decision.knownPlan[decision.k][7] > 0 || decision.knownPlan[decision.k][8] > 0 };
}

function main() {
  const dataFile = 'analysis/archive/personal-bots/policy-clock-strategy-prefix-data.json';
  const data = pinnedRead(snapshot, dataFile), recorded = recordings();
  const sourceFiles = [...new Set([...Object.keys(require.cache).filter(file => file.startsWith(root + path.sep))
    .map(file => path.relative(root, file).replace(/\\/g, '/')).sort(), 'analysis/archive/realdata/plays.json',
    ...Object.values(PIDS).map(pid => 'analysis/archive/replays/' + pid + '.json'),
    ...['manifest.json', dataFile].map(file => path.relative(root, path.join(snapshot, file)).replace(/\\/g, '/'))])];
  const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, hash(fs.readFileSync(path.join(root, file)))]));
  const rows = [];
  let prefixes = 0, callbacks = 0;
  for (const [name, games] of Object.entries(data.players)) for (const original of games) {
    if (!original.decisions.some(decision => decision.knownPlan.some(parts => parts.some(value => value !== 0)))) continue;
    const game = recorded[name].find(game => game.aid === original.aid), control = reconstruct(game, false, null, true);
    assert(control);
    let cursor = 0;
    const planned = reconstruct(retainedInput(game, control), false, null, true, (publicGame, state, actions) => {
      const decision = original.decisions[cursor++];
      assert(decision && decision.knownPlan.length === actions.length);
      if (publicGame.clock && state.alive[publicGame.clock.i]) rows.push({ name, aid: original.aid, lv: original.lv,
        initialNewLevel: !!original.initialNewLevel, choice: cursor - 1, ...rowOf(publicGame, state, actions, decision) });
      callbacks++;
      return { features: decision.knownPlan.map(parts => parts.slice()), nodes: 0, boundaries: 0 };
    });
    assert(planned); assert.deepEqual(planned.prefix, original);
    assert.deepEqual(planned.state.physicalLog, control.state.physicalLog);
    assert.deepEqual(planned.result, control.result);
    assert.equal(cursor, original.decisions.length); prefixes++;
  }
  assert.equal(rows.length, 1111);
  const summarize = samples => ({ states: samples.length, clockPictureUnknown: samples.filter(row => row.clockPictureUnknown).length,
    exitTwoSupport: samples.filter(row => row.anyExitTwo).length, knownPairAvailable: samples.filter(row => row.knownPairAvailable).length,
    pairWithExitTwoAvailable: samples.filter(row => row.pairWithExitTwoAvailable).length,
    pairBeforeClockAvailable: samples.filter(row => row.pairBeforeClockAvailable).length,
    pairBeforeClockWithExitTwoAvailable: samples.filter(row => row.pairBeforeClockWithExitTwoAvailable).length,
    selectedPair: samples.filter(row => row.selectedKnownPair).length,
    selectedPairBeforeClock: samples.filter(row => row.selectedPairBeforeClock).length,
    selectedPairWhenPairExitTwoAvailable: samples.filter(row => row.pairWithExitTwoAvailable && row.selectedKnownPair).length,
    selectedDirectClock: samples.filter(row => row.selectedDirectClock).length, selectedDig: samples.filter(row => row.selectedDig).length,
    selectedUncertain: samples.filter(row => row.selectedUncertain).length });
  const players = Object.fromEntries(Object.keys(PIDS).map(name => {
    const own = rows.filter(row => row.name === name);
    return [name, { all: summarize(own), crowded: summarize(own.filter(row => row.tray === 3)),
      initialNew: summarize(own.filter(row => row.initialNewLevel)),
      initialNewCrowded: summarize(own.filter(row => row.initialNewLevel && row.tray === 3)) }];
  }));
  for (const [file, expected] of Object.entries(sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, file))), expected);
  const report = { made: new Date().toISOString(), evidence: 'observed-public-clock-crowding-diagnostic', targetMet: false,
    sourceHashes, prefixes, callbacks, clockStates: rows.length, players, rows,
    note: 'All1111 clock-active natural-prefix states retained; no human target sequence is supplied to an autonomous bot. '
      + 'Reconstruction preserves the immutable12-feature action/frame/result controls. Previously validated frozen features are replayed only for this diagnostic. '
      + 'Unknown pictures remain null. Pair/clock support means found by bounded public planning, not optimal or proven absent when not found. '
      + 'This descriptive audit diagnoses feature coverage and individual crowding behavior, not winning-count accuracy or future80% success.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-clock-crowding-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ prefixes, callbacks, players }, null, 2));
}

if (require.main === module) main();
module.exports = { rowOf };
