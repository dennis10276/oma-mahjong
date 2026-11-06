/* Replays of how Dennisisdebeste won a level, for players who are stuck on it (js/pro.js).
   Reads an export of replays/<pid> (Firebase keeps those only 30 days), takes per level his most
   recent complete win, turns it into taps with their times, checks every tap against the game's own
   film rules (czStep/czApply from js/coach.js) and the recorded positions, and writes www/pro/L<n>.json.
   Files already there are kept (so wins older than 30 days stay available); a level is only rewritten
   with a newer win. The game shows a file only when its board signature equals the board being played.

   node tools/pro/build_pro.js <export.json> [--pid pmuy78xu6tsths9] [--name Dennisisdebeste] [--force]
   (export: curl -o x.json "$DB/replays/<pid>.json")   */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { readReplay } = require('../replays.js');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = process.argv[2], PID = arg('--pid', 'pmuy78xu6tsths9'), NAME = arg('--name', 'Dennisisdebeste'), FORCE = process.argv.includes('--force');
const OUT = path.join(__dirname, '..', '..', 'www', 'pro');
if (!SRC) { console.error('usage: node tools/pro/build_pro.js <replays export.json>'); process.exit(1); }

// the film rules of the game itself
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'www', 'js', 'coach.js'), 'utf8').replace("'use strict';", '') +
  '\n;this.czStep = czStep; this.czApply = czApply; this.czState = czState;', ctx);
// the same signature as proSig() in js/pro.js
const { proSig } = require('../../www/js/pro.js');

// the boards as they are now (the ready-made level tables), to pick a win on today's board
const game = {}; vm.createContext(game);
for (const f of ['layouts.js', 'hard.js', 'levels-hard.js', 'levels-early.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'www', f), 'utf8').replace(/^'use strict';/m, '') +
    (f === 'hard.js' ? '\n;this.Hard = Hard;' : ''), game, { filename: f });
function boardNow(level) {
  const H = game.Hard, d = H.applies(level, '') ? H.get(level) : H.appliesEarly(level, '') ? H.earlySpec(level).made : null;
  if (!d) return null;
  return JSON.stringify([d.tiles, d.faces, [...d.tiles.keys()].map(i => d.down.includes(i) ? 1 : 0)]);
}
const board = I => JSON.stringify([I.tiles, I.state.f, Array.from(I.state.d)]);

const exp = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const wins = new Map(), other = new Map();
for (const [aid, rec] of Object.entries(exp)) {
  let r; try { r = readReplay(rec); } catch (e) { continue; }
  const I = r.initial;
  if (!I || r.result !== 'win' || !r.complete || I.partial || I.track || !/^L\d+$/.test(I.key)) continue;
  if (board(I) !== boardNow(+I.key.slice(1))) { other.set(I.key, (other.get(I.key) || 0) + 1); continue; }   // an older version of the level
  const old = wins.get(I.key);
  if (!old || rec.createdAt > old.born) wins.set(I.key, { r, aid, born: rec.createdAt });
}
for (const [k, n] of other) if (!wins.has(k)) console.log(`${k}: no win on today's board (${n} on an older version)`);

function convert({ r, aid, born }) {
  const I = r.initial, f = I.state.f, faces = f.slice();
  let S = JSON.parse(JSON.stringify(I.state));
  const toCz = st => ({ a: st.a.slice(), d: st.d.slice(), p: st.p ?? -1, tray: st.tr.map(t => faces[t]), ck: st.ck ? { i: st.ck.i, left: st.ck.n - (st.m || 0) } : null });
  let cz = toCz(S), pend = null, t0 = null;
  const acts = [], bad = [];
  for (const fr of r.frames) {
    if (fr.kind === 'tap') { pend = fr.data[2] ? null : { i: fr.data[0], ms: fr.ms }; continue; }
    if (fr.kind !== 'state' || !pend) continue;
    const next = fr.state, i = pend.i;
    const act = ctx.czStep(cz, faces, i);
    const after = ctx.czApply(cz, faces, act);
    // the recorded result of this tap must be what the film rules make of it
    const want = toCz(next);
    const same = after.a.join('') === want.a.join('') && after.p === want.p && after.tray.join() === want.tray.join();
    if (!same) bad.push({ n: acts.length, i, act, want: { p: want.p, tray: want.tray }, got: { p: after.p, tray: after.tray } });
    if (t0 === null) t0 = pend.ms;
    acts.push([...act, pend.ms - t0]);
    cz = after; S = next; pend = null;
  }
  const done = cz.a.every(x => !x);
  return {
    file: { v: 1, lv: +I.key.slice(1), who: NAME, pid: PID, aid, born, gen: I.gen, sig: proSig(I),
      tiles: I.tiles, faces, d: I.state.d.join(''), ob: I.state.ob ? { need: I.state.ob.need, locks: I.state.ob.locks, keys: I.state.ob.keys, unlocked: !!I.state.ob.unlocked } : null,
      ck: I.state.ck ? { i: I.state.ck.i, left: I.state.ck.n } : null, dur: acts.length ? acts[acts.length - 1][acts[acts.length - 1].length - 1] : 0, acts },
    bad, done };
}

fs.mkdirSync(OUT, { recursive: true });
const report = [];
for (const [key, w] of [...wins].sort((a, b) => +a[0].slice(1) - +b[0].slice(1))) {
  const c = convert(w), dst = path.join(OUT, key + '.json');
  if (c.bad.length || !c.done) { report.push(`${key}: skipped (${c.bad.length} taps differ from the rules${c.done ? '' : ', board not cleared'})`); continue; }
  let old = null; try { old = JSON.parse(fs.readFileSync(dst, 'utf8')); } catch (e) { }
  if (old && !FORCE && old.born >= c.file.born) { report.push(`${key}: kept`); continue; }
  fs.writeFileSync(dst, JSON.stringify(c.file));
  report.push(`${key}: ${old ? 'updated' : 'new'} (${c.file.acts.length} taps, ${(c.file.dur / 1000).toFixed(0)} s)`);
}
console.log(report.join('\n'));
