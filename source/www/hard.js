/* Oma's Mahjong — the test player and the harder levels (from RULES.hard.from).

   THE TEST PLAYER plays a level the way a sensible person does, so we can measure how hard a level
   really is (the old test player in layouts.js could see under face-down tiles and ignored ice and
   locks; real players beat its levels far more often than it did). It
   - only knows a face-down tile once it can turn it over (a tile you can tap is always peeked),
   - respects ice, locks and the alarm clock,
   - takes a tray match at once; otherwise it weighs every pair and every tile it could park in the
     tray: how full the tray gets, how deep the twins of the waiting tiles are buried, how many
     tiles and pairs are free afterwards, and how much time the alarm clock leaves,
   - makes human mistakes: it picks among the moves by their score with some noise (`temp`).
   Its settings (P) were fitted to how Dennisisdebeste and Mrs. Doubtfire did on levels 50-74.

   A level for the test player: { tiles, nb, faces, down (0/1 per tile), rules (ice/locks, or
   null), clock ({ i, n }: tile i must be off the board within n moves, or null) }. */
'use strict';
const Hard = (() => {
  const L = typeof Layouts !== 'undefined' ? Layouts : require('./layouts.js');
  const SLOTS = L.SLOTS;
  // the sensible player. Personas re-fitted 2026-10-15 to 363 real attempts on the exact boards
  // (tools/sim/refit, analysis/honest-refit.md):
  // - unknown 0: real players are not afraid of a tray tile whose twin they have not seen yet;
  // - reveal 8: they dig where the uncovered tiles are likely to fit something (smart guessing,
  //   found in Dennisisdebeste's replay of level 102: the test player had 0%, he won);
  // - plan 10: with 10 moves or fewer left on the alarm clock they plan the way to the clock tile
  //   (his replay of level 105: from his opening the test player lost 9 of 10, now about 9 of 10 won).
  // strong ~ Dennisisdebeste (first tries 80-89: 0.71 real, 0.70 test player), average ~ Mrs. Doubtfire.
  // memory: on a retry, the chance to remember a picture seen at the start / middle / end of the lost
  //   try (rate2; fitted to real retries: Dennisisdebeste about half, Mrs. Doubtfire none).
  // focused: the old clock-focused calibration model, kept for comparison.
  // end: with this many tiles left and all of them seen, it works out the rest exactly
  const P = { tray: [0, 1, 3, 9], deep: 1.0, unknown: 7, free: 0.25, pairs: 0.8, clock: 3, temp: 3.5, end: 12 };
  const REF = { strong: { temp: 1.5, end: 12, clockFocus: 1, unknown: 0, reveal: 8, plan: 10, memory: [0.5, 0.3, 0.5] }, focused: { temp: 0.7, end: 20, clockFocus: 4 }, sensible: { temp: 3, end: 12, clockFocus: 4, unknown: 0, reveal: 8, plan: 10, memory: [0.5, 0.3, 0.5] }, average: { temp: 4.5, end: 12, clockFocus: 4, unknown: 0, reveal: 8, plan: 10, memory: 0 } };
  const persona = k => ({ ...P, ...REF[k] });
  // tiles lying exactly on top of a tile hide it completely (towers in the harder piles)
  const coverOf = (tiles, nb) => tiles.map((t, i) => nb.above[i].filter(j => tiles[j].x === t.x && tiles[j].y === t.y));

  /* ---------- one game ---------- */
  function play(g, p = P, seed = 1, trace = null) {
    const { tiles, nb, faces } = g, n = tiles.length;
    const r = L.rng(seed);
    const alive = new Uint8Array(n).fill(1), alive0 = new Uint8Array(n).fill(1);
    const rules = g.rules || null;
    const down = g.down || new Uint8Array(n);
    const can = i => rules ? L.takeable(i, alive, nb, rules, alive0) : L.isFree(i, alive, nb);
    const tray = [];        // faces waiting
    let moves = 0, left = n;
    const clock = g.clock && g.clock.i >= 0 ? g.clock : null;
    let choices = 0, decisions = 0, risky = 0, blind = 0, forcedBlind = 0, unknownOptions = 0, singleOptions = 0;
    const cover = g.cover || (g.cover = coverOf(tiles, nb));

    // how many tiles have to go before tile j can be taken (the ones on top of it, all the way up,
    // plus the shorter side of its row; ice: the hits still needed; a lock: its two keys)
    const memo = new Int16Array(n);
    let stamp = 1; const seen = new Int32Array(n);
    function depth(j) {
      if (memo[j]) return memo[j] - 1;
      // tiles on top (transitively)
      stamp++; let up = 0;
      const st = [j]; seen[j] = stamp;
      while (st.length) { const k = st.pop(); for (const a of nb.above[k]) if (alive[a] && seen[a] !== stamp) { seen[a] = stamp; up++; st.push(a); } }
      const side = d => { let c = 0, k = j; for (;;) { const nx = (d < 0 ? nb.left[k] : nb.right[k]).find(x => alive[x]); if (nx === undefined) return c; c++; k = nx; if (c > 12) return c; } };
      let v = up + Math.min(side(-1), side(1));
      if (rules && rules.ice && rules.ice[j]) { let gone = 0; for (const q of rules.iceNb[j]) if (alive0[q] && !alive[q]) gone++; v += Math.max(0, rules.ice[j] - gone); }
      if (rules && rules.locks && rules.locks.has(j)) for (const k of rules.keys) if (alive[k]) v += 1 + up;
      memo[j] = v + 1;
      return v;
    }
    // the tiles of each picture (so the tray's twins are found without looking at every tile)
    const byFace = new Map(); faces.forEach((f, i) => { if (!byFace.has(f)) byFace.set(f, []); byFace.get(f).push(i); });
    const hiddenNow = i => { for (const j of cover[i]) if (alive[j]) return true; return false; };
    // a retry (g.memory): the pictures it remembers from the try before (the same board comes back),
    // also of tiles that are face down or covered now. seenEver: what this try showed it (for the next)
    const mem = g.memory || null, seenEver = new Int16Array(n);   // seenEver: 1 + the move at which it was first seen
    const sees = i => can(i) || (!down[i] && !hiddenNow(i)) || (mem !== null && mem[i] === 1);
    // Freeze knowledge BEFORE trying a move. Hypothetically uncovering a tile must not give
    // its picture away while deciding which covering tile to take. Free tiles can be peeked.
    const known = new Uint8Array(n), freeNow = new Uint8Array(n), cnt = new Int16Array(256);
    // smart guessing (p.reveal): the pictures it has not seen yet, counted the way a person counts
    // what is still missing (how many of each, never where they are)
    const unseen = new Int16Array(256); let unseenN = 0;
    function score(tr) {
      memo.fill(0);
      let s = -p.tray[Math.min(3, tr.length)];
      let fr = 0, unk = 0; cnt.fill(0);
      for (let i = 0; i < n; i++) {
        if (!alive[i]) { freeNow[i] = 0; continue; }
        const f = can(i) ? 1 : 0; freeNow[i] = f;
        if (f) { fr++; if (known[i]) cnt[faces[i] & 255]++; else unk++; } else if ((down[i] || hiddenNow(i)) && !(mem !== null && mem[i] === 1)) unk++;
      }
      for (const f of tr) {
        let best = 1e9;
        for (const i of byFace.get(f)) if (alive[i] && known[i] && (freeNow[i] || (!down[i] && !hiddenNow(i)) || (mem !== null && mem[i] === 1))) { const d = depth(i); if (d < best) best = d; }
        s -= best < 1e9 ? p.deep * best : p.unknown + unk / 12;
      }
      let pr = 0, safe = 0;
      for (const [f, list] of byFace) {
        const c = cnt[f & 255]; if (!c) continue;
        if (tr.includes(f)) { pr += 2; safe++; continue; }
        if (c < 2) continue;
        pr++;
        // a pair with a face-down tile in it needs no slot (turn it over, then tap its twin)
        for (const i of list) if (alive[i] && freeNow[i] && down[i]) { safe++; break; }
      }
      s += p.free * fr + p.pairs * pr;
      // tiles this move uncovers that it could not see before: each is a draw from the pictures still
      // missing. A draw that fits a waiting tile, or a free tile without a partner, is worth a pair.
      if (p.reveal && unseenN) {
        let nf = 0; for (let i = 0; i < n; i++) if (freeNow[i] && !known[i]) nf++;
        if (nf) {
          let hit = 0;
          for (const f of tr) hit += unseen[f & 255];
          for (const [f] of byFace) { const c = cnt[f & 255]; if (c & 1 && !tr.includes(f)) hit += unseen[f & 255]; }
          s += p.reveal * nf * Math.min(1, hit / unseenN);
        }
      }
      if (tr.length >= SLOTS - 1 && !safe) {
        // stuck for sure, unless the move uncovered tiles it has not seen yet (one may fit)
        let nf = 0; for (let i = 0; i < n; i++) if (freeNow[i] && !known[i]) nf++;
        s -= nf ? 20 : 1000;
      }
      if (clock && alive[clock.i]) {
        const slack = clock.n - moves - depth(clock.i) - 1;
        if (slack < 0) s -= 1000; else s -= p.clock * Math.max(0, 6 - slack);
        s -= (p.clockFocus || 0) * depth(clock.i);
      }
      return s;
    }
    const clockTight = () => { if (!clock || !alive[clock.i]) return false; memo.fill(0); return clock.n - moves - depth(clock.i) - 1 <= 0; };
    const take = i => { alive[i] = 0; left--; moves++; const q = tray.indexOf(faces[i]); if (q >= 0) tray.splice(q, 1); else tray.push(faces[i]); };
    const at = new Int16Array(n).fill(-1);       // the move at which each tile was taken
    const commit = i => {
      if (clock && alive[clock.i] && moves >= clock.n) return false;
      at[i] = moves; if (!seenEver[i]) seenEver[i] = moves + 1; const q = trayT.findIndex(t => faces[t] === faces[i]); if (q >= 0) trayT.splice(q, 1); else trayT.push(i); take(i);
      return true;
    };
    const trayT = [];      // the waiting tiles themselves (for the exact end game)
    let plan = null;
    // start from a position in the middle of a game: these tiles were taken already, in this order
    // (tools/sim/refit/replay.js plays on from a real player's position)
    if (g.start) for (const i of g.start) if (!commit(i)) return end(false, 'clock');
    // the end game: everything left is in sight, so work it out exactly (ice counted from now on)
    function endGame() {
      if (!p.end || left > p.end) return null;
      for (let i = 0; i < n; i++) if (alive[i] && !sees(i)) return null;
      let ru = null;
      if (rules) {
        const ice = {};
        for (const k in rules.ice) { let gone = 0; for (const q of rules.iceNb[k]) if (alive0[q] && !alive[q]) gone++; const h = rules.ice[k] - gone; if (h > 0) ice[k] = h; }
        ru = { iceNb: rules.iceNb, ice, locks: rules.locks, keys: rules.keys };
      }
      const path = L.solve(tiles, nb, faces, alive, trayT, 3000, ru);
      if (!path || (clock && alive[clock.i] && path.indexOf(clock.i) >= clock.n - moves)) return [];   // no way found: play on by feel
      return path;
    }

    // planning for the alarm clock (p.plan: how many moves ahead): with the moves that are left,
    // find a way to take the clock tile in time using only what it can see now, without filling
    // the tray, and ending with at most 2 waiting (or a seen tile that fits). A face-down tile
    // that a move would uncover cannot be planned with. Dennisisdebeste on level 105: from his
    // opening the test player lost 9 of 10 games; he planned the 11 moves to the clock tile.
    let cplan = null;
    const seen0 = new Uint8Array(n);
    function clockSearch() {
      const budget = clock.n - moves;
      if (budget > p.plan) return null;
      for (let i = 0; i < n; i++) seen0[i] = alive[i] && sees(i) ? 1 : 0;
      const usable = i => alive[i] && seen0[i] && can(i);
      const path = [], visited = new Set();
      let nodes = 0, found = null;
      const put = i => { const t = tray.slice(); take(i); path.push(i); return t; };
      const undo = (i, t) => { alive[i] = 1; left++; moves--; path.pop(); tray.length = 0; tray.push(...t); };
      function ok() {
        if (tray.length <= SLOTS - 2) return true;
        for (let i = 0; i < n; i++) if (usable(i) && tray.includes(faces[i])) return true;
        return false;
      }
      function rec() {
        if (!alive[clock.i]) { if (ok()) { found = path.slice(); return true; } return false; }
        if (++nodes > (p.planNodes || 3000)) return true;
        memo.fill(0);
        if (moves + depth(clock.i) + 1 > clock.n) return false;
        const key = path.slice().sort((a, b) => a - b).join(',') + '|' + tray.slice().sort().join(',');
        if (visited.has(key)) return false; visited.add(key);
        const fr = []; for (let i = 0; i < n; i++) if (usable(i)) fr.push(i);
        const tries = [];
        // the clock tile itself first, then tiles that fit a waiting one, then pairs, then single tiles
        // on the way to the clock (the ones lying on it or next to it), then any other single tile
        const cone = new Set(); { const st = [clock.i]; while (st.length) { const k = st.pop(); for (const a of nb.above[k]) if (alive[a] && !cone.has(a)) { cone.add(a); st.push(a); } } for (const d of [nb.left, nb.right]) { let k = clock.i; for (let c = 0; c < 6; c++) { const x = d[k].find(q => alive[q]); if (x === undefined) break; cone.add(x); k = x; } } }
        const twin = i => fr.find(j => j !== i && faces[j] === faces[i]);
        if (can(clock.i)) { const t = twin(clock.i); if (t !== undefined) tries.push([clock.i, t]); tries.push([clock.i]); }
        for (const i of fr) if (i !== clock.i && tray.includes(faces[i])) tries.push([i]);
        for (let a = 0; a < fr.length; a++) for (let b = a + 1; b < fr.length; b++) if (fr[a] !== clock.i && fr[b] !== clock.i && faces[fr[a]] === faces[fr[b]] && !tray.includes(faces[fr[a]])) {
          const pr = down[fr[a]] && !down[fr[b]] ? [fr[b], fr[a]] : [fr[a], fr[b]];
          if (tray.length <= SLOTS - 2 || down[fr[a]] || down[fr[b]]) tries.push(pr);
        }
        if (tray.length < SLOTS - 1) {
          for (const i of fr) if (i !== clock.i && cone.has(i) && !tray.includes(faces[i])) tries.push([i]);
          for (const i of fr) if (i !== clock.i && !cone.has(i) && !tray.includes(faces[i])) tries.push([i]);
        }
        for (const o of tries) {
          if (moves + o.length > clock.n && alive[clock.i] && o[0] !== clock.i) continue;
          const saved = [];
          for (const i of o) saved.push([i, put(i)]);
          const done = (tray.length < SLOTS) && rec();
          for (let q = saved.length - 1; q >= 0; q--) undo(saved[q][0], saved[q][1]);
          if (done) return true;
        }
        return false;
      }
      rec();
      return found;
    }

    while (left > 0) {
      if (clock && alive[clock.i] && moves >= clock.n) return end(false, 'clock');
      if (p.plan && clock && alive[clock.i]) {
        if (cplan && cplan.length && !(alive[cplan[0]] && can(cplan[0]))) cplan = null;
        if (!cplan || !cplan.length) cplan = clockSearch();
        if (cplan && cplan.length) { if (!commit(cplan.shift())) return end(false, 'clock'); continue; }
      }
      const fr = []; for (let i = 0; i < n; i++) if (can(i)) fr.push(i);
      if (!fr.length) return end(false, 'none');
      const m = fr.find(i => tray.includes(faces[i]));
      if (!plan) plan = endGame();
      if (plan && plan.length) { if (!commit(plan.shift())) return end(false, 'clock'); continue; }
      // a tile that fits a waiting one is taken at once, unless the alarm clock cannot wait: then the
      // clock tile (or the way to it) comes first and the match is just one of the options
      // (Dennisisdebeste on level 105: took the clock tile as move 13 of 13, the match after it)
      if (m !== undefined && !clockTight()) { if (!commit(m)) return end(false, 'clock'); continue; }
      // the options: a pair (two tiles that are free), or one tile into the tray. With 3 tiles
      // waiting only a pair with a face-down tile in it is left: turned over, it matches its twin
      // straight away without a slot (board.js peekPair); any other tile would be the 4th.
      // p.blunder: how often, with 3 tiles waiting, it does not watch the tray and plays as if there
      // were room (a pair goes through the tray, so its first tile is the 4th: the level is over).
      // Gerda does this (analysis/archive/gerda-investigation.md).
      const careless = !!p.blunder && tray.length >= SLOTS - 1 && r() < p.blunder;
      const full = tray.length >= SLOTS - 1 && !careless;
      const opts = [];
      const byF = new Map(); for (const i of fr) { const f = faces[i]; if (!byF.has(f)) byF.set(f, []); byF.get(f).push(i); }
      for (const [, list] of byF) if (list.length >= 2) for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) if (!full || down[list[a]] || down[list[b]]) opts.push(down[list[a]] && !down[list[b]] ? [list[b], list[a]] : [list[a], list[b]]);   // the face-down one is turned over, the other tapped and taken first (board.js)
      if (!full) for (const i of fr) opts.push([i]);
      if (!opts.length) return end(false, 'tray');
      decisions++; choices += opts.length;
      for (let i = 0; i < n; i++) { known[i] = alive[i] && sees(i) ? 1 : 0; if (known[i] && !seenEver[i]) seenEver[i] = moves + 1; }
      if (p.reveal) { unseen.fill(0); unseenN = 0; for (let i = 0; i < n; i++) if (alive[i] && !known[i]) { unseen[faces[i] & 255]++; unseenN++; } }
      const mateKnown = i => tray.includes(faces[i]) || byFace.get(faces[i]).some(j => j !== i && alive[j] && known[j]);
      const unknown = fr.filter(i => !mateKnown(i)).length;
      unknownOptions += unknown; singleOptions += fr.length;
      if (unknown === fr.length) forcedBlind++;
      const sc = opts.map(o => {
        const tr = tray.slice();
        // the alarm clock rings when a move is made after its last one with the clock tile still there
        let rang = false;
        const tk = i => { if (clock && alive[clock.i] && moves >= clock.n) rang = true; take(i); };
        o.forEach(tk);
        // the obvious follow-up: tray matches that are now free
        const extra = [];
        for (let guard = 0; guard < 6; guard++) { let k = -1; for (const f of tray) { for (const i of byFace.get(f)) if (alive[i] && known[i] && can(i)) { k = i; break; } if (k >= 0) break; } if (k < 0) break; tk(k); extra.push(k); }
        const v = rang ? -1e4 : score(tray);
        for (let q = extra.length - 1; q >= 0; q--) { alive[extra[q]] = 1; left++; moves--; }
        for (let q = o.length - 1; q >= 0; q--) { alive[o[q]] = 1; left++; moves--; }
        tray.length = 0; tray.push(...tr);
        return v;
      });
      // pick: the best with a human amount of noise
      const mx = Math.max(...sc);
      const w = sc.map(v => Math.exp((v - mx) / Math.max(0.01, p.temp)));
      let x = r() * w.reduce((a, b) => a + b, 0), k = 0;
      while (k < w.length - 1 && (x -= w[k]) > 0) k++;
      if (trace) trace.push({ tray: tray.slice(), opts: opts.length, pick: opts[k], best: sc.indexOf(mx) === k });
      if (opts[k].length === 1 && tray.length === SLOTS - 2) risky++;   // a third tile waits: one more miss ends the level
      if (opts[k].length === 1 && !mateKnown(opts[k][0])) blind++;
      if (careless && !opts[k].some(i => tray.includes(faces[i])) && !(opts[k].length === 2 && (down[opts[k][0]] || down[opts[k][1]]))) return end(false, 'tray');
      for (const i of opts[k]) if (!commit(i)) return end(false, 'clock');
    }
    return end(tray.length === 0, tray.length ? 'tray' : 'win');
    function end(win, why) { return { win, why, left, moves, at, seen: seenEver, risky, decisions, blind, forcedBlind, unknownOptions, singleOptions, choices: decisions ? choices / decisions : 0 }; }
  }
  // share of games the test player wins (the same seeds every time, so two levels compare fairly)
  // risky: how often a winning game had to let a third tile wait (tray pressure)
  function* rateG(g, runs = 60, seed = 1, p = P) {
    let w = 0, ch = 0, rk = 0;
    for (let k = 0; k < runs; k++) { const r = play(g, p, seed * 7919 + k * 104729); if (r.win) { w++; rk += r.risky; } ch += r.choices; yield; }
    return { rate: w / runs, choices: ch / runs, risky: w ? rk / w : null };
  }
  const drain = it => { for (;;) { const s = it.next(); if (s.done) return s.value; } };
  function rate(g, runs = 60, seed = 1, p = P) { return drain(rateG(g, runs, seed, p)); }
  // first try and a second try after losing it: the same board, now remembering each picture it saw
  // on the first try with chance memP. memP can also be [start, middle, end]: the chance for a
  // picture first seen in the first, middle or last third of the lost try (a person remembers the
  // start and the end of a game better than the middle). two: share of games won within two tries
  function remembered(seen, moves, memP, r) {
    const m = new Uint8Array(seen.length), third = Math.max(1, moves) / 3;
    for (let i = 0; i < seen.length; i++) {
      if (!seen[i]) continue;
      const q = Array.isArray(memP) ? memP[Math.min(2, Math.floor((seen[i] - 1) / third))] : memP;
      if (r() < q) m[i] = 1;
    }
    return m;
  }
  // tries 1..maxT on the same board, each remembering (memP) what the lost tries before it showed;
  // cond[t-1]: the chance to win try t when tries 1..t-1 were lost (null: no game got that far)
  function rateChain(g, runs = 60, seed = 1, p = P, memP = p.memory === undefined ? 1 : p.memory, maxT = 4) {
    const reach = new Array(maxT).fill(0), won = new Array(maxT).fill(0), r = L.rng(seed * 31 + 11);
    for (let k = 0; k < runs; k++) {
      let memory = null;
      for (let t = 0; t < maxT; t++) {
        reach[t]++;
        const a = play(memory ? { ...g, memory } : g, p, seed * 7919 + k * 104729 + t * 15485863);
        if (a.win) { won[t]++; break; }
        const m = remembered(a.seen, a.moves, memP, r);
        if (memory) for (let i = 0; i < m.length; i++) m[i] |= memory[i];
        memory = m;
      }
    }
    return { first: won[0] / runs, cond: reach.map((n, t) => n ? won[t] / n : null), within: won.map((w, t) => won.slice(0, t + 1).reduce((a, b) => a + b, 0) / runs) };
  }
  function rate2(g, runs = 60, seed = 1, p = P, memP = p.memory === undefined ? 1 : p.memory) {
    let w1 = 0, w2 = 0, again = 0;
    const r = L.rng(seed * 31 + 7);
    for (let k = 0; k < runs; k++) {
      const a = play(g, p, seed * 7919 + k * 104729);
      if (a.win) { w1++; continue; }
      const memory = remembered(a.seen, a.moves, memP, r);
      again++;
      if (play({ ...g, memory }, p, seed * 6007 + k * 15485863).win) w2++;
    }
    return { first: w1 / runs, two: (w1 + w2) / runs, second: again ? w2 / again : null };
  }


  /* ---------- the harder levels ----------
     Settings in RULES.hard (rules.js). From `measureFrom` the test player decides how hard a level
     is; from `from` the levels are built differently:
     - piles of towers: tiles right on top of each other, straight rows, 5-6 layers (fewer ways
       through; a tower hides what is under it until you dig),
     - a tile lying on its own twin (it has to go to the tray first),
     - face-down tiles only where they hurt: tiles you can see but not take yet (a free tile can
       be turned over anyway), capped at 20% from 80; never a tile that is the only way out
       when the tray holds 3 (that move must always be visible),
     - the deal is improved step by step until the sensible test player gets about the target
       share of first tries (pairs that are a trap come out of this by themselves),
     - from `clockFrom`: the alarm clock, a tile that has to be off the board within n moves.
     make() is a generator: the game runs it in small steps while the player is busy with the level
     before (board.js), and keeps the result. The same level and screen shape always give the same
     result, on every phone (fixed numbers of steps, no clocks). */
  const GENV = 5;      // honest observer, more visible information, measured neighboring progression
  const DEF = { measureFrom: 70, from: 75, rebuildFrom: 80, clockFrom: 80, sense: 0.69, start: 0.42, end: 0.22, endLevel: 120, strongSense: 0.88, strongCurve: [[75, 0.70], [85, 0.60], [100, 0.45], [120, 0.35], [150, 0.30], [269, 0.18]], maxDown: 0.20, minTile: 54, minTileBig: 48, runs: 36, risky: 5, pile: 'classic', twin: 0.5, rounds: 12, deals: 6, steps: 12, extraEvery: 10, extraMax: 8, screen: 20, piles: 8, maxTiles: 88 };
  const cfg = () => Object.assign({}, DEF, (typeof RULES !== 'undefined' && RULES.hard) || {});
  // the share of first tries the sensible and the strong test player should win (the strong one
  // plays like Dennisisdebeste: a level that only suits the middle player can still be a coin flip
  // or a walk-over for him, so both count)
  function target(level, who = 'sensible') {
    const c = cfg(), st = who === 'strong';
    if (level < c.from) return st ? c.strongSense : c.sense;
    if (st && c.strongCurve && c.strongCurve.length) {
      const points = c.strongCurve;
      if (level <= points[0][0]) return points[0][1];
      for (let i = 1; i < points.length; i++) {
        const [a, x] = points[i - 1], [b, y] = points[i];
        if (level <= b) return x + (y - x) * (level - a) / (b - a);
      }
      return points[points.length - 1][1];
    }
    const f = Math.min(1, (level - c.from) / Math.max(1, c.endLevel - c.from));
    return st ? c.strongStart + (c.strongEnd - c.strongStart) * f : c.start + (c.end - c.start) * f;
  }
  // how big a tile gets on a typical phone (a 392 x 600 pixel pile area, as in board.js layoutBoard)
  function tilePx(tiles) {
    let l = 1e9, r = -1e9, t0 = 1e9, b = -1e9;
    for (const t of tiles) { const x = t.x / 2 - t.z * 0.14, y = t.y / 2 * 1.24 - t.z * 0.14; l = Math.min(l, x); r = Math.max(r, x + 1); t0 = Math.min(t0, y); b = Math.max(b, y + 1.24); }
    return Math.min(384 / (r - l + 0.125), 592 / (b - t0 + 0.16));
  }
  const size = (level, scale) => { const e = L.effLevel(level); let t = L.targetFor(Math.round(e)); if (e > 26) t = L.targetFor(level); t = Math.max(8, Math.round(t * scale)); return t - t % 2; };
  function twinsOn(faces, nb) { let c = 0; for (let d = 0; d < faces.length; d++) for (const u of nb.above[d]) if (faces[u] === faces[d]) { c++; break; } return c; }
  /* A deal along a way through (like Layouts.deal, so it can always be finished): walk a random
     order in which the tiles can be taken; each tile either starts a picture that waits in the
     tray (open) or finishes one that waits. twin: how often a tile finishes the picture of a tile
     lying right on top of it (a twin on its twin). Returns the faces and that way through. */
  function hdeal(tiles, nb, pf, r, o) {
    const n = tiles.length;
    for (let attempt = 0; attempt < 40; attempt++) {
      const alive = new Uint8Array(n).fill(1), order = [];
      let ok = true;
      for (let k = 0; k < n; k++) {
        const fr = []; for (let i = 0; i < n; i++) if (L.isFree(i, alive, nb)) fr.push(i);
        if (!fr.length) { ok = false; break; }
        const i = fr[Math.floor(r() * fr.length)]; alive[i] = 0; order.push(i);
      }
      if (!ok) continue;
      const faces = new Array(n).fill(-1), open = [], pool = L.shuffleArr(r, pf.slice());
      for (let k = 0; k < n && ok; k++) {
        const i = order[k], after = n - k - 1;
        const canOpen = pool.length > 0 && open.length < o.cap && after >= open.length + 1;
        const tw = open.findIndex(x => nb.above[i].includes(x.t));
        if (tw >= 0 && r() < o.twin) { faces[i] = open[tw].f; open.splice(tw, 1); }
        else if (canOpen && (open.length === 0 || r() < o.open)) { let pi = pool.findIndex(f => !open.some(x => x.f === f)); if (pi < 0) pi = 0; const f = pool.splice(pi, 1)[0]; faces[i] = f; open.push({ f, t: i }); }
        else if (open.length) { const j = Math.floor(r() * open.length); faces[i] = open[j].f; open.splice(j, 1); }
        else ok = false;
      }
      if (ok && !open.length) return { faces, order };
    }
    return null;
  }
  // along the way through: the tiles that end a "3 waiting" moment (the only way out then)
  function fullMoments(faces, path) {
    const tray = [], must = new Set();
    for (const m of path) { if (tray.length >= SLOTS - 1) must.add(m); const q = tray.indexOf(faces[m]); if (q >= 0) tray.splice(q, 1); else tray.push(faces[m]); }
    return must;
  }
  // compact shapes (no holes or thin arms) carry towers well
  const TOWER = ['block', 'oval', 'diamond', 'octagon', 'cross', 'pyramid', 'house', 'hourglass', 'bowtie', 'butterfly', 'heart'];
  const clockSpare = level => level < 90 ? [3, 4] : level < 110 ? [2, 3] : [1, 2];
  // Replay a complete witness, checking every tap including ice, locks, tray capacity and deadline.
  function validSolution(g, path) {
    if (!path || path.length !== g.tiles.length) return false;
    const initial = new Uint8Array(g.tiles.length).fill(1), alive = initial.slice(), tray = [];
    let clockTaken = !g.clock;
    for (let move = 0; move < path.length; move++) {
      const i = path[move];
      if (!Number.isInteger(i) || !alive[i] || !(g.rules ? L.takeable(i, alive, g.nb, g.rules, initial) : L.isFree(i, alive, g.nb))) return false;
      if (!clockTaken && move >= g.clock.n) return false;
      alive[i] = 0;
      if (g.clock && i === g.clock.i) clockTaken = true;
      const q = tray.indexOf(g.faces[i]); if (q >= 0) tray.splice(q, 1); else tray.push(g.faces[i]);
      if (tray.length >= SLOTS) return false;
    }
    return clockTaken && tray.length === 0;
  }
  // Bounded breadth-first search: prioritize the blockers of the clock, but keep alternative
  // legal tray states. Accept a prefix only if an exact solver can finish the whole board.
  function clockRoute(g, ci) {
    const n = g.tiles.length, initial = new Uint8Array(n).fill(1);
    const remainingRules = alive => {
      if (!g.rules) return null;
      const ice = {};
      for (const k in g.rules.ice) {
        const gone = g.rules.iceNb[k].filter(i => !alive[i]).length;
        if (g.rules.ice[k] > gone) ice[k] = g.rules.ice[k] - gone;
      }
      return { ...g.rules, ice };
    };
    const blockers = alive => {
      const up = new Set(), todo = [ci];
      while (todo.length) for (const j of g.nb.above[todo.pop()]) if (alive[j] && !up.has(j)) { up.add(j); todo.push(j); }
      const side = name => { const set = new Set(up), todo = [ci], seen = new Set();
        while (todo.length) { const k = todo.pop(); if (seen.has(k)) continue; seen.add(k); for (const j of g.nb[name][k]) if (alive[j]) { set.add(j); todo.push(j); } }
        return set.size;
      };
      return Math.min(side('left'), side('right')) + 1;
    };
    let frontier = [{ alive: initial.slice(), tray: [], path: [] }], nodes = 0;
    const seen = new Set();
    for (let depth = 0; depth < Math.min(36, n * 0.45) && frontier.length && nodes < 16000; depth++) {
      const next = [];
      for (const state of frontier) {
        for (let i = 0; i < n; i++) {
          if (!(g.rules ? L.takeable(i, state.alive, g.nb, g.rules, initial) : L.isFree(i, state.alive, g.nb))) continue;
          const q = state.tray.findIndex(j => g.faces[j] === g.faces[i]);
          if (q < 0 && state.tray.length >= SLOTS - 1) continue;
          const alive = state.alive.slice(); alive[i] = 0;
          const tray = q < 0 ? state.tray.concat(i) : state.tray.filter((_, k) => k !== q), path = state.path.concat(i);
          const key = alive.join('') + '|' + tray.map(j => g.faces[j]).sort((a,b) => a-b).join(',');
          if (seen.has(key)) continue; seen.add(key); nodes++;
          if (i === ci) {
            const rest = L.solve(g.tiles, g.nb, g.faces, alive, tray, 12000, remainingRules(alive));
            if (rest) return path.concat(rest);
          } else next.push({ alive, tray, path, score: blockers(alive) + tray.length * 0.15 });
        }
      }
      next.sort((a,b) => a.score-b.score);
      frontier = next.slice(0, 48);
    }
    return null;
  }
  // salt: another try at the same level (when a measurement says it missed)
  function* make(level, aspect, scale = 1, salt = 0) {
    const c = cfg(), hard = level >= c.from, T = target(level), TS = target(level, 'strong');
    const seed = level * 7919 + 13 + salt * 100003, r = L.rng(seed + 4242);
    const eff = L.effLevel(level), diff = L.difficultyFor(eff);
    let tiles;
    if (hard && c.pile !== 'classic') {
      const o = c.pile === 'semi' ? { baseFrac: 0.27 + r() * 0.04, keep: [0.68, 0.85], stack: 0.25 + r() * 0.2, noBrick: true, shapes: TOWER }
        : { baseFrac: 0.19 + r() * 0.06, keep: [0.85, 0.96], stack: 0.85 + r() * 0.15, noBrick: r() < 0.7, shapes: TOWER };
      tiles = L.buildPiles(seed, size(level, scale), c.pile === 'semi' ? 5 : r() < 0.5 ? 5 : 6, aspect, level, o).tiles;
    } else if (hard) {
      // the pile: tiles at least as big as on the usual levels (every 10th level may be a bit
      // bigger, with slightly smaller tiles); of a few that fit, the one with the fewest free tiles
      // at the start (fewer choices)
      const big = level % 10 === 0, minPx = big ? c.minTileBig : c.minTile;
      let bp = null;
      for (let k = 0; k < c.piles * 3 && !(bp && k >= c.piles); k++) {
        const t = L.buildPiles(seed + k * 1009, Math.min(big ? 96 : c.maxTiles, size(level, scale)), L.layersFor(eff), aspect, level).tiles;
        if (tilePx(t) < minPx) continue;
        const nb0 = L.neighbors(t), al = new Uint8Array(t.length).fill(1);
        let fr = 0; for (let i = 0; i < t.length; i++) if (L.isFree(i, al, nb0)) fr++;
        if (!bp || fr / t.length < bp.fr) bp = { t, fr: fr / t.length };
      }
      tiles = bp ? bp.t : L.forLevel(level, aspect, scale, '').tiles;
    } else tiles = L.forLevel(level, aspect, scale, '').tiles;
    const n = tiles.length, nb = L.neighbors(tiles), cover = coverOf(tiles, nb);
    const all = new Uint8Array(n).fill(1);
    const free0 = tiles.map((t, i) => L.isFree(i, all, nb));
    const nDown = level >= c.rebuildFrom ? Math.min(Math.round(n * diff.down), Math.floor(n * c.maxDown)) : Math.round(n * diff.down);
    const rd = L.rng(seed + 777), rnd = tiles.map(() => rd());
    // face-down tiles where they hurt: tiles you can see but not take yet (free ones can be turned
    // over anyway), first those whose twin is free (where is its partner?); never the only way
    // out of a "3 waiting" moment. The usual levels: anywhere, as before.
    function placeDown(faces, must) {
      if (!hard) return L.shuffleArr(L.rng(seed + 777), tiles.map((t, i) => i)).slice(0, nDown);
      const seen = [], hid = [];
      for (let i = 0; i < n; i++) { if (free0[i] || must.has(i)) continue; (cover[i].length ? hid : seen).push(i); }
      const twinFree = i => faces.some((f, j) => j !== i && f === faces[i] && free0[j]) ? 1 : 0;
      seen.sort((a, b) => (twinFree(b) - twinFree(a)) || (rnd[a] - rnd[b]));
      hid.sort((a, b) => rnd[a] - rnd[b]);
      return seen.concat(hid).slice(0, nDown);
    }
    const asDown = list => { const d = new Uint8Array(n); list.forEach(i => d[i] = 1); return d; };
    // gold, ice and locks as specials.js does it, placed along the known way through
    function extras(faces, down, path) {
      const rg = L.rng(seed + 555), anyF = faces.filter(f => f < 100), gf = anyF[Math.floor(rg() * anyF.length)];
      const gold = faces.map((x, i) => x === gf ? i : -1).filter(i => i >= 0).slice(0, 2);
      const ob = level >= L.MECH.ice ? L.obstacles(tiles, faces, { level, seed, avoid: new Set([...down, ...gold]), ez: 0, path, extra: hard ? Math.min(c.extraMax, Math.floor((level - c.from) / c.extraEvery)) : 0 }) : null;   // more ice and locks as the levels go up
      const rules = ob && (Object.keys(ob.ice || {}).length || (ob.keys || []).length) ? { iceNb: L.iceNeighbors(tiles), ice: ob.ice || {}, locks: (ob.keys || []).length ? new Set(ob.locks) : null, keys: ob.keys || [] } : null;
      return { gold, ob, rules };
    }
    const blindDn = new Uint8Array(n).fill(1);
    const game = (s, clock, blind) => ({ tiles, nb, faces: s.faces, down: blind ? blindDn : s.dn, rules: s.rules, clock, cover });
    // fresh: other games than the quick look (the best of many quick looks is usually a lucky one)
    const judge = (s, clock, k, who = 'sensible', blind = false, fresh = 0) => rateG(game(s, clock, blind), k || c.runs, seed + fresh * 7777, persona(who));
    // (blind: how the test player does with every tile face down, for the record. Real players
    // look for the twins of what waits in the tray, like the test player; levels that punish that
    // can be done by keeping the tray empty instead: a trap, which is part of being harder)
    // aim a little below the targets (the careful final measurement comes out a little easier);
    // off: how far a deal is from both targets, dev: too easy (+) or too hard (-)
    const clocked = hard && level >= c.clockFrom;
    // Leave room for the clock to contribute to the difficulty, rather than loosening its deadline.
    const aim = T + (clocked ? 0.08 : 0) - 0.03, aimS = TS + (clocked ? 0.08 : 0) - 0.02;
    const off = s => Math.abs(s.q - aim) + (s.st === undefined ? 0 : Math.abs(s.st - aimS));
    const dev = s => s.st === undefined ? s.q - aim : (s.q - aim + s.st - aimS) / 2;
    // 1. deals along a way through, screened quickly by both test players; tune how much waits
    //    in the tray (and the pictures) towards the targets
    const cands = [];
    let open = hard ? 0.95 : diff.open, kinds = L.kindsFor(n / 2, eff, diff);
    const twin = hard ? Math.min(0.9, c.twin + (level - c.from) * 0.005) : 0;   // more twins on twins as the levels go up
    const make1 = (faces, path) => { const must = hard ? fullMoments(faces, path) : new Set(); const down = placeDown(faces, must); return { faces, path, down, dn: asDown(down), must, ...extras(faces, down, path) }; };
    for (let round = 0; round < (hard ? c.rounds : 6); round++) {
      let rb = null;
      for (let k = 0; k < (hard ? c.deals : 4); k++) {
        const rr = L.rng(seed + k * 31337 + round * 7777);
        const d = hdeal(tiles, nb, L.pairFacesFor(n / 2, kinds, rr), rr, { cap: 3, open, twin });
        if (!d) continue;
        const s = make1(d.faces, d.order);
        const j = yield* judge(s, null, hard ? c.screen : 12); s.q = j.rate; s.risky = j.risky;
        if (hard && s.risky !== null && s.risky > c.risky) continue;   // careful with tray pressure
        s.st = (yield* judge(s, null, 12, 'strong')).rate;
        cands.push(s);
        if (!rb || off(s) < off(rb)) rb = s;
      }
      if (!rb) continue;
      if (dev(rb) < -0.05) { open = Math.max(0, open - 0.25); kinds = Math.max(4, Math.round(kinds * 0.88)); }
      else if (dev(rb) > 0.05) { open = Math.min(1, open + 0.2); kinds = Math.min(36, n / 2, Math.round(kinds * 1.12) + 1); }
    }
    if (!cands.length) {     // (practically never) the usual level
      const sp = L.forLevel(level, aspect, scale, ''), d = L.makeDeal(sp);
      return finish(sp.tiles, d.faces, d.down, null, null);
    }
    // 2. the closest few measured again, more carefully. Fair: the strong player must win at least
    //    as often as the sensible one (otherwise the level is luck, or fools the test player)
    cands.sort((a, b) => off(a) - off(b));
    let best = null;
    for (const s of cands.slice(0, 6)) {
      s.q = (yield* judge(s, null, 48, 'sensible', false, 1)).rate;
      s.st = (yield* judge(s, null, 36, 'strong', false, 1)).rate;
      if (hard && s.st < s.q - 0.05) continue;
      if (!best || off(s) < off(best)) best = s;
    }
    best = best || cands[0];
    // 3. still too easy: change the deal step by step (swap two pictures, mostly putting a tile on
    //    its own twin; the way through must still work with the 4-slot tray) and keep what helps
    const fits = (faces, path) => { const tray = []; for (const m of path) { const q = tray.indexOf(faces[m]); if (q >= 0) tray.splice(q, 1); else { tray.push(faces[m]); if (tray.length > SLOTS - 1) return false; } } return !tray.length; };
    if (hard) for (let st = 0; st < c.steps && dev(best) > 0.05; st++) {
      const faces = best.faces.slice();
      let a, b;
      if (r() < 0.6) { const d = Math.floor(r() * n), ups = nb.above[d]; if (!ups.length) continue; const u = ups[Math.floor(r() * ups.length)]; const xs = []; for (let x = 0; x < n; x++) if (x !== u && x !== d && faces[x] === faces[u]) xs.push(x); if (!xs.length || faces[d] === faces[u]) continue; a = d; b = xs[Math.floor(r() * xs.length)]; }
      else { a = Math.floor(r() * n); b = Math.floor(r() * n); if (faces[a] === faces[b]) continue; }
      [faces[a], faces[b]] = [faces[b], faces[a]];
      if (!fits(faces, best.path)) continue;
      const s = make1(faces, best.path);
      s.q = (yield* judge(s, null, 24)).rate;
      if (s.q < best.q - 0.02) {
        s.q = (yield* judge(s, null, 36, 'sensible', false, 2 + st)).rate;
        s.st = (yield* judge(s, null, 30, 'strong', false, 2 + st)).rate;
        if (off(s) < off(best) && s.st >= s.q - 0.05) best = s;
      }
    }
    // The clock must require a route, not a long countdown chosen to preserve an easy board.
    // A successful focused game supplies a full legal witness, including the remaining board.
    let clock = null, solution = best.path;
    if (hard && level >= c.clockFrom) {
      const ob = best.ob || {};
      const bad = new Set([...best.down, ...best.gold, ...Object.keys(ob.ice || {}).map(Number), ...(ob.locks || []), ...(ob.keys || [])]);
      const pool = L.shuffleArr(L.rng(seed + 99), tiles.map((t, i) => i).filter(i => !free0[i] && !cover[i].length && !bad.has(i)));
      let bc = null;
      for (const ci of pool.slice(0, 6)) {
        const route = clockRoute(game(best, null), ci);
        const base = route ? route.indexOf(ci) + 1 : Infinity;
        yield;
        // A late-board clock would again give a large, forgiving countdown. Require an early route.
        const routeLimit = level < 90 ? 18 : level < 110 ? 16 : 14;
        if (!route || base < 5 || base > routeLimit) continue;
        for (const spare of clockSpare(level)) {
          const o = { i: ci, n: base + spare, base, route };
          if (!validSolution(game(best, o), route)) continue;
          o.q = (yield* judge(best, o, 36, 'sensible', false, 1)).rate;
          o.st = (yield* judge(best, o, 40, 'strong', false, 1)).rate;
          if (o.st < o.q - 0.05) continue;                 // fair: a good player copes better with the clock too
          const miss = x => Math.abs(x.q - T) + 1.5 * Math.abs(x.st - TS);
          if (!bc || miss(o) < miss(bc)) bc = o;
        }
      }
      if (bc) { clock = { i: bc.i, n: bc.n }; solution = bc.route; }
    }
    // 4. the record: how the three test players do on the finished level
    best.q = (yield* judge(best, clock, 90, 'sensible', false, 99)).rate;
    best.strong = (yield* judge(best, clock, 60, 'strong', false, 99)).rate;
    best.blind = hard ? (yield* judge(best, clock, 30, 'sensible', true, 99)).rate : null;
    return finish(tiles, best.faces, best.down, best, clock, solution);

    function finish(tl, faces, down, x, clk, path = null) {
      return { v: GENV, level, aspect, scale, tiles: tl.map(t => [t.x, t.y, t.z]), faces, down: down.slice(), gold: x ? x.gold : null, obst: x ? x.ob : null, clock: clk, solution: path,
        info: { target: +T.toFixed(2), targetStrong: +TS.toFixed(2), rate: x ? +x.q.toFixed(2) : null, strong: x ? +x.strong.toFixed(2) : null, blind: x && x.blind !== null && x.blind !== undefined ? +x.blind.toFixed(2) : null, twins: twinsOn(faces, L.neighbors(tl)), hard } };
    }
  }
  // the whole design at once (tests, tools; the game prefers the steps in between taps)
  const makeNow = (level, aspect, scale = 1, salt = 0) => drain(make(level, aspect, scale, salt));

  /* ---------- in the game: the levels are made in advance ----------
     Designing takes seconds, so it is done once, on the computer (tools/sim/build_levels.js), for
     one screen shape (ASPECT; the pile is fitted to every screen). The result ships with the game
     in levels-hard.js (HARD_LEVELS): everyone gets the same levels, and they start at once.
     Past the last authored level, retain the hardest validated board, mirrored with other
     pictures. Do not cycle back to easier boards. Packed: tile positions, faces and tile numbers as
     letters (64 per letter). */
  const ASPECT = 1.6;
  const A64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const e1 = v => A64[v], e2 = v => A64[v >> 6] + A64[v & 63];
  const d1 = (s, i) => A64.indexOf(s[i]), d2 = (s, i) => d1(s, i) * 64 + d1(s, i + 1);
  const list2 = s => { const o = []; for (let i = 0; i < s.length; i += 2) o.push(d2(s, i)); return o; };
  function pack(d) {
    const ob = d.obst || {};
    return [d.tiles.map(([x, y, z]) => e1(x) + e1(y) + e1(z)).join(''), d.faces.map(e1).join(''), d.down.map(e2).join(''), (d.gold || []).map(e2).join(''),
      Object.entries(ob.ice || {}).map(([i, h]) => e2(+i) + e1(h)).join(''), (ob.locks || []).map(e2).join(''), (ob.keys || []).map(e2).join(''),
      d.clock ? [d.clock.i, d.clock.n] : 0, d.info.rate, d.info.strong, d.solution ? d.solution.map(e2).join('') : ''];
  }
  function unpack(level, r) {
    const [t, f, dn, g, ice, locks, keys, ck, rate, strong, proof] = r;
    const tiles = []; for (let i = 0; i < t.length; i += 3) tiles.push([d1(t, i), d1(t, i + 1), d1(t, i + 2)]);
    const faces = []; for (let i = 0; i < f.length; i++) faces.push(d1(f, i));
    const iceO = {}; for (let i = 0; i < ice.length; i += 3) iceO[d2(ice, i)] = d1(ice, i + 2);
    const obst = ice || keys ? { ice: iceO, locks: list2(locks), keys: list2(keys) } : null;
    return { level, tiles, faces, down: list2(dn), gold: list2(g), obst, clock: ck ? { i: ck[0], n: ck[1] } : null, solution: proof ? list2(proof) : null, info: { rate, strong } };
  }
  const table = () => (typeof HARD_LEVELS !== 'undefined' ? HARD_LEVELS : null);
  const applies = (level, track) => !track && level >= cfg().measureFrom && !!table();
  // The design of a level. Overflow keeps the hardest board; legacy tables retain their old cycle.
  function get(level) {
    const T = table(), last = T.from + T.levels.length - 1;
    if (level <= last) return unpack(level, T.levels[level - T.from]);
    const base = T.overflow === 'hardest' ? last : T.cycleFrom + (level - T.cycleFrom) % (last - T.cycleFrom + 1);
    const d = unpack(level, T.levels[base - T.from]);
    const w = Math.max(...d.tiles.map(t => t[0]));
    d.tiles = d.tiles.map(([x, y, z]) => [w - x, y, z]);                 // mirrored left-right: the same rules apply
    const perm = L.shuffleArr(L.rng(level * 7907 + 3), [...Array(36).keys()]);
    d.faces = d.faces.map(x => x < 36 ? perm[x] : x);                   // other pictures
    return d;
  }
  // the design as a level spec for board.js
  function spec(level) {
    const d = get(level);
    const tiles = d.tiles.map(([x, y, z]) => ({ x, y, z }));
    return { tiles, kinds: new Set(d.faces).size, seed: level * 104729 + 1, diff: L.difficultyFor(L.effLevel(level)), made: d };
  }

  return { MODEL_VERSION: 2, P, REF, persona, play, rate, rate2, rateChain, remembered, coverOf, target, clockSpare, validSolution, clockRoute, make, makeNow, cfg, GENV, ASPECT, applies, get, spec, pack, unpack };
})();
if (typeof module !== 'undefined') module.exports = Hard;
