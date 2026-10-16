/* Level 51: Gerda's board and PUK's board from their recordings, how hard each is for the test
   players, and how each of them played it. */
'use strict';
const fs = require('fs'), path = require('path');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const L = require(path.join(__dirname, '..', '..', '..', 'www', 'layouts.js'));
const games = (pid, key) => {
  const R = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'analysis', 'archive', 'replays', pid + '.json'), 'utf8')), out = [];
  for (const ch of Object.values(R)) {
    const rows = Object.values(ch).filter(r => r && r.data).sort((a, b) => a.seq - b.seq);
    let init = null; const ev = [];
    for (const r of rows) { const d = JSON.parse(r.data); if (d.init) init = d.init; ev.push(...d.events); }
    if (!init || init.key !== key) continue;
    const st = init.state, tiles = init.tiles.map(([x, y, z]) => ({ x, y, z })), n = tiles.length;
    const down = new Uint8Array(n); st.d.forEach((v, i) => { if (v) down[i] = 1; });
    const ob = st.ob || {}, hasRules = Object.keys(ob.need || {}).length || (ob.keys || []).length;
    const rules = hasRules ? { iceNb: L.iceNeighbors(tiles), ice: { ...(ob.need || {}) }, locks: (ob.keys || []).length ? new Set(ob.locks) : null, keys: ob.keys || [] } : null;
    const end = ev.find(e => e[1] === 'end');
    out.push({ at: init.at, t: rows[0].t, partial: init.partial, ez: init.ez, aspect: init.aspect, end: end && end[2], ev, g: { tiles, nb: L.neighbors(tiles), faces: st.f.slice(), down, rules, clock: st.ck ? { i: st.ck.i, n: st.ck.n } : null }, sig: JSON.stringify([init.tiles, st.f, st.d]) });
  }
  return out.sort((a, b) => a.t - b.t);
};
module.exports = { games };
if (require.main === module) {
  for (const [name, pid] of [['Gerda', 'pmv6yhzz3x9oxs8'], ['PUK', 'pmv2gaa0g00eq3q']]) {
    const G = games(pid, 'L51');
    const boards = [...new Set(G.map(x => x.sig))];
    console.log(`\n${name}: ${G.length} recorded tries of level 51, ${boards.length} different board(s); aspect ${G[0] && G[0].aspect}`);
    for (const sig of boards) {
      const x = G.find(y => y.sig === sig), g = x.g;
      const rates = Object.fromEntries(['strong', 'sensible', 'average'].map(k => [k, Hard.rate(g, 200, 3, Hard.persona(k)).rate]));
      const jokers = g.faces.filter(f => f === 101).length, down = g.down.reduce((a, b) => a + b, 0);
      console.log(`  board: ${g.tiles.length} tiles, ${down} face-down, ${jokers} jokers, ice ${g.rules ? Object.keys(g.rules.ice).length : 0}, locks ${g.rules && g.rules.keys ? g.rules.keys.length : 0} | test players strong ${rates.strong} sensible ${rates.sensible} average ${rates.average}`);
      console.log('  tries:', G.filter(y => y.sig === sig).map(y => `#${y.at}${y.ez ? ' ez' + y.ez : ''} ${y.end ? y.end.r : '?'}`).join(', '));
    }
  }
}
