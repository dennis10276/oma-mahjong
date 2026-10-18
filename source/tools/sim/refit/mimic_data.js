/* Behaviour cloning, step 1: every decision a real player made in their recorded games (Firebase
   replays/), with what each possible move was worth part by part (Hard.FEAT).
     node mimic_data.js <replays json> <name> > mimic-<name>.json
   The board comes from the recording itself (tiles, pictures, face-down tiles, ice, locks, clock).
   A game is followed until the first hint, shuffle, rescue or helper glow (they change the board or
   point at a move), and games resumed halfway or with jokers are left out. */
'use strict';
const fs = require('fs'), path = require('path');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const L = require(path.join(__dirname, '..', '..', '..', 'www', 'layouts.js'));
const [file, name] = process.argv.slice(2);
const R = JSON.parse(fs.readFileSync(file, 'utf8'));
const games = [];
let skipped = { partial: 0, joker: 0, track: 0, short: 0 };
for (const [aid, ch] of Object.entries(R)) {
  const rows = Object.values(ch).filter(r => r && r.data).sort((a, b) => a.seq - b.seq);
  let init = null; const ev = [];
  for (const r of rows) { const d = JSON.parse(r.data); if (d.init) init = d.init; ev.push(...d.events); }
  if (!init || !init.state) continue;
  if (init.partial) { skipped.partial++; continue; }
  if (init.track) { skipped.track++; continue; }
  const st = init.state;
  if (st.f.some(f => f >= 100 && f !== 101)) { skipped.joker++; continue; }   // other special tiles than the joker (101, which the test player knows)
  const tiles = init.tiles.map(([x, y, z]) => ({ x, y, z })), nb = L.neighbors(tiles), n = tiles.length;
  const down = new Uint8Array(n); st.d.forEach((v, i) => { if (v) down[i] = 1; });
  const ob = st.ob || {};
  const hasRules = ob && (Object.keys(ob.need || {}).length || (ob.keys || []).length);
  const rules = hasRules ? { iceNb: L.iceNeighbors(tiles), ice: Object.fromEntries(Object.entries(ob.need || {}).map(([k, v]) => [k, v])), locks: (ob.keys || []).length ? new Set(ob.locks) : null, keys: ob.keys || [] } : null;
  const clock = st.ck ? { i: st.ck.i, n: st.ck.n } : null;
  // the tiles they took, in order, until something changed the board or pointed at a move
  const take = []; let end = null, t0 = null;
  for (const [ms, kind, data] of ev) {
    if (['hint', 'shuffle', 'rescue', 'nudge'].includes(kind)) break;   // (lucky only makes a tile glow; relief is a game rule the test player knows)
    if (kind === 'end') { end = data && data.r; break; }
    if (kind === 'state' && data.p !== undefined && data.p >= 0) take.push(-(data.p + 1));   // turned this tile over
    if (kind === 'state' && data.a) for (const [i, v] of data.a) if (v === 0) take.push(i);
    if (kind === 'state' && data.f) break;                 // pictures changed (shuffle): stop here
  }
  if (take.filter(x => x >= 0).length < 4) { skipped.short++; continue; }
  const g = { tiles, nb, faces: st.f.slice(), down, rules, clock, follow: take, log: [] };
  const res = Hard.play(g, Hard.P, 1);
  const t = rows[0].t || null;
  const availableAt = Math.max(...rows.map(row => row.t || 0));
  games.push({ aid, key: init.key, at: init.at, t, availableAt, end, n, found: g.found || 0, missed: g.missed || 0, moves: take.length, decisions: g.log.map(d => ({ F: d.F, k: d.k, tray: d.tray, moves: d.moves, freeDown: d.freeDown, looked: d.looked, flip: !!d.flip })) });
}
games.sort((a, b) => (a.t || 0) - (b.t || 0));
const nd = games.reduce((s, g) => s + g.decisions.length, 0), miss = games.reduce((s, g) => s + g.decisions.filter(d => d.k < 0).length, 0);
// how often they turn a free face-down tile over: looked-at share of the free face-down tiles, over all decisions
const fd = games.reduce((s, g) => s + g.decisions.reduce((a, d) => a + (d.freeDown || 0), 0), 0), fl = games.reduce((s, g) => s + g.decisions.reduce((a, d) => a + (d.looked || 0), 0), 0);
console.error(`${name}: turned over ${fd ? (fl / fd * 100).toFixed(0) : '-'}% of the free face-down tiles (at decision moments)`);
console.error(`${name}: ${games.length} games, ${nd} decisions (${miss} moves outside the options), skipped ${JSON.stringify(skipped)}`);
// how often they find the face-down twin of a waiting tile: found ones against missed chances (per move)
const found = games.reduce((s, g) => s + g.found, 0), missed = games.reduce((s, g) => s + g.missed, 0);
console.error(`${name}: found a waiting tile's face-down twin ${found} times, passed one by ${missed} times`);
console.log(JSON.stringify({ name, feat: Hard.FEAT, peek: fd ? fl / fd : 1, search: found + missed ? found / (found + missed) : 0.5, games }));
