'use strict';
/**
 * run_experiments.js - Runs the G9 experimental suite and records all
 * requests, attempts, repairs, bot measurements (D, S), trace gates,
 * and CPU/wall costs to experiments.jsonl.
 */

const fs = require('fs');
const path = require('path');
const builder = require('../../tools/builder-next/builder_next.js');

const EXPERIMENTS_FILE = path.join(__dirname, 'experiments.jsonl');

const TEST_REQUESTS = [
  // Core requests for Task G9
  { id: 'exp-target10-ushape', target: 10, layout: 22, name: 'Target 10 on U-shape (Layout 22)' },
  { id: 'exp-target13-ushape', target: 13, layout: 22, name: 'Target 13 on U-shape (Layout 22)' },
  { id: 'exp-target7-ushape', target: 7, layout: 22, name: 'Target 7 on U-shape (Layout 22)' },
  { id: 'exp-target5-ushape', target: 5, layout: 22, name: 'Target 5 on U-shape (Layout 22)' },

  // Transfer tests on held-out geometries
  { id: 'exp-target10-castle', target: 10, layout: 20, name: 'Transfer: Target 10 on Castle (Layout 20)' },
  { id: 'exp-target13-castle', target: 13, layout: 20, name: 'Transfer: Target 13 on Castle (Layout 20)' },
  { id: 'exp-target10-arch', target: 10, layout: 0, name: 'Transfer: Target 10 on Arch (Layout 0)' }
];

async function main() {
  console.log('================================================================');
  console.log(' Running G9 Experimental Suite (builder-next)');
  console.log(` Output: ${EXPERIMENTS_FILE}`);
  console.log(` Requests to evaluate: ${TEST_REQUESTS.length}`);
  console.log('================================================================\n');

  // Clear previous experimental log
  if (fs.existsSync(EXPERIMENTS_FILE)) {
    fs.unlinkSync(EXPERIMENTS_FILE);
  }

  const summaries = [];

  for (let i = 0; i < TEST_REQUESTS.length; i++) {
    const req = TEST_REQUESTS[i];
    console.log(`[${i + 1}/${TEST_REQUESTS.length}] Running ${req.name}...`);
    const t0 = Date.now();

    const result = await builder.build({
      target: req.target,
      layout: req.layout
    }, {
      maxRepairs: 3
    });

    const elapsedWall = (Date.now() - t0) / 1000;
    const cand = result.finalCandidate || result.bestCandidate;
    const evalOut = result.evaluation || cand?.evaluation;

    const record = {
      id: req.id,
      name: req.name,
      timestamp: new Date().toISOString(),
      request: {
        target: req.target,
        layout: req.layout,
        skilledBand: [2.5, 6.0],
        tol: 1.0
      },
      result: {
        success: result.success,
        status: result.status,
        attempts: result.attempts,
        repairs: result.repairs,
        cost: result.cost,
        repairHistory: result.repairHistory,
        attemptHistory: result.attemptHistory
      },
      candidate: cand ? {
        recipe: cand.recipe,
        k: cand.k || cand.candidate?.k,
        clockN: cand.clockN || cand.design?.clock?.n,
        spare: cand.spare || cand.recipe?.spare,
        D: evalOut?.D,
        D_se: evalOut?.D_se,
        S: evalOut?.S,
        staticPass: evalOut?.staticPass,
        tracePass: evalOut?.tracePass,
        traces: evalOut?.traces
      } : null
    };

    fs.appendFileSync(EXPERIMENTS_FILE, JSON.stringify(record) + '\n');

    console.log(`   Status:   ${result.status} (${result.success ? 'QUALIFIED' : 'INCOMPLETE'})`);
    console.log(`   Attempts: ${result.attempts}, Repairs: ${result.repairs}`);
    if (cand && evalOut) {
      console.log(`   Family D: ${evalOut.D?.toFixed(2)} (Target: ${req.target}), Skilled S: ${evalOut.S?.toFixed(2)}`);
      console.log(`   Static:   ${evalOut.staticPass ? 'PASS' : 'FAIL'}, Trace: ${evalOut.tracePass ? 'PASS' : 'FAIL'}`);
    }
    console.log(`   Cost:     ${result.cost.cpuS.toFixed(2)}s CPU, ${elapsedWall.toFixed(2)}s Wall\n`);

    summaries.push({
      id: req.id,
      target: req.target,
      layout: req.layout,
      status: result.status,
      attempts: result.attempts,
      repairs: result.repairs,
      D: evalOut?.D,
      S: evalOut?.S,
      staticPass: evalOut?.staticPass,
      tracePass: evalOut?.tracePass,
      cpuS: result.cost.cpuS,
      wallS: elapsedWall
    });
  }

  console.log('================================================================');
  console.log(' G9 Experimental Suite Summary Table');
  console.log('================================================================');
  console.table(summaries);
  console.log('\nAll experiment records written to: ' + EXPERIMENTS_FILE);
}

main().catch(err => {
  console.error('Experiment suite failed:', err);
  process.exit(1);
});
