'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const Hard = require('../../../www/hard.js');
const { PIDS, boardOf } = require('./mimic_games.js');
const { followThroughSamples } = require('./personal_followthrough.js');
const { pairFollowThroughSamples } = require('./personal_pair_followthrough.js');
const { retryMemory } = require('./personal_retry_memory.js');
const { trayGoalSamples } = require('./personal_tray_goal.js');
const { campaignsOf } = require('./attempt_campaigns.js');
const { boardId } = require('./personal_model.js');
const root = path.resolve(__dirname, '../../..');
const STOPS = new Set(['hint', 'shuffle', 'rescue', 'nudge', 'auto', 'truncated', 'help', 'clock-help']);

const isNewInitial = (events, prefix) => prefix.at === 1 && !events.some(event => event.k === 'end' && event.r === 'win'
  && event.m !== 'd' && !event.tk && event.lv >= prefix.lv && event.t < prefix.t);

function prefixOf(chunks) {
  const rows = Object.values(chunks).filter(row => row?.data).sort((left, right) => left.seq - right.seq);
  if (!rows.length || rows.some(row => !Number.isInteger(row.seq) || row.seq < 0 || !Number.isFinite(row.t) || row.t <= 0)) return null;
  const contiguous = [];
  let expected = 0, integrityStop = null;
  for (const row of rows) {
    if (row.seq < expected) {
      if (row.data !== contiguous.at(-1).data) { contiguous.pop(); integrityStop = 'conflictingChunk'; break; }
      continue;
    }
    if (row.seq !== expected) { integrityStop = 'chunkGap'; break; }
    contiguous.push(row); expected++;
  }
  if (!contiguous.length) return null;
  const parts = contiguous.map(row => JSON.parse(row.data)), init = parts[0].init;
  if (!init || init.partial || init.track || init.ez || !/^L\d+$/.test(init.key) || !init.state || parts.slice(1).some(part => part.init)) return null;
  const state = structuredClone(init.state), size = init.tiles?.length;
  if (!size || !['a', 'd', 'f'].every(field => state[field]?.length === size) || state.a.some(value => value !== 1)
    || state.tr?.length !== 0 || state.m !== 0 || state.p >= 0 || state.f.some(face => face >= 100 && face !== 101)) return null;
  const take = [], actionTimes = [], actions = [];
  let pending = null, pendingTime = 0, settled = false, ending = null, stopReason = integrityStop || 'incomplete', elapsed = 0, manualChoices = 0;
  for (const [ms, kind, data] of parts.flatMap(part => part.events || [])) {
    elapsed = Number.isFinite(ms) ? ms : elapsed;
    if (STOPS.has(kind)) { stopReason = kind; break; }
    if (kind === 'end') { ending = data?.r ?? null; stopReason = 'end'; break; }
    if (kind === 'tap') {
      if (data?.[1]) { stopReason = 'automaticTap'; break; }
      pending = Array.isArray(data) && Number.isInteger(data[0]) && data[0] >= 0 && data[0] < size && !data[2] ? data[0] : null;
      pendingTime = elapsed;
    }
    if (kind === 'pause' || kind === 'resume') settled = true;
    if (kind === 'ignored' || kind === 'miss') pending = null;
    if (kind !== 'state' || !data) continue;
    if (data.f || data.a?.some(([index, value]) => value && !state.a[index])) { stopReason = 'boardMutation'; break; }
    const removed = (data.a || []).filter(([index, value]) => !value && state.a[index]).map(([index]) => index);
    const flipped = data.p >= 0 && data.p !== state.p && !removed.includes(data.p);
    if ((removed.length && (pending === null || !removed.includes(pending))) || (flipped && pending !== data.p)) {
      stopReason = 'unattributedAction'; break;
    }
    if (flipped) { take.push(-data.p - 1); actionTimes.push(elapsed); manualChoices++; }
    if (removed.length) {
      take.push(pending, ...removed.filter(index => index !== pending));
      actionTimes.push(...removed.map(() => elapsed)); manualChoices++;
    }
    for (const field of ['a', 'd']) for (const [index, value] of data[field] || []) state[field][index] = value;
    for (const field of ['tr', 'p', 'm', 'ob', 'ck']) if (Object.hasOwn(data, field)) state[field] = data[field];
    if (flipped || removed.length) actions.push({ index: pending, kind: removed.length ? 'take' : 'flip',
      moves: state.m, alive: state.a.slice(), tray: state.tr.map(index => state.f[index]), openPeek: state.p, followEnd: take.length,
      time: pendingTime, settled });
    if (flipped || removed.length) settled = false;
    pending = null;
  }
  if (!take.length) return null;
  return { key: init.key, lv: +init.key.slice(1), at: init.at, t: contiguous[0].t,
    availableAt: Math.max(...rows.map(row => row.t)), stopReason, ending, complete: stopReason === 'end',
    elapsed, manualChoices, physicalRemovals: take.filter(index => index >= 0).length,
    take, actionTimes, actions, gold: init.gold || [], g: boardOf(init) };
}

function recordings() {
  const plays = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/realdata/plays.json'), 'utf8'));
  return Object.fromEntries(Object.entries(PIDS).map(([name, pid]) => {
    const events = Object.values(plays[pid] || {}), byAttempt = new Map();
    for (const event of events) if (event.aid) {
      if (!byAttempt.has(event.aid)) byAttempt.set(event.aid, []);
      byAttempt.get(event.aid).push(event);
    }
    const replays = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/replays/' + pid + '.json'), 'utf8'));
    return [name, Object.entries(replays).flatMap(([aid, chunks]) => {
      const recorded = byAttempt.get(aid) || [];
      if (recorded.some(event => event.m === 'd' || event.tk)) return [];
      const prefix = prefixOf(chunks);
      if (!prefix) return [];
      const opening = recorded.filter(event => event.k === 'start').sort((left, right) => left.t - right.t)[0];
      const t = opening?.t ?? prefix.t;
      return [{ ...prefix, aid, t, openingRecorded: !!opening, initialNewLevel: isNewInitial(events, { ...prefix, t }) }];
    }).sort((left, right) => left.t - right.t)];
  }));
}

function reconstruct({ g, take, actionTimes, actions, ...originalMetadata }, singleStep = false, memory = null, value = false, planning = null) {
  const metadata = { ...originalMetadata };
  const replay = (selectedTake, selectedActions) => {
    const state = { ...g, ...(memory ? { memory } : {}), ...(value ? { valueLog: true } : {}), follow: selectedTake, log: [], policyLog: [], logMatches: true, physicalLog: [],
      tapTimes: selectedActions.map(action => action.time), settleBefore: selectedActions.map(action => action.settled) };
    const result = Hard.play(state, { ...Hard.P, physicalFlips: true, physicalSingleStep: singleStep, peek: 0, end: 0, plan: 0, forceMatches: false,
      ...(planning ? { physicalTrayPlanning: planning } : {}) }, 1);
    return { state, result };
  };
  let { state, result } = replay(take, actions);
  const fields = ['index', 'kind', 'moves', 'alive', 'tray', 'openPeek'];
  const mismatch = actions.findIndex((expected, index) => !state.physicalLog[index] || fields.some(field => JSON.stringify(expected[field]) !== JSON.stringify(state.physicalLog[index][field])));
  if (mismatch >= 0) {
    if (!mismatch) return null;
    const retained = actions.slice(0, mismatch), selectedTake = take.slice(0, retained.at(-1).followEnd);
    metadata.physicsBoundary = { originalChoices: metadata.manualChoices, retainedChoices: mismatch,
      expected: { index: actions[mismatch].index, moves: actions[mismatch].moves, tray: actions[mismatch].tray },
      simulated: state.physicalLog[mismatch] ? { index: state.physicalLog[mismatch].index, moves: state.physicalLog[mismatch].moves, tray: state.physicalLog[mismatch].tray } : null };
    metadata.manualChoices = mismatch; metadata.physicalRemovals = selectedTake.filter(index => index >= 0).length;
    metadata.complete = false; metadata.ending = null; metadata.stopReason = 'historicalPhysicsBoundary';
    ({ state, result } = replay(selectedTake, retained));
    if (state.physicalLog.length !== retained.length || retained.some((expected, index) => fields.some(field => JSON.stringify(expected[field]) !== JSON.stringify(state.physicalLog[index][field])))) throw new Error('Retained physical prefix still differs');
  } else if (state.physicalLog.length !== actions.length) throw new Error('Unexpected physical actions: ' + metadata.aid);
  for (const decision of state.policyLog) {
    if (decision.F?.some(feature => feature.length !== Hard.POLICY_FEAT.length || feature.some(value => !Number.isFinite(value)))
      || decision.kindContext?.length !== Hard.KIND_CONTEXT.length || decision.kindContext.some(value => !Number.isFinite(value))) throw new Error('Invalid natural-prefix features');
  }
  const decisions = state.policyLog.map(decision => ({ ...decision,
    F: decision.F.map((feature, index) => feature.concat(decision.goals[index])) }));
  return { prefix: { ...metadata, reconstructed: { why: result.why, moves: result.moves, left: result.left, decisions: decisions.length }, decisions }, state, result };
}

function main() {
  const singleStep = process.argv[2] === 'single';
  const sequence = process.argv[2] === 'sequence';
  const intent = process.argv[2] === 'intent' || sequence;
  const relation = process.argv[2] === 'relation';
  const goal = process.argv[2] === 'goal';
  const value = process.argv[2] === 'value';
  const memory = process.argv[2] === 'memory' || goal || value;
  if (process.argv[2] && !singleStep && !intent && !relation && !memory) throw new Error('Unknown natural-prefix scoring mode');
  const fingerprintFiles = ['www/hard.js', 'www/layouts.js', 'tools/sim/refit/personal_prefix_data.js',
    'tools/sim/refit/mimic_games.js', 'analysis/archive/realdata/plays.json',
    ...Object.values(PIDS).map(pid => 'analysis/archive/replays/' + pid + '.json'),
    ...(intent ? ['tools/sim/refit/personal_followthrough.js', 'tools/sim/refit/physical_tray_audit.js'] : []),
    ...(sequence ? ['tools/sim/refit/personal_pair_followthrough.js'] : []),
    ...(memory ? ['tools/sim/refit/personal_retry_memory.js', 'tools/sim/refit/attempt_campaigns.js', 'tools/sim/refit/personal_model.js'] : []),
    ...(goal ? ['tools/sim/refit/personal_tray_goal.js', 'tools/sim/refit/physical_tray_audit.js'] : [])];
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of fingerprintFiles) digest.update(file).update(fs.readFileSync(path.join(root, file)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf(), players = {}, memoryPlayers = value ? { configured: {} } : { configured: {}, full: {} };
  const plays = memory ? JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/realdata/plays.json'))) : null;
  for (const [name, games] of Object.entries(recordings())) {
    const history = [], campaigns = memory ? new Map(campaignsOf(plays[PIDS[name]]).flatMap(campaign => campaign.campaignAids.map(aid => [aid, campaign.start]))) : null;
    for (const mode of Object.keys(memoryPlayers)) memoryPlayers[mode][name] = [];
    players[name] = games.map(game => {
      const rebuilt = reconstruct(game, singleStep, null, value);
      if (!rebuilt) return null;
      const { prefix, state, result } = rebuilt;
      if (memory) {
        const target = { name, campaign: campaigns.get(game.aid), board: boardId(game.g), t: game.t };
        for (const mode of Object.keys(memoryPlayers)) {
          const remembered = retryMemory(history, target, mode, game.g.faces.length);
          const recalled = reconstruct(game, false, remembered.memory, value);
          if (!recalled || JSON.stringify(recalled.prefix.reconstructed) !== JSON.stringify(prefix.reconstructed)
            || JSON.stringify(recalled.state.physicalLog) !== JSON.stringify(state.physicalLog)) throw new Error('Memory changed recorded physical actions');
          memoryPlayers[mode][name].push({ ...recalled.prefix, memoryMode: mode, memorySources: remembered.sources,
            inheritedPictures: remembered.memory.reduce((sum, value) => sum + value, 0),
            ...(goal ? { trayGoalSamples: trayGoalSamples({ ...game.g, memory: remembered.memory }, recalled.state.physicalLog, recalled.state.policyLog) } : {}),
            availableAt: Math.max(prefix.availableAt, ...remembered.sources.map(source => source.availableAt)) });
        }
        history.push({ ...target, aid: game.aid, availableAt: prefix.availableAt, seen: Array.from(result.seen), moves: result.moves });
      }
      return { ...prefix,
        ...(goal ? { trayGoalSamples: trayGoalSamples(game.g, state.physicalLog, state.policyLog) } : {}),
        ...(intent ? { followThroughSamples: followThroughSamples(game.g, state.physicalLog, state.policyLog) } : {}),
        ...(sequence ? { pairFollowThroughSamples: pairFollowThroughSamples(game.g, state.physicalLog, state.policyLog) } : {}) };
    }).filter(Boolean);
    const stops = {};
    for (const game of players[name]) stops[game.stopReason === 'end' ? game.ending : game.stopReason] = (stops[game.stopReason === 'end' ? game.ending : game.stopReason] || 0) + 1;
    console.log(name, JSON.stringify({ games: games.length, decisions: players[name].reduce((sum, game) => sum + game.decisions.length, 0), stops }));
  }
  if (fingerprintOf() !== fingerprint) throw new Error('Natural-prefix inputs changed during reconstruction');
  const output = { made: new Date().toISOString(), scope: 'physicalNaturalPrefix-v2', fingerprint, fingerprintFiles,
    physicalSingleStep: singleStep,
    followThroughMeasured: intent,
    pairFollowThroughMeasured: sequence,
    ...(memory ? { retryMemoryMeasured: true, memoryPlayers } : {}),
    ...(goal ? { trayGoalMeasured: true, trayGoalDepth: 8, trayGoalContextFeatures: Hard.TRAY_GOAL_CONTEXT } : {}),
    ...(value ? { immediateValueMeasured: true,
      valueFeatures: [...Hard.POLICY_FEAT.map(feature => 'actual.' + feature), ...Hard.GOAL_FEAT.map(feature => 'actual.goal.' + feature), ...Hard.KIND_CONTEXT.map(feature => 'context.' + feature)] } : {}),
    features: [...Hard.POLICY_FEAT, ...Hard.GOAL_FEAT.map(feature => 'goal.' + feature)], kindContextFeatures: Hard.KIND_CONTEXT, goalFeatures: Hard.GOAL_FEAT,
    base: [...Hard.weightsOf({ ...Hard.persona('strong'), temp: 2 }), ...new Array(Hard.POLICY_FEAT.length - Hard.FEAT.length + Hard.GOAL_FEAT.length).fill(0)], players,
    note: 'Natural recorded regular prefixes only, stopping before assistance, automatic play or missing/conflicting chunks. Restarts and unfinished prefixes are retained, not labelled as losses. Last chunk availability gates training. One actual open tile, physical first-tap auto-matches and known reopens are modelled; no multi-tap pair macros. Visible goal effects are appended to option features. Action likelihood is not winning-attempt accuracy.' };
  fs.writeFileSync(path.join(root, 'analysis/archive/personal-bots/' + (value ? 'policy-value-prefix-data.json' : goal ? 'policy-goal-prefix-data.json' : memory ? 'policy-memory-prefix-data.json' : sequence ? 'policy-sequence-prefix-data.json' : relation ? 'policy-relation-prefix-data.json' : intent ? 'policy-intent-prefix-data.json' : singleStep ? 'policy-single-prefix-data.json' : 'policy-prefix-data.json')), JSON.stringify(output));
}

if (require.main === module) main();
module.exports = { prefixOf, recordings, isNewInitial, reconstruct };
