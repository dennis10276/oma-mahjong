/* Replays of how a level was won, for players who are stuck on it (js/pro.js; decisions Dennis 2026-11-06).
   Per level: Dennisisdebeste's most recent complete win on today's board; for a level without one, the
   win of the player who needed the fewest tries (then the quickest). Every tap is checked against the
   game's own film rules (czStep/czApply from js/coach.js) and the recorded positions.
   Writes www/pro/L<n>.json. Firebase keeps recordings only 30 days, so files already there are kept:
   a level is only rewritten with a better choice (Dennis over others, his newer win, or another
   player's win in fewer tries); a file whose board is no longer today's board is removed.
   The game shows a file only when its board fingerprint equals the board being played.

   Runs at every release (release.py). By hand:
     node tools/pro/build_pro.js --fetch            download all players' recordings and update
     node tools/pro/build_pro.js <pid>.json ... --names scores.json   from exports of replays/<pid> */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { readReplay } = require('../replays.js');

const DB = 'https://oma-mahjong-default-rtdb.europe-west1.firebasedatabase.app';
const BEST = 'pmuy78xu6tsths9';                  // Dennisisdebeste: his win first
const SKIP = new Set(['pmuxw2uqkzcnbgx']);        // DennisTEST (follows grandma's settings)
const OUT = path.join(__dirname, '..', '..', 'www', 'pro');
const argv = process.argv.slice(2), arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };

// the film rules of the game itself, and the same fingerprint as the game
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'www', 'js', 'coach.js'), 'utf8').replace("'use strict';", '') +
  '\n;this.czStep = czStep; this.czApply = czApply;', ctx);
const { proSig } = require('../../www/js/pro.js');

// the boards as they are now (the ready-made level tables)
const game = {}; vm.createContext(game);
for (const f of ['layouts.js', 'hard.js', 'levels-hard.js', 'levels-early.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'www', f), 'utf8').replace(/^'use strict';/m, '') +
    (f === 'hard.js' ? '\n;this.Hard = Hard;' : ''), game, { filename: f });
const nowCache = new Map();
function boardNow(level) {
  if (!nowCache.has(level)) {
    const H = game.Hard, d = H.applies(level, '') ? H.get(level) : H.appliesEarly(level, '') ? H.earlySpec(level).made : null;
    nowCache.set(level, d ? JSON.stringify([d.tiles, d.faces, [...d.tiles.keys()].map(i => d.down.includes(i) ? 1 : 0)]) : null);
  }
  return nowCache.get(level);
}
const boardOf = (tiles, f, d) => JSON.stringify([tiles, f, Array.from(d).map(Number)]);

async function getJSON(url) {
  for (let k = 0; k < 3; k++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw Error('could not download ' + url);
}

function convert(r) {
  const I = r.initial, faces = I.state.f.slice();
  const toCz = st => ({ a: st.a.slice(), d: st.d.slice(), p: st.p ?? -1, tray: st.tr.map(t => faces[t]), ck: st.ck ? { i: st.ck.i, left: st.ck.n - (st.m || 0) } : null });
  let cz = toCz(I.state), pend = null, t0 = null, bad = 0;
  const acts = [];
  for (const fr of r.frames) {
    if (fr.kind === 'tap') { pend = fr.data[2] ? null : { i: fr.data[0], ms: fr.ms }; continue; }
    if (fr.kind !== 'state' || !pend) continue;
    const act = ctx.czStep(cz, faces, pend.i), after = ctx.czApply(cz, faces, act), want = toCz(fr.state);
    // the recorded result of this tap must be what the film rules make of it
    if (after.a.join('') !== want.a.join('') || after.p !== want.p || after.tray.join() !== want.tray.join()) bad++;
    if (t0 === null) t0 = pend.ms;
    acts.push([...act, pend.ms - t0]);
    cz = after; pend = null;
  }
  if (bad || !cz.a.every(x => !x) || acts.length < 10) return null;
  return { tiles: I.tiles, faces, d: I.state.d.join(''),
    ob: I.state.ob ? { need: I.state.ob.need, locks: I.state.ob.locks, keys: I.state.ob.keys, unlocked: !!I.state.ob.unlocked } : null,
    ck: I.state.ck ? { i: I.state.ck.i, left: I.state.ck.n } : null, dur: acts[acts.length - 1].at(-1), acts };
}
// which win is the better film: Dennis first (his newest win), then the fewest tries, then the quickest
const better = (a, b) => {
  if (!b) return true;
  const da = a.pid === BEST, db = b.pid === BEST;
  if (da !== db) return da;
  if (da) return a.born > b.born;
  return a.at !== b.at ? a.at < b.at : a.dur !== b.dur ? a.dur < b.dur : a.born < b.born;
};

(async () => {
  let names = {}, exports = [];
  if (argv.includes('--fetch')) {
    const scores = await getJSON(DB + '/scores.json');
    for (const [pid, s] of Object.entries(scores || {})) if (s && s.name) names[pid] = s.name;
    const pids = Object.keys(await getJSON(DB + '/replays.json?shallow=true') || {});
    for (const pid of pids) if (!pid.startsWith('test-') && !SKIP.has(pid)) exports.push([pid, await getJSON(`${DB}/replays/${pid}.json`)]);
  } else {
    if (arg('--names')) for (const [pid, s] of Object.entries(JSON.parse(fs.readFileSync(arg('--names'), 'utf8')))) if (s && s.name) names[pid] = s.name;
    for (const f of argv.filter(a => a.endsWith('.json') && a !== arg('--names'))) {
      exports.push([path.basename(f, '.json'), JSON.parse(fs.readFileSync(f, 'utf8'))]);      // file name = player id
    }
  }
  // the best win per level on today's board
  const pick = new Map();
  for (const [pid, d] of exports) {
    if (SKIP.has(pid) || pid.startsWith('test-')) continue;
    for (const [aid, rec] of Object.entries(d || {})) {
      let r; try { r = readReplay(rec); } catch (e) { continue; }
      const I = r.initial;
      if (!I || r.result !== 'win' || !r.complete || I.partial || I.track || !/^L\d+$/.test(I.key)) continue;
      const lv = +I.key.slice(1);
      if (boardOf(I.tiles, I.state.f, I.state.d) !== boardNow(lv)) continue;      // an older version of the level
      const c = { pid, aid, born: rec.createdAt || 0, at: I.at || 99, r };
      const best = pick.get(lv), film = convert(r);
      if (!film) continue;
      c.film = film; c.dur = film.dur;
      if (better(c, best)) pick.set(lv, c);
    }
  }
  fs.mkdirSync(OUT, { recursive: true });
  const report = [];
  // files whose board changed since are of no use any more
  for (const f of fs.readdirSync(OUT).filter(f => /^L\d+\.json$/.test(f))) {
    const o = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
    if (boardOf(o.tiles, o.faces, o.d) !== boardNow(o.lv)) { fs.unlinkSync(path.join(OUT, f)); report.push(`L${o.lv}: removed (the level changed)`); }
  }
  for (const [lv, c] of [...pick].sort((a, b) => a[0] - b[0])) {
    const dst = path.join(OUT, `L${lv}.json`);
    let old = null; try { old = JSON.parse(fs.readFileSync(dst, 'utf8')); } catch (e) { }
    if (old && old.aid === c.aid && !argv.includes('--force')) continue;
    if (old && !argv.includes('--force') && !better(c, { ...old, at: old.at || (old.pid === BEST ? 1 : 99) })) continue;
    const who = names[c.pid] || (c.pid === BEST ? 'Dennisisdebeste' : null);
    if (!who) continue;
    fs.writeFileSync(dst, JSON.stringify({ v: 1, lv, who, pid: c.pid, aid: c.aid, born: c.born, at: c.at, gen: c.r.initial.gen, sig: proSig(c.r.initial), ...c.film }));
    report.push(`L${lv}: ${old ? 'updated' : 'new'} — ${who}, try ${c.at} (${c.film.acts.length} taps, ${Math.round(c.dur / 1000)} s)`);
  }
  const all = fs.readdirSync(OUT).filter(f => /^L\d+\.json$/.test(f)).map(f => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')));
  const by = {}; for (const o of all) by[o.who] = (by[o.who] || 0) + 1;
  console.log(report.join('\n') + (report.length ? '\n' : '') + `replays: ${all.length} levels (${Object.entries(by).map(([w, n]) => `${w} ${n}`).join(', ')})`);
})().catch(e => { console.error(e.message); process.exit(1); });
