'use strict';
const SG = require('../builder/loop/static_gates.js');
const GP = require('../builder/loop/gate_profile.js');
const T = require('../builder/loop/traces.js');

function diagnose(e, request) {
  const issues = [], { target, tol = 1, skilledBand = [2.5, 6] } = request;
  if (e.staticPass !== true) issues.push('STATIC_FAILURE');
  if (e.S_valid !== true || !Number.isFinite(e.S)) issues.push('SKILLED_UNRESOLVED');
  else if (e.S < skilledBand[0]) issues.push('SKILLED_TOO_EASY');
  else if (e.S > skilledBand[1]) issues.push('SKILLED_TOO_HARD_REVIEW');
  if (e.D_valid !== true || !Number.isFinite(e.D)) issues.push('FAMILY_UNRESOLVED');
  else if (Math.abs(e.D - target) > tol) issues.push(e.D < target ? 'FAMILY_TOO_EASY' : 'FAMILY_TOO_HARD');
  if (e.tracePass !== true) issues.push(e.tracePass === false ? 'TRACE_FAILURE' : 'TRACE_NOT_CHECKED');
  if (e.maxTarget != null && target > e.maxTarget) issues.push('REPEAT_INFLATED_TARGET');
  return issues;
}

function evaluateDesign(design, { ys, request, shape, spare, campaigns = 80 }) {
  const started = Date.now(), cpu = process.cpuUsage(), profile = GP.loadProfile('e5-v1');
  const finish = result => {
    const used = process.cpuUsage(cpu);
    return { ...result, ms: Date.now() - started, cpuS: (used.user + used.system) / 1e6 };
  };
  const raw = SG.staticGates(design, { shape, stopEarly: false });
  const stat = GP.applyStatic(raw, profile);
  const unresolved = GP.unresolvedStatic(stat, profile, { spare });
  const staticPass = stat.pass === true && stat.shipSpares.includes(spare) && !unresolved.length;
  if (!staticPass) return finish({ staticPass: false, tracePass: null,
    failedGates: profile.static.required.filter(k => stat.gates[k]?.pass !== true), unresolved,
    shipSpares: stat.shipSpares, gateProfile: profile.fingerprint });

  // Both bots see the exact constructed deadline. Never redial S separately.
  const pl = ys.planner(design, { spare: null });
  const fam = ys.rate(design, { block: 'CURVE', campaigns, allResults: true });
  const result = { staticPass: true, S: pl.S, S_valid: pl.valid, styles: pl.styles,
    D: fam.D, D_valid: fam.valid, D_se: fam.se, familyCampaigns: fam.n,
    familyFingerprint: fam.fingerprint, skilledFingerprint: pl.fingerprint,
    clockN: design.clock?.n ?? null, tracePass: null, gateProfile: profile.fingerprint };
  const { target, tol = 1, skilledBand = [2.5, 6] } = request;
  if (pl.valid && fam.valid && Number.isFinite(pl.S) && Number.isFinite(fam.D) &&
      pl.S >= skilledBand[0] && pl.S <= skilledBand[1] && Math.abs(fam.D - target) <= tol) {
    const trace = T.traceGates(design, GP.traceOptions({
      ys,
      spare: null,
      campaigns,
      cap: ys.pins?.cap,
      maxAttempts: ys.pins?.cap,
      protocol: ys.protocol
    }, profile));
    result.tracePass = trace.pass === true;
    result.failedTraces = profile.traces.required.filter(k => trace[k]?.pass !== true);
    result.traces = Object.fromEntries(['B1','B2','B3','B4','B5','B6','B7'].map(k => [k, trace[k]]));
    result.traceCampaigns = trace.campaigns;
    result.maxTarget = trace.B7?.maxTarget ?? null;
  }
  result.pass = diagnose(result, request).length === 0;
  return finish(result);
}
module.exports = { diagnose, evaluateDesign };
