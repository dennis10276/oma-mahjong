#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const E = require('../engine');
const D = require('../loop/detour');
const O = require('../loop/obvious');

const MIN_DELAY = 5;
const CLASSES = ['easy', 'good', 'too-hard'];
const LABEL = { easy: 'not-ready', good: 'lab-ready', 'too-hard': 'too-hard' };
const takeOf = action => typeof action === 'number' ? [action] : action.pair;
const takeKey = ids => ids.slice().sort((a, b) => a - b).join(',');
const sha256 = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function witness(game, solution, proof) {
  let state = E.start(game);
  const route = [];
  if (E.replay(game.design, solution).ok) {
    for (let i = 0; i < solution.length; i++) {
      let action = solution[i];
      let next = E.step(game, state, action);
      if (!next) {
        action = { pair: [action, solution[++i]] };
        next = E.step(game, state, action);
      }
      route.push(action);
      state = next;
    }
    return { result: 'win', path: route };
  }
  return proof.win(game, state, 125000);
}

function visibleGoals(game, state) {
  const vis = O.visibility(game, state);
  const waiting = new Set(state.tray.map(i => game.faces[i]));
  const goals = [];
  for (let tile = 0; tile < game.n; tile++) {
    if (!state.alive[tile]) continue;
    const goal = kind => goals.push({ kind, tile });
    if (tile === game.clock.i) goal('clock');
    else if (vis[tile].role && game.isKey[tile]) goal('key');
    else if (vis[tile].role && game.lockT[tile]) goal('lock');
    else if (vis[tile].role && game.iceH[tile]) goal('ice');
    else if (vis[tile].picture && waiting.has(game.faces[tile])) goal('tray-match');
  }
  return goals;
}

// Follow the goal's visible physical prerequisites. This deliberately does
// not infer a key/lock or a valuable picture from a tile hidden under the pile.
function dependencies(game, state, goal) {
  const set = new Set([goal.tile]);
  const queue = [goal.tile];
  const alive = state.alive;
  const vis = O.visibility(game, state);
  for (let depth = 0; depth < 3 && queue.length; depth++) {
    for (const tile of queue.splice(0)) {
      const related = [...game.nb.above[tile]];
      const left = game.nb.left[tile].filter(i => alive[i]);
      const right = game.nb.right[tile].filter(i => alive[i]);
      if (left.length && right.length) related.push(...left, ...right);
      if (vis[tile].role || tile === game.clock.i) {
        const stillFrozen = game.iceH[tile] > game.iceNb[tile].filter(i => !alive[i]).length;
        if (stillFrozen) related.push(...game.iceNb[tile].filter(i => game.tiles[i].z >= game.tiles[tile].z));
        if (game.lockT[tile] & 1) related.push(...game.keys.filter(i => vis[i].role));
        if (game.lockT[tile] & 2) related.push(...game.keys2.filter(i => vis[i].role));
      }
      for (const other of related) {
        if (!alive[other] || set.has(other)) continue;
        set.add(other);
        queue.push(other);
      }
    }
  }
  return set;
}

function follow(game, start, goal) {
  let state = start;
  const continuation = [];
  for (let i = 0; i < MIN_DELAY && state.alive[goal.tile]; i++) {
    const related = dependencies(game, state, goal);
    const available = E.legal(game, state).flatMap(action => {
      const next = E.step(game, state, action);
      if (!next) return [];
      const goalProgress = takeOf(action).some(tile => related.has(tile));
      const trayProgress = next.tray.length < state.tray.length;
      return goalProgress || trayProgress ? [{ action, next, goalProgress, trayProgress }] : [];
    });
    available.sort((a, b) => Number(b.trayProgress) - Number(a.trayProgress)
      || Number(b.goalProgress) - Number(a.goalProgress));
    if (!available.length) break;
    const { action, next } = available[0];
    continuation.push(takeOf(action));
    state = next;
  }
  return continuation;
}

// Replay an author's proposed wrong plan independently of the stored solution.
function auditPlan(design, plan) {
  const game = E.game(design);
  const proof = D.work(350000);
  let state = E.start(game);

  const legalStep = (position, action) => {
    try { return E.step(game, position, action); } catch { return null; }
  };
  const purposeful = (position, step, next) => {
    const goal = visibleGoals(game, position).find(g =>
      g.tile === step.goal?.tile && g.kind === step.goal.kind);
    if (!goal) return false;
    const related = dependencies(game, position, goal);
    return takeOf(step.take).some(tile => related.has(tile))
      || next.tray.length < position.tray.length;
  };

  for (const action of plan.prefix ?? []) {
    state = legalStep(state, action);
    if (!state) return { result: 'illegal-prefix' };
  }
  const before = proof.win(game, state, 100000).result;
  if (before !== 'win') return { result: before === 'unknown' ? 'unknown' : 'prefix-already-lost' };
  const next = legalStep(state, plan.commit?.take);
  if (!next) return { result: 'illegal-commitment' };
  if (!purposeful(state, plan.commit, next)) return { result: 'unrelated-commitment' };
  const after = proof.win(game, next, 100000).result;
  if (after !== 'lose') return { result: after === 'unknown' ? 'unknown' : 'commitment-still-wins' };

  const commitment = next;
  state = next;
  for (const step of plan.steps ?? []) {
    const advanced = legalStep(state, step.take);
    if (!advanced) return { result: 'illegal-continuation' };
    if (!purposeful(state, step, advanced)) return { result: 'unrelated-move' };
    state = advanced;
  }
  const followOnMoves = state.moves - commitment.moves;
  if (followOnMoves < MIN_DELAY) return { result: 'too-short', followOnMoves };
  const clockExpired = !state.clockTaken && state.moves >= game.clock.n;
  if (!clockExpired && E.legal(game, state).some(action => E.step(game, state, action))) {
    return { result: 'consequence-not-yet-reached', followOnMoves };
  }
  const twoMoreClockMoves = commitment.clockTaken ? null
    : proof.win(D.clockGames(design).at(game.clock.n + 2), commitment, 100000).result;
  return { result: 'proved', followOnMoves, endsBy: clockExpired ? 'clock' : 'stuck',
    phase: commitment.clockTaken ? 'after-clock' : 'before-clock', twoMoreClockMoves };
}


function measure(design) {
  if (!design?.clock || !Array.isArray(design.tiles) || !Array.isArray(design.faces)
      || design.faces.length !== design.tiles.length) throw new Error('Expected a board with tiles, pictures and a clock');
  const game = E.game(design);
  if (!game.clock || !Number.isInteger(game.clock.n) || game.clock.n < 1) throw new Error('Invalid clock');
  const proof = D.work(200000);
  const result = witness(game, design.solution, proof);
  const base = { win: result.result, minimumClock: null, spare: null, longPlans: 0, immediateLosses: 0,
    unknownAlternatives: 0, searchBudgetExhausted: false, specialTilesOnClockRoute: 0,
    faceDownOnClockRoute: 0, beforeClockPressureParks: 0, afterClockPressureParks: 0, plans: [] };
  if (result.result !== 'win') return base;

  const clock = E.clockShortest(E.game({ ...design, clock: { ...game.clock, n: 99 } }), {
    nodes: 45000, totalNodes: 90000, finishNodes: 12000,
  });
  if (clock && !clock.unsure) {
    base.minimumClock = clock.k;
    base.spare = game.clock.n - clock.k;
  }

  const plans = new Map();
  let state = E.start(game);
  for (const winningAction of result.path) {
    const next = E.step(game, state, winningAction);
    if (state.tray.length > 0 && state.tray.length < 3 && next.tray.length > state.tray.length) {
      base[state.clockTaken ? 'afterClockPressureParks' : 'beforeClockPressureParks']++;
    }
    if (!state.clockTaken) {
      for (const tile of takeOf(winningAction)) {
        if (game.iceH[tile] || game.lockT[tile] || game.isKey[tile]) base.specialTilesOnClockRoute++;
        if (game.down[tile]) base.faceDownOnClockRoute++;
      }
    }
    const phase = state.clockTaken ? 'after-clock' : 'before-clock';
    if (!proof.over() && game.n - state.moves > MIN_DELAY) {
      const goals = visibleGoals(game, state).map(goal => ({ ...goal, related: dependencies(game, state, goal) }));
      const winning = takeKey(takeOf(winningAction));
      for (const action of E.legal(game, state)) {
        const takes = takeOf(action);
        const key = takeKey(takes);
        if (key === winning) continue;
        const relevant = goals.filter(goal => takes.some(i => goal.related.has(i)));
        if (!relevant.length) continue;
        const after = E.step(game, state, action);
        if (!after) continue; // A move that already overflows the tray has no delayed consequence.
        const losing = proof.win(game, after, 8000).result;
        if (losing === 'unknown') base.unknownAlternatives++;
        if (losing !== 'lose') continue;
        let best = null;
        for (const goal of relevant) {
          const continuation = follow(game, after, goal);
          if (!best || continuation.length > best.continuation.length) {
            best = { goal: { kind: goal.kind, tile: goal.tile }, continuation };
          }
          if (best.continuation.length === MIN_DELAY) break;
        }
        const signature = phase + ':' + key;
        const existing = plans.get(signature);
        if (!existing || best.continuation.length > existing.continuation.length) {
          plans.set(signature, { phase, at: state.moves, commitment: takes, ...best });
        }
      }
    }
    state = next;
  }
  base.searchBudgetExhausted = proof.over();
  const groups = new Map();
  for (const plan of plans.values()) {
    // Reordered along-witness commitments can produce the same plan.
    const planTiles = takeKey([...plan.commitment, ...plan.continuation.flat()]);
    const key = [plan.phase, plan.goal.kind, plan.goal.tile, planTiles].join(':');
    if (!groups.has(key)) groups.set(key, plan);
  }
  base.plans = [...groups.values()];
  base.longPlans = base.plans.filter(plan => plan.continuation.length >= MIN_DELAY).length;
  base.immediateLosses = base.plans.filter(plan => !plan.continuation.length).length;
  return base;
}

// Use the layout and trap geometry to keep mirrored and redressed variants
// together, without giving the classifier their labels or board identifiers.
function familyOf(board) {
  const minX = Math.min(...board.tiles.map(t => t[0]));
  const maxX = Math.max(...board.tiles.map(t => t[0]));
  const minY = Math.min(...board.tiles.map(t => t[1]));
  const ob = board.obst || {};
  const signatures = [false, true].map(mirror => board.tiles.map(([x, y, z], i) => [
    mirror ? maxX - x : x - minX, y - minY, z, Number(i === board.clock?.i),
    ob.ice?.[i] || 0, Number(ob.keys?.includes(i) || false), Number(ob.locks?.includes(i) || false),
    Number(ob.keys2?.includes(i) || false), Number(ob.locks2?.includes(i) || false),
  ].join(':')).sort().join(';'));
  return signatures.sort()[0];
}

function split(rows) {
  const families = new Map();
  for (const row of rows.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    const family = row.family ?? row.id;
    if (!families.has(family)) families.set(family, []);
    families.get(family).push(row);
  }
  const groups = [...families.values()].sort((a, b) =>
    sha256(String(a[0].id)).localeCompare(sha256(String(b[0].id))));
  const total = CLASSES.map(label => rows.filter(row => row.class === label).length);
  const target = total.map(n => n > 1 ? Math.max(1, Math.round(n / 3)) : 0);
  const taken = total.map(() => 0);
  const training = [], heldOut = [];
  for (const group of groups) {
    const added = CLASSES.map(label => group.filter(row => row.class === label).length);
    const canHold = added.every((n, i) => n === 0 || taken[i] + n < total[i]);
    const useful = added.some((n, i) => n > 0 && taken[i] < target[i]);
    if (!canHold || !useful) {
      training.push(...group);
      continue;
    }
    heldOut.push(...group);
    added.forEach((n, i) => { taken[i] += n; });
  }
  return { training, heldOut };
}

function predict(row, { min, max }) {
  if (row.win !== 'win' || row.longPlans < min) return 'easy';
  return row.longPlans >= max ? 'too-hard' : 'good';
}

function score(rows, model) {
  const classes = Object.fromEntries(CLASSES.map(label => [label, { correct: 0, total: 0 }]));
  const misses = [];
  for (const row of rows) {
    const prediction = predict(row, model);
    classes[row.class].total++;
    if (prediction === row.class) classes[row.class].correct++;
    else misses.push({ id: row.id, expected: row.class, prediction, longPlans: row.longPlans });
  }
  return { correct: rows.length - misses.length, total: rows.length, classes, misses };
}

function fit(rows) {
  const options = [...new Set([2, ...rows.map(row => row.longPlans + 1).filter(n => n >= 2)])].sort((a, b) => a - b);
  let best = null;
  for (const min of options) {
    for (const max of options) {
      if (max <= min) continue;
      const model = { min, max };
      const s = score(rows, model);
      const accuracy = Object.values(s.classes).reduce((sum, c) => sum + (c.total ? c.correct / c.total : 0), 0);
      const easyCorrect = s.classes.easy.correct;
      if (!best || accuracy > best.accuracy || (accuracy === best.accuracy && easyCorrect > best.easyCorrect)) {
        best = { model, accuracy, easyCorrect };
      }
    }
  }
  return best?.model || { min: 2, max: 3 };
}

function calibrate(file) {
  const reference = read(file);
  const boards = read(path.resolve(path.dirname(file), reference.boards));
  const labelled = reference.records.filter(row => CLASSES.includes(row.class)).map(row => {
    const board = boards[row.snapshotKey];
    if (!board || sha256(board) !== row.boardSha256) throw new Error('Reference board hash mismatch for ' + row.id);
    return { id: row.id, class: row.class, family: familyOf(board), board };
  });
  const partitions = split(labelled);
  const measureRows = rows => rows.map(({ id, class: label, board }) => ({ id, class: label, ...measure(board) }));
  const trainingRows = measureRows(partitions.training);
  const model = fit(trainingRows);
  const heldOutRows = measureRows(partitions.heldOut);
  const training = score(trainingRows, model);
  const heldOut = score(heldOutRows, model);
  const qualified = [training, heldOut].every(part => part.correct === part.total
    && CLASSES.every(label => part.classes[label].total > 0));
  const rows = [...trainingRows.map(row => ({ ...row, partition: 'training' })),
    ...heldOutRows.map(row => ({ ...row, partition: 'held-out' }))];
  return { model, training, heldOut, qualified, rows };
}

function decide(row, { model, qualified }) {
  if (row.win !== 'win') return { status: 'not-ready', reason: 'Full win was not proved' };
  const prediction = LABEL[predict(row, model)];
  if (!qualified) return { status: 'not-ready', reason: 'The measured thresholds did not pass reference calibration', prediction };
  if (row.searchBudgetExhausted || row.unknownAlternatives) {
    return { status: 'not-ready', reason: 'Some plausible alternatives could not be proved', prediction };
  }
  return { status: prediction, reason: prediction === 'lab-ready' ? 'Count is in the calibrated range'
    : prediction === 'too-hard' ? 'Count is above the calibrated range' : 'Too few delayed, goal-directed wrong plans' };
}

module.exports = { auditPlan, measure, familyOf, split, fit, score, decide, calibrate };

if (require.main === module) {
  try {
    const [boardFile, flag, referenceFile] = process.argv.slice(2);
    if (!boardFile || flag !== '--reference' || !referenceFile || process.argv.length !== 5) {
      throw new Error('Usage: board_check.js <board.json|--calibrate> --reference <reference.json>');
    }
    const calibration = calibrate(referenceFile);
    if (boardFile === '--calibrate') console.log(JSON.stringify(calibration, null, 2));
    else {
      const input = read(boardFile);
      const metrics = measure(input.design || input.board || input);
      const { model, qualified, training, heldOut } = calibration;
      const authoredPlans = (input.wrongPlans ?? []).map(plan => auditPlan(input.design || input.board || input, plan));
      console.log(JSON.stringify({ ...decide(metrics, calibration), metrics, authoredPlans,
        calibration: { model, qualified, training, heldOut } }, null, 2));
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
