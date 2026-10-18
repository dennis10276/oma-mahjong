/* Every try of a person (attempts.json: first tries and retries, no help used) with the exact board:
   the recorded board when the attempt ID matches, otherwise the board rebuilt the way
   the game makes it (designed levels: that version's table; classic levels: their screen shape, with
   gold, jokers, ice and locks as specials.js / board.js).
     const { triesOf } = require('./pdata.js'); triesOf('Gerda') -> [{ lv, at, t, won, why, src, g }] */
'use strict';
const path = require('path');
const B = require('./boards.js'), L = B.L;
const { gamesOf } = require('./mimic_games.js');
const ATT = require('./attempts.json');
const ver = s => (s || '0').split('.').map(Number).reduce((a, x) => a * 100 + x, 0);
const rulesOf = (tiles, ob) => ob && (Object.keys(ob.ice || {}).length || (ob.keys || []).length) ? { iceNb: L.iceNeighbors(tiles), ice: ob.ice || {}, locks: (ob.keys || []).length ? new Set(ob.locks) : null, keys: ob.keys || [] } : null;
// a classic level exactly as the game makes it (no time limit), gold and jokers as specials.js
function classic(lv, aspect) {
  const spec = L.forLevel(lv, aspect, 1, ''), d = L.makeDeal(spec, 24, true), tiles = spec.tiles, n = tiles.length;
  let faces = d.faces.slice(); const dn = (d.down || []).slice();
  const r = L.rng(spec.seed + 555); let gold = [];
  if (lv >= 20) { const anyF = faces.filter(f => f < 100); const f = anyF[Math.floor(r() * anyF.length)]; gold = faces.map((x, i) => x === f ? i : -1).filter(i => i >= 0).slice(0, 2); }
  if (lv >= 30 && lv < 50 && r() < 0.6) {
    const cnt = {}; faces.forEach(f => cnt[f] = (cnt[f] || 0) + 1);
    const twos = Object.keys(cnt).filter(f => cnt[f] === 2 && +f < 100).map(Number);
    if (twos.length) { const f = twos[Math.floor(r() * twos.length)]; faces = faces.map(x => x === f ? 101 : x); }
  }
  const ob = lv >= L.MECH.ice ? L.obstacles(tiles, faces, { level: lv, seed: spec.seed, avoid: new Set([...dn, ...gold]), ez: 0 }) : null;
  const down = new Uint8Array(n); dn.forEach(i => down[i] = 1);
  return { tiles, nb: L.neighbors(tiles), faces, down, rules: rulesOf(tiles, ob), clock: null };
}
const cache = {};
function triesOf(name) {
  if (cache[name]) return cache[name];
  const rec = new Map(gamesOf(name).map(game => [game.aid, game.g]));
  const out = [];
  for (const a of ATT.filter(a => a.name === name && a.t)) {
    let g = null, src = null;
    if (a.aid && rec.has(a.aid) && ver(a.v) >= ver('1.50')) { g = rec.get(a.aid); src = 'recorded'; }
    else if (a.board.kind === 'table') { g = B.designed(a.board.v, a.lv); src = 'table'; }
    else if (a.board.kind === 'classic') { g = classic(a.lv, a.board.aspect); src = 'classic'; }
    if (!g) continue;
    out.push({ aid: a.aid, v: a.v, lv: a.lv, at: a.at, t: a.t, startedAt: a.startedAt || a.t - (a.dur || 0) * 1000, won: a.r === 'win', why: a.r, src, key: a.key, g });
  }
  return (cache[name] = out.sort((a, b) => a.t - b.t));
}
module.exports = { triesOf, classic };
if (require.main === module) for (const n of ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda']) {
  const T = triesOf(n), src = {}; T.forEach(x => src[x.src] = (src[x.src] || 0) + 1);
  console.log(n, T.length, 'tries,', T.filter(x => x.at === 1).length, 'first tries; boards', JSON.stringify(src), 'levels', Math.min(...T.map(x => x.lv)) + '-' + Math.max(...T.map(x => x.lv)));
}
