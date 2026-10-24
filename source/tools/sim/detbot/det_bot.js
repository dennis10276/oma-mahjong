/* Prototype (Claude, 2026-10-24): a determinization player for Oma's Mahjong.
   It knows only what a person could know: pictures and roles of tiles it has seen (now, or in an earlier
   try of the same level), the tray, the clock. Each decision it fills the unseen pictures (and a missing
   key) in many ways that fit what it saw, solves each filled-in board exactly, and plays the action that
   wins in the most of them. Free face-down tiles are turned over first (looking costs no move).
   The real game decides what happens: Codex's production session around the unmodified hard.js;
   visibility from Codex's observeBoard. Unseen roles are assumed plain (except a missing key). */
'use strict';
const path = require('path');
const R = path.join(__dirname, '..', 'refit');   // Codex's files (branch wip/personal-bots)
const L = require(path.join(__dirname, '..', '..', '..', 'www', 'layouts.js'));
const { createSessionFactory } = require(path.join(R, 'production_physical_session.js'));
const { observeBoard } = require(path.join(R, 'human_board_visibility.js'));
const { visibleRole } = require(path.join(R, 'human_reference_campaign.js'));
const { decodeGame } = require(path.join(R, 'personal_game_io.js'));
const { makeSolver2 } = require('./solver2.js');
const { makeRollout } = require('./rollout.js');

function rng(seed) { let s = seed % 2147483646 + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function playLevel(game, opts = {}) {
  const tries = opts.tries ?? 12, samples = opts.samples ?? 16, limit = opts.limit ?? 3000, budgetMs = opts.budgetMs ?? 1500;
  const n = game.tiles.length, iceNb = L.iceNeighbors(game.tiles), world = makeSolver2(game), rollout = makeRollout(game);
  const factory = createSessionFactory(), settings = { seed: 20261111, choiceLimit: 512, tapMs: 1000 };
  // memory over tries: pictures seen; roles as they were at the start (what a person can work out)
  const memory = new Array(n).fill(null), downMem = new Array(n).fill(null);
  const iceMem = new Array(n).fill(null), lockMem = new Array(n).fill(null), keyMem = new Array(n).fill(null);
  const r = rng(opts.seed ?? 7);
  const out = [];
  let slowest = 0, decisions = 0;
  for (let t = 1; t <= tries; t++) {
    const session = factory(game, settings);
    let view = session.view(), queue = [];
    while (view.type !== 'productionPhysicalEnd-v1') {
      const t0 = Date.now(), st = view.state, alive = st.alive;
      const obs = observeBoard(game.tiles, st, game.clock, { picture: i => game.faces[i], role: i => visibleRole(game, st, i) });
      obs.pictures.forEach((p, i) => { if (p !== null) memory[i] = p; });
      obs.down.forEach((d, i) => { if (d !== null && downMem[i] === null && alive[i]) downMem[i] = d; });
      obs.roles.forEach((x, i) => {
        if (x === null || st.relieved) return;
        const gone = iceNb[i].filter(j => !alive[j]).length;
        if (x === 'ice' || x === 'ice2') iceMem[i] = (x === 'ice' ? 1 : 2) + gone;
        else if (iceMem[i] === null && gone === 0) iceMem[i] = 0;
        const keysLeft = keyMem.some((k, j) => k && alive[j]) || keyMem.filter(k => k).length < 2;
        if (x === 'lock') lockMem[i] = true; else if (x === 'key') keyMem[i] = true;
        else if (x === 'none' && keysLeft && lockMem[i] === null && iceMem[i] === 0) { lockMem[i] = false; keyMem[i] = keyMem[i] || false; }
      });
      const legal = view.legalTiles;
      // a free tile the game will not let you take (or turn over) has ice or a lock, seen or not
      const blocked = [];
      if (game.rules && !st.relieved) for (let i = 0; i < n; i++) if (alive[i] && L.isFree(i, alive, game.nb) && !legal.includes(i)) blocked.push(i);
      let pick = null;
      // a queued action continues (turn over, then take)
      while (queue.length && pick === null) { const q = queue.shift(); if (legal.includes(q) && alive[q]) pick = q; else queue = []; }
      // look first: a free face-down tile never seen
      // (with the clock still on the board a look can cost moves: the game takes a looked-at tile that fits
      //  the tray or the open tile at once, so then looks are weighed with the other actions below)
      const looks = legal.filter(i => st.down[i] && memory[i] === null);
      const clockOn = game.clock && alive[game.clock.i];
      if (pick === null && looks.length && (!clockOn || opts.freeLooks)) pick = looks[0];
      if (pick === null) {
        decisions++;
        // the rules as known
        const keys = [], locks = [], ice = {};
        for (let i = 0; i < n; i++) { if (keyMem[i]) keys.push(i); if (lockMem[i]) locks.push(i); if (iceMem[i] > 0) ice[i] = iceMem[i]; }
        // blocked tiles whose reason it has not seen: a lock if keys are still out there, otherwise ice
        const mystery = blocked.filter(i => !lockMem[i] && !(iceMem[i] > iceNb[i].filter(j => !alive[j]).length));
        const keysOut = keys.length < 2 || keys.some(k => alive[k]);
        for (const i of mystery) { if (keysOut && (locks.length || keys.length)) locks.push(i); else ice[i] = iceNb[i].filter(j => !alive[j]).length + 1; }
        const unknownRole = []; for (let i = 0; i < n; i++) if (alive[i] && keyMem[i] === null && lockMem[i] !== true) unknownRole.push(i);
        // sample worlds
        const count = {};
        for (let i = 0; i < n; i++) if (memory[i] !== null) count[memory[i]] = (count[memory[i]] || 0) + 1;
        const unknown = []; for (let i = 0; i < n; i++) if (alive[i] && memory[i] === null) unknown.push(i);
        const need = []; for (const f in count) if (count[f] % 2) need.push(+f);
        const worlds = [];
        for (let s = 0; s < samples; s++) {
          const faces = game.tiles.map((_, i) => memory[i] ?? -1);
          const bag = need.slice(0, unknown.length); let fresh = 1000;
          while (bag.length < unknown.length) { const f = fresh++; bag.push(f, f); }
          for (let k = bag.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [bag[k], bag[j]] = [bag[j], bag[k]]; }
          unknown.forEach((i, k) => faces[i] = bag[k]);
          const down = game.tiles.map((_, i) => downMem[i] ?? 0);
          let ks = keys.slice();
          if (locks.length && ks.length < 2) { const pool = unknownRole.filter(i => !ks.includes(i)); while (ks.length < 2 && pool.length) ks.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); }
          const lockedNow = ks.length === 2 && ks.some(k => alive[k]);
          const rules = (lockedNow && locks.length) || Object.keys(ice).length ? { iceNb, ice, locks: lockedNow && locks.length ? new Set(locks) : null, keys: lockedNow ? ks : [] } : null;
          worlds.push({ faces, down, rules });
        }
        // the actions: take a free tile; a free face-down tile with a free tile of the same picture
        const known = legal.filter(i => memory[i] !== null);
        const acts = known.map(i => [i]);
        for (const i of looks) acts.push(['look', i]);
        for (let a = 0; a < known.length; a++) for (let b = 0; b < known.length; b++) {
          const x = known[a], y = known[b];
          if (x !== y && st.down[x] && memory[x] === memory[y] && !st.tray.includes(memory[x]) && (!st.down[y] || x < y)) acts.push([x, y]);
        }
        // what each action does in a world (tiles gone, tray, moves), or null when it ends the level now
        const apply = (act, wd) => {
          const a2 = alive.slice(); let tr = st.tray.slice(), mv = st.moves;
          if (act[0] === 'look') {
            const i = act[1], f = wd.faces[i], q = tr.indexOf(f), op = st.openPeek;
            if (q >= 0) { a2[i] = 0; mv++; tr = tr.filter((_, k) => k !== q); }
            else if (op >= 0 && op !== i && alive[op] && wd.faces[op] === f) { a2[i] = 0; a2[op] = 0; mv += 2; }
          } else if (act.length === 2) { a2[act[0]] = 0; a2[act[1]] = 0; mv += 2; }
          else {
            const i = act[0], f = wd.faces[i], q = tr.indexOf(f);
            a2[i] = 0; mv++;
            if (q >= 0) tr = tr.filter((_, k) => k !== q); else if (tr.length >= 3) return null; else tr = tr.concat(f);
          }
          if (game.clock && alive[game.clock.i] && st.moves >= game.clock.n) return null;
          return [a2, tr, mv];
        };
        const stats = acts.map(() => ({ w: 0, u: 0, k: 0, d: 0, dead: false }));
        acts.forEach((act, k) => { if (!apply(act, worlds[0])) stats[k].dead = !(act[0] === 'look'); });
        for (const wd of worlds) {
          if (Date.now() - t0 > budgetMs) break;
          const solveW = world(wd.faces, wd.down, wd.rules);
          const knownNow = memory.map(m => m !== null ? 1 : 0);
          acts.forEach((act, k) => {
            if (stats[k].dead) return;
            const next = apply(act, wd);
            stats[k].k++;
            if (!next) return;
            const res = solveW(next[0], next[1], next[2], st.relieved, limit);
            if (res === true) stats[k].w++; else { if (res === null) stats[k].u++; stats[k].d += solveW.deepest / n; }
            stats[k].r = (stats[k].r || 0) + rollout(wd.faces, wd.down, wd.rules, next[0], next[1], next[2], st.relieved, knownNow);
          });
        }
        // the less it has seen, the more the honest play-outs count (the filled-in worlds know too much)
        const aliveN = alive.reduce((a, b) => a + b, 0), unseenN = alive.filter((a, i) => a && memory[i] === null).length;
        const rw = Math.min(1, (opts.rolloutScale ?? 2) * unseenN / Math.max(1, aliveN));
        let best = null;
        acts.forEach((act, k) => {
          const x = stats[k]; if (x.dead || !x.k) return;
          const sc = (x.w + 0.9 * x.d + rw * (x.r || 0)) / x.k + (act[0] === 'look' ? 0.02 : act.length === 2 ? 0.005 : 0) + (st.tray.includes(memory[act[0]]) ? 0.003 : 0);
          if (!best || sc > best.sc) best = { act, sc, w: x.w, u: x.u, of: x.k };
        });
        const act = best ? best.act : [legal[0]];
        if (opts.trace) opts.trace.push({ t, moves: st.moves, tray: st.tray.slice(), act, w: best && best.w, u: best && best.u, of: best && best.of });
        // carry out: a face-down tile is turned over first (one tap), then taken (another tap) or paired
        if (act[0] === 'look') { pick = act[1]; queue = []; }
        else if (act.length === 2) { pick = act[0]; queue = [act[1]]; if (st.openPeek === act[0]) { pick = act[1]; queue = []; } }
        else { pick = act[0]; queue = st.down[act[0]] && st.openPeek !== act[0] && !st.tray.includes(memory[act[0]]) ? [act[0]] : []; }
      }
      slowest = Math.max(slowest, Date.now() - t0);
      view = session.tap(pick);
    }
    out.push({ why: view.win ? 'win' : view.why, left: view.state.alive.reduce((a, b) => a + b, 0) });
    if (view.win) return { wonOn: t, tries: out, slowestMs: slowest, decisions };
  }
  return { wonOn: null, tries: out, slowestMs: slowest, decisions };
}

module.exports = { playLevel };

if (require.main === module) {
  const fs = require('fs');
  const cat = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const want = process.argv.slice(3).map(Number);
  for (const row of cat.rows.filter(r => !want.length || want.includes(r.lv))) {
    if (row.stackedRoles) continue;
    const g = decodeGame(row.game), t0 = Date.now();
    const res = playLevel(g, { tries: +(process.env.TRIES || 12), samples: +(process.env.SAMPLES || 16), limit: +(process.env.LIMIT || 3000) });
    console.log(JSON.stringify({ lv: row.lv, dennis: row.wonOn, bot: res.wonOn, tries: res.tries.map(x => x.why + ':' + x.left).join(' '), slowestMs: res.slowestMs, s: Math.round((Date.now() - t0) / 1000) }));
  }
}
