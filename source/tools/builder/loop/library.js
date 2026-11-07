'use strict';
// The puzzle library (process-design-synthesis.md section 6, step 8).
//
//   const lib = createLibrary();                       // source/analysis/builder/library/
//   lib.has(key)              -> 'library' | 'reject' | null
//   lib.add(entry)            -> { added: true, key } | { added: false, key, reason: 'duplicate' | 'rejected' }
//   lib.reject(row)           -> { added: true, key } | { added: false, key, reason }
//   lib.entries(), lib.rejects(), lib.get(key), lib.query({...}), lib.rejectStats()
//   pairsOf(entries, opts)    -> the (puzzle, spare) pairs the assignment may use
//
// Files (append-only JSON lines; a line is never rewritten or removed by this code):
//   library/library.jsonl   one accepted, frozen puzzle per line (schema 'library-entry-v1', makeEntry below)
//   library/rejects.jsonl   one refused candidate per line with the gate that refused it
// Dedupe is by board content (contentKey): the same board is stored once, whichever brief or seed made it.
// A half-written last line (a crash mid-append) is skipped on reading and counted in lib.damaged.
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const LIB_DIR = path.resolve(__dirname, '../../../analysis/builder/library');
const ENTRY_SCHEMA = 'library-entry-v1', REJECT_SCHEMA = 'library-reject-v1';
const BIG_BOARD = 88;   // boards with more tiles than this ship only on lv%10 == 0 (gate A9)

// ---------- content ----------
function canonical(x) {
  if (Array.isArray(x)) return '[' + x.map(canonical).join(',') + ']';
  if (x && typeof x === 'object') return '{' + Object.keys(x).sort().filter(k => x[k] !== undefined).map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
  return JSON.stringify(x);
}
// The puzzle without its clock budget and without its witness: tiles, pictures, face-down tiles, specials, the
// clock tile. Two builds that differ only in clock.n (the dial) or in the stored route are the same puzzle.
// Exact content: a mirrored copy of a board gets a different key (originality.js judges near-copies, not this).
function puzzleContent(design) {
  const d = design && design.design && design.design.tiles ? design.design : design;
  if (!d || !Array.isArray(d.tiles)) throw Error('contentKey needs a design with tiles');
  const ob = d.obst || {};
  return {
    tiles: d.tiles.map(t => Array.isArray(t) ? t : [t.x, t.y, t.z]),
    faces: d.faces || null,
    down: (d.down || []).slice().sort((a, b) => a - b),
    gold: d.gold ?? null,
    obst: { ice: ob.ice && Object.keys(ob.ice).length ? ob.ice : {}, keys: (ob.keys || []).slice().sort((a, b) => a - b), locks: (ob.locks || []).slice().sort((a, b) => a - b) },
    clock: d.clock ? d.clock.i : null,
  };
}
const contentKey = design => crypto.createHash('sha256').update(canonical(puzzleContent(design))).digest('hex');

// The frozen design stored in the library: the full design, its clock.n set to k (spare 0). Every shipped
// spare s is made from it with knobs.clockSpare(design, s), which re-proves k and replays the witness.
function frozenDesign(design, k) {
  const d = JSON.parse(JSON.stringify(design));
  if (d.clock && Number.isInteger(k)) d.clock.n = k;
  return d;
}

// ---------- archetype (provisional) ----------
// Section 4 "Card": A1 free-pair relief, A2 keys before the clock, A3 thaw order, A5 second act. The label is read
// from what the builder produced, not built on purpose. static_gates.js names it (archetype: 'keys before the clock',
// 'thaw order', 'free-pair relief' or 'clock race', from the specials on the way to the clock and gate A5); without
// that name a rougher rule here uses the specials on the board and A5's best priced move.
const ARCHETYPE_LABELS = { 'free-pair relief': 'A1', 'keys before the clock': 'A2', 'thaw order': 'A3', 'second act': 'A5', 'clock race': 'race' };
function archetypeOf({ story, design, staticReport, secondAct }) {
  if (secondAct) return { label: 'A5', name: 'second act', from: 'brief/secondAct' };
  const named = staticReport && typeof staticReport.archetype === 'string' ? staticReport.archetype : null;
  if (named) return { label: ARCHETYPE_LABELS[named] ?? null, name: named, from: 'static_gates.js' };
  const ob = (design && design.obst) || {};
  const best = staticReport?.gates?.A5?.detail?.best || null;
  if (best && (best.kind === 'pair' || best.kind === 'match')) return { label: 'A1', name: 'free-pair relief', from: 'A5 priced ' + best.kind };
  if ((ob.locks || []).length && (ob.keys || []).length) return { label: 'A2', name: 'keys before the clock', from: 'story ' + story + ' (locks)' };
  if (Object.keys(ob.ice || {}).length) return { label: 'A3', name: 'thaw order', from: 'story ' + story + ' (ice)' };
  return { label: null, name: 'unlabelled', from: 'no rule matched' };
}

function yardstickKey(design) {
  try { const Y = require('./yardstick.js'); return typeof Y.puzzleKey === 'function' ? Y.puzzleKey(design) : null; } catch (e) { return null; }
}

// ---------- entry ----------
const pick = (o, keys) => o ? Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]])) : null;
function compactStatic(r) {
  if (!r) return null;
  // the per-state fork rows (r.forks) are left out: they are large and static_gates.js rebuilds them from the design
  return { pass: r.pass, k: r.k, strictK: r.strictK, shipSpares: r.shipSpares, archetype: r.archetype, witnessSource: r.witnessSource, ms: r.ms, nodes: r.nodes,
    warnings: r.warnings, card: r.card, gates: r.gates };
}
function compactCurve(c) {
  if (!c) return null;
  return { block: c.block, bot: c.bot, fingerprint: c.fingerprint, seconds: c.seconds, shippable: c.shippable, diallable: c.diallable, ratio13: c.ratio13, monotone: c.monotone,
    points: (c.points || []).map(p => pick(p, ['spare', 'clockN', 'minimum', 'D', 'pHat', 'se', 'n', 'valid', 'uncleared', 'lossPhase', 'perCampaign', 'fail'])),
    steps: c.steps, verdicts: c.verdicts };
}
function compactTrace(t) {
  if (!t) return null;
  const { thresholds, budget, wonOn, ...rest } = t;   // thresholds and budget are constants of traces.js; wonOn is bulky
  return rest;
}

// Build one library entry. Only `design`, `k` and `curve` are required; the rest is stored as given.
//   shipSpares   the spares that passed every gate (curve D rules, B, C1); the assignment uses only these
//   S            { S, valid, trusted (C2), styles, fingerprint }
function makeEntry(o) {
  if (!o.design || !Number.isInteger(o.k)) throw Error('makeEntry needs design and k');
  const design = frozenDesign(o.design, o.k), tiles = design.tiles.length;
  const ship = (o.shipSpares || o.curve?.shippable || []).slice().sort((a, b) => a - b);
  return {
    schema: ENTRY_SCHEMA,
    key: contentKey(design),
    puzzleKey: yardstickKey(design),   // yardstick.js puzzleKey (the accept ledger's key), when available
    addedAt: o.addedAt || new Date().toISOString(),
    run: o.run ?? null,
    design, k: o.k, tiles,
    tags: { story: o.story ?? null, layout: o.layout ?? null, shape: o.shape ?? null, briefId: o.briefId ?? null, seed: o.seed ?? null,
      bigBoard: tiles > BIG_BOARD, openingClock: o.k <= 6, secondAct: !!o.secondAct },
    curve: compactCurve(o.curve),
    shipSpares: ship,
    S: o.S ?? null,
    gates: {
      A1: o.gates?.A1 ?? null,
      static: compactStatic(o.gates?.static),
      screen: o.gates?.screen ?? null,
      traces: o.gates?.traces ? Object.fromEntries(Object.entries(o.gates.traces).map(([s, t]) => [s, compactTrace(t)])) : null,
      counterfactuals: o.gates?.counterfactuals ?? null,
      spareNotes: o.gates?.spareNotes ?? null,
    },
    card: o.card ?? null,
    archetype: o.archetype ?? archetypeOf({ story: o.story, design, staticReport: o.gates?.static, secondAct: o.secondAct }),
    fingerprints: o.fingerprints ?? null,
    cpu: o.cpu ?? null,
  };
}

// ---------- files ----------
function readJsonl(file, onBad) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    try { out.push(JSON.parse(line)); } catch (e) { onBad && onBad({ file, line: i + 1 }); }
  });
  return out;
}

function createLibrary(opts = {}) {
  const dir = path.resolve(opts.dir || LIB_DIR);
  const files = { library: path.join(dir, 'library.jsonl'), rejects: path.join(dir, 'rejects.jsonl') };
  const damaged = [];
  let lib = null, rej = null, index = null; const rejPipe = new Map();
  function load() {
    if (index) return;
    lib = readJsonl(files.library, b => damaged.push(b));
    rej = readJsonl(files.rejects, b => damaged.push(b));
    index = new Map();
    for (const r of rej) if (r.key) { index.set(r.key, 'reject'); rejPipe.set(r.key, r.pipeline ?? null); }   // the latest reject row wins
    for (const e of lib) if (e.key) index.set(e.key, 'library');   // a library entry wins over an older reject
  }
  function append(file, row) {
    fs.mkdirSync(dir, { recursive: true });
    // One write call per line; a line ends with \n. If the previous run died mid-line, start on a fresh line.
    let prefix = '';
    if (fs.existsSync(file)) {
      const size = fs.statSync(file).size;
      if (size > 0) { const fd = fs.openSync(file, 'r'), b = Buffer.alloc(1); fs.readSync(fd, b, 0, 1, size - 1); fs.closeSync(fd); if (b[0] !== 10) prefix = '\n'; }
    }
    fs.appendFileSync(file, prefix + JSON.stringify(row) + '\n');
  }
  // One rule for has() and reject(): a reject only blocks a board while it was made under the same pipeline version
  // (opts.pipeline). A changed version (new gates or ruler) lets the board be tested again; a library entry always blocks.
  const stale = (key, pipeline) => index.get(key) === 'reject' && pipeline !== undefined && (rejPipe.get(key) ?? null) !== pipeline;
  const has = (key, o = {}) => { load(); return stale(key, o.pipeline) ? null : (index.get(key) || null); };

  function add(entry) {
    load();
    if (!entry || entry.schema !== ENTRY_SCHEMA || !entry.key) throw Error('add() takes an entry from makeEntry()');
    if (entry.key !== contentKey(entry.design)) throw Error('entry.key does not match its design');
    const seen = index.get(entry.key);
    if (seen === 'library') return { added: false, key: entry.key, reason: 'duplicate' };
    append(files.library, entry); lib.push(entry); index.set(entry.key, 'library');
    return { added: true, key: entry.key, ...(seen === 'reject' ? { note: 'was rejected before' } : {}) };
  }
  // row: { design | key, gate, reason, ... small detail }. The design itself is not stored (rebuildable from
  // briefId + seed; pass keepDesign: true to store it).
  function reject(row) {
    load();
    const key = row.key || contentKey(row.design);
    const seen = stale(key, row.pipeline) ? null : index.get(key);
    if (seen) return { added: false, key, reason: seen === 'library' ? 'inLibrary' : 'duplicate' };
    if (!row.gate) throw Error('reject() needs the gate that refused the board');
    const { design, keepDesign, ...rest } = row;
    const out = { schema: REJECT_SCHEMA, key, at: row.at || new Date().toISOString(), ...rest, ...(keepDesign && design ? { design } : {}) };
    append(files.rejects, out); rej.push(out); index.set(key, 'reject'); rejPipe.set(key, row.pipeline ?? null);
    return { added: true, key };
  }
  const entries = () => { load(); return lib.slice(); };
  const rejects = () => { load(); return rej.slice(); };
  const get = key => { load(); return lib.find(e => e.key === key) || null; };

  // query({ story, layout, bigBoard, archetype, spare, D: [lo, hi] (at `spare` or any shippable spare),
  //         S: [lo, hi], trustedS, fingerprint (family), shippable: true })
  function query(q = {}) {
    load();
    return lib.filter(e => {
      if (q.story != null && e.tags.story !== q.story) return false;
      if (q.layout != null && e.tags.layout !== q.layout) return false;
      if (q.bigBoard != null && e.tags.bigBoard !== q.bigBoard) return false;
      if (q.archetype != null && e.archetype?.label !== q.archetype) return false;
      if (q.fingerprint != null && e.fingerprints?.family !== q.fingerprint) return false;
      if (q.shippable && !e.shipSpares.length) return false;
      if (q.trustedS && !(e.S && e.S.trusted !== false && Number.isFinite(e.S.S))) return false;
      if (q.S && !(e.S && Number.isFinite(e.S.S) && e.S.S >= q.S[0] && e.S.S <= q.S[1])) return false;
      if (q.D) {
        const spares = q.spare != null ? [q.spare] : e.shipSpares;
        if (!spares.some(s => { const D = curveD(e, s); return D != null && D >= q.D[0] && D <= q.D[1]; })) return false;
      }
      return true;
    });
  }
  function rejectStats() {
    load();
    const by = {};
    for (const r of rej) by[r.gate] = (by[r.gate] || 0) + 1;
    return { total: rej.length, byGate: by };
  }
  return { dir, files, has, add, reject, entries, rejects, get, query, rejectStats, damaged, reload: () => { index = null; load(); } };
}

const curveD = (e, spare) => { const p = (e.curve?.points || []).find(x => x.spare === spare); return p && p.D != null ? p.D : null; };

// The (puzzle, spare) pairs for assign_levels.js. One pair per entry and shippable spare.
//   measured  optional Map or object 'key:spare' -> { D, se, n, source } (ACCEPT values of record override the
//             CURVE D, synthesis section 2: only ACCEPT numbers are values of record)
//   family    optional family fingerprint: entries rated with another ruler are left out (and counted)
function pairsOf(entries, opts = {}) {
  const measured = opts.measured instanceof Map ? opts.measured : new Map(Object.entries(opts.measured || {}));
  const pairs = [], skipped = { otherRuler: 0, noShippableSpare: 0 };
  for (const e of entries) {
    if (opts.family && e.fingerprints?.family && e.fingerprints.family !== opts.family) { skipped.otherRuler++; continue; }
    if (!e.shipSpares || !e.shipSpares.length) { skipped.noShippableSpare++; continue; }
    for (const spare of e.shipSpares) {
      const m = measured.get(e.key + ':' + spare), p = (e.curve?.points || []).find(x => x.spare === spare);
      const D = m ? m.D : p?.D;
      if (D == null || !Number.isFinite(D)) continue;
      const tr = e.gates?.traces?.[spare] || e.gates?.traces?.[String(spare)] || null;
      const S = e.S && Number.isFinite(e.S.S) ? e.S.S : null;
      pairs.push({
        key: e.key, spare, D, se: m ? m.se ?? null : p?.se ?? null, Dsource: m ? (m.source || 'ACCEPT') : 'CURVE',
        S, Strusted: !!(e.S && e.S.trusted !== false && S != null),
        story: e.tags.story, layout: e.tags.layout, tiles: e.tiles, bigBoard: e.tags.bigBoard, openingClock: e.tags.openingClock,
        maxTarget: tr?.B7?.maxTarget ?? null, archetype: e.archetype?.label ?? null, card: e.card ?? null,
      });
    }
  }
  return opts.withSkipped ? { pairs, skipped } : pairs;
}

module.exports = { createLibrary, makeEntry, contentKey, puzzleContent, frozenDesign, archetypeOf, pairsOf, curveD, canonical, readJsonl,
  LIB_DIR, ENTRY_SCHEMA, REJECT_SCHEMA, BIG_BOARD };
