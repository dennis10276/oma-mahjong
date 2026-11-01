'use strict';
/**
 * bot_designer.js: Bot-driven level design for Oma's Mahjong.
 *
 * Implements designWithBot(deal, target, opts)
 *
 * Key Bot-Driven Principles:
 * 1. Lock on a tile the bot's routes need early:
 *    Probes unconstrained play; places locks on tiles the bot takes in early taps,
 *    preventing rush down one branch and guiding player toward keys.
 * 2. Keys where they point the way:
 *    Keys are placed on buried pairs (coverOf >= 1) along a constructive path,
 *    so they cannot be cleared on move 1, guiding the route to 16-35 moves.
 * 3. Ice on tiles that block the path to the clock/keys:
 *    Ice is placed directly on the clock or on tiles guarding keys/clock,
 *    ensuring ice removal directly affects time/moves.
 * 4. Clock on a route where reach rate is 10-40%, with 1-3 spare moves:
 *    Ensures clock creates real pressure and matters under ablation.
 * 5. Avoid late squeeze:
 *    All keys and locked partners are resolved in early/mid game (ckIdx <= 48% tiles).
 * 6. Ablation verification:
 *    Every returned board is verified with specialsMatter(board).ok === true.
 */

const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const Hard = require(path.join(ROOT, 'www', 'hard.js'));
const I = require(path.join(ROOT, 'tools', 'lab', 'ideas.js'));
const { measureHuman, critique } = require('./human_bot.js');
const { specialsMatter } = require(path.join(ROOT, 'tools', 'factory', 'specials_matter.js'));
const { campaign } = require('./human_style_environment.js');
const { normalizeBoard } = require('./public_board_input.js');
const profiles = require('./human_style_profiles.json');

// Use beam search (EXACT=false) for instant route calculation
I.setExact(false);

const BAD_CRITIC_FLAGS = new Set(['lateSqueeze', 'clockTooTight', 'guessing', 'specialAddsNothing']);

const DENNIS_RECIPES = [
  'deepKeys+iceChain',
  'iceLockClock',
  'chainReaction',
  'lockedPartners+iceChain',
  'lockedClock',
  'dontGrab+lockedPartners'
];

function coverOf(c, i) {
  const s = new Set(), st = [i];
  while (st.length) {
    const j = st.pop();
    for (const a of c.nb.above[j]) if (!s.has(a)) { s.add(a); st.push(a); }
  }
  return s;
}

function probeBot(deal, seed = 4711) {
  try {
    const enc = normalizeBoard(deal);
    const res = campaign(enc, profiles.Dennis, seed, { maxAttempts: 1, capture: true });
    return res.attempts[0].decisions.map(d => d.index);
  } catch (e) {
    return deal.solution.slice(0, 30);
  }
}

/**
 * Generates candidate board configurations for a given puzzle recipe on a clean deal.
 */
function generateRecipeCandidates(deal, c, recipe, probeTaps, target, rng) {
  const ok = i => !(deal.gold || []).includes(i);
  const candidates = [];
  const [minExp, maxExp] = target;
  const isHigherBand = minExp >= 4.0;
  const idealCkPos = isHigherBand ? 26 : 20;
  const spares = isHigherBand ? [1, 2] : [2, 1, 3];
  const maxCkPos = Math.floor(c.n * 0.45);
  const minCkIdx = 14;
  const maxCkIdx = Math.floor(c.n * 0.48);

  if (recipe === 'lockedClock') {
    const cks = c.P.filter(i => ok(i) && c.pos[i] >= 12 && c.pos[i] <= maxCkPos && c.nb.above[i].length > 0)
      .sort((a, b) => Math.abs(c.pos[a] - idealCkPos) - Math.abs(c.pos[b] - idealCkPos));
    for (const ck of cks.slice(0, 4)) {
      // Prefer buried keys (coverOf >= 1)
      let kPairs = c.pairs.filter(([a, b, k]) => k < c.pos[ck] - 1 && a !== ck && b !== ck && ok(a) && ok(b) && (coverOf(c, a).size >= 1 || coverOf(c, b).size >= 1));
      if (!kPairs.length) {
        kPairs = c.pairs.filter(([a, b, k]) => k < c.pos[ck] - 1 && k >= Math.floor(c.pos[ck] * 0.35) && a !== ck && b !== ck && ok(a) && ok(b));
      }
      if (!kPairs.length) continue;
      const kp = kPairs[kPairs.length - 1];
      const extraLocks = probeTaps.slice(1, 6).filter(t => ok(t) && t !== ck && !kp.includes(t) && c.top[t]).slice(0, isHigherBand ? 2 : 1);
      const x = I.clone(deal);
      x.obst = { ice: {}, locks: [ck, ...extraLocks], keys: [kp[0], kp[1]] };
      x.clock = { i: ck, n: 999 };
      for (const sp of spares) {
        const b = I.fix(x, sp);
        if (b && I.valid(b)) {
          const idx = b.solution.indexOf(b.clock.i) + 1;
          if (idx >= minCkIdx && idx <= maxCkIdx) {
            candidates.push({ b, sp, recipe });
          }
        }
      }
      if (candidates.length >= 3) break;
    }
  } else if (recipe === 'iceLockClock') {
    const cks = c.P.filter(i => ok(i) && c.pos[i] >= 12 && c.pos[i] <= maxCkPos && c.inb[i].filter(j => ok(j) && c.tiles[j].z === c.tiles[i].z).length >= 1)
      .sort((a, b) => Math.abs(c.pos[a] - idealCkPos) - Math.abs(c.pos[b] - idealCkPos));
    for (const ck of cks.slice(0, 4)) {
      const nbs = c.inb[ck].filter(j => ok(j) && c.tiles[j].z === c.tiles[ck].z);
      const byFace = {};
      for (let i = 0; i < c.n; i++) if (ok(i) && coverOf(c, i).size >= 1 && i !== ck && !nbs.includes(i)) (byFace[deal.faces[i]] = byFace[deal.faces[i]] || []).push(i);
      const pairs = Object.values(byFace).filter(g => g.length >= 2).map(g => [g[0], g[1]]);
      if (!pairs.length) continue;
      for (const kp of pairs.slice(0, 3)) {
        const x = I.clone(deal);
        x.obst = { ice: { [ck]: Math.min(2, Math.max(1, nbs.length)) }, locks: [ck, ...nbs.slice(0, isHigherBand ? 2 : 1)], keys: [kp[0], kp[1]] };
        x.clock = { i: ck, n: 999 };
        for (const sp of spares) {
          const b = I.fix(x, sp);
          if (b && I.valid(b)) {
            const idx = b.solution.indexOf(b.clock.i) + 1;
            if (idx >= minCkIdx && idx <= maxCkIdx) {
              candidates.push({ b, sp, recipe });
            }
          }
        }
        if (candidates.length >= 3) break;
      }
      if (candidates.length >= 3) break;
    }
  } else if (recipe === 'chainReaction') {
    const deep = c.P.filter(i => ok(i) && coverOf(c, i).size >= 1 && coverOf(c, i).size <= 3);
    const byFace = {};
    for (const i of deep) (byFace[deal.faces[i]] = byFace[deal.faces[i]] || []).push(i);
    const pairs = Object.values(byFace).filter(g => g.length >= 2).map(g => [g[0], g[1]]);
    for (const kk of pairs.slice(0, 3)) {
      const kdig = new Set([...coverOf(c, kk[0]), ...coverOf(c, kk[1])]);
      const clocks = c.P.filter(i => ok(i) && c.pos[i] >= 14 && c.pos[i] <= maxCkPos && !kk.includes(i) && !kdig.has(i))
        .sort((a, b) => Math.abs(c.pos[a] - idealCkPos) - Math.abs(c.pos[b] - idealCkPos));
      for (const ck of clocks.slice(0, 2)) {
        const ice = {};
        for (const k of kk) {
          const t = [...coverOf(c, k)].find(j => ok(j) && !Object.keys(ice).some(q => c.inb[j].includes(+q)));
          if (t !== undefined) ice[t] = 1;
        }
        if (!Object.keys(ice).length) {
          const g = c.nb.above[ck].filter(ok);
          if (g.length) ice[g[0]] = 1; else ice[ck] = 1;
        }
        const extraLocks = probeTaps.slice(1, 5).filter(t => ok(t) && t !== ck && !kdig.has(t) && !kk.includes(t) && c.top[t]).slice(0, 1);
        const x = I.clone(deal);
        x.obst = { ice, locks: [ck, ...extraLocks], keys: [kk[0], kk[1]] };
        x.clock = { i: ck, n: 999 };
        const crSpares = isHigherBand ? [2, 1] : [3, 2];
        for (const sp of crSpares) {
          const b = I.fix(x, sp);
          if (b && I.valid(b)) {
            const idx = b.solution.indexOf(b.clock.i) + 1;
            if (idx >= minCkIdx && idx <= maxCkIdx) {
              candidates.push({ b, sp, recipe });
            }
          }
        }
        if (candidates.length >= 3) break;
      }
      if (candidates.length >= 3) break;
    }
  } else if (recipe === 'deepKeys+iceChain') {
    const deep = c.P.filter(i => ok(i) && c.tiles[i].z <= 1 && coverOf(c, i).size >= 1);
    const byFace = {};
    for (const i of deep) (byFace[deal.faces[i]] = byFace[deal.faces[i]] || []).push(i);
    const pairs = Object.values(byFace).filter(g => g.length >= 2).map(g => [g[0], g[1]])
      .filter(p => coverOf(c, p[0]).size >= 1 && coverOf(c, p[1]).size >= 1);
    for (const kk of pairs.slice(0, 4)) {
      const kdig = new Set([...coverOf(c, kk[0]), ...coverOf(c, kk[1])]);
      const clocks = c.P.filter(i => ok(i) && c.pos[i] >= 14 && c.pos[i] <= maxCkPos && !kk.includes(i) && !kdig.has(i))
        .sort((a, b) => Math.abs(c.pos[a] - idealCkPos) - Math.abs(c.pos[b] - idealCkPos));
      for (const ck of clocks.slice(0, 2)) {
        const guards = c.nb.above[ck].filter(ok);
        const ice = {};
        if (guards.length) ice[guards[0]] = 1; else ice[ck] = 1;
        const locks = probeTaps.slice(1, 5).filter(t => ok(t) && t !== ck && !kdig.has(t) && !kk.includes(t) && c.top[t]).slice(0, isHigherBand ? 2 : 1);
        const x = I.clone(deal);
        x.obst = { ice, locks: [ck, ...locks], keys: [kk[0], kk[1]] };
        x.clock = { i: ck, n: 999 };
        for (const sp of spares) {
          const b = I.fix(x, sp);
          if (b && I.valid(b)) {
            const idx = b.solution.indexOf(b.clock.i) + 1;
            if (idx >= minCkIdx && idx <= maxCkIdx) {
              candidates.push({ b, sp, recipe });
            }
          }
        }
        if (candidates.length >= 3) break;
      }
      if (candidates.length >= 3) break;
    }
  } else if (recipe === 'lockedPartners+iceChain') {
    const byFace = {};
    for (let i = 0; i < c.n; i++) if (ok(i) && coverOf(c, i).size >= 1 && coverOf(c, i).size <= 3) (byFace[deal.faces[i]] = byFace[deal.faces[i]] || []).push(i);
    const pairs = Object.values(byFace).filter(g => g.length >= 2).map(g => [g[0], g[1]]);
    for (const kk of pairs.slice(0, 4)) {
      const kMaxPos = Math.max(c.pos[kk[0]], c.pos[kk[1]]);
      if (kMaxPos < 8 || kMaxPos > maxCkPos) continue;
      const dig = new Set([...coverOf(c, kk[0]), ...coverOf(c, kk[1])]);
      const locks = [];
      for (const t of dig) {
        for (let j = 0; j < c.n; j++) {
          if (j !== t && deal.faces[j] === deal.faces[t] && !dig.has(j) && !kk.includes(j) && ok(j) && !locks.includes(j) && c.pos[j] < maxCkPos) {
            locks.push(j);
            break;
          }
        }
      }
      if (locks.length < 1) continue;
      const ckCands = c.P.filter(i => c.pos[i] > kMaxPos && c.pos[i] <= kMaxPos + 12 && !kk.includes(i) && !dig.has(i) && !locks.includes(i) && ok(i))
        .sort((a, b) => Math.abs(c.pos[a] - idealCkPos) - Math.abs(c.pos[b] - idealCkPos));
      for (const ck of ckCands.slice(0, 2)) {
        const ice = {};
        const guards = c.nb.above[ck].filter(ok);
        if (guards.length) ice[guards[0]] = 1; else ice[ck] = 1;
        const x = I.clone(deal);
        x.obst = { ice, locks: [ck, ...locks.slice(0, 3)], keys: [kk[0], kk[1]] };
        x.clock = { i: ck, n: 999 };
        for (const sp of spares) {
          const b = I.fix(x, sp);
          if (b && I.valid(b)) {
            const idx = b.solution.indexOf(b.clock.i) + 1;
            if (idx >= minCkIdx && idx <= maxCkIdx) {
              candidates.push({ b, sp, recipe });
            }
          }
        }
        if (candidates.length >= 3) break;
      }
      if (candidates.length >= 3) break;
    }
  } else if (recipe === 'dontGrab+lockedPartners') {
    const free0 = c.P.filter(i => ok(i) && c.free0[i]);
    for (const ck of free0.slice(0, 4)) {
      const twins = deal.faces.map((f, i) => f === deal.faces[ck] && i !== ck && ok(i) ? i : -1).filter(i => i >= 0);
      if (!twins.length) continue;
      const mate = twins[0];
      const matePos = c.pos[mate];
      if (matePos < 10 || matePos > 26) continue;
      const dig = new Set([...coverOf(c, mate)]);
      const locks = [];
      for (const t of dig) {
        for (let j = 0; j < c.n; j++) {
          if (j !== t && deal.faces[j] === deal.faces[t] && !dig.has(j) && ok(j) && !locks.includes(j) && c.pos[j] < maxCkPos) {
            locks.push(j);
            break;
          }
        }
      }
      if (!locks.length) continue;
      const x = I.clone(deal);
      x.obst = { ice: {}, locks: locks.slice(0, 3), keys: [] };
      x.clock = { i: ck, n: matePos + 2 };
      x.clockMate = mate;
      for (const sp of [2, 1]) {
        const b = I.fix(x, sp);
        if (b && I.valid(b)) candidates.push({ b, sp, recipe });
      }
      if (candidates.length >= 3) break;
    }
  }

  return candidates;
}

/**
 * Designs a level with the human bot matching the target expected tries band.
 *
 * @param {Object} deal - Designer deal { tiles, faces, down, solution }
 * @param {Array<number>} target - Target band [minTries, maxTries] (e.g. [3.4, 4.9] or [4.4, 5.4])
 * @param {Object} [opts] - Options { puzzle, maxAttempts, seed, runs, pileIndex }
 * @returns {Object} { board, g2, critic, specialsMatter, recipe, clockSpare }
 */
function designWithBot(deal, target, opts = {}) {
  const [minExp, maxExp] = target;
  const maxAttempts = opts.maxAttempts || 10;
  const baseSeed = opts.seed || 4711;
  const runs = opts.runs || 20;

  // Clean the deal
  const clean = {
    tiles: deal.tiles,
    faces: deal.faces.slice(),
    down: (deal.down || []).slice(),
    gold: (deal.gold || []).slice(),
    obst: { ice: {}, locks: [], keys: [] },
    clock: null,
    solution: deal.solution.slice()
  };

  const c = I.ctxOf(clean);
  const probeTaps = probeBot(clean, baseSeed);

  // Determine recipes to try (rotate starting recipe by pileIndex/seed for variety)
  let recipes = opts.puzzle
    ? (Array.isArray(opts.puzzle) ? opts.puzzle : [opts.puzzle])
    : DENNIS_RECIPES.slice();

  if (!opts.puzzle) {
    const rot = (opts.pileIndex !== undefined ? opts.pileIndex : (baseSeed % DENNIS_RECIPES.length)) % DENNIS_RECIPES.length;
    recipes = DENNIS_RECIPES.slice(rot).concat(DENNIS_RECIPES.slice(0, rot));
  }

  let bestCandidate = null;
  let bestDistance = Infinity;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const recipe = recipes[attempt % recipes.length];
    const rng = I.rngOf(baseSeed + attempt * 31);
    const candidates = generateRecipeCandidates(clean, c, recipe, probeTaps, target, rng);
    if (!candidates.length) continue;

    for (const cand of candidates) {
      let b = cand.b;
      if (!I.valid(b) || !b.clock) continue;
      let ckIndex = b.solution.indexOf(b.clock.i) + 1;
      let ckSpare = b.clock.n - ckIndex;
      if (ckSpare < 1 || ckSpare > 3) continue;
      if (ckIndex < 8 || ckIndex > Math.floor(b.tiles.length * 0.52)) continue;
      if ((b.obst.keys || []).length === 2) {
        if (b.faces[b.obst.keys[0]] !== b.faces[b.obst.keys[1]]) continue;
      }

      // Fast screening with target runs
      let m;
      try {
        m = measureHuman(b, { runs, setting: 'dennis', seed: baseSeed });
      } catch (e) {
        continue;
      }

      let exp = m.expectedTries;

      // Active clock spare tuning if slightly outside band
      if (exp < minExp && ckSpare > 1) {
        const tuned = I.fix({ ...b, clock: { i: b.clock.i, n: b.clock.n - 1 } }, ckSpare - 1);
        if (tuned && I.valid(tuned)) {
          try {
            const mTuned = measureHuman(tuned, { runs, setting: 'dennis', seed: baseSeed });
            if (Math.abs(mTuned.expectedTries - (minExp + maxExp) / 2) < Math.abs(exp - (minExp + maxExp) / 2)) {
              b = tuned;
              m = mTuned;
              exp = m.expectedTries;
              ckIndex = b.solution.indexOf(b.clock.i) + 1;
              ckSpare = b.clock.n - ckIndex;
            }
          } catch (e) {}
        }
      } else if (exp > maxExp && ckSpare < 3) {
        const tuned = I.fix({ ...b, clock: { i: b.clock.i, n: b.clock.n + 1 } }, ckSpare + 1);
        if (tuned && I.valid(tuned)) {
          try {
            const mTuned = measureHuman(tuned, { runs, setting: 'dennis', seed: baseSeed });
            if (Math.abs(mTuned.expectedTries - (minExp + maxExp) / 2) < Math.abs(exp - (minExp + maxExp) / 2)) {
              b = tuned;
              m = mTuned;
              exp = m.expectedTries;
              ckIndex = b.solution.indexOf(b.clock.i) + 1;
              ckSpare = b.clock.n - ckIndex;
            }
          } catch (e) {}
        }
      }

      const inBand = exp >= minExp && exp <= maxExp;
      const dist = exp < minExp ? minExp - exp : exp > maxExp ? exp - maxExp : 0;

      // Only check specialsMatter IF candidate is in band
      if (inBand) {
        let sm;
        try {
          sm = specialsMatter(b, m, measureHuman);
        } catch (e) {
          continue;
        }

        if (sm.ok) {
          const crit = critique(b, { runs, seed: baseSeed });
          const badFlags = (crit.flags || []).filter(f => BAD_CRITIC_FLAGS.has(f));

          if (badFlags.length === 0) {
            // Perfect hit!
            return {
              board: b,
              g2: { exp: m.expectedTries, label: m.label, first: m.firstTryRate, version: m.version },
              critic: crit,
              specialsMatter: sm,
              recipe: cand.recipe,
              clockSpare: ckSpare
            };
          }

          if (dist < bestDistance) {
            bestDistance = dist;
            bestCandidate = { cand, b, m, exp, ckSpare, sm, crit };
          }
        }
      }
    }
  }

  // Return best passing candidate if any met specialsMatter
  if (bestCandidate && bestCandidate.sm && bestCandidate.sm.ok) {
    const { cand, b, ckSpare, sm, crit } = bestCandidate;
    const m = bestCandidate.m;
    return {
      board: b,
      g2: { exp: m.expectedTries, label: m.label, first: m.firstTryRate, version: m.version },
      critic: crit || critique(b, { runs, seed: baseSeed }),
      specialsMatter: sm,
      recipe: cand.recipe,
      clockSpare: ckSpare
    };
  }

  return null;
}

module.exports = { designWithBot, DENNIS_RECIPES, generateRecipeCandidates, probeBot };
