/* Oma's Mahjong — grit rewards, safe Lucky lookahead and board helper logic. */
'use strict';

(function (globalScope) {
  const CAT = typeof require === 'function' ? require('../shop/catalog') : globalScope;
  const ECON = typeof require === 'function' ? require('../shop/shop') : globalScope.ShopEconomy;
  const RULES = CAT.SHOP_RULES;
  const LayoutEngine = typeof require === 'function' ? require('../../../layouts') : Layouts;

  /**
   * Bijna! 5-petal Grit Flower (`rewards/grit.js`).
   * Triggers on `stuck` loss OR manual `restart` at >= 60% cleared; max 1 petal per calendar day.
   */
  function recordGritAttempt(S, { cleared = 0, total = 0, reason = 'stuck', today = ECON.localDateKey() }, hooks = {}) {
    const pct = total > 0 ? cleared / total : 0;
    if (!S.grit || typeof S.grit !== 'object') S.grit = { petals: 0, lastDay: '' };
    if (!S.stats) S.stats = {};

    if (reason !== 'stuck' && reason !== 'restart') {
      return { added: false, reason: 'invalid_reason', pct, petals: S.grit.petals, bloomed: false, coins: 0 };
    }
    if (pct + 1e-9 < RULES.grit.minClear) {
      return { added: false, reason: 'below_threshold', pct, petals: S.grit.petals, bloomed: false, coins: 0 };
    }
    if (S.grit.lastDay === today) {
      return { added: false, reason: 'already_today', pct, petals: S.grit.petals, bloomed: false, coins: 0 };
    }

    S.grit.lastDay = today;
    S.grit.petals = (Math.floor(Number(S.grit.petals) || 0)) + 1;

    let bloomed = false;
    let coins = 0;
    if (S.grit.petals >= RULES.grit.petals) {
      S.grit.petals = 0;
      bloomed = true;
      coins = RULES.grit.coins;
      ECON.addCoins(S, coins, { renderCoins: hooks.renderCoins });
      S.stats.gritBlooms = (Number(S.stats.gritBlooms) || 0) + 1;
      if (typeof hooks.log === 'function') hooks.log('grit_bloom', { coins, via: reason });
    }
    if (typeof hooks.save === 'function') hooks.save();

    return { added: true, reason: null, pct, petals: S.grit.petals, bloomed, coins };
  }

  /** Helper matching `board.js` `solveNow()` lone-joker normalization for solver checks. */
  function normalizeSolveState(tiles, alive, tray) {
    const faces = tiles.map(t => t.face);
    let trayCopy = tray.slice();
    const jb = [];
    for (let i = 0; i < tiles.length; i++) if (alive[i] && faces[i] === 101) jb.push(i);
    const jt = trayCopy.filter(t => faces[t] === 101);
    if ((jb.length + jt.length) % 2) {
      if (jt.length) trayCopy = trayCopy.filter(t => t !== jt[0]);
      else if (jb.length) faces[jb[jb.length - 1]] = -1;
    }
    return { faces, tray: trayCopy };
  }

  function hasActiveTraps(G) {
    if (!G) return false;
    if (G.clock && G.alive[G.clock.i]) return true;
    if (G.clock && G.clockClearedAt != null && (Number(G.mv) || 0) <= G.clockClearedAt) return true;
    if (G.ob) {
      if (!G.ob.unlocked && G.ob.locks) {
        for (const idx of G.ob.locks) if (G.alive[idx]) return true;
      }
      if (G.ob.left) {
        for (const k of Object.keys(G.ob.left)) {
          const i = +k;
          if (G.ob.left[i] > 0 && G.alive[i]) return true;
        }
      }
    }
    return false;
  }

  /**
   * Post-clock, post-locks/ice, non-lethal-tray Lucky selector:
   * - Never runs during tile flights (`G.flights > 0`) or match animations;
   * - Rolls Lucky chance FIRST so the solver runs only when Lucky would really fire;
   * - Enforces a hard wall-clock time budget (default `30 ms`; out of time = no Lucky).
   * `opts.solveWithState(faces, alive, tray, limit, remainingMs)` wraps `Layouts.solve(...)`.
   */
  function pickSafeLuckyTile(G, opts = {}) {
    if (!G || G.film || G.done || G.busy || G.overShown || G.autoFin || G.introducing || G.lucky) return null;
    if ((Number(G.flights) || 0) > 0) return null;
    const nowMs = opts.nowFn || (() => performance.now());
    const budgetMs = opts.timeBudgetMs ?? 30;
    const deadline = nowMs() + budgetMs;
    const perLevel = opts.perLevel || 1;
    const fromLevel = opts.fromLevel || 10;
    const level = G.mode === 'level' ? (G.level || 1) : (opts.playerLevel || 1);
    if ((G.luckyN || 0) >= perLevel || level < fromLevel) return null;

    // Roll the Lucky chance FIRST before scanning traps or invoking the solver
    const chance = opts.chance !== undefined ? opts.chance : 0.3;
    if (chance <= 0) return null;
    const roll = opts.roll !== undefined ? opts.roll : Math.random();
    if (roll > chance) return null;
    // An open peek or a live joker can pair by different rules than the quiet lookahead.
    if (G.peek >= 0 || G.tray?.some(i => G.tiles[i].face === 101)
      || G.tiles.some((tile, i) => G.alive[i] && tile.face === 101)) return null;

    const n = G.tiles.length;
    let left = 0;
    for (let i = 0; i < n; i++) if (G.alive[i]) left++;
    if (left > n * 0.8 || left < 6) return null;

    if (hasActiveTraps(G)) return null;

    const slots = opts.slots || 4;
    const tray = G.tray || [];
    if (tray.length >= slots - 1) return null; // Never trigger at 3/4 tray

    const faceOf = i => G.tiles[i].face;
    const takeable = opts.takeableFn || (i => {
      if (!G.alive[i]) return false;
      if (G.ob && G.ob.left && G.ob.left[i] > 0) return false;
      if (G.ob && !G.ob.unlocked && G.ob.locks) {
        const locked = typeof G.ob.locks.has === 'function'
          ? G.ob.locks.has(i)
          : (Array.isArray(G.ob.locks) && G.ob.locks.includes(i));
        if (locked) return false;
      }
      const nb = G.nb;
      if (!nb) return true;
      for (const j of nb.above[i]) if (G.alive[j]) return false;
      let lFree = true;
      for (const j of nb.left[i]) if (G.alive[j]) { lFree = false; break; }
      if (lFree) return true;
      for (const j of nb.right[i]) if (G.alive[j]) return false;
      return true;
    });

    const tf = new Set(tray.map(faceOf));
    const freeUp = [];
    for (let i = 0; i < n; i++) {
      if (G.alive[i] && !(G.down && G.down[i]) && takeable(i) && faceOf(i) < 100) freeUp.push(i);
    }

    const cand = tray.length === slots - 2
      ? freeUp.filter(i => tf.has(faceOf(i))) // At 2/4 tray: strictly a tile that clears a slot
      : freeUp.filter(i => tf.has(faceOf(i)) || freeUp.some(j => j !== i && faceOf(j) === faceOf(i)));
    if (!cand.length || nowMs() >= deadline) return null;

    const expired = {};
    const solveWithState = opts.solveWithState || ((faces, alive, tray, limit) => {
      // Layouts.isFree reads above for each live tile, so the search can stop
      // inside a solver call without changing the shared layouts engine.
      const checkedNeighbors = {
        get above() {
          if (nowMs() >= deadline) throw expired;
          return G.nb.above;
        },
        left: G.nb.left,
        right: G.nb.right,
      };
      try {
        return LayoutEngine.solve(G.tiles, checkedNeighbors, faces, alive, tray, limit, null, G.down);
      } catch (error) {
        if (error === expired) return null;
        throw error;
      }
    });
    const fastLimit = opts.fastLimit || 1000;
    const candLimit = opts.candLimit || 600;

    // 1. Quiet fast-path on current board within hard time budget
    if (nowMs() >= deadline) return null;
    const candSet = new Set(cand);
    const norm0 = normalizeSolveState(G.tiles, G.alive, tray);
    const p0 = solveWithState(norm0.faces, G.alive, norm0.tray, fastLimit, Math.max(0, deadline - nowMs()));
    if (nowMs() >= deadline) return null;
    if (Array.isArray(p0) && p0.length && candSet.has(p0[0])) {
      return p0[0];
    }

    // 2. Test up to 3 shuffled candidates inside remaining time budget; out of time = no Lucky
    const pool = cand.slice();
    const rng = opts.rng || Math.random;
    for (let k = pool.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [pool[k], pool[j]] = [pool[j], pool[k]];
    }

    const maxChecks = Math.min(3, pool.length);
    for (let k = 0; k < maxChecks; k++) {
      const rem = deadline - nowMs();
      if (rem <= 0) return null;
      const c = pool[k];
      const aliveNext = Uint8Array.from(G.alive);
      aliveNext[c] = 0;
      const mi = tray.findIndex(t => faceOf(t) === faceOf(c));
      const trayNext = mi >= 0 ? tray.filter((_, q) => q !== mi) : tray.concat([c]);
      if (trayNext.length >= slots) continue;
      const norm = normalizeSolveState(G.tiles, aliveNext, trayNext);
      const sol = solveWithState(norm.faces, aliveNext, norm.tray, candLimit, Math.max(0, deadline - nowMs()));
      if (nowMs() >= deadline) return null;
      if (sol) return c;
    }

    return null;
  }

  /** Oma-friendly logical daily tasks (speed-neutral; retires `points` & `combo`). */
  const TASK_TYPES_V2 = Object.freeze([
    { id: 'pairs', ico: '🀄', make: r => 20 + Math.floor(r() * 3) * 10 },
    { id: 'levels', ico: '🧩', make: r => 2 + Math.floor(r() * 2) },
    { id: 'daily', ico: '📅', make: () => 1 },
    { id: 'flow', ico: '⚡', make: r => 1 + (r() < 0.35 ? 1 : 0) },
    { id: 'stars3', ico: '⭐', make: () => 1 },
    { id: 'flips', ico: '🔄', make: r => 5 + Math.floor(r() * 2) * 5, minLevel: 6 },
    { id: 'nohelp', ico: '💪', make: () => 1, minLevel: 16 },
  ]);

  /** Replace legacy `points`/`combo` entries in today's `S.tasks` safely inside `ensureTasks()`. */
  function sanitizeTasksForToday(S, today = ECON.localDateKey(), rng = Math.random) {
    if (!S || !S.tasks || S.tasks.date !== today || !Array.isArray(S.tasks.list)) return false;
    const validIds = new Set(TASK_TYPES_V2.map(t => t.id));
    const usedIds = new Set(S.tasks.list.filter(t => t && validIds.has(t.id)).map(t => t.id));
    const pool = TASK_TYPES_V2.filter(t => (!t.minLevel || (S.level || 1) >= t.minLevel) && !usedIds.has(t.id));
    let changed = false;

    for (let i = 0; i < S.tasks.list.length; i++) {
      const t = S.tasks.list[i];
      if (!t || !validIds.has(t.id)) {
        const repl = pool.shift() || TASK_TYPES_V2[0];
        S.tasks.list[i] = { id: repl.id, goal: repl.make(rng), prog: 0, done: false };
        changed = true;
      }
    }
    return changed;
  }

  /** Fresh main-level win streak (replays & Daily Puzzles never inflate or break `S.winStreak`). */
  function stepWinStreak(S, { mode, fresh = false, won = false }) {
    if (mode !== 'level' || !fresh) return { changed: false, winStreak: S.winStreak || 0, momentumArmed: false };
    S.winStreak = won ? (Number(S.winStreak) || 0) + 1 : 0;
    return {
      changed: true,
      winStreak: S.winStreak,
      momentumArmed: Boolean(won && S.winStreak >= RULES.winStreak.momentumAt),
    };
  }

  /**
   * Next-Board Momentum (`3+ op rij`) extra Gold Pair applied inside `begin()` AFTER `G.gold` loads.
   * Works even on ready-made/hard levels (`51–349+`) where `o.specials === true`.
   */
  function pickMomentumGoldPair(G, rng = Math.random) {
    if (!G || !Array.isArray(G.tiles)) return null;
    const excluded = new Set(G.gold || []);
    if (G.clock && G.clock.i != null) excluded.add(G.clock.i);
    if (G.ob) {
      for (const k of Object.keys(G.ob.need || G.ob.left || {})) excluded.add(+k);
      for (const k of (G.ob.locks || [])) excluded.add(k);
      for (const k of (G.ob.keys || [])) excluded.add(k);
    }

    const byFace = new Map();
    for (let i = 0; i < G.tiles.length; i++) {
      if (!G.alive[i] || (G.down && G.down[i]) || excluded.has(i)) continue;
      const f = G.tiles[i].face;
      if (f >= 100 || f < 0) continue;
      if (!byFace.has(f)) byFace.set(f, []);
      byFace.get(f).push(i);
    }

    const pairs = Array.from(byFace.values()).filter(arr => arr.length >= 2);
    if (!pairs.length) return null;
    const chosen = pairs[Math.floor(rng() * pairs.length)];
    return [chosen[0], chosen[1]];
  }

  /** Remove all neighbor edges for `tileIdx` so a parked returned tile never blocks/affects board tiles. */
  function detachTileNeighbors(nb, tileIdx) {
    if (!nb) return;
    nb.above[tileIdx] = [];
    nb.left[tileIdx] = [];
    nb.right[tileIdx] = [];
    for (let k = 0; k < nb.above.length; k++) {
      if (k === tileIdx) continue;
      nb.above[k] = nb.above[k].filter(x => x !== tileIdx);
      nb.left[k] = nb.left[k].filter(x => x !== tileIdx);
      nb.right[k] = nb.right[k].filter(x => x !== tileIdx);
    }
  }

  function rectsCloserThan(aL, aT, aW, aH, b, margin) {
    return !(aL + aW + margin <= b.l || b.l + b.w + margin <= aL || aT + aH + margin <= b.t || b.t + b.h + margin <= aT);
  }

  /**
   * Compute where a tile returned by `Steen terugleggen` (`600 🪙`) lands (`board.js`):
   * - Original `(t.x, t.y, t.z)` when open/unobstructed;
   * - Otherwise a tight adjacent holding spot (`t.parked = true`) beside the alive cluster
   *   inside `#boardWrap`, with `>= 0.25–0.35 * tw` gap so it never overlaps, blocks, or rescales.
   */
  function findReturnPlacement(G, tileIdx, wrapW, wrapH) {
    const t = G.tiles[tileIdx];
    const aboveAlive = Boolean(G.nb && G.nb.above[tileIdx] && G.nb.above[tileIdx].some(j => G.alive[j]));
    let sameLayerOverlap = false;
    for (let j = 0; j < G.tiles.length; j++) {
      if (j === tileIdx || !G.alive[j]) continue;
      const o = G.tiles[j];
      if (o.z >= t.z && Math.abs(o.x - t.x) < 2 && Math.abs(o.y - t.y) < 2) {
        sameLayerOverlap = true;
        break;
      }
      // Only a previously parked tile (which sits outside board coordinates) needs a screen-rect overlap check;
      // normal adjacent z+1 tiles shifted by 3D depth bevel do NOT obstruct returning to (t.x, t.y, t.z).
      if (o.parked && t.r && o.r && rectsCloserThan(t.r.l, t.r.t, t.r.w, t.r.h, o.r, 0)) {
        sameLayerOverlap = true;
        break;
      }
    }

    if (!aboveAlive && !sameLayerOverlap) {
      return {
        mode: 'original',
        parked: false,
        l: t.r ? t.r.l : 0,
        t: t.r ? t.r.t : 0,
        w: t.r ? t.r.w : (G.tw || 48) - 1.5,
        h: t.r ? t.r.h : ((G.tw || 48) * 1.24) - 1.5,
        zi: t.r ? t.r.zi : (t.z * 10000 + t.y * 100 + t.x),
      };
    }

    const aliveRects = [];
    let minL = Infinity, maxR = -Infinity, minT = Infinity, maxB = -Infinity;
    let sumX = 0, sumY = 0;
    for (let j = 0; j < G.tiles.length; j++) {
      if (!G.alive[j] || j === tileIdx || !G.tiles[j].r) continue;
      const r = G.tiles[j].r;
      aliveRects.push(r);
      minL = Math.min(minL, r.l);
      maxR = Math.max(maxR, r.l + r.w);
      minT = Math.min(minT, r.t);
      maxB = Math.max(maxB, r.t + r.h);
      sumX += r.l + r.w / 2;
      sumY += r.t + r.h / 2;
    }

    const tw = G.tw || (t.r ? t.r.w + 1.5 : 48);
    const w = t.r ? t.r.w : +(tw - 1.5).toFixed(1);
    const h = t.r ? t.r.h : +(tw * 1.24 - 1.5).toFixed(1);
    const pad = 4;
    const gap = Math.max(4, Math.round(tw * 0.30));
    const gapMin = Math.max(4, Math.round(tw * 0.25));

    if (!aliveRects.length) {
      if (!Number.isFinite(wrapW) || !Number.isFinite(wrapH) || wrapW < w || wrapH < h) return null;
      return { mode: 'parked', parked: true, l: Math.round((wrapW - w) / 2), t: Math.round((wrapH - h) / 2), w, h, zi: 9000 };
    }

    const cx = sumX / aliveRects.length;
    const cy = sumY / aliveRects.length;
    const maxX = wrapW - w - pad;
    const maxY = wrapH - h - pad;
    if (!Number.isFinite(wrapW) || !Number.isFinite(wrapH) || maxX < pad - 0.1 || maxY < pad - 0.1) {
      return null;
    }

    const isFreeSpot = (x, y, clearance) => {
      if (x < pad - 0.1 || x > maxX + 0.1 || y < pad - 0.1 || y > maxY + 0.1) return false;
      for (const r of aliveRects) if (rectsCloserThan(x, y, w, h, r, clearance)) return false;
      return true;
    };

    const stepY = Math.max(10, Math.round(h * 0.5));
    const stepX = Math.max(10, Math.round(w * 0.5));

    for (const flankGap of [gap, gapMin]) {
      const candidates = [];
      // Right flank, Left flank, Bottom edge, Top edge (tight to alive cluster)
      const flanksX = [maxR + flankGap, minL - w - flankGap];
      for (const x of flanksX) {
        for (let d = 0; d <= Math.max(wrapH, 300); d += stepY) {
          candidates.push({ x, y: cy - h / 2 + d });
          if (d > 0) candidates.push({ x, y: cy - h / 2 - d });
        }
      }
      const flanksY = [maxB + flankGap, minT - h - flankGap];
      for (const y of flanksY) {
        for (let d = 0; d <= Math.max(wrapW, 300); d += stepX) {
          candidates.push({ x: cx - w / 2 + d, y });
          if (d > 0) candidates.push({ x: cx - w / 2 - d, y });
        }
      }

      for (const c of candidates) {
        const rx = +c.x.toFixed(1), ry = +c.y.toFixed(1);
        if (isFreeSpot(rx, ry, flankGap)) {
          return { mode: 'parked', parked: true, l: rx, t: ry, w, h, zi: 9000 };
        }
      }
    }

    // Interior cleared grid scan sorted nearest to alive centroid
    const gridPts = [];
    for (let x = pad; x <= maxX; x += Math.max(8, Math.round(w * 0.35))) {
      for (let y = pad; y <= maxY; y += Math.max(8, Math.round(h * 0.35))) {
        const dx = (x + w / 2) - cx;
        const dy = (y + h / 2) - cy;
        gridPts.push({ x: +x.toFixed(1), y: +y.toFixed(1), dist: dx * dx + dy * dy });
      }
    }
    gridPts.sort((a, b) => a.dist - b.dist);

    for (const minClr of [gap, gapMin, Math.max(2, Math.round(gap * 0.5)), 2, 0]) {
      for (const p of gridPts) {
        if (isFreeSpot(p.x, p.y, minClr)) {
          return { mode: 'parked', parked: true, l: p.x, t: p.y, w, h, zi: 9000 };
        }
      }
    }

    return null;
  }

  /**
   * Return 1 chosen tray tile back onto the board:
   * keeps `G.mv` unchanged, clears `G.clock` if returning former clock tile, and detaches `G.nb` if parked.
   * Returns `{ ok: false, reason: 'no_placement' }` without mutating state when no non-overlapping spot exists;
   * live `board.js` integration MUST validate `findReturnPlacement` / `applyTileReturn` BEFORE spending the token.
   */
  function applyTileReturn(G, tileIdx, wrapW, wrapH) {
    const pos = G.tray.indexOf(tileIdx);
    if (pos < 0) return { ok: false, reason: 'not_in_tray' };

    const place = findReturnPlacement(G, tileIdx, wrapW, wrapH);
    if (!place) return { ok: false, reason: 'no_placement' };
    G.tray.splice(pos, 1);
    G.alive[tileIdx] = 1;
    if (G.down) G.down[tileIdx] = 0; // Tray tiles are always face-up

    if (G.clock && G.clock.i === tileIdx) {
      G.clock = null; // Former clock tile returns as a plain tile
    }

    const tile = G.tiles[tileIdx];
    tile.r = { l: place.l, t: place.t, w: place.w, h: place.h, zi: place.zi };
    tile.parked = place.parked;
    if (place.parked && G.nb) detachTileNeighbors(G.nb, tileIdx);

    return { ok: true, tileIdx, place };
  }

  /**
   * Compute Spieken targets (`👁️ Spieken`, 450 🪙):
   * - `faceDownIds`: ALL alive face-down tiles only (no see-through covers, no pulsing twins).
   */
  function computeXrayTargets(G) {
    if (!G || !Array.isArray(G.tiles) || !G.alive) {
      return { faceDownIds: [] };
    }
    const faceDownIds = [];
    for (let i = 0; i < G.tiles.length; i++) {
      if (G.alive[i] && G.down && G.down[i]) faceDownIds.push(i);
    }
    return { faceDownIds };
  }

  const exportsObj = {
    TASK_TYPES_V2,
    recordGritAttempt,
    pickSafeLuckyTile,
    sanitizeTasksForToday,
    stepWinStreak,
    pickMomentumGoldPair,
    detachTileNeighbors,
    findReturnPlacement,
    applyTileReturn,
    computeXrayTargets,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  } else {
    globalScope.PrepBoard = exportsObj;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
