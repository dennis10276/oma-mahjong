/* Every real first-try-or-later attempt we can match to the exact board the player got.
   node dataset.js > attempts.json   (reads analysis/archive/realdata/plays.json from Firebase) */
'use strict';
const fs = require('fs'), path = require('path');
const B = require('./boards.js');
const { tableVersion, fixedEarlyLevel } = require('./board_versions.js');
const DATA = process.env.DATA || path.join(__dirname, '..', '..', '..', 'analysis', 'archive', 'realdata');
const plays = JSON.parse(fs.readFileSync(path.join(DATA, 'plays.json'), 'utf8'));
const scores = JSON.parse(fs.readFileSync(path.join(DATA, 'scores.json'), 'utf8'));
const ver = s => (s || '0').split('.').map(Number).reduce((a, x) => a * 100 + x, 0);
const TABLE_VERSIONS = ['1.44', '1.45', '1.46', '1.47', '1.48', '1.49', '1.50', '1.51', '1.52', '1.53', '1.54', '1.55'];
const SKIP = new Set(['pmuxw2uqkzcnbgx']);                      // DennisTEST
const out = [], notes = {};
for (const [pid, entries] of Object.entries(plays)) {
  if (SKIP.has(pid)) continue;
  if (!scores[pid]) continue;
  const ev = Object.values(entries || {}).filter(event => event && typeof event === 'object').sort((left, right) => left.t - right.t);
  const name = (scores[pid] || {}).name || (ev.find(e => e.name) || {}).name || pid;
  const ends = ev.filter(e => e.k === 'end' && e.m !== 'd' && !e.tk && e.lv >= 10);
  // the screen shape for classic levels: the one that reproduces the tile counts they logged
  const cl = ends.filter(e => e.lv < 70 && ver(e.v) >= ver('1.31') && e.n);
  let aspect = null, best = -1;
  for (let a = 1.0; a <= 2.41; a += 0.1) {
    const asp = Math.round(a * 10) / 10; let ok = 0;
    for (const e of cl.slice(-40)) if (B.L.forLevel(e.lv, asp, 1, '').tiles.length === e.n) ok++;
    if (ok > best) { best = ok; aspect = asp; }
  }
  notes[name] = { aspect, classicChecked: Math.min(40, cl.length), matched: best };
  for (const e of ends) {
    if (e.ez || e.h || e.sh || e.rb) continue;                   // an easier deal, or tools used: not comparable
    let r = e.r === 'win' ? 'win' : e.r === 'stuck' ? (e.ck ? 'clock' : 'tray') : e.r === 'restart' && (e.dur || 0) >= 30 ? 'gaveup' : null;
    if (!r) continue;
    let board = null;
    if ((e.lv >= 70 || fixedEarlyLevel(e.v, e.lv)) && TABLE_VERSIONS.includes(tableVersion(e.v))) board = { v: e.v, lv: e.lv, kind: 'table' };
    else if (e.lv < 70 && !fixedEarlyLevel(e.v, e.lv) && ver(e.v) >= ver('1.31') && aspect) {
      // their usual shape, or (a player can change phones: Gerda 1.4, then 1.6) the shape that
      // gives the tile count they logged for this try
      let a = aspect;
      if (e.n && B.L.forLevel(e.lv, aspect, 1, '').tiles.length !== e.n) for (let x = 1.0; x <= 2.41; x += 0.1) { const s = Math.round(x * 10) / 10; if (B.L.forLevel(e.lv, s, 1, '').tiles.length === e.n) { a = s; break; } }
      board = { aspect: a, lv: e.lv, kind: 'classic' };
    }
    else if (e.lv >= 70 && ver(e.v) < ver('1.43') && ver(e.v) >= ver('1.31') && aspect) board = { aspect, lv: e.lv, kind: 'classic' };
    if (!board) continue;
    const start = e.aid && ev.find(event => event.k === 'start' && event.aid === e.aid);
    out.push({ pid, name, aid: e.aid, lv: e.lv, v: e.v, at: e.at || 1, r, n: e.n, t: e.t, startedAt: start ? start.t : e.t - (e.dur || 0) * 1000, dur: e.dur, board });
  }
}
// check the tile counts against the rebuilt boards
const cache = {};
const keyOf = b => b.kind === 'table' ? `t${b.v}:${b.lv}` : `c${b.aspect}:${b.lv}`;
let bad = 0;
for (const a of out) {
  const k = keyOf(a.board);
  if (!(k in cache)) { const g = a.board.kind === 'table' ? B.designed(a.board.v, a.board.lv) : B.classic(a.board.lv, a.board.aspect); cache[k] = g ? g.tiles.length : null; }
  a.key = k; a.ok = cache[k] !== null && (!a.n || cache[k] === a.n); if (!a.ok) bad++;
}
const kept = out.filter(a => a.ok);
console.error('screen shapes', JSON.stringify(notes));
console.error(`attempts: ${out.length}, board matches ${kept.length}, mismatches ${bad}`);
const by = {}; for (const a of kept) { by[a.name] = by[a.name] || { n: 0, win: 0, levels: new Set() }; by[a.name].n++; if (a.r === 'win') by[a.name].win++; by[a.name].levels.add(a.lv); }
for (const [k, v] of Object.entries(by)) console.error(k, 'attempts', v.n, 'wins', v.win, 'levels', v.levels.size, 'range', Math.min(...v.levels), '-', Math.max(...v.levels));
console.log(JSON.stringify(kept));
