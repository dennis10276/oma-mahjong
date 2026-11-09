#!/usr/bin/env node
'use strict';
/**
 * cli.js - Command-line interface for the builder-next target-driven builder.
 *
 * Usage:
 *   node source/tools/builder-next/cli.js --target 10
 *   node source/tools/builder-next/cli.js --target 13 --layout 22 --seed 1
 *   node source/tools/builder-next/cli.js --target 10 --json
 */

const builder = require('./builder_next.js');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    target: 10,
    layout: 22,
    maxRepairs: 3,
    json: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) options.target = Number(args[++i]);
    else if (args[i] === '--layout' && args[i + 1]) options.layout = Number(args[++i]);
    else if (args[i] === '--seed' && args[i + 1]) options.seed = Number(args[++i]);
    else if (args[i] === '--repairs' && args[i + 1]) options.maxRepairs = Number(args[++i]);
    else if (args[i] === '--json') options.json = true;
    else if (args[i] === '--help') {
      console.log('Usage: node cli.js [--target 10|13] [--layout 22] [--seed 1] [--repairs 3] [--json]');
      process.exit(0);
    }
  }

  return options;
}

async function main() {
  const opts = parseArgs();

  if (!opts.json) {
    console.log('================================================================');
    console.log(` Builder-Next: Target-Driven Build Request`);
    console.log(` Target Family Difficulty: ${opts.target} (Band: [${opts.target - 1}, ${opts.target + 1}])`);
    console.log(` Target Skilled Band:      [2.5, 6.0]`);
    console.log(` Geometry / Layout:        Layout ${opts.layout}, Seed ${opts.seed}`);
    console.log(` Work Budget:              Max ${opts.maxRepairs} Repairs`);
    console.log('================================================================\n');
  }

  const result = await builder.build({
    target: opts.target,
    layout: opts.layout,
    seed: opts.seed
  }, {
    maxRepairs: opts.maxRepairs
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Status: ${result.status} (${result.success ? 'SUCCESS' : 'INCOMPLETE'})`);
  console.log(`Total Attempts: ${result.attempts}, Repairs Made: ${result.repairs}`);
  console.log(`Resource Usage: ${result.cost.cpuS.toFixed(2)}s CPU, ${(result.cost.wallMs / 1000).toFixed(2)}s Wall\n`);

  if (result.repairHistory.length > 0) {
    console.log('--- Repair Ledger ---');
    result.repairHistory.forEach((r, idx) => {
      console.log(`Repair #${r.repairIndex || idx + 1}: [${r.editType || r.action}]`);
      console.log(`  Reason: ${r.reason}`);
      if (r.beforeD != null) console.log(`  Before: D=${r.beforeD?.toFixed(2)}, S=${r.beforeS?.toFixed(2)}`);
      if (r.afterRecipe) console.log(`  Applied: ${JSON.stringify(r.afterRecipe)}`);
    });
    console.log('');
  }

  const evalOut = result.evaluation || result.bestCandidate?.evaluation;
  const cand = result.finalCandidate || result.bestCandidate;

  if (evalOut && cand) {
    console.log('--- Candidate Outcome ---');
    console.log(`Recipe:        ${JSON.stringify(cand.recipe)}`);
    console.log(`Clock:         k=${cand.k || cand.candidate?.k}, spare=${cand.spare || cand.recipe.spare}, clock.n=${cand.clockN || cand.design?.clock?.n}`);
    console.log(`Family D:      ${evalOut.D.toFixed(3)} (SE: ${evalOut.D_se.toFixed(3)}) [Target: ${opts.target}]`);
    console.log(`Skilled S:     ${evalOut.S != null ? evalOut.S.toFixed(2) : 'null'} [Normal Band: 2.5 - 6.0]`);
    console.log(`Static Gates:  ${evalOut.staticPass ? 'PASS' : 'FAIL'}`);
    console.log(`Trace Gates:   ${evalOut.tracePass ? 'PASS' : 'FAIL'}`);
    if (evalOut.traces) {
      console.log(`  B6 (Pacing post-clock):   ${evalOut.traces.B6?.toFixed(3)} (threshold <= 0.65)`);
      console.log(`  B7 (Repeated mistakes):   ${evalOut.traces.B7_repeat?.toFixed(3)} (threshold <= 0.50, inflated: ${evalOut.traces.inflated})`);
      if (evalOut.traces.failedTraces?.length) console.log(`  Failed Gates:             [${evalOut.traces.failedTraces.join(', ')}]`);
    }
  }

  console.log('\n================================================================');
}

main().catch(err => {
  console.error('Fatal builder error:', err);
  process.exit(1);
});
