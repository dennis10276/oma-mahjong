'use strict';
/**
 * evaluator.js - Unified evaluation harness for builder-next.
 * Wraps verified static gates, yardstick ratings (planner S and family D),
 * and trace quality gates (B1-B7).
 */

const SG = require('../builder/loop/static_gates.js');
const GP = require('../builder/loop/gate_profile.js');
const T = require('../builder/loop/traces.js');
const Y = require('../builder/loop/yardstick.js');

const profile = GP.loadProfile('e5-v1');
const ys = Y.createYardstick();

/**
 * Runs complete static, skilled (S), family (D), and trace evaluations.
 * Supports quick screen (40 campaigns) or full calibration (80 campaigns).
 */
function evaluateDesign(design, options = {}) {
  const t0 = Date.now();
  const cpu0 = process.cpuUsage();
  const spare = options.spare ?? 1;
  const shape = options.shape || 'ushape';
  const campaigns = options.campaigns || 80;

  // 1. Static Gates (A1-A9)
  const rawStatic = SG.staticGates(design, { shape, stopEarly: false });
  const staticResult = GP.applyStatic(rawStatic, profile);

  if (!staticResult.pass) {
    const failed = Object.keys(staticResult.gates).filter(g => staticResult.gates[g].pass === false);
    const cpu = process.cpuUsage(cpu0);
    return {
      pass: false,
      stage: 'static',
      failedGates: failed,
      staticPass: false,
      ms: Date.now() - t0,
      cpuS: (cpu.user + cpu.system) / 1e6
    };
  }

  // 2. Skilled Bot (S)
  const pl = ys.planner(design, { spare });
  const S = pl.S;
  const S_valid = pl.valid;

  // 3. Family Bot (D)
  const fam = ys.rate(design, { block: 'CURVE', allResults: campaigns >= 80 });
  const D = fam.D;
  const D_se = fam.se;

  // 4. Trace Quality Gates (B1-B7)
  const tr = T.traceGates(design, GP.traceOptions({ ys, spare, campaigns: Math.min(campaigns, 40) }, profile));

  const tracePass = tr.pass === true;
  const failedTraces = Object.keys(tr).filter(k => tr[k] && tr[k].pass === false);
  const inflated = tr.B7?.inflated === true;

  const cpu = process.cpuUsage(cpu0);
  const cpuS = (cpu.user + cpu.system) / 1e6;
  const ms = Date.now() - t0;

  return {
    pass: staticResult.pass && tracePass && !inflated,
    staticPass: staticResult.pass,
    tracePass,
    S,
    S_valid,
    D,
    D_se,
    traces: {
      D: tr.D,
      pass: tr.pass,
      B1: tr.B1?.value,
      B2: tr.B2?.value,
      B3: tr.B3?.value,
      B4: tr.B4?.value,
      B5: tr.B5?.value,
      B6: tr.B6?.value,
      B7_repeat: tr.B7?.value,
      inflated,
      maxTarget: tr.B7?.maxTarget,
      failedTraces
    },
    ms,
    cpuS
  };
}

module.exports = {
  evaluateDesign
};
