'use strict';
// Variety ledger ("never reuse levels", Dennis 2026-11-12: three boards on one layout with the same kind of trap felt played).
//   const L = require('./ledger.js');
//   L.signature(design, card)        -> { layout, trap, clock, key, ice, cells }   (cells: layout tile positions, for the overlap test)
//   L.check(candidate, entries)      -> { ok, reasons[] }   candidate: a signature, or { design, card }; entries: signatures in level order (oldest first)
//   L.loadRated()                    -> signatures of every bank puzzle Dennis rated (lab findings files), in lab order
//   L.fromBoards([{design,card}])    -> signatures
// Reject when: layout (or a layout sharing > 75% tile positions) among the last 12 entries; trap type among the last 2;
// the same layout + trap type together anywhere; fewer than 3 of the 5 fields (layout, trap, clock cell, key cell, ice cell) differ from ANY entry.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../..');
const BANK = path.join(ROOT, 'source/analysis/builder/bank/puzzles');
const FINDINGS = ['lab-findings-2026-11-12.json', 'lab-findings-2026-11-12-lab3.json'].map(f => path.join(ROOT, 'source/analysis/builder/process-v2', f));
const RULES = { layoutWindow: 12, trapWindow: 2, minDiff: 3, overlap: 0.75 };
const FIELDS = ['layout', 'trap', 'clock', 'key', 'ice'];

const tilesOf = d => d.tiles.map(t => Array.isArray(t) ? t : [t.x, t.y, t.z]);
function signature(design, card = {}) {
  const T = tilesOf(design), ext = i => { const v = T.map(t => t[i]); return [Math.min(...v), Math.max(...v)]; };
  const [x0, x1] = ext(0), [y0, y1] = ext(1), [z0, z1] = ext(2);
  const bin = (v, lo, hi, n) => hi <= lo ? 0 : Math.min(n - 1, Math.floor((v - lo) / (hi - lo + 1e-9) * n));
  const cell = i => { const t = T[i]; return bin(t[0], x0, x1, 3) + ',' + bin(t[1], y0, y1, 3) + ',' + ['low', 'mid', 'high'][bin(t[2], z0, z1, 3)]; };
  const ob = design.obst || {}, keys = (ob.keys || []).map(cell).sort(), ice = Object.keys(ob.ice || {}).map(Number).map(cell).sort();
  return { layout: card.layout != null ? card.layout : null, trap: card.trapType || card.story || null,
    clock: design.clock && Number.isInteger(design.clock.i) ? cell(design.clock.i) : null, key: keys.length ? keys.join('|') : null, ice: ice.length ? ice.join('|') : null,
    cells: T.map(t => t.join(',')) };
}
const isSig = x => x && 'trap' in x && 'clock' in x;
const sigOf = x => isSig(x) ? x : signature(x.design, x.card || {});

const overlap = (a, b) => {
  if (!a.cells || !b.cells) return 0;
  const sb = new Set(b.cells); let c = 0; for (const t of a.cells) if (sb.has(t)) c++;
  return c / Math.min(a.cells.length, b.cells.length);
};
const sameLayout = (a, b) => (a.layout != null && a.layout === b.layout) || overlap(a, b) > RULES.overlap;
const diffCount = (a, b) => FIELDS.reduce((n, f) => n + (a[f] !== b[f] ? 1 : 0), 0);

function check(candidate, entries, o = {}) {
  const c = sigOf(candidate), E = entries.map(sigOf), R = { ...RULES, ...o }, reasons = [], same = o.sameLayout || sameLayout;
  const lastL = E.slice(-R.layoutWindow), lastT = E.slice(-R.trapWindow);
  const li = lastL.findIndex(e => same(c, e));
  if (li >= 0) reasons.push(`layout ${c.layout} (or >${R.overlap * 100}% of it) among the last ${R.layoutWindow} entries (entry ${E.length - lastL.length + li})`);
  if (c.trap != null && lastT.some(e => e.trap === c.trap)) reasons.push(`trap type ${c.trap} among the last ${R.trapWindow} entries`);
  if (E.some(e => e.layout === c.layout && e.trap === c.trap)) reasons.push(`layout ${c.layout} with trap type ${c.trap} was used before`);
  const near = E.findIndex(e => diffCount(c, e) < R.minDiff);
  if (near >= 0) reasons.push(`only ${diffCount(c, E[near])} of 5 signature fields differ from entry ${near}`);
  return { ok: !reasons.length, reasons };
}

function fileOfKey(k, dir = BANK) { const f = fs.readdirSync(dir).find(x => x.startsWith(k)); return f && path.join(dir, f); }
function fromBoards(bs) { return bs.map(b => signature(b.design, b.card || {})); }
function loadRated(opts = {}) {
  const out = [];
  for (const f of opts.findings || FINDINGS) {
    if (!fs.existsSync(f)) continue;
    const r = JSON.parse(fs.readFileSync(f, 'utf8')).ratings || {};
    for (const k of Object.keys(r).sort((a, b) => (+r[a].lab || +a) - (+r[b].lab || +b))) {
      const bk = r[k].boardKey, file = bk && fileOfKey(bk.slice(0, 16), opts.dir || BANK);
      if (!file) continue;
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      out.push({ ...signature(j.design, j.card), lab: r[k].lab || k, stars: r[k].stars, boardKey: bk });
    }
  }
  return out;
}
module.exports = { signature, check, loadRated, fromBoards, overlap, sameLayout, diffCount, RULES, FIELDS };

if (require.main === module) {
  for (const e of loadRated()) console.log(e.lab, e.stars + '*', 'layout', e.layout, e.trap, 'clock', e.clock, 'key', e.key, 'ice', e.ice);
}
