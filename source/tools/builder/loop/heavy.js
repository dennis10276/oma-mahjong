#!/usr/bin/env node
// Run a CPU-heavy command inside the PC's shared core budget.
//   node source/tools/builder/loop/heavy.js [--label name] [--cores N] -- <command> [args...]
// Dennis, 2026-11-13: "8 cores can run at once", then "OMA_CORES 12 and max 80%" (the PC has 20 logical cores). So this is no longer a one-job lock:
// every heavy job reserves the cores it will use (--cores, default 1; a par.js job reserves its --workers) and
// starts as soon as reserved + sampled use fits in the budget (12 cores, or env OMA_CORES) and the job would not
// push the PC's total CPU load above 80% (env OMA_MAX_LOAD). Several jobs of different
// agents can run side by side, e.g. an 8-worker run alone, or a 4-worker run next to four single-core jobs.
// 1. Reservations are files in a folder shared by every worktree: <OmasMahjong>/.heavy-slots/<pid>.json.
//    A reservation whose process is gone is dropped.
// 2. Before starting, node/python work that did not reserve (older checkouts, other tools) is sampled for 3 s and
//    counted too, so such jobs are not trampled.
// 3. Runs the command with inherited stdio, then releases. Exit code = the command's.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const HERE = path.resolve(__dirname, '..', '..', '..', '..');
const ROOT = path.dirname(HERE);
const SLOTS = path.join(ROOT, '.heavy-slots');
const MUTEX = path.join(SLOTS, '.mutex');
const BUDGET = Math.max(1, +process.env.OMA_CORES || 12);        // Dennis 2026-11-13: 12 cores
const MAX_LOAD = Math.max(1, +process.env.OMA_MAX_LOAD || 80);   // and never push the whole PC above 80% CPU

function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function reservations() {
  const out = [];
  let names = [];
  try { names = fs.readdirSync(SLOTS); } catch { return out; }
  for (const n of names) {
    if (!/^\d+\.json$/.test(n)) continue;
    const f = path.join(SLOTS, n);
    try {
      const r = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (alive(r.pid)) out.push(r); else fs.rmSync(f, { force: true });
    } catch { /* being written */ }
  }
  return out;
}

// short critical section around "count and reserve"
function withMutex(fn) {
  fs.mkdirSync(SLOTS, { recursive: true });
  for (let i = 0; ; i++) {
    try { fs.mkdirSync(MUTEX); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { if (Date.now() - fs.statSync(MUTEX).mtimeMs > 30000) fs.rmSync(MUTEX, { recursive: true, force: true }); } catch { /* gone */ }
      sleep(200);
    }
  }
  try { return fn(); } finally { try { fs.rmSync(MUTEX, { recursive: true, force: true }); } catch { /* gone */ } }
}

// cores used by node/python processes that are not part of a reserved job (3 s sample)
function unreservedCores(resv) {
  let s;
  try { s = require('./busy.js').sampleProcesses(); } catch (e) { return { stray: 0, load: 0 }; }
  const procs = s.procs || [], byPid = new Map(procs.map(p => [p.pid, p]));
  const reserved = new Set(resv.map(r => r.pid));
  const inReservedJob = p => { for (let q = p, n = 0; q && n < 12; q = byPid.get(q.ppid), n++) if (reserved.has(q.pid)) return true; return false; };
  return { stray: procs.filter(p => p.pid !== process.pid && !inReservedJob(p)).reduce((t, p) => t + (p.cores || 0), 0), load: +s.load || 0 };
}

function main() {
  const argv = process.argv.slice(2);
  const dd = argv.indexOf('--');
  if (dd < 0 || dd === argv.length - 1) {
    console.error('usage: heavy.js [--label name] [--cores N] -- <command> [args...]');
    process.exit(64);
  }
  const opt = n => { const i = argv.indexOf('--' + n); return i >= 0 && i < dd ? argv[i + 1] : null; };
  const cmd = argv.slice(dd + 1);
  const label = opt('label') || cmd.join(' ').slice(0, 120);
  // cores: explicit, else the --workers of a par.js command, else 1
  const wi = cmd.indexOf('--workers');
  const cores = Math.min(BUDGET, Math.max(1, +opt('cores') || (cmd.some(a => /par\.js$/.test(a)) ? (wi >= 0 ? +cmd[wi + 1] : 8) : 1)));
  const mine = path.join(SLOTS, process.pid + '.json');
  let waited = 0;
  for (;;) {
    const state = withMutex(() => {
      const resv = reservations(), used = resv.reduce((t, r) => t + r.cores, 0);
      if (used + cores > BUDGET) return { ok: false, why: `${used} of ${BUDGET} cores reserved (${resv.map(r => r.label + ':' + r.cores).join(', ')})` };
      const { stray, load } = unreservedCores(resv);
      if (used + stray + cores > BUDGET + 0.5) return { ok: false, why: `${used} reserved + ${stray.toFixed(1)} used by unreserved node/python jobs` };
      // the load this job adds, as a share of all logical cores, must keep the PC at or under MAX_LOAD
      const add = 100 * cores / require('os').cpus().length;
      if (load + add > MAX_LOAD + 0.5 && load > 100 * (used + stray) / require('os').cpus().length + 10) return { ok: false, why: `CPU load ${load}% (limit ${MAX_LOAD}%)` };
      if (100 * (used + stray + cores) / require('os').cpus().length > MAX_LOAD + 0.5) return { ok: false, why: `would exceed ${MAX_LOAD}% CPU` };
      fs.writeFileSync(mine, JSON.stringify({ pid: process.pid, cores, label, since: new Date().toISOString(), worktree: path.basename(HERE) }));
      return { ok: true };
    });
    if (state.ok) break;
    if (waited % 60000 === 0) console.error(`[heavy] waiting for ${cores} core(s): ${state.why}`);
    sleep(5000); waited += 5000;
  }
  const release = () => { try { fs.rmSync(mine, { force: true }); } catch { /* gone */ } };
  process.on('exit', release);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { release(); process.exit(130); });
  const child = spawn(cmd[0], cmd.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' && !/\.exe$|^node$/i.test(cmd[0]) });
  child.on('exit', (code) => { release(); process.exit(code === null ? 1 : code); });
}

if (require.main === module) main();
module.exports = { reservations, BUDGET, MAX_LOAD, SLOTS };
