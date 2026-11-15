#!/usr/bin/env node
/**
 * Parallel host-sweep across the 6-wide catalogue (layouts-6wide.json):
 * tests every layout against the 41 trap_stories chain shapes and the
 * 10 chained_v2_run trap-mix families without mutating the designed footprint.
 */
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const V2_NAMES = [
  'waitThawWay', 'waitNested', 'waitThawKey', 'lookalikeThaw',
  'lookalikeCover', 'lookalikeWay', 'roofThawKey', 'waitLookalikeRoof',
  'waitLookalikeWay', 'lookalikeCoverThaw',
];

function parseArgs(argv) {
  const out = {
    input: path.resolve(__dirname, '../../analysis/builder/data/layouts-6wide.json'),
    out: path.resolve(__dirname, '../../build/six-wide-sweep.json'),
    mirror: path.resolve(__dirname, '../../../../gemini-tasks/results/six-wide/sweep-summary.json'),
    workers: 8,
    chainTries: 12,
    chainWall: 6000,
    v2Tries: 100,
    v2Wall: 8000,
    only: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') out.input = path.resolve(argv[++i]);
    else if (a === '--out') out.out = path.resolve(argv[++i]);
    else if (a === '--mirror') out.mirror = path.resolve(argv[++i]);
    else if (a === '--workers') out.workers = +argv[++i];
    else if (a === '--chain-tries') out.chainTries = +argv[++i];
    else if (a === '--chain-wall') out.chainWall = +argv[++i];
    else if (a === '--v2-tries') out.v2Tries = +argv[++i];
    else if (a === '--v2-wall') out.v2Wall = +argv[++i];
    else if (a === '--only') out.only = new Set(argv[++i].split(',').map(Number));
  }
  return out;
}

if (!isMainThread) {
  const CF = require('./compact_footprint.js');
  CF.compact = (r) => r;
  const B = require('./builder.js');
  const raw = JSON.parse(fs.readFileSync(workerData.input, 'utf8'));
  const designs = Array.isArray(raw) ? raw : raw.layouts;
  B.LAYOUTS.splice(0, B.LAYOUTS.length, ...designs);
  const T = require('./trap_stories.js');
  const M = require('./trap_mixes.js');

  parentPort.on('message', (job) => {
    const t0 = Date.now();
    let ok = false;
    let why = '';
    if (job.kind === 'chain') {
      try {
        const res = T.build('chain', {
          chain: job.name,
          layout: job.layoutIdx,
          seed: 1,
          stage: 'edge',
        }, { tries: workerData.chainTries, wallMs: workerData.chainWall });
        ok = !!(res && res.design);
        why = ok ? 'ok' : (res && (res.fail || (res.fails && Object.keys(res.fails)[0]))) || 'fail';
      } catch (e) {
        why = `err:${e.message}`;
      }
    } else {
      try {
        const res = M.build(job.name, {
          layout: job.layoutIdx,
          seed: 11,
          obviousnessDial: 0,
          frame: { spare: 1 },
          targets: {},
        }, { tries: workerData.v2Tries, wallMs: workerData.v2Wall });
        ok = !!(res && res.design);
        why = ok ? 'ok' : (res && (res.fail || (res.fails && Object.keys(res.fails)[0]))) || 'fail';
      } catch (e) {
        why = `err:${e.message}`;
      }
    }
    parentPort.postMessage({
      idx: job.idx,
      layoutIdx: job.layoutIdx,
      kind: job.kind,
      name: job.name,
      ok,
      why,
      ms: Date.now() - t0,
    });
  });
  return;
}

async function main() {
  const args = parseArgs(process.argv);
  const raw = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  const designs = Array.isArray(raw) ? raw : raw.layouts;
  const T = require('./trap_stories.js');
  const chainShapes = T.CHAIN_SHAPES;

  const jobs = [];
  for (let i = 0; i < designs.length; i++) {
    if (args.only && !args.only.has(i)) continue;
    for (const sig of chainShapes) {
      jobs.push({ idx: jobs.length, layoutIdx: i, kind: 'chain', name: sig });
    }
    for (const name of V2_NAMES) {
      jobs.push({ idx: jobs.length, layoutIdx: i, kind: 'v2', name });
    }
  }

  console.log(`Sweeping ${designs.length} layouts (${jobs.length} jobs) on ${args.workers} workers...`);
  const tStart = Date.now();
  const perLayout = designs.map((d, i) => ({
    index: i,
    level: d.level,
    shape: d.shape,
    base: d.base,
    n: d.n,
    px: d.px,
    chainPassed: [],
    chainFailWhy: {},
    v2Passed: [],
    v2FailWhy: {},
  }));

  let next = 0;
  let done = 0;
  const workers = [];
  await new Promise((resolve, reject) => {
    let active = args.workers;
    for (let w = 0; w < args.workers; w++) {
      const worker = new Worker(__filename, {
        workerData: {
          input: args.input,
          chainTries: args.chainTries,
          chainWall: args.chainWall,
          v2Tries: args.v2Tries,
          v2Wall: args.v2Wall,
        },
      });
      workers.push(worker);
      const sendNext = () => {
        if (next < jobs.length) {
          worker.postMessage(jobs[next++]);
        } else {
          worker.terminate();
          active--;
          if (active === 0) resolve();
        }
      };
      worker.on('message', (msg) => {
        done++;
        const rec = perLayout[msg.layoutIdx];
        if (msg.kind === 'chain') {
          if (msg.ok) rec.chainPassed.push(msg.name);
          else rec.chainFailWhy[msg.why] = (rec.chainFailWhy[msg.why] || 0) + 1;
        } else {
          if (msg.ok) rec.v2Passed.push(msg.name);
          else rec.v2FailWhy[msg.why] = (rec.v2FailWhy[msg.why] || 0) + 1;
        }
        if (done % 250 === 0 || done === jobs.length) {
          const sec = ((Date.now() - tStart) / 1000).toFixed(1);
          console.log(`  progress: ${done}/${jobs.length} (${sec}s)`);
        }
        sendNext();
      });
      worker.on('error', reject);
      sendNext();
    }
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    elapsedSec: +((Date.now() - tStart) / 1000).toFixed(1),
    chainTotal: chainShapes.length,
    v2Total: V2_NAMES.length,
    layouts: perLayout,
  };

  for (const outPath of [args.out, args.mirror].filter(Boolean)) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  }
  const zeroChain = perLayout.filter((r) => (!args.only || args.only.has(r.index)) && r.chainPassed.length === 0);
  const zeroV2 = perLayout.filter((r) => (!args.only || args.only.has(r.index)) && r.v2Passed.length === 0);
  console.log(`Done in ${summary.elapsedSec}s. Zero-chain: ${zeroChain.map((r) => `${r.index}:${r.shape}`).join(', ') || 'none'}. Zero-v2: ${zeroV2.map((r) => `${r.index}:${r.shape}`).join(', ') || 'none'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
