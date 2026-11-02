/* Level factory: does every special on a board change how hard it is? (Claude, 2026-10-31)
   Dennis: "how the old levels were built a special often didn't add anything. I want to change that from now.
   Levels shouldn't get this flag." Gemini's critic tests this with 10-game ablations (noisy: it fired on half
   of the old 1.63 levels); here every special kind (ice, locks with their keys, the clock) is removed in turn
   and the board measured with the full g2.1 measure (2 seeds x 20 games, seed 4711), like the board itself.
   A special matters when removing it changes the expected tries by at least MIN (0.3) or the first-try rate
   by at least 0.15, either way (first run: on several boards removing the locks made the level HARDER - the
   locks show the way, as Dennis said of 187: "the locks put you in the right direction"). The clock cannot go (every level from 80 has one), so a clock that does not matter
   has to be made to matter (fewer spare moves, or placed elsewhere); idle ice or locks are simply taken off.
     const { specialsMatter } = require('./specials_matter.js');  specialsMatter(board, base?)            */
'use strict';
// the bot's family profile is the meter from human-g6 (Dennis 2026-11-02: tune to Gerda and Mrs. Doubtfire; one profile)
const BOT_SETTING = process.env.BOT_SETTING || 'family';
const MIN = +(process.env.MATTER_MIN || 0.3), MIN_FIRST = 0.15;
function specialsMatter(board, base, measureHuman = require(process.env.HUMAN_BOT).measureHuman) {
  const meas = b => measureHuman({ tiles: b.tiles, faces: b.faces, down: b.down, obst: b.obst, clock: b.clock }, { runs: 20, setting: BOT_SETTING, seed: 4711 });
  const m0 = base || meas(board), ob = board.obst || {};
  const out = { exp: m0.expectedTries, first: m0.firstTryRate, kinds: {} };
  const test = (kind, b) => {
    const m = meas(b), d = +(m0.expectedTries - m.expectedTries).toFixed(2), df = +(m.firstTryRate - m0.firstTryRate).toFixed(2);
    out.kinds[kind] = { without: m.expectedTries, drop: d, firstUp: df, matters: Math.abs(d) >= MIN || Math.abs(df) >= MIN_FIRST };
  };
  if (ob.ice && Object.keys(ob.ice).length) test('ice', { ...board, obst: { ...ob, ice: {} } });
  if (ob.locks && ob.locks.length) test('locks', { ...board, obst: { ...ob, locks: [], keys: [] } });
  if (board.clock) test('clock', { ...board, clock: null });
  out.ok = Object.values(out.kinds).every(k => k.matters);
  out.idle = Object.entries(out.kinds).filter(([, k]) => !k.matters).map(([k]) => k);
  return out;
}
module.exports = { specialsMatter };
if (require.main === module) {
  // node specials_matter.js <rows.jsonl> [ids,...]   (rows with design; prints one line per board)
  const fs = require('fs');
  const rows = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map(JSON.parse);
  const want = process.argv[3] ? process.argv[3].split(',') : null;
  for (const r of rows) {
    const id = r.id || String(r.level);
    if (want && !want.includes(id)) continue;
    const s = specialsMatter(r.design);
    console.log(JSON.stringify({ id, shape: r.shape, recipe: r.recipe, ...s }));
  }
}
