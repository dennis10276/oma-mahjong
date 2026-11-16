#!/usr/bin/env node
'use strict';
/* replay_study.js: what Dennis did in a lab, try by try (Dennis 2026-11-16: "Would be smart to store my moves").
     node source/tools/builder/bank/replay_study.js <lab-dir> [--level <lab id>]
   Reads <lab-dir>-replays.json (lab_server.js) and <lab-dir>/lab-ideas.js. Per try: the taps, where it left the stored route,
   the first move after which the clock could no longer be reached in time (exact, engine), the outcome, and the long pauses
   (thinking moments: 6 s or more before a tap). */
const fs = require('fs'), path = require('path'), E = require('../engine.js'), D = require('../loop/detour.js');
function load(dir) {
  const R = JSON.parse(fs.readFileSync(dir + '-replays.json', 'utf8')), t = fs.readFileSync(path.join(dir, 'lab-ideas.js'), 'utf8');
  const ideas = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)).ideas, byId = new Map(ideas.map(i => ['X' + i.id, i]));
  const chunks = {};
  for (const [k, s] of Object.entries(R)) {
    if (!k.startsWith('omamj.replayq.')) continue;
    const v = JSON.parse(s), d = JSON.parse(v.data); (chunks[v.aid] = chunks[v.aid] || []).push({ seq: v.seq, d, t: v.t });
  }
  const tries = [];
  for (const [aid, cs] of Object.entries(chunks)) {
    cs.sort((a, b) => a.seq - b.seq);
    const key = cs.map(c => c.d.init && c.d.init.key).find(Boolean), idea = byId.get(key);
    if (!idea) continue;
    const ev = cs.flatMap(c => c.d.events), taps = ev.filter(e => e[1] === 'tap'), end = ev.find(e => e[1] === 'end');
    tries.push({ aid, key, idea, t0: cs[0].t, taps: taps.map(e => ({ ms: e[0], i: e[2][0], blocked: e[2][2] || '' })), end: end ? end[2] : null });
  }
  return tries.sort((a, b) => a.t0 - b.t0);
}
function study(tr) {
  const d = tr.idea.board, ci = d.solution.indexOf(d.clock.i), route = d.solution.slice(0, ci + 1);
  const C = D.clockGames(d), g = C.at(d.clock.n), w = D.work(3e6, 60000);
  let s = E.start(C.free), moves = [], left = null, lost = null, k = 0, prev = tr.taps[0] ? tr.taps[0].ms : 0;
  const pauses = [];
  for (const tp of tr.taps) {
    if (tp.ms - prev >= 6000) pauses.push({ before: k + 1, s: Math.round((tp.ms - prev) / 1000), tile: tp.i });
    prev = tp.ms;
    if (tp.blocked) { moves.push(tp.i + '(' + tp.blocked + ')'); continue; }
    let s2; try { s2 = E.legal(C.free, s).includes(tp.i) ? E.step(C.free, s, tp.i) : null; } catch (e) { s2 = null; }
    if (!s2) { moves.push(tp.i + '?'); continue; }   // a peek pair's second tap or a tap the engine reads differently
    k++; moves.push(String(tp.i));
    if (left == null && !s.clockTaken && route[k - 1] !== tp.i) left = { move: k, tile: tp.i, route: route[k - 1] };
    s = s2;
    if (lost == null && !s.clockTaken) { const r = D.clockNeed(C, s, { upTo: d.clock.n, nodes: 40000, w }); if (r.k == null && r.exact) lost = { move: k, tile: tp.i }; }
  }
  return { level: tr.idea.lv, title: tr.idea.title, taps: tr.taps.length, moves, leftRoute: left, lostAt: lost, end: tr.end, pauses: pauses.slice(0, 6), clockTaken: s.clockTaken };
}
module.exports = { load, study };
if (require.main === module) {
  const a = process.argv.slice(2), lv = a.includes('--level') ? 'X' + a[a.indexOf('--level') + 1] : null;
  for (const tr of load(path.resolve(a[0])).filter(t => !lv || t.key === lv)) {
    const r = study(tr);
    console.log(`${r.level} ${r.title.slice(0, 40)} | ${r.moves.length} taps, clock ${r.clockTaken ? 'taken' : 'not taken'}, end ${JSON.stringify(r.end)}`);
    console.log('   left route at ' + (r.leftRoute ? `move ${r.leftRoute.move} (took ${r.leftRoute.tile}, route ${r.leftRoute.route})` : '-') + ' | clock lost after ' + (r.lostAt ? `move ${r.lostAt.move} (${r.lostAt.tile})` : '-'));
    console.log('   pauses ' + r.pauses.map(p => `${p.s}s before move ${p.before} (${p.tile})`).join(', '));
    console.log('   ' + r.moves.slice(0, 30).join(' '));
  }
}
