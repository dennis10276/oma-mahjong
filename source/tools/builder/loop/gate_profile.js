'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { canonical } = require('./library.js');
const FILE = path.resolve(__dirname, '../../../analysis/builder/library/gates-calibrated.json');
const STATIC = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A9'];
const TRACE = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'];
const digest = x => crypto.createHash('sha256').update(canonical(x)).digest('hex');
function loadProfile(name = 'e5-v1') {
  if (!['e5-v1', 'strict-v1'].includes(name)) throw Error('Unknown gate profile: ' + name);
  const calibrated = name === 'e5-v1', source = calibrated ? fs.readFileSync(FILE, 'utf8') : null;
  const proposal = source && JSON.parse(source);
  const reportOnly = calibrated ? STATIC.filter(g => proposal.static[g]?.action === 'report-only') : [];
  const spec = { schema: 'gate-profile-v1', id: name, experimental: calibrated,
    static: { required: STATIC.filter(g => !reportOnly.includes(g)), reportOnly },
    traces: { required: TRACE, thresholds: calibrated ? proposal.asThresholdsOption['traces.thresholds'] : {} },
    evidence: calibrated ? { file: 'library/gates-calibrated.json', sha256: digest(proposal) } : null };
  return { ...spec, fingerprint: digest(spec) };
}
function applyStatic(result, profile) {
  const r = structuredClone(result);
  for (const g of profile.static.reportOnly) if (r.gates?.[g]) {
    const v = r.gates[g]; r.gates[g] = { ...v, wouldPass: v.pass, pass: null, reportOnly: true };
  }
  r.pass = profile.static.required.every(g => r.gates?.[g]?.pass === true) && !!r.shipSpares?.length;
  r.profile = { id: profile.id, fingerprint: profile.fingerprint };
  return r;
}
function traceOptions(opts, profile) {
  return { ...opts, thresholds: structuredClone(profile.traces.thresholds) };
}
function unresolvedStatic(result, profile, { spare } = {}) {
  return profile.static.required.filter(g => {
    const gate = result.gates?.[g];
    if (gate?.pass == null) return true;
    if (!gate.warn) return false;
    // Unresolved extra opening moves cannot invalidate two already proven alternatives.
    // Every potentially forced witness state must still have been resolved, and budget
    // exhaustion remains unresolved. This does not classify an unknown action as a win.
    if (g === 'A4' && gate.pass === true && gate.warn === 'unknown' && spare != null) {
      const d = gate.detail, p = d?.perSpare?.[spare];
      if (d?.statesWithUnknown === 0 && p?.ok === true && p.openingWins >= 2 && Array.isArray(p.notObvious) && p.notObvious.length === 0) return false;
    }
    return true;
  });
}
module.exports = { loadProfile, applyStatic, traceOptions, unresolvedStatic, digest };
