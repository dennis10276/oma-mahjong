/* Levels 51 and 53-69, ready-made for everyone (www/levels-early.js; Dennis, 2026-10-16). The family
   had passed 52 when this started, so lower levels stay as they were (made for each screen).
   The standard is the board Gerda played: levels she has a recording of are her exact board
   (analysis/early-gerda.json, from tools/early_from_replays.js); the others are made with the game's
   own code for the screen shape she had (layouts.js forLevel + makeDeal without time limit, gold and
   jokers as specials.js, ice and locks as board.js). Her very hard level 51 and her level 53 are
   switched: 53 is her 51, 51 is her 53. Level 52 is not in the table (null).
     node tools/build_early.js            writes www/levels-early.js
     node tools/build_early.js --check    only checks that the file matches */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const W = path.join(__dirname, '..', 'www');
const L = require(path.join(W, 'layouts.js'));
const Hard = require(path.join(W, 'hard.js'));
const RULES = vm.runInNewContext(fs.readFileSync(path.join(W, 'js', 'rules.js'), 'utf8') + ';RULES');
const GERDA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'analysis', 'early-gerda.json'), 'utf8'));
const SP = RULES.specials, JOKERS_GONE = 50, FROM = 51, TO = 69;
const SWAP = { 51: 53, 53: 51 }, OWN = new Set([52]);   // OWN: made for each screen as before
// the board the game makes for this level and screen shape (normal track, no time limit)
function made(lv, aspect) {
  const spec = L.forLevel(lv, aspect, 1, ''), d = L.makeDeal(spec, 24, true);
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
  return { tiles: spec.tiles.map(t => [t.x, t.y, t.z]), faces, down, gold, obst: hasOb ? { ice: ob.ice || {}, locks: ob.locks || [], keys: ob.keys || [] } : null };
}
function level(lv) {
  if (OWN.has(lv)) return null;
  const src = SWAP[lv] || lv, g = GERDA.boards[src], b = g || made(src, GERDA.aspects[src]);
  if (b.faces.some(f => f >= 100 && f !== 101)) throw new Error(`level ${lv}: an unknown special tile`);
  return Hard.pack({ tiles: b.tiles, faces: b.faces.map(f => f === 101 ? 63 : f), down: b.down, gold: b.gold, obst: b.obst, clock: null, info: { rate: 0, strong: 0 }, solution: null });
}
const T = { v: 3, from: FROM, levels: [] };
for (let lv = FROM; lv <= TO; lv++) T.levels.push(level(lv));
const text = `/* Levels ${FROM}-${TO} (not ${[...OWN].join(', ')}), the same for everyone: the boards Gerda played (51 and 53 switched) (made by tools/build_early.js; see hard.js earlySpec). */\nconst EARLY_LEVELS = ${JSON.stringify(T)};\n`;
const file = path.join(W, 'levels-early.js');
if (process.argv.includes('--check')) { const ok = fs.existsSync(file) && fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') === text; console.log(ok ? 'levels-early.js matches' : 'levels-early.js differs'); process.exit(ok ? 0 : 1); }
fs.writeFileSync(file, text);
console.log(`wrote ${file}: ${T.levels.filter(Boolean).length} levels (${T.levels.filter((r, i) => r && GERDA.boards[SWAP[FROM + i] || FROM + i]).length} her recorded boards), ${(text.length / 1024).toFixed(0)} KB`);
