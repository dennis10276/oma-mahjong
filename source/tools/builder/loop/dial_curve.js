'use strict';
// The dial curve (process-design-synthesis.md section 3 and section 6 step 6).
//
//   const curve = measureCurve(design, ys, { spares: [0, 1, 2, 3], block: 'CURVE' });
//
// Spare s means clock.n = k + s, where k = engine.clockShortest(game) (the game's own rules, peek
// pairs included) = the smallest clock.n that still wins. knobs.clockSpare makes it (only clock.n
// changes; the stored witness is replayed). Checked on the 18 qualified 200-225 boards: the stored
// witness never fits clock.n = k - 1, and its clock index + 1 equals the strict k.
//
// Every spare is rated on the SAME seeds, so the step between two spares is a paired difference:
// campaign i at spare s and campaign i at spare s+1 share their random stream. The rules:
//   monotone           D(s+1) <= D(s) + max(0.5, 2 SE of the paired difference)   (null if s+1 not measured)
//   tighter neighbour  D(s-1) <= min(1.5 D(s), D(s) + 3)                          (fails if s-1 not measured)
//   not censored       D(s) < 18.5 and the rating is valid
//   shippable          s in {1, 2, 3}, clock.n <= 19, and the release test's spare
//                      (t_clocks.js: clock.n - stored clock index - 1) also in 1..3
//   diallable          D(1) / D(3) >= 1.2 (a puzzle property)
//   opening clock      k <= 6 => only spare >= 2 may ship (a flag:
//                      shippableOpeningRule lists the spares that also pass it)
// A spare whose stored witness does not fit (clockSpare 'witnessWouldChange', the peek-pair shortcut
// of gate A3) is still rated as a probe with clock.n = k + s so its neighbours can be judged; it can
// never ship.
const K = require('../knobs.js');

const DEFAULT_RULES = Object.freeze({ monotoneSlack: 0.5, monotoneSe: 2, neighbourRatio: 1.5, neighbourAdd: 3,
  censoredAt: 18.5, shippableSpares: [1, 2, 3], maxClockN: 19, diallableRatio: 1.2,
  openingClockK: 6, openingClockMinSpare: 2, releaseTestSpare: [1, 3] });

function sampleSd(a) {
  if (a.length < 2) return 0;
  const m = a.reduce((s, x) => s + x, 0) / a.length;
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

// Paired step from point a (spare s) to point b (spare s+1). The difference of means uses the
// full-block D values; its SE uses the visible per-campaign pairs, scaled to the block size.
function pairedStep(a, b) {
  const k = Math.min(a.perCampaign.length, b.perCampaign.length);
  const d = Array.from({ length: k }, (_, i) => b.perCampaign[i] - a.perCampaign[i]);
  const n = Math.min(a.n, b.n);
  const unpaired = Math.sqrt(a.se ** 2 + b.se ** 2);
  return { from: a.spare, to: b.spare, diff: b.D - a.D, seDiff: k > 1 ? sampleSd(d) / Math.sqrt(n) : null,
    seUnpaired: unpaired, pairs: k, n };
}

// The spare the release test sees: clock.n - (index of the clock tile in the stored solution) - 1.
function releaseSpare(design) {
  const i = design?.solution && design.clock ? design.solution.indexOf(design.clock.i) : -1;
  return i < 0 ? null : design.clock.n - i - 1;
}

function applyRules(points, steps, rules = DEFAULT_RULES, { k = null } = {}) {
  const R = { ...DEFAULT_RULES, ...rules };
  const at = s => points.find(p => p.spare === s && p.D != null);
  const ok = p => p && p.valid !== false;
  const verdicts = {};
  const openingRestricted = k != null && k <= R.openingClockK;
  for (const p of points) {
    if (p.D == null) { verdicts[p.spare] = { spare: p.spare, canShip: false, reasons: [p.fail || 'unmeasured'] }; continue; }
    const s = p.spare, up = at(s + 1), down = at(s - 1), step = steps.find(x => x.from === s && x.to === s + 1);
    const v = { spare: s, D: p.D, clockN: p.clockN, reasons: [] };
    if (up && ok(up) && step) {
      v.monotoneLimit = p.D + Math.max(R.monotoneSlack, R.monotoneSe * (step.seDiff ?? 0));
      v.monotone = up.D <= v.monotoneLimit;
    } else v.monotone = null;
    if (down && ok(down)) {
      v.neighbourLimit = Math.min(R.neighbourRatio * p.D, p.D + R.neighbourAdd);
      v.tighterNeighbour = down.D <= v.neighbourLimit;
    } else v.tighterNeighbour = false;
    v.notCensored = p.valid !== false && p.D < R.censoredAt;
    v.shippableSpare = R.shippableSpares.includes(s) && p.clockN <= R.maxClockN;
    v.releaseSpare = p.releaseSpare ?? null;
    const releaseOk = p.releaseSpare == null || (p.releaseSpare >= R.releaseTestSpare[0] && p.releaseSpare <= R.releaseTestSpare[1]);
    v.openingClockOk = !openingRestricted || s >= R.openingClockMinSpare;
    if (v.monotone === false) v.reasons.push('cliffToLooser');
    if (v.monotone === null) v.notes = ['monotoneUnchecked'];
    if (!v.tighterNeighbour) v.reasons.push(down ? 'cliffAtTighterNeighbour' : 'tighterNeighbourUnmeasured');
    if (!v.notCensored) v.reasons.push(p.valid === false ? 'invalidRating' : 'censored');
    if (!v.shippableSpare) v.reasons.push(R.shippableSpares.includes(s) ? 'clockOver' + R.maxClockN : 'probeOnly');
    if (p.probe) v.reasons.push(p.probe);
    if (!releaseOk) v.reasons.push('releaseTestSpare');
    v.canShip = v.monotone !== false && v.tighterNeighbour && v.notCensored && v.shippableSpare && !p.probe && releaseOk;
    verdicts[s] = v;
  }
  const d1 = at(1), d3 = at(3);
  const ratio = d1 && d3 && d3.D > 0 ? d1.D / d3.D : null;
  const ratio13Se = ratio !== null && d1.D > 0 && d1.se != null && d3.se != null ? ratio * Math.sqrt((d1.se / d1.D) ** 2 + (d3.se / d3.D) ** 2) : null;
  const shippable = Object.values(verdicts).filter(v => v.canShip).map(v => v.spare);
  return {
    verdicts,
    shippable,
    openingClock: { k, restricted: openingRestricted, rule: `k <= ${R.openingClockK} => spare >= ${R.openingClockMinSpare}` },
    shippableOpeningRule: shippable.filter(s => verdicts[s].openingClockOk),
    ratio13: ratio,
    // Delta-method SE of D(1)/D(3), unpaired (conservative); unsettled = the 1.2 cut lies within 1 SE of the ratio.
    ratio13Se,
    diallableUnsettled: ratio !== null && ratio13Se !== null && Math.abs(ratio - R.diallableRatio) <= ratio13Se,
    diallable: ratio !== null && ratio >= R.diallableRatio,
    monotone: steps.every(st => st.diff <= Math.max(R.monotoneSlack, R.monotoneSe * (st.seDiff ?? 0)))
  };
}

// The design rated at spare s: knobs.clockSpare, or (probe) clock.n = k + s when only the witness check fails.
function spareDesign(design, spare, clockOptions, probeUnwitnessed) {
  const t = K.clockSpare(design, spare, clockOptions);
  if (!t.fail) return { design: t.design, k: t.proof.minimum };
  if (t.fail !== 'witnessWouldChange' || !probeUnwitnessed) return { fail: t.fail };
  const E = require('../engine.js'); // clockSpare does not return k on failure: the same proof again
  const way = E.clockShortest(E.game(JSON.parse(JSON.stringify(design))), { nodes: clockOptions?.nodes ?? 400000, ms: clockOptions?.ms ?? 5000 });
  if (!way || way.unsure) return { fail: t.fail };
  const copy = JSON.parse(JSON.stringify(design));
  copy.clock.n = way.k + spare;
  return { design: copy, k: way.k, probe: 'witnessWouldChange' };
}

function measureCurve(design, ys, { spares = [0, 1, 2, 3], block = 'CURVE', campaigns, runs, bot = 'family', clockOptions, probeUnwitnessed = true, allResults = true } = {}) {
  const started = Date.now();
  let k = null;
  const points = spares.map(spare => {
    const t0 = Date.now(), t = spareDesign(design, spare, clockOptions, probeUnwitnessed);
    if (t.fail) return { spare, fail: t.fail, D: null };
    k = t.k;
    const r = ys.rate(t.design, { block, campaigns, runs, bot, allResults });
    return { spare, clockN: t.design.clock.n, minimum: t.k, releaseSpare: t.probe ? null : releaseSpare(t.design),
      ...(t.probe ? { probe: t.probe } : {}), D: r.D, pHat: r.pHat, se: r.se, n: r.n,
      valid: r.valid, uncleared: r.uncleared, lossPhase: r.lossPhase, perCampaign: r.perCampaign, fingerprint: r.fingerprint,
      seconds: (Date.now() - t0) / 1000 };
  });
  const measured = points.filter(p => p.D != null).sort((a, b) => a.spare - b.spare);
  const steps = [];
  for (let i = 1; i < measured.length; i++)
    if (measured[i].spare === measured[i - 1].spare + 1) steps.push(pairedStep(measured[i - 1], measured[i]));
  const rules = applyRules(points, steps, ys.pins?.curveRules, { k });
  return { block, bot, fingerprint: measured[0]?.fingerprint ?? ys.fingerprint, k, points, steps, ...rules, seconds: (Date.now() - started) / 1000 };
}

module.exports = { measureCurve, applyRules, pairedStep, releaseSpare, spareDesign, DEFAULT_RULES };

// Timing run (process-v1/yardstick-timing.md). One process, no cache, so every number is real bot time.
//   node source/tools/builder/loop/heavy.js --label yardstick-dial -- node source/tools/builder/loop/dial_curve.js --timing [--ids a,b,c] [--out file]
if (require.main === module && process.argv.includes('--timing')) {
  const fs = require('fs'), path = require('path'), os = require('os');
  const Y = require('./yardstick.js'), S = require('./screen.js');
  const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined; };
  const rows = fs.readFileSync(path.resolve(__dirname, '../../../analysis/builder/data/qualified-200-225.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const ids = (arg('ids') || '70bde28d4c0922c5,fb46c7888c54e687,0fcd2cc72af5f1a6').split(',');
  const ys = Y.createYardstick({ cacheDir: false, ledgerFile: false });
  const time = f => { const t = process.hrtime.bigint(), v = f(); return [Number(process.hrtime.bigint() - t) / 1e9, v]; };
  const out = { date: new Date().toISOString(), node: process.version, cpu: os.cpus()[0].model, cores: os.cpus().length,
    family: ys.fingerprint, reference: ys.referenceFingerprint, cache: 'off', boards: [] };
  for (const id of ids) {
    const row = rows.find(r => r.id === id), d = row.design, b = { id, level: row.level, tiles: d.tiles.length, clockN: d.clock.n };
    const [tRate, r] = time(() => ys.rate(d, { block: 'CURVE' }));
    b.curveRating = { seconds: tRate, D: r.D, se: r.se, n: r.n, valid: r.valid };
    const [tCurve, c] = time(() => measureCurve(d, ys));
    b.fullCurve = { seconds: tCurve, k: c.k, points: c.points.map(p => ({ spare: p.spare, clockN: p.clockN, D: p.D, se: p.se, seconds: p.seconds, probe: p.probe, fail: p.fail })),
      steps: c.steps.map(s => ({ from: s.from, diff: s.diff, seDiff: s.seDiff, seUnpaired: s.seUnpaired })), shippable: c.shippable, shippableOpeningRule: c.shippableOpeningRule, diallable: c.diallable, ratio13: c.ratio13, ratio13Se: c.ratio13Se, diallableUnsettled: c.diallableUnsettled };
    const [tScreen, s] = time(() => S.screenBoard(d, ys, { lo: 1, hi: 19, early: false }));
    b.screen = { seconds: tScreen, D1: s.points[1]?.D, D3: s.points[3]?.D, campaigns: s.campaigns };
    const [tPlan, p] = time(() => ys.planner(d, { spare: 2 }));
    b.planner = { seconds: tPlan, S: p.S, styles: p.styles, valid: p.valid, clockN: p.clockN, fail: p.fail };
    out.boards.push(b);
    console.error(JSON.stringify(b));
  }
  const file = arg('out') || path.resolve(__dirname, '../../../build/yardstick-timing.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
  console.log('wrote ' + file);
}
