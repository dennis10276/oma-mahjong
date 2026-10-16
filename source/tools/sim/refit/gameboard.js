/* A level as the live game makes it (main's layouts.js, js/board.js + js/specials.js): the pile for a
   screen shape and salt, the deal, gold, the joker pair (levels 30-49, not in grandma mode) and
   ice / locks. Used by salt_scan.js; checked against recorded boards with: node gameboard.js */
'use strict';
const fs = require('fs'), path = require('path');
const LM = require(process.env.MAIN_LAYOUTS || '/home/claude/repo-oma/source/www/layouts.js');
const L = require(path.join(__dirname, '..', '..', '..', 'www', 'layouts.js'));
const SP = { goldFrom: 20, jokerFrom: 30, jokerChance: 0.6, jokersGoneFrom: 50 };
function gameBoard(lv, aspect, salt = 0) {
  const spec = LM.forLevel(lv, aspect, 1, '', salt), d = LM.makeDeal(spec, 24, true);
  let faces = d.faces.slice(); const downL = d.down || [];
  const r = LM.rng(spec.seed + 555); let gold = [];
  if (lv >= SP.goldFrom) { const anyF = faces.filter(f => f < 100); const f = anyF[Math.floor(r() * anyF.length)]; gold = faces.map((x, i) => x === f ? i : -1).filter(i => i >= 0).slice(0, 2); }
  if (lv >= SP.jokerFrom && lv < SP.jokersGoneFrom && r() < SP.jokerChance) {
    const cnt = {}; faces.forEach(f => cnt[f] = (cnt[f] || 0) + 1);
    const twos = Object.keys(cnt).filter(f => cnt[f] === 2 && +f < 100).map(Number);
    if (twos.length) { const f = twos[Math.floor(r() * twos.length)]; faces = faces.map(x => x === f ? 101 : x); }
  }
  const tiles = spec.tiles, n = tiles.length;
  const ob = lv >= LM.MECH.ice ? LM.obstacles(tiles, faces, { level: lv, seed: spec.seed, avoid: new Set([...downL, ...gold]), ez: 0 }) : null;
  const rules = ob && (Object.keys(ob.ice || {}).length || (ob.keys || []).length) ? { iceNb: L.iceNeighbors(tiles), ice: ob.ice || {}, locks: (ob.keys || []).length ? new Set(ob.locks) : null, keys: ob.keys || [] } : null;
  const down = new Uint8Array(n); downL.forEach(i => down[i] = 1);
  return { tiles, nb: L.neighbors(tiles), faces, down, rules, clock: null, gold, ob };
}
module.exports = { gameBoard };
if (require.main === module) {
  // check: rebuild every recorded board below 70 (normal track, no easier deal) and compare
  for (const pid of ['pmv2gaa0g00eq3q', 'pmv6yhzz3x9oxs8', 'pmv16kj3jr35750']) {
    const R = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'analysis', 'archive', 'replays', pid + '.json'), 'utf8'));
    let n = 0, same = 0; const bad = [];
    for (const ch of Object.values(R)) {
      const rows = Object.values(ch).filter(r => r && r.data).sort((a, b) => a.seq - b.seq);
      let init = null; for (const r of rows) { const d = JSON.parse(r.data); if (d.init) { init = d.init; break; } }
      if (!init || init.partial || init.track || init.ez || !/^L\d+$/.test(init.key)) continue;
      const lv = +init.key.slice(1); if (lv >= 70) continue;
      const g = gameBoard(lv, init.aspect); n++;
      const ok = g.faces.join() === init.state.f.join() && Array.from(g.down).join() === init.state.d.join();
      if (ok) same++; else if (bad.length < 4) bad.push(`${init.key}@${init.aspect} help ${JSON.stringify(init.help && { j: init.help.jokersGoneFrom, g: init.help.gentle })}`);
    }
    console.log(pid, 'recorded boards', n, 'rebuilt exactly', same, bad.join(' | '));
  }
}
