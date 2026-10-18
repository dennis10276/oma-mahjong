'use strict';
const Hard = require('../../../www/hard.js');
const L = require('../../../www/layouts.js');
const { decodeGame } = require('./personal_game_io.js');

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
    takeableWithTakeableMate,
    meanMateDepth: mateDepths.length ? mateDepths.reduce((a, b) => a + b, 0) / mateDepths.length : 6,
    clockSlackRatio,
  };
}

function runDetailedChain(g, p, runs = 32, seed = 20261028, maxT = 8) {
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
      const trialSeed = seed * 7919 + k * 104729 + t * 15485863;
      const a = Hard.play(memory || avoidMoves ? { ...g, memory, avoidMoves } : g, p, trialSeed, trace);
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

module.exports = { computePublicOpeningFeatures, runDetailedChain };
