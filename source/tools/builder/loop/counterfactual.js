'use strict';
// Counterfactual gates C1-C4 of the process design (source/analysis/builder/process-design-synthesis.md, section 4 C).
// Finalists only. Every rating goes through the yardstick (yardstick.js), so cached ratings are reused and the
// fingerprints are checked.
//
//   const CF = require('./counterfactual.js');
//   CF.c1(design, { spare, ys })                      key-memory vs reference family D (CURVE block) at the shipped spare
//   CF.c2c3(design, { ys, plannerSpare: 2 })           planner face-up vs as is
//   CF.c4(design, { spare, ys, campaigns: 160, startBlock: 0, accepted })   specials ablation on ACCEPT seeds
//   CF.counterfactuals(design, { spare, ys, c4: false }) -> { C1, C2, C3, C4?, ruler, ms }
//
// C1  |D_reference - D_keymemory| <= max(2, 25% of D_keymemory), both on the 80-campaign CURVE block at the shipped
//     spare. Big gaps flag boards whose rating depends on forgetting keys (the reference bot forgets them).
// C2  planner face-up <= planner as is + 2, at plannerSpare (2: where S is defined). Fail = S untrusted, no skilled credit.
// C3  (report) planner face-up >= 50% of planner as is: the skilled difficulty is not mainly hidden information.
//     FACE-UP is design.down = [] on the spared design, clock.n unchanged. The bots read `down` through
//     public_board_input.normalizeBoard: an empty list makes every tile face up, but a tile still shows its picture
//     only when it is geometrically exposed (human_board_visibility.tileVisibility: picture = exposed && !down), so
//     covered tiles stay unknown. It is not omniscience. It also removes the peek pairs (a peek pair needs a
//     face-down tile), so the clock can need MORE moves face-up; we report engine.clockShortest for both
//     (task10_report.js said the same of AllFaceUp: "not a pure information intervention").
// C4  removing each special lowers D by >= max(1, 2 SE of the difference), on the same ACCEPT blocks as the value
//     of record. "Special" and the removal are the factory's own (factory/batch_evaluate.js, the "every special
//     matters" rule): ice (all ice), locks (all locks and the keys), clock (clock = null); everything else, clock.n
//     included, unchanged. opts.per = 'tile' removes each lock / ice tile on its own instead. The factory also
//     counted a special whose removal makes the board HARDER as mattering ("they show the way", analysis/factory/
//     README.md); the synthesis requires a drop, so such a special fails C4 here and is marked raisesD. The SE of
//     the difference is sqrt(se_with^2 + se_without^2) (no pairing credit taken, so it is conservative).
//
// CLI: node source/tools/builder/loop/counterfactual.js <boards.jsonl|json> <index|id> <spare|shipped|asis> [--c4] [--skip=C1,C2] [--nocache]
const fs = require('fs'), path = require('path');
const E = require('../engine.js'), M = require('../../factory/meter.js'), Y = require('./yardstick.js'), T = require('./traces.js');

const round = (x, k = 2) => x == null || !Number.isFinite(x) ? x ?? null : Math.round(x * 10 ** k) / 10 ** k;
const finite = (...a) => a.every(Number.isFinite);

// The yardstick with the pinned family ruler. If library/yardstick.json still names the slow family-key-memory-v1
// (or Codex's d362e85f), the fast bot stands in: the meter lists both as zero-drift predecessors of
// family-key-memory-v1-fast (Gemini Task G3). Anything else is refused.
function rulerYardstick(opts = {}) {
  if (opts.ys) return opts.ys;
  const pins = Y.loadPins(opts.pinsFile), fastFp = M.createMeter({ botVersion: T.FAST, cacheDir: false }).fingerprint;
  if (pins.family.botVersion === T.FAST || pins.family.fingerprint === fastFp) return Y.createYardstick({ pins, cacheDir: opts.cacheDir });
  if (!(M.FAMILY_CACHE_MIGRATIONS[fastFp] || []).includes(pins.family.fingerprint))
    throw Error(`Counterfactuals: pinned family ${pins.family.fingerprint} is not ${T.FAST} or a zero-drift predecessor of it`);
  const fastPins = { ...pins, family: { ...pins.family, botVersion: T.FAST, fingerprint: fastFp, zeroDriftOf: pins.family.fingerprint } };
  const ys = Y.createYardstick({ pins: fastPins, cacheDir: opts.cacheDir });
  ys.rulerNote = `library/yardstick.json pins ${pins.family.fingerprint.slice(0, 8)} (slow key memory); its zero-drift fast path ${fastFp.slice(0, 8)} measured instead`;
  return ys;
}

// ---------- C1 ----------
function c1(input, opts = {}) {
  const ys = rulerYardstick(opts), at = T.atSpare(input, opts.spare ?? null);
  if (at.fail) return { pass: null, fail: at.fail };
  const rate = bot => ys.rate(at.design, { block: opts.block ?? 'CURVE', bot, ...(opts.campaigns ? { campaigns: opts.campaigns } : {}), ...(opts.runs ? { runs: opts.runs } : {}) });
  const t = Date.now(), km = rate('family'), ref = rate('reference');
  const diff = ref.D - km.D, tolerance = Math.max(2, 0.25 * km.D), valid = km.valid && ref.valid;
  return { pass: valid && finite(diff) ? Math.abs(diff) <= tolerance : null, keyMemory: round(km.D), reference: round(ref.D), diff: round(diff), tolerance: round(tolerance),
    seKeyMemory: round(km.se), seReference: round(ref.se), n: km.n, calls: { keyMemory: (km.calls || []).map(c => c.exp), reference: (ref.calls || []).map(c => c.exp) }, valid, spare: opts.spare ?? null, clockN: at.design.clock?.n ?? null,
    fingerprints: { keyMemory: km.fingerprint, reference: ref.fingerprint }, ms: Date.now() - t };
}

// ---------- C2 / C3 ----------
function clockK(design, o) {
  if (o.engineCheck === false || !design.clock) return null;
  try { const r = E.clockShortest(E.game(design), { nodes: 400000, ms: 5000 }); return r ? r.k : null; } catch { return null; }
}
// The planner rater. planner-fast-v1 (Gemini Task G4, zero drift, ~10x faster) replaces the reference planner for
// C2/C3. library/yardstick.json (not owned by this piece) still pins the reference meter for 'planner', so the fast
// meter is built here with the same pinned planner settings. An injected ys (tests) keeps its own ys.planner.
const PLANNER_FAST = 'planner-fast-v1';
function plannerRater(ys, opts) {
  if (opts.plannerMeter === false || ys.injected || (opts.ys && !opts.ysBuilt)) return d => ys.planner(d);
  const meter = M.createMeter({ botVersion: PLANNER_FAST, cacheDir: opts.cacheDir === false ? false : Y.CACHE_DIR });
  return d => { const m = meter.measure(M.boardOf(d), { ...ys.pins.planner.settings });
    return { S: m.expectedTries, styles: m.plannerStyles || null, valid: m.valid === true, fingerprint: meter.fingerprint }; };
}
function c2c3(input, opts = {}) {
  const ys = rulerYardstick(opts), plannerSpare = opts.plannerSpare ?? ys.pins?.planner?.spare ?? 2, at = T.atSpare(input, plannerSpare);
  if (at.fail) return { C2: { pass: null, fail: at.fail }, C3: { report: true, pass: null, fail: at.fail } };
  const t = Date.now(), asIsDesign = at.design, faceUpDesign = { ...asIsDesign, down: [] };
  const rate = plannerRater(ys, opts), a = rate(asIsDesign), b = rate(faceUpDesign);   // no spare argument: both keep clock.n of the spared design
  const asIs = a.S, faceUp = b.S, valid = a.valid && b.valid, ok = valid && finite(asIs, faceUp);
  const C2 = { pass: ok ? faceUp <= asIs + 2 : null, asIs, faceUp, diff: ok ? round(faceUp - asIs) : null, skilledCredit: ok ? faceUp <= asIs + 2 : null,
    plannerSpare, clockN: asIsDesign.clock?.n ?? null, faceDownTiles: (asIsDesign.down || []).length, styles: { asIs: a.styles, faceUp: b.styles },
    clockK: { asIs: clockK(asIsDesign, opts), faceUp: clockK(faceUpDesign, opts) }, valid, fingerprint: a.fingerprint, ms: Date.now() - t };
  const ratio = ok && asIs > 0 ? faceUp / asIs : null;
  const C3 = { report: true, pass: ratio == null ? null : ratio >= 0.5, value: round(ratio, 3) };
  return { C2, C3 };
}

// ---------- C4 ----------
function specialVariants(d, per = 'kind') {
  const ob = d.obst || {}, ice = Object.keys(ob.ice || {}).filter(i => ob.ice[i] > 0), locks = ob.locks || [], keys = ob.keys || [], out = [];
  const withObst = o => ({ ...d, obst: { ice: { ...(ob.ice || {}) }, locks: locks.slice(), keys: keys.slice(), ...o } });
  if (per === 'tile') {
    for (const i of ice) { const x = withObst(); delete x.obst.ice[i]; out.push({ special: 'ice ' + i, design: x }); }
    if (keys.length) for (const i of locks) { const rest = locks.filter(j => j !== i); out.push({ special: 'lock ' + i, design: withObst({ locks: rest, keys: rest.length ? keys.slice() : [] }) }); }
  } else {
    if (ice.length) out.push({ special: 'ice', design: withObst({ ice: {} }) });
    if (locks.length) out.push({ special: 'locks', design: withObst({ locks: [], keys: [] }) });
  }
  if (d.clock) out.push({ special: 'clock', design: { ...d, clock: null } });
  return out;
}
function c4(input, opts = {}) {
  const ys = rulerYardstick(opts), at = T.atSpare(input, opts.spare ?? null);
  if (at.fail) return { pass: null, fail: at.fail };
  const settings = { block: 'ACCEPT', campaigns: opts.campaigns ?? ys.pins?.acceptance?.startCampaigns ?? 160, startBlock: opts.startBlock ?? 0, ...(opts.runs ? { runs: opts.runs } : {}) };
  const t = Date.now(), base = opts.accepted && finite(opts.accepted.D, opts.accepted.se) ? opts.accepted : ys.rate(at.design, settings);
  const specials = specialVariants(at.design, opts.per).map(v => {
    const r = ys.rate(v.design, settings), drop = base.D - r.D, seDiff = Math.sqrt(base.se ** 2 + r.se ** 2), need = Math.max(1, 2 * seDiff), valid = !!(base.valid !== false && r.valid);
    return { special: v.special, without: round(r.D), drop: round(drop), seDiff: round(seDiff), need: round(need), pass: valid && finite(drop) ? drop >= need : null,
      raisesD: finite(drop) && drop <= -need, valid };
  });
  const passes = specials.map(s => s.pass);
  return { pass: !specials.length ? true : passes.includes(false) ? false : passes.includes(null) ? null : true, D: round(base.D), se: round(base.se), n: base.n ?? null,
    specials, settings, per: opts.per || 'kind', fingerprint: base.fingerprint ?? ys.fingerprint, ms: Date.now() - t };
}

function counterfactuals(input, opts = {}) {
  const ys = rulerYardstick(opts), o = { ...opts, ys, ysBuilt: !opts.ys }, skip = opts.skip || [], out = { spare: opts.spare ?? null }, t = Date.now();
  if (!skip.includes('C1')) out.C1 = c1(input, o);
  if (!skip.includes('C2')) Object.assign(out, c2c3(input, o));
  if (opts.c4 && !skip.includes('C4')) out.C4 = c4(input, o);
  out.ruler = { family: ys.fingerprint, reference: ys.referenceFingerprint, ...(ys.rulerNote ? { note: ys.rulerNote } : {}) };
  out.ms = Date.now() - t;
  return out;
}

module.exports = { PLANNER_FAST, plannerRater, counterfactuals, c1, c2c3, c4, specialVariants, rulerYardstick };

if (require.main === module) {
  const args = process.argv.slice(2), flag = k => args.includes(k), [file, which, spareArg] = args.filter(a => !a.startsWith('--'));
  const skipArg = args.find(a => a.startsWith('--skip='));
  const text = fs.readFileSync(path.resolve(file), 'utf8').trim();
  const rows = text.startsWith('[') ? JSON.parse(text) : text.split('\n').map(l => JSON.parse(l));
  const row = /^\d+$/.test(which) ? rows[+which] : rows.find(r => r.id === which);
  const spare = spareArg === 'asis' ? null : spareArg === 'shipped' ? row.clockSpare : +spareArg;
  // --nocache: measure everything (cold timing); otherwise the shared factory cache is used
  const t = Date.now(), r = counterfactuals(row, { spare, c4: flag('--c4'), skip: skipArg ? skipArg.slice(7).split(',') : [], ...(flag('--nocache') ? { cacheDir: false } : {}) });
  console.log(JSON.stringify({ id: row.id, level: row.level, spare, wallMs: Date.now() - t, ...r }, null, 1));
}
