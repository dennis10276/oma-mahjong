'use strict';
const fs = require('fs');
const path = require('path');
const Hard = require('../../../www/hard.js');
const L = require('../../../www/layouts.js');
const { decodeGame, encodeGame } = require('./personal_game_io.js');
const { physicalActor } = require('./personal_physical_actor.js');
const { styleAttemptFactory } = require('./personal_outcome_styles_choice.js');
const { actorOf, selectModels } = require('./physical_count_data.js');
const { CONFIG } = require('./personal_model.js');
const { kindsAt } = require('./kinds.js');
const { DEFAULT_KINDS } = require('./personal_policy_prior.js');

const REPO_ROOT = path.resolve(__dirname, '../../../..');

const MASTER_SEED = 20261028;
const REFERENCE_SEED = 20261019;

function trialSeed(seed, runIndex, attemptIndex) {
  return seed * 7919 + runIndex * 104729 + attemptIndex * 15485863;
}

function computePublicOpeningFeatures(gameOrEncoded) {
  const g = gameOrEncoded && gameOrEncoded.tiles ? gameOrEncoded : decodeGame(gameOrEncoded);
  const { tiles, nb, faces, down, rules, clock } = g;
  const n = tiles.length;
  const alive = new Uint8Array(n).fill(1);
  const cover = Hard.coverOf(tiles, nb);
  const hiddenNow = i => cover[i].length > 0;
  const visible0 = new Uint8Array(n);
  for (let i = 0; i < n; i++) visible0[i] = (!down[i] && !hiddenNow(i)) ? 1 : 0;

  const can = i => rules ? L.takeable(i, alive, nb, rules, alive) : L.isFree(i, alive, nb);
  const geomFree = [];
  const takeable = [];
  for (let i = 0; i < n; i++) {
    if (L.isFree(i, alive, nb)) geomFree.push(i);
    if (can(i)) takeable.push(i);
  }
  const takeableUp = takeable.filter(i => !down[i]);

  const depth = j => {
    const seen = new Set([j]);
    const st = [j];
    let up = 0;
    while (st.length) {
      const k = st.pop();
      for (const a of nb.above[k]) if (!seen.has(a)) { seen.add(a); up++; st.push(a); }
    }
    const side = d => {
      let c = 0, k = j;
      for (;;) {
        const nx = (d < 0 ? nb.left[k] : nb.right[k])[0];
        if (nx === undefined) return c;
        c++; k = nx; if (c > 12) return c;
      }
    };
    let v = up + Math.min(side(-1), side(1));
    if (rules && rules.ice && rules.ice[j]) v += rules.ice[j];
    if (rules && rules.locks && rules.locks.has(j)) v += (rules.keys || []).length * (1 + up);
    return v;
  };

  const visByFace = new Map();
  for (let i = 0; i < n; i++) {
    if (visible0[i]) {
      const f = faces[i];
      if (!visByFace.has(f)) visByFace.set(f, []);
      visByFace.get(f).push(i);
    }
  }

  let takeableWithVisMate = 0;
  let takeableWithTakeableMate = 0;
  const mateDepths = [];
  for (const i of takeableUp) {
    const mates = (visByFace.get(faces[i]) || []).filter(j => j !== i);
    if (mates.length > 0) {
      takeableWithVisMate++;
      const minD = Math.min(...mates.map(depth));
      mateDepths.push(minD);
      if (mates.some(j => takeableUp.includes(j))) takeableWithTakeableMate++;
    }
  }

  const clockDepth = clock ? depth(clock.i) : 0;
  const clockSlackRatio = clock ? (clock.n - (clockDepth + 1)) / clock.n : 1;
  const blockedFreeCount = geomFree.length - takeable.length;

  return {
    n,
    blockedFreeCount,
    takeableWithVisMateFrac: takeableUp.length ? takeableWithVisMate / takeableUp.length : 0,
    takeableWithTakeableMate: takeableWithTakeableMate / 2,
    meanMateDepth: mateDepths.length ? mateDepths.reduce((a, b) => a + b, 0) / mateDepths.length : 6,
    clockSlackRatio,
  };
}

function runDetailedChain(g, p, runs = 32, seed = MASTER_SEED, maxT = 8) {
  const n = g.tiles.length;
  const memP = p.memory === undefined ? 1 : p.memory;
  const r = L.rng(seed * 31 + 11);
  const reach = new Array(maxT).fill(0), won = new Array(maxT).fill(0);
  let t1ClockLoss = 0, t1TrayLoss = 0, t1LeftSum = 0, t1MovesSum = 0, t1SeenSum = 0;
  let t1BlindSum = 0, t1ForcedBlindSum = 0, t1ChoicesSum = 0, t1DecSum = 0;
  let t2LeftSum = 0, t2ClockLoss = 0, t2SeenSum = 0;

  for (let k = 0; k < runs; k++) {
    let memory = null;
    const avoidMoves = p.learnFromLoss ? new Map() : null;
    for (let t = 0; t < maxT; t++) {
      reach[t]++;
      const trace = p.learnFromLoss ? [] : null;
      const tSeed = trialSeed(seed, k, t);
      const a = Hard.play(memory || avoidMoves ? { ...g, memory, avoidMoves } : g, p, tSeed, trace);
      let seenCount = 0;
      for (let i = 0; i < n; i++) if (a.seen[i] > 0 || (memory && memory[i])) seenCount++;
      if (t === 0) {
        if (!a.win && a.why === 'clock') t1ClockLoss++;
        if (!a.win && a.why === 'tray') t1TrayLoss++;
        t1LeftSum += a.left / n;
        t1MovesSum += a.moves / n;
        t1SeenSum += seenCount / n;
        t1BlindSum += a.blind / Math.max(1, a.decisions);
        t1ForcedBlindSum += a.forcedBlind / Math.max(1, a.decisions);
        t1ChoicesSum += a.choices;
        t1DecSum += a.decisions / n;
      } else if (t === 1) {
        if (!a.win && a.why === 'clock') t2ClockLoss++;
        t2LeftSum += a.left / n;
        t2SeenSum += seenCount / n;
      }
      if (a.win) {
        won[t]++;
        break;
      }
      if (avoidMoves && trace) {
        for (let idx = trace.length - 1; idx >= 0; idx--) {
          const dec = trace[idx];
          if (!dec.state || !dec.alternatives || !dec.alternatives.some(opt => opt !== dec.chosen)) continue;
          if (!avoidMoves.has(dec.state)) avoidMoves.set(dec.state, new Set());
          avoidMoves.get(dec.state).add(dec.chosen);
          break;
        }
      }
      const m = Hard.remembered(a.seen, a.moves, memP, r);
      if (memory) for (let i = 0; i < m.length; i++) m[i] |= memory[i];
      memory = m;
    }
  }
  const within = won.map((_, t) => won.slice(0, t + 1).reduce((a, b) => a + b, 0) / runs);
  const t2Reach = Math.max(1, reach[1]);
  return {
    first: won[0] / runs,
    within2: within[1],
    within3: within[2],
    within5: within[4],
    within8: within[7],
    t1ClockLoss: t1ClockLoss / runs,
    t1TrayLoss: t1TrayLoss / runs,
    t1Left: t1LeftSum / runs,
    t1Moves: t1MovesSum / runs,
    t1Seen: t1SeenSum / runs,
    t1Blind: t1BlindSum / runs,
    t1ForcedBlind: t1ForcedBlindSum / runs,
    t1Choices: t1ChoicesSum / runs,
    t1Dec: t1DecSum / runs,
    t2ClockLoss: t2ClockLoss / t2Reach,
    t2Left: t2LeftSum / t2Reach,
    t2Seen: t2SeenSum / t2Reach,
  };
}

function loadModelContext(rootPath = REPO_ROOT) {
  const bankPath = path.join(rootPath, 'source/analysis/archive/personal-bots/physical-memory-policy-bank.json');
  const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));

  const freshInputPath = path.join(rootPath, 'source/analysis/archive/personal-bots/personal-fresh-count-input.json');
  const freshInput = JSON.parse(fs.readFileSync(freshInputPath, 'utf8'));

  const modelFolder = path.join(rootPath, 'source', freshInput.modelSnapshot);
  const futureModels = JSON.parse(fs.readFileSync(path.join(modelFolder, 'analysis/archive/personal-bots/personal-fresh-own-models.json'), 'utf8'));
  const recentModels = JSON.parse(fs.readFileSync(path.join(modelFolder, 'analysis/archive/personal-bots/personal-fresh-recent-models.json'), 'utf8'));
  const actorsMap = new Map([...futureModels.models, ...recentModels.models].map(a => [a.id, a]));

  return { bank, freshInput, actorsMap };
}

function buildTaskProfiles(task, bank, actorsMap) {
  let baseActor, followThrough, pairFollowThrough, choiceFactory = null;

  if (task.modelId && actorsMap.has(task.modelId)) {
    const actor = actorsMap.get(task.modelId);
    baseActor = physicalActor(actor);
    choiceFactory = styleAttemptFactory(actor, actor.outcomeStyles, true, true);
    followThrough = actor.followThrough?.probabilities;
    pairFollowThrough = actor.pairFollowThrough?.probabilities;
  } else {
    const m = selectModels(bank, task).ownAll;
    baseActor = actorOf(m);
    followThrough = m.followThrough;
    pairFollowThrough = m.pairFollowThrough;
  }

  const pPlan8 = {
    ...baseActor,
    memory: CONFIG.memory,
    learnFromLoss: true,
    physicalPlan: 8,
    physicalFollowThrough: followThrough,
    physicalPairFollowThrough: pairFollowThrough,
  };

  const pSafe = {
    ...baseActor,
    memory: CONFIG.memory,
    learnFromLoss: true,
    physicalPlan: 14,
    physicalKeyPlan: 14,
    physicalSafety: 0.90,
    physicalFollowThrough: followThrough,
    physicalPairFollowThrough: pairFollowThrough,
  };

  const pFull14 = {
    ...baseActor,
    ...(choiceFactory ? { physicalChoiceForAttempt: choiceFactory } : {}),
    physicalPlan: 14,
    physicalClockSafeExit: true,
    physicalKeyPlan: 14,
    physicalKeySafeExit: true,
    physicalSafety: 0.95,
    physicalFollowThrough: followThrough,
    physicalPairFollowThrough: pairFollowThrough,
    physicalNoPairReinspect: true,
    memory: CONFIG.memory,
    learnFromLoss: true,
  };

  const pLegacyBase = {
    ...Hard.P,
    allMoves: true,
    flips: true,
    peek: 0,
    end: 12,
    plan: 10,
    memory: CONFIG.memory,
    kinds: { ...DEFAULT_KINDS, ...kindsAt(task.name, task.start) },
    w: [...Hard.weightsOf({ ...Hard.persona('strong'), temp: CONFIG.care })],
  };

  return { pPlan8, pSafe, pFull14, pLegacyBase, baseActor };
}

function simulateTaskFeatures(game, profiles, runs = 32, seed = MASTER_SEED) {
  const diagPlan8 = runDetailedChain(game, profiles.pPlan8, runs, seed, 8);
  const diagSafe = runDetailedChain(game, profiles.pSafe, runs, seed, 8);
  const cFull14 = Hard.rateChain(game, runs, seed, profiles.pFull14, CONFIG.memory, 32);

  return {
    sf14_w3: cFull14.within[2],
    sf14_w5: cFull14.within[4],
    sf14_w8: cFull14.within[7],
    s14_t1Left: diagSafe.t1Left,
    p8_t1Dec: diagPlan8.t1Dec,
  };
}

function loadAllGames(rootPath = REPO_ROOT) {
  const cachePath = path.join(rootPath, 'source/analysis/archive/personal-bots/personal-all-games-cache.json');
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  }
  const { tasksOf } = require('./physical_count_data.js');
  return tasksOf().map(x => ({ ...x, game: encodeGame(x.game) }));
}

async function verifyTasks(targets = ['Mrs. Doubtfire:34', 'Mrs. Doubtfire:84', 'Mrs. Doubtfire:102', 'Mrs. Doubtfire:107']) {
  const { bank, freshInput, actorsMap } = loadModelContext();
  const allHistoricalGames = loadAllGames();
  const featJsonPath = path.join(REPO_ROOT, 'source/analysis/personal-bots/personal-causal-factor-features.json');
  const featJson = JSON.parse(fs.readFileSync(featJsonPath, 'utf8'));

  console.log(`Verifying ${targets.length} target task simulations against ${featJsonPath}...`);
  let passCount = 0;

  for (const target of targets) {
    const [tName, tLvStr] = target.split(':');
    const tLv = parseInt(tLvStr, 10);

    let task = allHistoricalGames.find(t => t.name === tName && t.lv === tLv);
    if (!task) {
      task = [...freshInput.recent, ...freshInput.future].find(t => t.name === tName && t.lv === tLv);
    }
    if (!task) {
      console.error(`Task ${target} not found!`);
      continue;
    }

    const g = decodeGame(task.game);
    const profiles = buildTaskProfiles(task, bank, actorsMap);
    const sim = simulateTaskFeatures(g, profiles, 32, MASTER_SEED);
    const openGeom = computePublicOpeningFeatures(g);

    const keyByBoard = `${task.name}|lv=${task.lv}|${task.board}`;
    const keyByStart = `${task.name}|${task.start}|${task.board}`;
    const targetRec = featJson.byLevelBoard[keyByBoard] || featJson.byStart[keyByStart];
    if (!targetRec) {
      console.error(`No record found in features JSON for ${keyByBoard}`);
      continue;
    }
    const f = targetRec.features;

    const diffs = {
      blockedFreeCount: Math.abs(openGeom.blockedFreeCount - f.blockedFreeCount),
      takeableWithTakeableMate: Math.abs(openGeom.takeableWithTakeableMate - f.takeableWithTakeableMate),
      meanMateDepth: Math.abs(openGeom.meanMateDepth - f.meanMateDepth),
      takeableWithVisMateFrac: Math.abs(openGeom.takeableWithVisMateFrac - f.takeableWithVisMateFrac),
      clockSlackRatio: Math.abs(openGeom.clockSlackRatio - f.clockSlackRatio),
      sf14_w3: Math.abs(sim.sf14_w3 - f.sf14_w3),
      sf14_w5: Math.abs(sim.sf14_w5 - f.sf14_w5),
      sf14_w8: Math.abs(sim.sf14_w8 - f.sf14_w8),
      s14_t1Left: Math.abs(sim.s14_t1Left - f.s14_t1Left),
      p8_t1Dec: Math.abs(sim.p8_t1Dec - f.p8_t1Dec),
    };

    const maxDiff = Math.max(...Object.values(diffs));
    if (maxDiff > 1e-9) {
      console.error(`FAIL: ${target} max difference ${maxDiff}`);
      console.log('Diffs:', diffs);
    } else {
      console.log(`PASS: ${target} [sf14_w8=${sim.sf14_w8.toFixed(4)}, s14_t1Left=${sim.s14_t1Left.toFixed(4)}, p8_t1Dec=${sim.p8_t1Dec.toFixed(4)}] max error = ${maxDiff.toExponential(2)}`);
      passCount++;
    }
  }

  console.log(`Verification completed: ${passCount}/${targets.length} passed.`);
  return passCount === targets.length;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--verify')) {
    const idx = args.indexOf('--verify');
    const filter = args[idx + 1];
    let targets = ['Mrs. Doubtfire:34', 'Mrs. Doubtfire:84', 'Mrs. Doubtfire:102', 'Mrs. Doubtfire:107'];
    if (filter && filter !== 'benchmark' && filter !== 'all') {
      targets = [filter];
    }
    verifyTasks(targets).then(ok => {
      process.exit(ok ? 0 : 1);
    }).catch(err => {
      console.error(err);
      process.exit(1);
    });
  } else {
    verifyTasks(['Mrs. Doubtfire:34', 'Mrs. Doubtfire:84', 'Mrs. Doubtfire:102', 'Mrs. Doubtfire:107']).then(ok => {
      process.exit(ok ? 0 : 1);
    });
  }
}

module.exports = {
  MASTER_SEED,
  REFERENCE_SEED,
  trialSeed,
  computePublicOpeningFeatures,
  runDetailedChain,
  loadModelContext,
  buildTaskProfiles,
  simulateTaskFeatures,
  loadAllGames,
  verifyTasks,
};
