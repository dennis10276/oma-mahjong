/* Levels 1-69, ready-made for everyone (www/levels-early.js): each level made with the game's own
   code (layouts.js forLevel + makeDeal without time limit, gold and jokers as specials.js, ice and
   locks as board.js) for screen shape RULES.levels.aspect, with the deal chosen per level in
   analysis/early-salts.json (the one about as hard as that level on most phones; chosen with the
   test players on wip/honest-observer, tools/sim/refit/salt_scan.js).
     node tools/build_early.js            writes www/levels-early.js
     node tools/build_early.js --check    only checks that the file matches */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const W = path.join(__dirname, '..', 'www');
const L = require(path.join(W, 'layouts.js'));
const Hard = require(path.join(W, 'hard.js'));
const RULES = vm.runInNewContext(fs.readFileSync(path.join(W, 'js', 'rules.js'), 'utf8') + ';RULES');
const SALTS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'analysis', 'early-salts.json'), 'utf8'));
const NORMAL_HELP = RULES.HELP ? null : null;   // (jokers: as for players without grandma mode)
const SP = RULES.specials, JOKERS_GONE = 50, FROM = 1, TO = 69, ASPECT = RULES.levels.aspect;
function level(lv) {
  const s = SALTS.levels[lv] || { salt: 0 };
  const spec = L.forLevel(lv, ASPECT, 1, '', s.salt), d = L.makeDeal(spec, 24, true);
  let faces = d.faces.slice(); const down = (d.down || []).slice();
  const r = L.rng(spec.seed + 555); let gold = [];
  if (lv >= SP.goldFrom) { const anyF = faces.filter(f => f < 100); const f = anyF[Math.floor(r() * anyF.length)]; gold = faces.map((x, i) => x === f ? i : -1).filter(i => i >= 0).slice(0, 2); }
  if (lv >= SP.jokerFrom && lv < JOKERS_GONE && r() < SP.jokerChance) {
    const cnt = {}; faces.forEach(f => cnt[f] = (cnt[f] || 0) + 1);
    const twos = Object.keys(cnt).filter(f => cnt[f] === 2 && +f < 100).map(Number);
    if (twos.length) { const f = twos[Math.floor(r() * twos.length)]; faces = faces.map(x => x === f ? 101 : x); }
  }
  const ob = lv >= L.MECH.ice ? L.obstacles(spec.tiles, faces, { level: lv, seed: spec.seed, avoid: new Set([...down, ...gold]), ez: 0 }) : null;
  const hasOb = ob && (Object.keys(ob.ice || {}).length || (ob.keys || []).length);
  const row = Hard.pack({ tiles: spec.tiles.map(t => [t.x, t.y, t.z]), faces: faces.map(f => f === 101 ? 63 : f), down, gold,
    obst: hasOb ? { ice: ob.ice || {}, locks: ob.locks || [], keys: ob.keys || [] } : null, clock: null,
    info: { rate: (s.rates || {}).sensible || 0, strong: (s.rates || {}).strong || 0 }, solution: null });
  return { row, salt: s.salt };
}
const T = { v: 1, aspect: ASPECT, from: FROM, salts: [], levels: [] };
for (let lv = FROM; lv <= TO; lv++) { const x = level(lv); T.levels.push(x.row); T.salts.push(x.salt); }
const text = `/* Levels ${FROM}-${TO}, the same for everyone (made by tools/build_early.js; see hard.js earlySpec). */\nconst EARLY_LEVELS = ${JSON.stringify(T)};\n`;
const file = path.join(W, 'levels-early.js');
if (process.argv.includes('--check')) { const ok = fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text; console.log(ok ? 'levels-early.js matches' : 'levels-early.js differs'); process.exit(ok ? 0 : 1); }
fs.writeFileSync(file, text);
console.log(`wrote ${file}: ${T.levels.length} levels, ${(text.length / 1024).toFixed(0)} KB, other deals for ${T.salts.filter(Boolean).length} levels`);
