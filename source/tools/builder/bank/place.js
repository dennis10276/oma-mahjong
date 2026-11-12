#!/usr/bin/env node
'use strict';
// Placement half of "bank and place": assigns banked puzzles to levels. Proposal only; light CPU; writes nothing to the game.
// Usage: node place.js --start 250 --count 50 [--stat D40|D20] [--bank dir] [--out file.json] [--allow-fallback 260,270] [--taken file]
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const DEF_BANK = path.join(ROOT, 'analysis/builder/bank/puzzles');

// Dennis 2026-11-12 (final that day): 6 bot tries at 250, +1 try every 15 levels.
function targetCurve(l) { return 6 + (l - 250) / 15; }
function slot(l) { const big = l % 10 === 0; return { big, minTiles: big ? 96 : 72, maxTiles: big ? 96 : 88 }; }
const tileClass = t => (t >= 96 ? '96' : '72-88');

// Reads bank-puzzle-v1 files (card.stats...) into flat entries.
function loadBank(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), c = j.card;
      if (!c || !c.stats) continue;
      out.push({ key: c.boardKey, body: c.matchingBodyKey, layout: c.layout, tiles: c.tiles, D20: c.stats.D20, D40: c.stats.D40, S: c.stats.S, band: c.stats.band, B7: c.traceGates && c.traceGates.B7 ? c.traceGates.B7.value : null, late: c.traceGates && c.traceGates.B6 ? c.traceGates.B6.value : null });
    } catch (e) { /* skip unreadable */ }
  }
  return out;
}

// Hungarian algorithm (rows <= cols); returns column index per row.
function hungarian(cost) {
  const n = cost.length, m = cost[0].length, INF = 1e18;
  const u = new Array(n + 1).fill(0), v = new Array(m + 1).fill(0), p = new Array(m + 1).fill(0), way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i; let j0 = 0; const minv = new Array(m + 1).fill(INF), used = new Array(m + 1).fill(false);
    do {
      used[j0] = true; const i0 = p[j0]; let d = INF, j1 = 0;
      for (let j = 1; j <= m; j++) if (!used[j]) {
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < d) { d = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) if (used[j]) { u[p[j]] += d; v[j] -= d; } else minv[j] -= d;
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const res = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) res[p[j] - 1] = j - 1;
  return res;
}

function place(bank, o) {
  const stat = o.stat || 'D40', start = o.start, count = o.count, allow = new Set(o.allowFallback || []);
  const taken = new Set(o.taken || []);
  const pool = bank.filter(b => !taken.has(b.key) && Number.isFinite(b[stat]));
  const levels = Array.from({ length: count }, (_, i) => start + i);
  const tgt = levels.map(targetCurve);
  const D = b => b[stat];
  const feasible = (li, b) => {
    const L = levels[li], s = slot(L);
    if (b.tiles < s.minTiles || b.tiles > s.maxTiles) return false;
    if (Math.abs(D(b) - tgt[li]) > 1 + 1e-9) return false;
    if (!(typeof b.B7 === 'number' && b.B7 <= 0.3)) return false; // Dennis 2026-11-12: a high repeated-blunder share means "steer first" (steer.js), so it is not placed as it is
    // Dennis on test puzzle 254 (2026-11-12): "the rest of the level is quite easy" - its share of lost tries after the clock was 0.13.
    // Small steering edits could not raise that share, so placement asks for a second act: at least 0.25 (when measured).
    if (typeof b.late === 'number' && b.late < (o.minLate != null ? o.minLate : 0.25)) return false;
    if (b.S < (o.sMin != null ? o.sMin : 1.75) || b.S > 6) return false;
    return true;
  };
  const BIG = 1000, NO = 1e7, n = count, m = pool.length;
  // columns: pool puzzles, then one private hole column per level (cost BIG) => max filled first, then min deviation.
  const cost = levels.map((_, li) => {
    const row = [];
    for (let j = 0; j < m; j++) row.push(feasible(li, pool[j]) ? Math.abs(D(pool[j]) - tgt[li]) : NO);
    for (let k = 0; k < n; k++) row.push(k === li ? BIG : NO * 10);
    return row;
  });
  const sol = n ? hungarian(cost) : [];
  const asg = sol.map(j => (j >= 0 && j < m ? j : -1));

  // ---- constraint violations and swap/replace repair
  const win = 5;
  function violations(a) {
    let v = 0;
    const seen = new Set();
    for (let i = 0; i < n; i++) if (a[i] >= 0) {
      const b = pool[a[i]];
      if (b.body != null) { if (seen.has(b.body)) v++; seen.add(b.body); }
      for (let k = Math.max(0, i - 3); k < i; k++) if (a[k] >= 0 && pool[a[k]].layout === b.layout) v++;
    }
    for (let i = 0; i + win <= n; i++) {
      let ok = true, s = 0, t = 0;
      for (let k = i; k < i + win; k++) { if (a[k] < 0) { ok = false; break; } s += D(pool[a[k]]); t += tgt[k]; }
      if (ok && Math.abs(s - t) / win > 0.5 + 1e-9) v++;
    }
    return v;
  }
  const score = a => [violations(a), a.filter(x => x < 0).length, a.reduce((s, x, i) => s + (x >= 0 ? Math.abs(D(pool[x]) - tgt[i]) : 0), 0)];
  const better = (x, y) => { for (let i = 0; i < 3; i++) if (Math.abs(x[i] - y[i]) > 1e-9) return x[i] < y[i]; return false; };
  let cur = asg.slice(), cs = score(cur), iter = 0;
  const feasIdx = levels.map((_, li) => { const r = []; for (let j = 0; j < m; j++) if (feasible(li, pool[j])) r.push(j); return r; });
  while (cs[0] > 0 && iter++ < 200) {
    let best = null, bs = cs;
    const usedSet = new Set(cur.filter(x => x >= 0));
    for (let i = 0; i < n; i++) {
      for (const j of feasIdx[i]) if (!usedSet.has(j) && cur[i] !== j) {
        const t = cur.slice(); t[i] = j; const s = score(t); if (better(s, bs)) { bs = s; best = t; }
      }
      for (let k = i + 1; k < n; k++) {
        const a = cur[i], b = cur[k];
        if (a === b || (b >= 0 && !feasible(i, pool[b])) || (a >= 0 && !feasible(k, pool[a]))) continue;
        const t = cur.slice(); t[i] = b; t[k] = a; const s = score(t); if (better(s, bs)) { bs = s; best = t; }
      }
      if (cur[i] >= 0) { const t = cur.slice(); t[i] = -1; const s = score(t); if (better(s, bs)) { bs = s; best = t; } }
    }
    if (!best) break;
    cur = best; cs = bs;
  }

  // ---- report
  const rows = levels.map((L, i) => {
    const b = cur[i] >= 0 ? pool[cur[i]] : null;
    return { level: L, target: +tgt[i].toFixed(3), key: b && b.key, layout: b && b.layout, tiles: b && b.tiles, D: b && D(b), S: b && b.S, band: b && b.band, dev: b ? +(D(b) - tgt[i]).toFixed(3) : null, bodyKey: b && b.body };
  });
  const windows = [], unchecked = [];
  for (let i = 0; i + win <= n; i++) {
    const r = rows.slice(i, i + win);
    if (r.some(x => !x.key)) { windows.push({ from: levels[i], to: levels[i + win - 1], skipped: 'hole' }); continue; }
    const md = r.reduce((s, x) => s + x.D, 0) / win, mt = r.reduce((s, x) => s + x.target, 0) / win;
    windows.push({ from: levels[i], to: levels[i + win - 1], meanD: +md.toFixed(3), meanTarget: +mt.toFixed(3), diff: +(md - mt).toFixed(3), ok: Math.abs(md - mt) <= 0.5 + 1e-9 });
  }
  for (let k = 1; k < win; k++) {
    unchecked.push(`${start - win + k}..${start + k - 1} (crosses start)`);
    unchecked.push(`${start + count - win + k}..${start + count + k - 1} (crosses end)`);
  }
  const holes = rows.filter(r => !r.key).map(r => {
    const s = slot(r.level);
    return { level: r.level, target: r.target, needD: [+(r.target - 1).toFixed(2), +(r.target + 1).toFixed(2)], tileClass: s.big ? '96' : '72-88', S: [1.75, 6] };
  });
  const supply = {}, demand = {}, bin = d => Math.floor(d);
  for (const b of pool) { const k = tileClass(b.tiles), s = supply[k] = supply[k] || {}; s[bin(D(b))] = (s[bin(D(b))] || 0) + 1; }
  for (let i = 0; i < n; i++) { const k = slot(levels[i]).big ? '96' : '72-88', s = demand[k] = demand[k] || {}; s[bin(tgt[i])] = (s[bin(tgt[i])] || 0) + 1; }
  return { params: { start, count, stat, allowFallback: [...allow], poolSize: pool.length }, rows, windows, uncheckedWindows: unchecked, holes, supply, demand, filled: rows.filter(r => r.key).length, totalAbsDev: +cs[2].toFixed(3), violationsLeft: cs[0] };
}

function markdown(r) {
  const L = ['# Placement proposal', '', `levels ${r.params.start}..${r.params.start + r.params.count - 1}, stat ${r.params.stat}, pool ${r.params.poolSize}, filled ${r.filled}/${r.params.count}, total |dev| ${r.totalAbsDev}, violations left ${r.violationsLeft}`, '',
    '| level | target | puzzle | layout | tiles | D | S | band | dev |', '|---|---|---|---|---|---|---|---|---|'];
  for (const x of r.rows) L.push(x.key ? `| ${x.level} | ${x.target} | ${x.key} | ${x.layout} | ${x.tiles} | ${x.D} | ${x.S} | ${x.band} | ${x.dev} |` : `| ${x.level} | ${x.target} | HOLE | | | | | | |`);
  L.push('', '## 5-level window checks', '');
  for (const w of r.windows) L.push(w.skipped ? `- ${w.from}-${w.to}: skipped (hole)` : `- ${w.from}-${w.to}: meanD ${w.meanD} vs ${w.meanTarget} diff ${w.diff} ${w.ok ? 'ok' : 'FAIL'}`);
  L.push('', 'Unchecked (cross plan edge): ' + r.uncheckedWindows.join('; '), '', '## Holes / needs', '');
  if (!r.holes.length) L.push('none');
  for (const h of r.holes) L.push(`- L${h.level}: D in [${h.needD[0]}, ${h.needD[1]}], tiles ${h.tileClass}, S ${h.S[0]}-${h.S[1]}`);
  L.push('', '## Supply vs demand by 1-try D bin (floor(D))', '');
  for (const k of ['72-88', '96']) {
    const bins = [...new Set([...Object.keys(r.supply[k] || {}), ...Object.keys(r.demand[k] || {})])].map(Number).sort((a, b) => a - b);
    L.push(`${k} tiles: ` + (bins.map(b => `D${b}: supply ${(r.supply[k] || {})[b] || 0} / demand ${(r.demand[k] || {})[b] || 0}`).join('; ') || 'none'));
    L.push('');
  }
  return L.join('\n') + '\n';
}

function main() {
  const a = process.argv.slice(2), g = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
  const start = +g('start'), count = +g('count');
  if (!Number.isFinite(start) || !Number.isFinite(count)) { console.error('need --start L --count N'); process.exit(2); }
  const taken = g('taken') ? (() => { const j = JSON.parse(fs.readFileSync(g('taken'), 'utf8')); return Array.isArray(j) ? j : (j.keys || (j.rows || []).map(r => r.key).filter(Boolean)); })() : [];
  const r = place(loadBank(g('bank', DEF_BANK)), { start, count, stat: g('stat', 'D40'), sMin: g('s-min', null) == null ? null : +g('s-min', null), minLate: g('min-late', null) == null ? null : +g('min-late', null), // --s-min: what-if only; Dennis's band is 1.75-6
    allowFallback: (g('allow-fallback', '') || '').split(',').filter(Boolean).map(Number), taken });
  const out = g('out', path.join(ROOT, `analysis/builder/bank/placement_${start}_${count}.json`));
  fs.writeFileSync(out, JSON.stringify(r, null, 1)); fs.writeFileSync(out.replace(/\.json$/, '.md'), markdown(r));
  console.log(markdown(r));
}
if (require.main === module) main();
module.exports = { place, targetCurve, slot, loadBank, markdown };
