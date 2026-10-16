/* The standard for levels 1-69 is the board Gerda played (Dennis, 2026-10-16): this takes her boards
   from her recorded tries (Firebase replays/, exported to analysis/archive/replays/<pid>.json) and
   writes analysis/early-gerda.json. Every try of a level gave her the same board.
     node tools/early_from_replays.js [replays file]
   Levels without a recording are built by tools/build_early.js for the screen shape she had then
   (aspects in the output: level 1 her first shape, after her last level her current shape). */
'use strict';
const fs = require('fs'), path = require('path');
const PID = 'pmv6yhzz3x9oxs8';   // Gerda
const file = process.argv[2] || path.join(__dirname, '..', 'analysis', 'archive', 'replays', PID + '.json');
const R = JSON.parse(fs.readFileSync(file, 'utf8'));
const boards = {}, conflicts = [];
for (const ch of Object.values(R)) {
  const rows = Object.values(ch).filter(r => r && r.data).sort((a, b) => a.seq - b.seq);
  let init = null;
  for (const r of rows) { const d = JSON.parse(r.data); if (d.init) { init = d.init; break; } }
  if (!init || !init.state || init.track || init.partial || init.ez || !/^L\d+$/.test(init.key)) continue;
  const lv = +init.key.slice(1);
  if (lv > 69) continue;
  const st = init.state, ob = st.ob || {};
  const b = {
    aspect: init.aspect,
    tiles: init.tiles.map(t => t.slice(0, 3)),
    faces: st.f.slice(),
    down: st.d.map((v, i) => v ? i : -1).filter(i => i >= 0),
    gold: (init.gold || []).slice(),
    obst: Object.keys(ob.need || {}).length || (ob.keys || []).length ? { ice: { ...(ob.need || {}) }, locks: (ob.locks || []).slice(), keys: (ob.keys || []).slice() } : null,
  };
  if (boards[lv] && JSON.stringify(boards[lv]) !== JSON.stringify(b)) conflicts.push(lv);
  boards[lv] = b;
}
if (conflicts.length) { console.error('different boards for the same level:', conflicts.join(' ')); process.exit(1); }
const lvs = Object.keys(boards).map(Number).sort((a, b) => a - b);
const first = boards[lvs[0]].aspect, last = boards[lvs[lvs.length - 1]].aspect;
const aspects = {};
for (let lv = 1; lv <= 69; lv++) aspects[lv] = boards[lv] ? boards[lv].aspect : lv < lvs[0] ? first : last;
const out = { player: 'Gerda', pid: PID, made: new Date().toISOString().slice(0, 10), aspects, boards };
fs.writeFileSync(path.join(__dirname, '..', 'analysis', 'early-gerda.json'), JSON.stringify(out));
console.log(`levels ${lvs[0]}-${lvs[lvs.length - 1]} from her recordings (${lvs.length}); shape ${first} before, ${last} after`);
