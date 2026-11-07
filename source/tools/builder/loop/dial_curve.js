'use strict';
// The dial curve (process-design-synthesis.md section 3 and section 6 step 6).
//
//   const curve = measureCurve(design, ys, { spares: [0, 1, 2, 3], block: 'CURVE' });
//
// Every spare is made with knobs.clockSpare (only clock.n changes; the witness is replayed) and
// rated on the SAME seeds, so the step between two spares is a paired difference: campaign i at
// spare s and campaign i at spare s+1 share their random stream. The rules then mark which spares
// could ship:
//   monotone           D(s+1) <= D(s) + max(0.5, 2 SE of the paired difference)   (unchecked if s+1 not measured)
//   tighter neighbour  D(s-1) <= min(1.5 D(s), D(s) + 3)                          (fails if s-1 not measured)
//   not censored       D(s) < 18.5 and the rating is valid
//   shippable          s in {1, 2, 3} and clock.n <= 19
//   diallable          D(1) / D(3) >= 1.2 (a puzzle property)
const K = require('../knobs.js');

const DEFAULT_RULES = Object.freeze({ monotoneSlack: 0.5, monotoneSe: 2, neighbourRatio: 1.5, neighbourAdd: 3,
  censoredAt: 18.5, shippableSpares: [1, 2, 3], maxClockN: 19, diallableRatio: 1.2 });

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
  return { from: a.spare, to: b.spare, diff: b.D - a.D, seDiff: k ? sampleSd(d) / Math.sqrt(n) : null,
    seUnpaired: unpaired, pairs: k, n };
}

function applyRules(points, steps, rules = DEFAULT_RULES) {
  const R = { ...DEFAULT_RULES, ...rules };
  const at = s => points.find(p => p.spare === s && p.D != null);
  const ok = p => p && p.valid !== false;
  const verdicts = {};
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
    if (v.monotone === false) v.reasons.push('cliffToLooser');
    if (v.monotone === null) v.notes = ['monotoneUnchecked'];
    if (!v.tighterNeighbour) v.reasons.push(down ? 'cliffAtTighterNeighbour' : 'tighterNeighbourUnmeasured');
    if (!v.notCensored) v.reasons.push(p.valid === false ? 'invalidRating' : 'censored');
    if (!v.shippableSpare) v.reasons.push(R.shippableSpares.includes(s) ? 'clockOver' + R.maxClockN : 'probeOnly');
    v.canShip = v.monotone !== false && v.tighterNeighbour && v.notCensored && v.shippableSpare;
    verdicts[s] = v;
  }
  const d1 = at(1), d3 = at(3);
  const ratio = d1 && d3 && d3.D > 0 ? d1.D / d3.D : null;
  return {
    verdicts,
    shippable: Object.values(verdicts).filter(v => v.canShip).map(v => v.spare),
    ratio13: ratio,
    diallable: ratio !== null && ratio >= R.diallableRatio,
    monotone: steps.every(st => st.diff <= Math.max(R.monotoneSlack, R.monotoneSe * (st.seDiff ?? 0)))
  };
}

function measureCurve(design, ys, { spares = [0, 1, 2, 3], block = 'CURVE', campaigns, runs, bot = 'family', clockOptions } = {}) {
  const started = Date.now();
  const points = spares.map(spare => {
    const t = K.clockSpare(design, spare, clockOptions);
    if (t.fail) return { spare, fail: t.fail, D: null };
    const r = ys.rate(t.design, { block, campaigns, runs, bot });
    return { spare, clockN: t.design.clock.n, minimum: t.proof.minimum, D: r.D, pHat: r.pHat, se: r.se, n: r.n,
      valid: r.valid, uncleared: r.uncleared, lossPhase: r.lossPhase, perCampaign: r.perCampaign, fingerprint: r.fingerprint };
  });
  const measured = points.filter(p => p.D != null).sort((a, b) => a.spare - b.spare);
  const steps = [];
  for (let i = 1; i < measured.length; i++)
    if (measured[i].spare === measured[i - 1].spare + 1) steps.push(pairedStep(measured[i - 1], measured[i]));
  const rules = applyRules(points, steps, ys.pins?.curveRules);
  return { block, bot, fingerprint: measured[0]?.fingerprint ?? ys.fingerprint, points, steps, ...rules, seconds: (Date.now() - started) / 1000 };
}

module.exports = { measureCurve, applyRules, pairedStep, DEFAULT_RULES };
