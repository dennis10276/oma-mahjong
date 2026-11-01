/* Level factory: how the family really loses a level, from the recordings (Claude, 2026-11-01).
   Dennis: "Why can't it find out from the data the players gave?" Every try is recorded tap by tap in
   Firebase replays/<pid>/<aid> (kept 30 days; the dashboard's player, site/dash/watch.js, shows them).
   This reads a raw export (one <pid>.json per player, the replays/<pid> node as downloaded; raw exports
   stay in analysis/archive/, git-ignored) with tools/replays.js and gives per level and player:
     - only the tries up to and including the FIRST win (Dennis: "use my actual needed tries before I
       succeed a level, not the total tries. Sometimes I replay a level afterwards; that doesn't count");
     - how each lost try ended: the clock ran out ('clock': the clock tile was still on the board when its
       moves were used up) or the tray filled ('tray'), or a restart;
     - for tray losses: tiles left on the board and whether the clock had been taken already.
   No database access and no writes to the database.
     node source/tools/factory/real_losses.js <export-dir> <out.json> [from-to]                          */
'use strict';
const fs = require('fs'), path = require('path');
const { readReplay } = require('../replays.js');
const [dir, out, range = '85-174'] = process.argv.slice(2);
const [from, to] = range.split('-').map(Number);
const NAME = { pmuy78xu6tsths9: 'Dennis', pmv6yhzz3x9oxs8: 'Gerda', pmv16kj3jr35750: 'MrsD' };
const tries = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const pid = f.replace('.json', ''), who = NAME[pid];
  if (!who) continue;
  for (const rec of Object.values(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))) {
    let r; try { r = readReplay(rec); } catch (e) { continue; }
    if (!r.initial || !/^L\d+$/.test(r.initial.key) || r.initial.partial) continue;
    const lv = +r.initial.key.slice(1);
    if (lv < from || lv > to) continue;
    const s = r.state, ck = s.ck, end = r.frames.find(x => x.kind === 'end');
    const cause = r.result === 'win' ? 'win' : r.result === 'restart' ? 'restart' : r.result === 'stuck'
      ? ((end && end.data && end.data.ck) || (ck && s.a[ck.i] && s.m >= ck.n) ? 'clock' : 'tray') : 'unfinished';
    let clockAt = null;
    if (ck) for (const fr of r.frames) if (fr.state && !fr.state.a[ck.i]) { clockAt = fr.state.m; break; }
    tries.push({ who, lv, at: r.initial.at, cause, n: s.a.length, left: s.a.filter(Boolean).length, moves: s.m, clock: ck, clockAt, tray: s.tr || [] });
  }
}
// up to the first win only
const groups = {};
for (const t of tries) (groups[t.lv + ' ' + t.who] = groups[t.lv + ' ' + t.who] || []).push(t);
const levels = {};
for (const a of Object.values(groups)) {
  a.sort((p, q) => p.at - q.at);
  const w = a.findIndex(t => t.cause === 'win'), keep = w < 0 ? a : a.slice(0, w + 1), t0 = keep[0];
  const c = { win: 0, clock: 0, tray: 0, restart: 0, unfinished: 0 }; for (const t of keep) c[t.cause]++;
  const tl = keep.filter(t => t.cause === 'tray').map(t => t.left).sort((p, q) => p - q);
  (levels[t0.lv] = levels[t0.lv] || { level: t0.lv, tiles: t0.n, clock: t0.clock, players: {} }).players[t0.who] = {
    recordedTries: keep.length, firstRecordedTry: t0.at, won: w >= 0, leftOutAfterWin: a.length - keep.length, ...c,
    trayLossTilesLeftMedian: tl.length ? tl[tl.length >> 1] : null,
    trayLossClockTakenShare: tl.length ? +(keep.filter(t => t.cause === 'tray' && t.clockAt != null).length / tl.length).toFixed(2) : null,
  };
}
const res = { about: 'How Dennis, Gerda and Mrs. Doubtfire lost each level ' + range + ', from the recordings (tools/factory/real_losses.js); tries up to the first win only.', levels: Object.values(levels).sort((a, b) => a.level - b.level) };
fs.writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
console.log(res.levels.length, 'levels,', tries.length, 'recorded tries read');
