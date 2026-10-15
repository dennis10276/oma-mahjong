/* Follow a real player's recorded attempt (Firebase replays/) and ask the test player, after every
   move the player made, how often it would still win from there. Where the chance jumps, the player
   found something the test player would not.
     node replay.js <replays-of-player.json> <attempt id prefix> [persona json] [runs=60] */
'use strict';
const fs = require('fs'), path = require('path');
const B = require('./boards.js');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
function load(file, prefix) {
  const R = JSON.parse(fs.readFileSync(file, 'utf8'));
  const aid = Object.keys(R).find(k => k.startsWith(prefix));
  const rows = Object.values(R[aid]).filter(r => r && r.data).sort((a, b) => a.seq - b.seq);
  let init = null, code = rows[0].code; const ev = [];
  for (const r of rows) { const d = JSON.parse(r.data); if (d.init) init = d.init; ev.push(...d.events); }
  return { aid, init, ev, code };
}
// the tiles taken, in order, with what the player did in between (peeks, the tray)
function takes(rec) {
  const out = [], peeks = []; let tray = [];
  for (const [ms, kind, data] of rec.ev) {
    if (kind !== 'state') continue;
    if (data.p !== undefined && data.p >= 0) peeks.push({ at: out.length, i: data.p });
    if (data.a) for (const [i, v] of data.a) if (v === 0) out.push({ i, ms, peeksBefore: peeks.filter(p => p.at === out.length).map(p => p.i) });
    if (data.tr) tray = data.tr;
  }
  return out;
}
module.exports = { load, takes };
if (require.main === module) {
  const [file, prefix, pj] = process.argv.slice(2);
  const runs = +(process.argv[5] || 60);
  const per = { ...Hard.P, ...(pj ? JSON.parse(pj) : Hard.REF.strong) };
  const rec = load(file, prefix), lv = +rec.init.key.replace(/\D/g, '');
  const g = B.designed(rec.code, lv);
  const same = g.faces.join() === rec.init.state.f.join() && g.down.join() === rec.init.state.d.join();
  console.log(`${rec.init.key} v${rec.code} try ${rec.init.at}: board matches the table: ${same}; clock ${JSON.stringify(g.clock)}`);
  const seq = takes(rec);
  let last = null;
  for (let k = 0; k <= seq.length; k += 1) {
    const st = seq.slice(0, k).map(x => x.i);
    const r = Hard.rate({ ...g, start: st }, runs, 5, per).rate;
    const t = seq[k - 1];
    const mark = last !== null && r - last >= 0.25 ? '  <== jump' : last !== null && last - r >= 0.25 ? '  <== drop' : '';
    if (k % 2 === 0 || mark) console.log(`${String(k).padStart(3)} taken  ${t ? 'tile ' + t.i + (g.down[t.i] ? ' (face-down)' : '') + ' face ' + g.faces[t.i] : '-'}  bot wins from here ${r.toFixed(2)}${mark}`);
    last = r;
  }
}
