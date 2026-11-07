#!/usr/bin/env node
// Run a CPU-heavy command as THE one heavy job on this PC.
//   node source/tools/builder/loop/heavy.js [--label name] -- <command> [args...]
// 1. Takes an exclusive lock (a directory under source/build/heavy.lock) so two of Claude's own
//    agents never run heavy jobs at the same time (busy.js deliberately ignores this worktree).
// 2. Waits until busy.js says FREE (Codex/Gemini jobs, CPU load).
// 3. Runs the command with inherited stdio, then releases the lock. Exit code = the command's.
// A lock whose owner process is gone is taken over. Waiting prints a line every minute.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const HERE = path.resolve(__dirname, '..', '..', '..', '..');
const LOCK = path.join(HERE, 'source', 'build', 'heavy.lock');
const BUSY = path.join(__dirname, 'busy.js');

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function tryLock(label) {
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  try {
    fs.mkdirSync(LOCK);
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let owner = null;
    try { owner = JSON.parse(fs.readFileSync(path.join(LOCK, 'owner.json'), 'utf8')); } catch { /* being written */ }
    if (owner && !alive(owner.pid)) {
      fs.rmSync(LOCK, { recursive: true, force: true });
      return tryLock(label);
    }
    return owner || { pid: '?', label: '?' };
  }
  fs.writeFileSync(path.join(LOCK, 'owner.json'), JSON.stringify({ pid: process.pid, label, since: new Date().toISOString() }));
  return null;
}

function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function main() {
  const argv = process.argv.slice(2);
  const dd = argv.indexOf('--');
  if (dd < 0 || dd === argv.length - 1) {
    console.error('usage: heavy.js [--label name] -- <command> [args...]');
    process.exit(64);
  }
  const li = argv.indexOf('--label');
  const label = li >= 0 && li < dd ? argv[li + 1] : argv.slice(dd + 1).join(' ').slice(0, 120);
  const cmd = argv.slice(dd + 1);
  let waited = 0;
  for (;;) {
    const holder = tryLock(label);
    if (!holder) break;
    if (waited % 60000 === 0) console.error(`[heavy] waiting for lock held by pid ${holder.pid} (${holder.label})`);
    sleep(5000); waited += 5000;
  }
  const release = () => { try { fs.rmSync(LOCK, { recursive: true, force: true }); } catch { /* gone */ } };
  process.on('exit', release);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { release(); process.exit(130); });
  waited = 0;
  for (;;) {
    const r = spawnSync(process.execPath, [BUSY], { encoding: 'utf8' });
    if (r.status === 0) break;
    if (waited % 60000 === 0) console.error(`[heavy] PC busy, waiting: ${(r.stdout || '').trim().split('\n')[0]}`);
    sleep(15000); waited += 15000;
  }
  const child = spawn(cmd[0], cmd.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' && !/\.exe$|^node$/i.test(cmd[0]) });
  child.on('exit', (code, sig) => { release(); process.exit(code === null ? 1 : code); });
}

main();
