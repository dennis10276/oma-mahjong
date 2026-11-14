#!/usr/bin/env node
'use strict';
/* Export finished designed boards into the game's level table (www/levels-hard.js), levels 250 and up.
   Usage: node export_levels.js --in <folder of level-<n>.json> [--table www/levels-hard.js] [--out dir] [--write] [--min 250]
   Default is a DRY RUN: writes <out>/levels-hard.js (default source/build/export) and <out>/export-report.json.
   --write replaces the table in www/ (same text format as the existing file: header comment, CRLF).
   Input files: level-<n>.json holding {tiles,faces,down,gold,obst{locks,keys,ice},clock{i,n},solution}
   (or the same under a "design" key, like build/traps/examples2/*.json). n must be >= 250 and join the table
   (n <= current last level + 1, no gaps). Uses the game's own encoder/decoder (www/hard.js pack/unpack).
   No bot ratings are written: packed rate/strong fields of new rows are 0 (the game only logs them). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.resolve(__dirname, '../../..');
const Hard = require(path.join(SRC, 'www/hard.js')), L = require(path.join(SRC, 'www/layouts.js'));

const loadTable = text => vm.runInNewContext(text + ';HARD_LEVELS');
const parts = text => {                       // header, JSON, tail: so the file can be written back in its own shape
  const a = text.indexOf('const HARD_LEVELS = '), b = text.lastIndexOf('};');
  if (a < 0 || b < 0) throw new Error('table text not recognised');
  return { head: text.slice(0, a), json: text.slice(a + 20, b + 1), tail: text.slice(b + 1) };
};
// the same tile-size formula as hard.js (tilePx there is private): reference screen 384 x 592 px of board
function tilePx(tiles) {
  let l = 1e9, r = -1e9, t0 = 1e9, b = -1e9;
  for (const t of tiles) { const x = t.x / 2 - t.z * 0.14, y = t.y / 2 * 1.24 - t.z * 0.14; l = Math.min(l, x); r = Math.max(r, x + 1); t0 = Math.min(t0, y); b = Math.max(b, y + 1.24); }
  return Math.min(384 / (r - l + 0.125), 592 / (b - t0 + 0.16));
}
const gameOf = d => {
  const tiles = d.tiles.map(([x, y, z]) => ({ x, y, z })), nb = L.neighbors(tiles), down = new Uint8Array(tiles.length);
  (d.down || []).forEach(i => { down[i] = 1; });
  const ob = d.obst, has = ob && (Object.keys(ob.ice || {}).length || (ob.keys || []).length);
  const rules = has ? { iceNb: L.iceNeighbors(tiles), ice: ob.ice || {}, locks: (ob.keys || []).length ? new Set(ob.locks || []) : null, keys: ob.keys || [] } : null;
  return { tiles, nb, faces: d.faces, down, rules, clock: d.clock || null };
};
// what the packed form can hold, as the decoder will give it back
const norm = d => {
  const ob = d.obst || {}, ice = {}; for (const k of Object.keys(ob.ice || {})) ice[+k] = +ob.ice[k];
  const hasOb = Object.keys(ice).length || (ob.keys || []).length;
  return { tiles: d.tiles, faces: d.faces, down: d.down || [], gold: d.gold || [], obst: hasOb ? { ice, locks: ob.locks || [], keys: ob.keys || [] } : null, clock: d.clock ? { i: d.clock.i, n: d.clock.n } : null, solution: d.solution || null };
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function checkDesign(n, d) {
  const e = [], w = [], N = d.tiles && d.tiles.length;
  const int = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;
  if (!Array.isArray(d.tiles) || !N) return { e: ['no tiles'], w };
  if (N % 2) e.push('odd tile count ' + N);
  if (!d.tiles.every(t => t.length === 3 && t.every(v => int(v, 63)))) e.push('tile coordinate outside 0..63');
  if (!Array.isArray(d.faces) || d.faces.length !== N || !d.faces.every(v => int(v, 63))) e.push('faces: need one per tile, each 0..63');
  else {
    const c = {}; d.faces.forEach(f => { c[f] = (c[f] || 0) + 1; });
    if (Object.values(c).some(v => v % 2)) e.push('a picture appears an odd number of times');
  }
  for (const [name, list] of [['down', d.down], ['gold', d.gold], ['locks', d.obst && d.obst.locks], ['keys', d.obst && d.obst.keys]])
    if (list && !list.every(i => int(i, Math.min(N - 1, 4095)))) e.push(name + ': tile index out of range');
  for (const [k, h] of Object.entries((d.obst && d.obst.ice) || {})) if (!int(+k, N - 1) || !int(h, 63) || h < 1) e.push('ice entry ' + k + ':' + h + ' invalid');
  if (d.obst && (d.obst.locks || []).length && !(d.obst.keys || []).length) e.push('locks without keys (the packed form would drop them)');
  if (d.clock && !(int(d.clock.i, N - 1) && Number.isInteger(d.clock.n) && d.clock.n > 0)) e.push('clock invalid');
  if (!Array.isArray(d.solution) || d.solution.length !== N || !d.solution.every(i => int(i, 4095))) e.push('solution must list every tile once (indices <= 4095)');
  const big = n % 10 === 0;
  if (big ? N !== 96 : (N < 72 || N > 88)) w.push(`tile count ${N} outside the slot rule (${big ? '96 on every 10th level' : '72..88'})`);
  return { e, w };
}

function exportTable(tableText, designs, opt = {}) {
  const P = parts(tableText), T = JSON.parse(P.json), min = opt.min || 250;
  const last = T.from + T.levels.length - 1, report = { ok: true, errors: [], warnings: [], levels: [] };
  const err = m => { report.ok = false; report.errors.push(m); };
  const nums = Object.keys(designs).map(Number).sort((a, b) => a - b);
  if (!nums.length) err('no levels given');
  nums.forEach((n, k) => {
    if (n < min) err(`level ${n} is below ${min}`);
    if ((!k && n > last + 1) || (k && n !== nums[k - 1] + 1)) err(`level ${n} leaves a gap (table ends at ${last}; levels must be consecutive)`);
  });
  if (!report.ok) return { report };
  const NT = JSON.parse(P.json), old = loadTable(tableText);
  for (const n of nums) {
    const d = designs[n], c = checkDesign(n, d);
    c.e.forEach(m => err(`level ${n}: ${m}`)); c.w.forEach(m => report.warnings.push(`level ${n}: ${m}`));
    if (c.e.length) continue;
    const row = Hard.pack({ ...d, gold: d.gold || [], down: d.down || [], info: { rate: 0, strong: 0 } });
    const i = n - T.from;
    if (i < NT.levels.length) NT.levels[i] = row; else { NT.levels.push(row); if (NT.ratingModels) NT.ratingModels.push('strong'); }
  }
  if (!report.ok) return { report };
  const crlf = P.head.includes('\r\n') ? '\r\n' : '\n';
  let head = P.head;
  const note = `/* Levels ${nums[0]}-${nums[nums.length - 1]}: designed boards written by tools/builder/bank/export_levels.js (no bot ratings; packed rate/strong fields are 0). */`;
  if (!head.includes('export_levels.js')) head = head.replace(/(const\s*$)/, '') + note + crlf;
  const text = head + 'const HARD_LEVELS = ' + JSON.stringify(NT) + P.tail;
  report.text = text;
  Object.assign(report, verify(tableText, text, designs, nums, opt.minPx));
  return { report, text };
}

// decode the OUTPUT TEXT with the game's decoder and compare
function verify(oldText, newText, designs, nums, minPx) {
  const out = { ok: true, errors: [], warnings: [], levels: [], checks: {} };
  const err = m => { out.ok = false; out.errors.push(m); };
  const o = loadTable(oldText), n = loadTable(newText);
  const oLast = o.from + o.levels.length - 1, nLast = n.from + n.levels.length - 1;
  const first = nums[0], lastNew = nums[nums.length - 1];
  for (const k of ['v', 'aspect', 'from', 'cycleFrom', 'previousVersion', 'reorderFrom']) if (o[k] !== n[k]) err(`table field ${k} changed`);
  // every untouched level decodes exactly as before (and its packed row is identical)
  let untouched = 0;
  for (let lv = o.from; lv <= oLast; lv++) {
    if (lv >= first && lv <= lastNew) continue;
    untouched++;
    if (!same(n.levels[lv - n.from], o.levels[lv - o.from]) || !same(Hard.unpack(lv, n.levels[lv - n.from]), Hard.unpack(lv, o.levels[lv - o.from]))) err(`level ${lv} changed but should not`);
    if (o.ratingModels && n.ratingModels[lv - n.from] !== o.ratingModels[lv - o.from]) err(`ratingModels[${lv}] changed`);
  }
  out.checks.untouchedLevels = untouched;
  if (nLast !== Math.max(oLast, lastNew)) err(`level count: last level ${nLast}, expected ${Math.max(oLast, lastNew)}`);
  if (n.ratingModels && n.ratingModels.length !== n.levels.length) err('ratingModels length differs from the level count');
  // each new level decodes to exactly the input, and its stored solution wins under the game's rules
  const minTile = Hard.cfg().minTile, minBig = Hard.cfg().minTileBig;
  for (const lv of nums) {
    const dec = Hard.unpack(lv, n.levels[lv - n.from]), want = norm(designs[lv]);
    const got = { tiles: dec.tiles, faces: dec.faces, down: dec.down, gold: dec.gold, obst: dec.obst, clock: dec.clock, solution: dec.solution };
    const r = { level: lv, tiles: dec.tiles.length, decodesExact: same(got, want) };
    if (!r.decodesExact) err(`level ${lv}: decoded board differs from the input`);
    const g = gameOf(dec);
    r.solutionWins = Hard.validSolution(g, dec.solution);
    if (!r.solutionWins) err(`level ${lv}: stored solution does not win (ice/locks/tray/clock replay)`);
    r.tilePx = +tilePx(g.tiles).toFixed(2);
    r.minTilePx = lv % 10 === 0 ? minBig : minTile;
    if (r.tilePx < r.minTilePx) { const m = `level ${lv}: tile size ${r.tilePx}px below the game's ${r.minTilePx}px`; if (minPx && r.tilePx >= minPx) out.warnings.push(m + ' (allowed by --minpx ' + minPx + ')'); else err(m); }
    r.locks = dec.obst ? dec.obst.locks.length : 0; r.keys = dec.obst ? dec.obst.keys.length : 0;
    r.ice = dec.obst ? Object.keys(dec.obst.ice).length : 0; r.down = dec.down.length; r.clock = dec.clock;
    out.levels.push(r);
  }
  // past the end: the cycle rule still works, from the new table, and the decoded rows come round mirrored
  const prev = global.HARD_LEVELS; global.HARD_LEVELS = n;
  try {
    const span = nLast - n.cycleFrom + 1, probe = [nLast + 1, nLast + span, nLast + span + 1, 400, 1000].filter((v, i, a) => a.indexOf(v) === i);
    out.checks.cycle = { cycleFrom: n.cycleFrom, last: nLast, span, firstPastEnd: nLast + 1, firstPastEndBase: n.cycleFrom + (nLast + 1 - n.cycleFrom) % span };
    out.checks.firstReappearance = [];
    for (const lv of nums) { if (lv >= n.cycleFrom) out.checks.firstReappearance.push([lv, lv + span]); }
    for (const lv of probe) {
      const base = n.cycleFrom + (lv - n.cycleFrom) % span, d = Hard.get(lv), src = Hard.unpack(base, n.levels[base - n.from]);
      const w = Math.max(...src.tiles.map(t => t[0]));
      if (d.tiles.length !== src.tiles.length || !d.tiles.every((t, i) => t[0] === w - src.tiles[i][0] && t[1] === src.tiles[i][1] && t[2] === src.tiles[i][2])) err(`cycle: level ${lv} is not the mirrored level ${base}`);
      if (!Hard.validSolution(gameOf({ ...d, tiles: d.tiles }), d.solution)) err(`cycle: level ${lv} (copy of ${base}) solution does not win`);
    }
    out.checks.cycleProbe = probe;
  } finally { global.HARD_LEVELS = prev; }
  // levels before 70 and the care track (grandma) are not in this table at all
  { const gp = global.HARD_LEVELS; global.HARD_LEVELS = n; out.checks.careTrackUsesTable = [...nums, nLast + 1, 400].some(lv => Hard.applies(lv, 'care')); global.HARD_LEVELS = gp; if (out.checks.careTrackUsesTable) err('care track would read the table'); }
  return out;
}

function readDir(dir) {
  const designs = {};
  for (const f of fs.readdirSync(dir)) {
    const m = /^level-(\d+)\.json$/.exec(f); if (!m) continue;
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    designs[+m[1]] = j.design || j;
  }
  return designs;
}

function main(argv) {
  const a = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2); a[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; }
  if (!a.in) { console.error('usage: node export_levels.js --in <folder> [--table file] [--out dir] [--write] [--min 250] [--minpx <px, experiments only: lowers the tile-size floor to a warning>]'); process.exit(2); }
  const tablePath = path.resolve(a.table || path.join(SRC, 'www/levels-hard.js'));
  const { report, text } = exportTable(fs.readFileSync(tablePath, 'utf8'), readDir(path.resolve(a.in)), { min: +a.min || 250, minPx: +a.minpx || 0 });
  const outDir = path.resolve(a.out || path.join(SRC, 'build/export'));
  delete report.text;
  console.log(JSON.stringify({ ok: report.ok, errors: report.errors, warnings: report.warnings, levels: report.levels, checks: report.checks }, null, 1));
  if (!report.ok) { console.error('NOT exported: verification failed'); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'levels-hard.js'), text);
  fs.writeFileSync(path.join(outDir, 'export-report.json'), JSON.stringify(report, null, 1));
  console.log('dry run written to ' + outDir);
  if (a.write) { fs.writeFileSync(tablePath, text); console.log('REPLACED ' + tablePath); }
}
module.exports = { exportTable, verify, checkDesign, tilePx, gameOf, readDir, loadTable };
if (require.main === module) main(process.argv.slice(2));
