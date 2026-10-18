/* The recorded games of each person as test boards (exact board from the recording; no help used,
   played to the end), with what really happened. Shared by the move-bot evaluations.
     const { gamesOf } = require('./mimic_games.js'); gamesOf('Gerda') -> [{ key, at, t, won, why, g }] */
'use strict';
const fs = require('fs'), path = require('path');
const L = require(path.join(__dirname, '..', '..', '..', 'www', 'layouts.js'));
const PIDS = { Dennisisdebeste: 'pmuy78xu6tsths9', 'Mrs. Doubtfire': 'pmv16kj3jr35750', PUK: 'pmv2gaa0g00eq3q', Gerda: 'pmv6yhzz3x9oxs8' };
const boardOf = init => {
  const st = init.state, tiles = init.tiles.map(([x, y, z]) => ({ x, y, z })), n = tiles.length;
  const down = new Uint8Array(n); st.d.forEach((v, i) => { if (v) down[i] = 1; });
  const ob = st.ob || {}, hasRules = Object.keys(ob.need || {}).length || (ob.keys || []).length;
  const rules = hasRules ? { iceNb: L.iceNeighbors(tiles), ice: { ...(ob.need || {}) }, locks: (ob.keys || []).length ? new Set(ob.locks) : null, keys: ob.keys || [] } : null;
  return { tiles, nb: L.neighbors(tiles), faces: st.f.slice(), down, rules, clock: st.ck ? { i: st.ck.i, n: st.ck.n } : null };
};
function gamesOf(name) {
  const R = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'analysis', 'archive', 'replays', PIDS[name] + '.json'), 'utf8'));
  const games = [];
  for (const [aid, ch] of Object.entries(R)) {
    const rows = Object.values(ch).filter(r => r && r.data).sort((a, b) => a.seq - b.seq);
    let init = null; const ev = [];
    for (const r of rows) { const d = JSON.parse(r.data); if (d.init) init = d.init; ev.push(...d.events); }
    if (!init || init.partial || init.track || !init.state) continue;
    if (init.state.f.some(f => f >= 100 && f !== 101)) continue;
    if (ev.some(e => ['hint', 'shuffle', 'rescue', 'nudge'].includes(e[1]))) continue;
    const end = ev.find(e => e[1] === 'end'); if (!end || !end[2]) continue;
    const r = end[2].r; if (r === 'restart') continue;
    // the tiles they took (and turned over), in order: for following their game
    const take = [];
    for (const [, kind, data] of ev) { if (kind === 'state' && data.p !== undefined && data.p >= 0) take.push(-(data.p + 1)); if (kind === 'state' && data.a) for (const [i, v] of data.a) if (v === 0) take.push(i); }
    games.push({ aid, key: init.key, lv: +init.key.slice(1), at: init.at, t: rows[0].t, availableAt: Math.max(...rows.map(row => row.t || 0)), won: r === 'win', why: r, take, g: boardOf(init) });
  }
  return games.sort((a, b) => a.t - b.t);
}
module.exports = { PIDS, gamesOf, boardOf };
