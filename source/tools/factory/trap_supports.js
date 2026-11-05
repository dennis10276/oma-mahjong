'use strict';
// A useful main trap must not hide an idle supporting trap in a group ablation.
const { MOTIFS } = require('./trap_composer.js');
const { digest } = require('./meter.js');
const VERSION = 'support-ablations-v2';
const ICE = new Set([...Object.keys(MOTIFS), 'frozenGuards', 'trayJuggleFrozen', 'iceChain']);
const LOCKS = new Set(['lockedPartners', 'trayJuggleLocked']);
function checks(row) {
  const result = (row.trapPlan?.steps || []).flatMap((step, index) => {
    if (step.placement !== 'extend existing roles') return [];
    const kind = ICE.has(step.recipe) ? 'ice' : LOCKS.has(step.recipe) ? 'locks' : null;
    return kind ? [{ name: step.recipe + '@' + index, recipe: step.recipe, kind,
      indices: [...new Set(step.addedSpecials || [])].sort((a, b) => a - b) }] : [];
  });
  for (const key of new Set(row.recipe || [])) if (MOTIFS[key] && !result.some(x => x.recipe === key))
    result.push({ name: key + '@untracked', recipe: key, kind: 'ice', indices: [] });
  return result;
}
function fingerprint(row) { const list = checks(row); return list.length || row.playerFeedback
  ? digest({ version: VERSION, checks: list, playerFeedback: !!row.playerFeedback }) : null; }
function compatible(row, quality) {
  if (!quality) return false;
  const expected = fingerprint(row); return !expected || quality.supportFingerprint === expected;
}
function measure(row, baseline, meter, settings) {
  const supportFingerprint = fingerprint(row); if (!supportFingerprint) return {};
  const supports = {};
  for (const check of checks(row)) {
    const b = row.design, ids = new Set(check.indices);
    const present = ids.size > 0 && [...ids].every(i => check.kind === 'ice' ? b.obst?.ice?.[i] > 0 : b.obst?.locks?.includes(i));
    if (!present) { supports[check.name] = { kind: check.kind, indices: check.indices, present: false, matters: false }; continue; }
    const obst = { ...b.obst, ...(check.kind === 'ice'
      ? { ice: Object.fromEntries(Object.entries(b.obst.ice).filter(([i]) => !ids.has(+i))) }
      : { locks: b.obst.locks.filter(i => !ids.has(i)) }) };
    const m = meter.measure({ ...b, obst }, settings);
    supports[check.name] = { kind: check.kind, indices: check.indices, present: true,
      without: m.expectedTries, first: m.firstTryRate, valid: m.valid,
      matters: baseline.valid && m.valid && (Math.abs(baseline.expectedTries - m.expectedTries) >= .3 || Math.abs(baseline.firstTryRate - m.firstTryRate) >= .15) };
  }
  return { supportFingerprint, supports };
}
module.exports = { VERSION, checks, fingerprint, compatible, measure };
